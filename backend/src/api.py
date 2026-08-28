# backend/src/api.py
#
# Week 2, slice 1: app skeleton + /health + GET /wells.
# Not the full API contract (§5) yet — just enough to prove FastAPI -> DB ->
# response works end to end, on the lowest-stakes endpoint, before the other
# four endpoints reuse this same pattern.

import os
from contextlib import contextmanager

from fastapi import HTTPException

import psycopg2
import psycopg2.extras
from psycopg2 import pool
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="GroundLog API")

# A connection POOL, not one connection per request. las_parser.py shells out
# to `psql` as a subprocess per statement - fine for one-time batch loading,
# wrong for a live API, since spawning a process and re-authenticating on
# every HTTP request is slow and won't hold up under concurrent load. Batch
# and interactive workloads earn different data-access patterns; this isn't
# an inconsistency with the ingestion script, it's a deliberate split.
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
    the connection when the caller's `with` block exits - even on error."""
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


class WellSummary(BaseModel):
    id: int
    name: str
    quality_status: str
    depth_range: DepthRange
    curve_count: int


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
                COUNT(DISTINCT c.mnemonic) AS curve_count,
                COUNT(DISTINCT q.id) AS flag_count
            FROM wells w
            LEFT JOIN curves c ON c.well_id = w.id
            LEFT JOIN quality_flags q ON q.well_id = w.id
            GROUP BY w.id, w.name, w.start_depth, w.stop_depth
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