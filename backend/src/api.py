# backend/src/api.py
#
# Week 2, slice 1: app skeleton + /health + GET /wells.
# Not the full API contract (§5) yet — just enough to prove FastAPI -> DB ->
# response works end to end, on the lowest-stakes endpoint, before the other
# four endpoints reuse this same pattern.

import os
from contextlib import contextmanager

import math

from fastapi import HTTPException

import psycopg2
import psycopg2.extras
import re
from psycopg2 import pool
from fastapi import FastAPI
from pydantic import BaseModel
from google import genai

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="GroundLog API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://slb-groundlog.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def find_mentioned_curve(question: str, available_curves: list[str]) -> str | None:
    for curve in available_curves:
        if re.search(rf"\b{re.escape(curve)}\b", question, re.IGNORECASE):
            return curve
    return None

QUALITY_KEYWORDS = [
    "flag", "flagged", "quality", "problem", "issue",
    "gap", "missing", "flatline", "duplicate", "out of range",
]

def is_quality_question(question: str) -> bool:
    question_lower = question.lower()
    return any(keyword in question_lower for keyword in QUALITY_KEYWORDS)

def get_curve_summary(cur, well_id: int, mnemonic: str) -> dict | None:
    cur.execute(
        "SELECT unit, readings FROM curves WHERE well_id = %s AND mnemonic = %s;",
        (well_id, mnemonic),
    )
    row = cur.fetchone()
    if row is None:
        return None

    values = [v for v in row["readings"] if not math.isnan(v)]
    if not values:
        return {"mnemonic": mnemonic, "unit": row["unit"], "count": 0, "min": None, "max": None, "mean": None}

    return {
        "mnemonic": mnemonic,
        "unit": row["unit"],
        "count": len(values),
        "min": min(values),
        "max": max(values),
        "mean": sum(values) / len(values),
    }

def get_quality_flags(cur, well_id: int) -> list[dict]:
    cur.execute(
        """
        SELECT flag_type, curve, depth_start, depth_end, detail
        FROM quality_flags
        WHERE well_id = %s
        ORDER BY flag_type, curve, depth_start;
        """,
        (well_id,),
    )
    return cur.fetchall()

def summarize_quality_flags(flags: list[dict]) -> dict:
    summary = {}
    for flag in flags:
        flag_type = flag["flag_type"]
        curve = flag["curve"]
        entry = summary.setdefault(flag_type, {"count": 0, "curves": set()})
        entry["count"] += 1
        if curve:
            entry["curves"].add(curve)

    return {
        flag_type: {"count": data["count"], "curves": sorted(data["curves"])}
        for flag_type, data in summary.items()
    }

# Constructed lazily, on first real use - not at import time. Importing
# this module (which every test file has to do to get `app`) shouldn't
# require a live API key just to build an object nothing in that import
# path actually calls. This also means tests that mock call_llm() outright
# never touch the real client at all.
_genai_client = None

def get_genai_client():
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client()
    return _genai_client

def call_llm(prompt: str) -> str:
    interaction = get_genai_client().interactions.create(
        model="gemini-3.6-flash",
        input=prompt,
        timeout=60,
    )
    return interaction.output_text

def build_grounded_prompt(context: dict, question: str) -> str:
    return f"""You are answering a question about well-log data using ONLY the information given below. Do not use any outside knowledge about oil and gas wells, geology, or typical values.

DATA:
{context}

QUESTION:
{question}

Instructions:
- Answer using ONLY the DATA above.
- If the DATA above does not contain enough information to answer the question, respond with exactly the single word: INSUFFICIENT_DATA
- Otherwise, give a short, direct answer, referencing specific numbers from the DATA.
"""


def interpret_llm_response(raw_response: str) -> tuple[bool, str]:
    if "INSUFFICIENT_DATA" in raw_response:
        return False, "The available data doesn't support answering that question."
    return True, raw_response.strip()

# A connection POOL, not one connection per request. las_parser.py shells out
# to `psql` as a subprocess per statement - fine for one-time batch loading,
# wrong for a live API, since spawning a process and re-authenticating on
# every HTTP request is slow and won't hold up under concurrent load. Batch
# and interactive workloads earn different data-access patterns; this isn't
# an inconsistency with the ingestion script, it's a deliberate split.
#
# DATABASE_URL, when set, is a full connection string (Neon in dev/prod,
# eventually Render) and takes priority. Falling back to the discrete
# GROUNDLOG_DB_* vars keeps the original local-Postgres workflow working
# unchanged when DATABASE_URL isn't set at all.
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    DB_POOL = psycopg2.pool.SimpleConnectionPool(
        minconn=1,
        maxconn=5,
        dsn=DATABASE_URL,
    )
else:
    DB_POOL = psycopg2.pool.SimpleConnectionPool(
        minconn=1,
        maxconn=5,
        dbname=os.environ.get("GROUNDLOG_DB", "groundlog"),
        user=os.environ.get("GROUNDLOG_DB_USER", "postgres"),
        # Reuses the same PGPASSWORD env var your psql workflow already relies
        # on - one config convention, not two.
        password=os.environ.get("PGPASSWORD"),
        host=os.environ.get("GROUNDLOG_DB_HOST", "localhost"),
    )


@contextmanager
def get_db_cursor():
    """Borrow a connection from the pool, hand back a cursor, always return
    the connection when the caller's `with` block exits - even on error.

    Neon's compute auto-suspends after a few idle minutes and drops its
    connections when it does; this pool is long-lived across that cycle
    independently of Neon's, so a pooled connection can go stale while
    this process keeps running. A cheap SELECT 1 catches that before real
    work runs, discarding and replacing a dead connection instead of
    failing the whole request."""
    conn = DB_POOL.getconn()
    try:
        conn.cursor().execute("SELECT 1;")
    except psycopg2.OperationalError:
        DB_POOL.putconn(conn, close=True)
        conn = DB_POOL.getconn()

    try:
        # RealDictCursor: rows come back as {"name": ...} not row[1].
        # Positional indexing breaks silently the moment someone reorders
        # or adds a SELECT column. Slightly more typing now, one fewer
        # 2am bug later.
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        conn.commit()
    finally:
        DB_POOL.putconn(conn)


@app.get("/health")
def health():
    return {"status": "ok"}


# Pydantic models aren't just input validation - they're a contract. The
# DB's actual row shape never leaks straight to a client; this is what gets
# returned, deliberately, regardless of what the query happens to select.
class DepthRange(BaseModel):
    start: float
    stop: float

class Location(BaseModel):
    lat: float
    lon: float

class WellSummary(BaseModel):
    id: int
    name: str
    quality_status: str
    depth_range: DepthRange
    curve_count: int
    location: Location | None = None


@app.get("/wells", response_model=list[WellSummary])
def list_wells():
    with get_db_cursor() as cur:
        # One query, not N+1: count distinct curves and distinct flags per
        # well via LEFT JOINs, so a well with zero curves/flags still shows
        # up (LEFT, not INNER) instead of silently disappearing.
        cur.execute("""
            SELECT
                w.id,
                w.name,
                w.start_depth,
                w.stop_depth,
                w.latitude,
                w.longitude,
                COUNT(DISTINCT c.mnemonic) AS curve_count,
                COUNT(DISTINCT q.id) AS flag_count
            FROM wells w
            LEFT JOIN curves c ON c.well_id = w.id
            LEFT JOIN quality_flags q ON q.well_id = w.id
            GROUP BY w.id, w.name, w.start_depth, w.stop_depth, w.latitude, w.longitude
            ORDER BY w.id;
        """)
        rows = cur.fetchall()

    return [
        WellSummary(
            id=row["id"],
            name=row["name"],
            # quality_status is derived, not stored - "flagged" if this well
            # has any row in quality_flags at all, "clean" otherwise.
            quality_status="flagged" if row["flag_count"] > 0 else "clean",
            depth_range=DepthRange(start=row["start_depth"], stop=row["stop_depth"]),
            curve_count=row["curve_count"],
            location=Location(lat=row["latitude"], lon=row["longitude"]) if row["latitude"] is not None else None,
        )
        for row in rows
    ]

# NOT in this file, on purpose: the X-API-Key auth §5 calls for eventually.
# Stated and deferred, not forgotten.

class QualityFlag(BaseModel):
    flag_type: str
    curve: str | None
    depth_start: float | None
    depth_end: float | None
    detail: str


class WellDetail(BaseModel):
    id: int
    name: str
    start_depth: float
    stop_depth: float
    curves: list[str]
    quality_flags: list[QualityFlag]


# well_id: int in the path means FastAPI rejects a non-integer path segment
# with a 422 automatically - free validation, no code needed for that case.
@app.get("/wells/{well_id}", response_model=WellDetail)
def get_well(well_id: int):
    with get_db_cursor() as cur:
        # %s + a params tuple, NOT an f-string. well_id came from the
        # request - this is the actual line standing between this endpoint
        # and SQL injection, not a style choice.
        cur.execute(
            "SELECT id, name, start_depth, stop_depth FROM wells WHERE id = %s;",
            (well_id,),
        )
        well = cur.fetchone()
        if well is None:
            # A missing well is a normal, expected case for a client to hit
            # (bad ID, deleted well) - it gets a real 404, not a 200 with an
            # empty body or a 500 from an unhandled None downstream.
            raise HTTPException(status_code=404, detail=f"Well {well_id} not found")

        cur.execute(
            "SELECT DISTINCT mnemonic FROM curves WHERE well_id = %s ORDER BY mnemonic;",
            (well_id,),
        )
        curves = [row["mnemonic"] for row in cur.fetchall()]

        cur.execute(
            """
            SELECT flag_type, curve, depth_start, depth_end, detail
            FROM quality_flags
            WHERE well_id = %s
            ORDER BY flag_type, curve, depth_start;
            """,
            (well_id,),
        )
        flags = [QualityFlag(**row) for row in cur.fetchall()]

    return WellDetail(
        id=well["id"],
        name=well["name"],
        start_depth=well["start_depth"],
        stop_depth=well["stop_depth"],
        curves=curves,
        quality_flags=flags,
    )

class CurveSeries(BaseModel):
    mnemonic: str
    unit: str
    depths: list[float]
    values: list[float | None]


# Note: PRD's documented shape calls this field "values"; the DB column
# it's read from is named "readings" (see sql/schema.sql). Deliberate -
# API response field names don't have to mirror internal column names.
@app.get("/wells/{well_id}/curves/{mnemonic}", response_model=CurveSeries)
def get_curve(well_id: int, mnemonic: str):
    with get_db_cursor() as cur:
        # mnemonic is untrusted path input just like well_id was -
        # %s-parameterized for the same SQL-injection reason as before.
        cur.execute(
            "SELECT mnemonic, unit, depths, readings FROM curves WHERE well_id = %s AND mnemonic = %s;",
            (well_id, mnemonic),
        )
        row = cur.fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"No curve '{mnemonic}' found for well {well_id}",
        )

    # NaN -> None. JSON has no NaN token; Python's json module will emit a
    # literal `NaN` anyway if you let it, which is invalid JSON and will
    # break strict JSON.parse() downstream. This is the actual fix, not a
    # style choice.
    clean_values = [None if math.isnan(v) else v for v in row["readings"]]

    return CurveSeries(
        mnemonic=row["mnemonic"],
        unit=row["unit"],
        depths=row["depths"],
        values=clean_values,
    )

class QueryRequest(BaseModel):
    question: str

class QueryResponse(BaseModel):
    grounded: bool
    answer: str
    citation: str | None = None

@app.post("/wells/{well_id}/query", response_model=QueryResponse)
def query_well(well_id: int, request: QueryRequest):
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM wells WHERE id = %s;", (well_id,))
        well = cur.fetchone()
        if well is None:
            raise HTTPException(status_code=404, detail=f"Well {well_id} not found")

        cur.execute(
            "SELECT DISTINCT mnemonic FROM curves WHERE well_id = %s ORDER BY mnemonic;",
            (well_id,),
        )
        available_curves = [row["mnemonic"] for row in cur.fetchall()]
    
    mentioned_curve = find_mentioned_curve(request.question, available_curves)

    if mentioned_curve:
        with get_db_cursor() as cur:
            summary = get_curve_summary(cur, well_id, mentioned_curve)
        prompt = build_grounded_prompt(summary, request.question)
        raw = call_llm(prompt)
        grounded, answer = interpret_llm_response(raw)
        return QueryResponse(
            grounded=grounded,
            answer=answer,
            citation=f"well {well_id}, curve {mentioned_curve}" if grounded else None,
        )
    elif is_quality_question(request.question):
        with get_db_cursor() as cur:
            flags = get_quality_flags(cur, well_id)
        summary = summarize_quality_flags(flags)
        prompt = build_grounded_prompt(summary, request.question)
        raw = call_llm(prompt)
        grounded, answer = interpret_llm_response(raw)
        return QueryResponse(
            grounded=grounded,
            answer=answer,
            citation=f"well {well_id} quality_flags" if grounded else None,
        )
    else:
        # No curve name or quality keyword matched - but that's no longer a
        # reason to skip the LLM. We hand it an explicit "nothing found"
        # context instead of real data, and let build_grounded_prompt's own
        # instructions + interpret_llm_response's sentinel check decide the
        # refusal. This is a real model call, not a canned string - the
        # model can genuinely say something other than INSUFFICIENT_DATA if
        # it ignores instructions, and the benchmark should catch that if
        # it happens.
        #
        # citation is always None here regardless of what the model
        # returns: there is no retrieved record in this branch, so there is
        # nothing honest to cite even if the model claims groundedness.
        context = {
            "status": "no_matching_data",
            "explanation": "No curve or quality-flag data in this well matches what this question is asking about.",
        }
        prompt = build_grounded_prompt(context, request.question)
        raw = call_llm(prompt)
        grounded, answer = interpret_llm_response(raw)
        return QueryResponse(
            grounded=grounded,
            answer=answer,
            citation=None,
        )