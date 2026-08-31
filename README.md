# SLB GroundLog

![CI](https://github.com/vhugo23/slb-groundlog/actions/workflows/ci.yml/badge.svg)

A grounded query platform over subsurface well-log data: ingest real LAS files, automatically flag what's wrong with the data, and answer natural-language questions about a well **only from records it can cite** — refusing outright when the data doesn't support a claim.

## Why this exists

SLB's subsurface data is fragmented across legacy formats, and the company has bet its next decade of digital growth on AI that reasons over that data — the kind of confident recommendation sitting on top of unreliable input is the actual risk. Live SLB job postings name "benchmark datasets, evaluation metrics, and acceptance criteria" as a real deliverable. GroundLog is a small, honest proof of that pattern: a data-quality pipeline paired with a grounded, *evaluated* query layer, built solo and defensible end to end — not a demo that only looks like it works.

## Architecture
Frontend (React/TS/Leaflet)
world map: SLB technology centers (static, demo layer)

well cluster (live, queryable, colored by quality status)
│ REST (JSON)
▼
API service (FastAPI, psycopg2 connection pool)
│
┌────┴─────────────────┬───────────────────────┐
▼ ▼ ▼
Ingestion + quality Grounded query engine Benchmark / eval
layer (lasio parser, (retrieval → LLM → harness (golden +
4 quality checks) citation → refusal) unanswerable sets)
│
▼
Postgres: wells / curves / quality_flags


## What's built

- **Ingestion**: real LAS 2.0 parsing via `lasio`, loading into Postgres via parameterized `psycopg2` (no raw SQL string-building anywhere in the pipeline).
- **Quality checks**, each producing a flag rather than rejecting the well:

| Check | Trigger |
|---|---|
| `duplicate_depth` | Same depth value appears more than once in the index |
| `curve_gap` | ≥3 consecutive missing samples in a curve |
| `flatline` | ≥20 consecutive near-identical values, tolerance scaled to that curve's own value range (5th–95th percentile) |
| `out_of_range` | Value outside a curve's plausible physical range, checked against a 16-curve reference table |

  A separate sanitization pass also catches per-curve null sentinels (e.g. `-999.9`) that don't match a file's globally declared `NULL` header value — a real bug found and fixed against real data, not a synthetic case.

- **API** (`GET /wells`, `GET /wells/{id}`, `GET /wells/{id}/curves/{mnemonic}`, `POST /wells/{id}/query`, `GET /health`) — connection-pooled, parameterized, Pydantic response models throughout.
- **Grounded query engine**: this is structured data, not free text, so retrieval here means fetching exact records (a curve's summary stats, or a well's quality-flag summary) from Postgres — not vector search. The LLM (Gemini) receives only those retrieved records plus an explicit instruction to answer strictly from what's given, or say so plainly if it can't. A citation is attached only when the model's answer is grounded; a question that matches nothing still goes to the model, with an explicit "no matching data" context, so a refusal reflects the model's own judgment rather than a keyword filter deciding before the model is ever consulted — and no citation is ever fabricated for that fallback path, regardless of what the model claims.
- **Benchmark harness**: a small, versioned test set (`benchmark/test_cases.py`) run end to end against the live API, independently re-checking ground truth from the `GET` endpoints rather than trusting the query engine's own internals. Reports three metrics: query accuracy (golden set), refusal rate (unanswerable set), and groundedness rate (does the citation actually support the claim).
- **Tests & CI**: a `pytest` suite (`backend/tests/`) exercises every endpoint against a real Postgres fixture, with the LLM call mocked so the suite runs free of any external API dependency. GitHub Actions runs it on every push against a fresh Postgres service container.

## Data

Real well-log data from the Volve field (FORCE 2020 Lithofacies dataset), 5 wells, ingested as-is with all their real messiness — duplicate depths, sensor gaps, tool-fault flatlines, and at least one genuinely mislabeled null convention this project found and fixed.

## Project structure
backend/
src/ api.py, las_parser.py, quality_checks.py
scripts/ one-off/maintenance scripts (recompute flags, backfill locations, ...)
benchmark/ test_cases.py, run_benchmark.py
tests/ pytest suite + Postgres fixture
sql/ schema.sql
sample_data/ real Volve LAS files
frontend/
src/ React + TypeScript + Vite + react-leaflet
.github/workflows/ci.yml


## Running it locally

**Backend**
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

psql -U postgres -c "CREATE DATABASE groundlog;"
psql -U postgres -d groundlog -f sql/schema.sql

$env:PGPASSWORD = "your-postgres-password"
$env:GEMINI_API_KEY = "your-gemini-api-key"

python src/las_parser.py          # ingests sample_data/force2020/*.las
uvicorn src.api:app --reload
```

`GROUNDLOG_DB` (default `groundlog`), `GROUNDLOG_DB_USER` (default `postgres`), and `GROUNDLOG_DB_HOST` (default `localhost`) only need setting if your local setup differs from those defaults.

**Frontend**
```powershell
cd frontend
npm install
npm run dev
```

**Tests**
```powershell
cd backend
python -m pytest tests/ -v          # fast, no external dependencies
python benchmark/run_benchmark.py   # hits the live server + real Gemini API
```

## Known limitations — stated honestly, not glossed over

- `PHYSICAL_RANGES` bounds (the `out_of_range` check) are illustrative plausibility bounds calibrated against this dataset's real observed values, not certified petrophysical QC thresholds.
- Two curves (`MUDWEIGHT`, `ROPA`) are deliberately excluded from range-checking — their unit field is an undocumented placeholder in these files, and guessing a bound without a real unit convention would be less honest than skipping it.
- The near-vertical-well assumption behind excluding `X_LOC`/`Y_LOC` from quality checks was verified against real coordinate drift (6–50m across ~3000m of depth per well), not just asserted.
- API authentication (`X-API-Key`) is deliberately deferred — this is a demo service, not a multi-tenant product — and stated as such rather than forgotten.
- The query engine answers single-curve or single-quality-flag questions; it doesn't yet reason across multiple curves in one question.
- Gemini's free-tier request quota is small enough that sustained interactive use (or repeated benchmark runs) can hit a real rate limit — discovered directly while building this, not a hypothetical.

## Data source

Well-log data from the [FORCE 2020 Lithofacies Prediction](https://xeek.ai/challenges/force-well-logs) dataset (Volve field, Equinor), used under its open license for this non-commercial demo.