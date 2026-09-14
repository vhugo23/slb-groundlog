# SLB GroundLog

![CI](https://github.com/vhugo23/slb-groundlog/actions/workflows/ci.yml/badge.svg)

A grounded query platform over subsurface well-log data: ingest real LAS files, automatically flag what's wrong with the data, and answer natural-language questions about a well **only from records it can cite** — refusing outright when the data doesn't support a claim.

**Live:** frontend on [Vercel](https://slb-groundlog.vercel.app) · backend on [Render](https://slb-groundlog.onrender.com) — free tier, so the first request after a period of inactivity can take 50+ seconds to wake up.

## Why this exists

SLB's Digital division is the company's smallest business by revenue and its fastest-growing, and SLB has put numbers on where that growth is supposed to come from: a target to double Digital ARR to $2 billion and adjusted EBITDA to $1.8–2 billion by 2030, on top of $3 billion already invested in Delfi/Lumi R&D since 2016 (2026 Digital Investor Day materials). In February 2026, CEO Olivier Le Peuch described SLB's AI as having moved "beyond simple application features to foundation models with deep domain expertise enabling autonomous operations," with 150+ AI-enabled applications already deployed across drilling risk prediction, maintenance forecasting, and production optimization (THRIVE Energy Conference, Feb 2026).

That bet sits on top of a real, documented problem: decades of subsurface data trapped in incompatible legacy formats — LAS well logs, SEG-Y seismic, proprietary Petrel/Techlog project files. SLB open-sourced OSDU in 2019 specifically to unify that data, and OSDU's own integrator ecosystem still documents "ingest first, fix later" as a live anti-pattern, alongside ongoing schema drift and legacy-app non-compliance. Feeding an autonomous AI layer from a data layer with that history is exactly the risk SLB's own product messaging is careful about: Tela, SLB's agentic assistant, markets itself around "physics-informed reasoning" rather than generic chat, because a bad recommendation on a drilling operation is a safety incident, not a UX complaint. It's a caution the whole industry shares, in different doses — Baker Hughes' equivalent (Leucipa/Cordant) is explicitly positioned as a "trusted assistant" that stops short of autonomous decision-making, even as SLB's own Tela includes an autonomous tier by design. Whichever posture a company takes on autonomy, the requirement underneath is the same: the AI has to be checkable against real data, not just plausible-sounding.

GroundLog is a small, honest proof of that specific requirement — a data-quality pipeline that surfaces exactly what's wrong with ingested well-log data, paired with a query layer that answers only from records it can cite and refuses outright when it can't. It's also a direct answer to something SLB's own hiring language asks for: live postings for AI-adjacent roles name "benchmark datasets, evaluation metrics, and acceptance criteria" as an explicit deliverable, which is why this project ships with its own versioned benchmark harness instead of a demo that just looks like it works.

**Worth being direct about:** this reasoning is this project's own synthesis of SLB's public materials — investor-day filings, executive statements, job postings, competitor positioning — not a claim about SLB's internal org structure, a specific team, or anything SLB has said about what a candidate should build. It's a defensible hypothesis, not a confirmed brief.

## Architecture

```
Frontend (React/TS/Leaflet)
   Overview   — dataset-wide metrics, live flag-type breakdown, map preview
   Wells      — searchable inventory, status + issue counts per well
   Workspace  — per-well quality summary, aligned multi-curve log viewer,
                filterable flag table, grounded query panel
   Explore Map — well cluster (live, queryable) + SLB technology centers
                 (static, demo layer) as two independently-toggleable layers
        │  REST (JSON)
        ▼
API service (FastAPI, psycopg2 connection pool)
        │
        ├── Ingestion + quality layer (lasio parser, 4 quality checks)
        ├── Grounded query engine (retrieval → LLM → citation → refusal)
        └── Benchmark / eval harness (golden + unanswerable sets)
        │
        ▼
Postgres: wells / curves / quality_flags
```

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

- **Frontend**: a four-page app (Overview, Wells, Well Workspace, Explore Map) built around one design system — dark ink-navy sidebar nav, a dedicated logging-teal accent kept visually separate from the three semantic status colors, and IBM Plex Sans/Mono throughout, so status color and interaction color never collide. The well-log viewer renders up to four curve tracks on a shared depth axis with hover readouts, flatline/out-of-range bands shaded directly on the affected curve, and null gaps preserved as real breaks in the line rather than interpolated across. All status-color pairs were checked against real WCAG contrast ratios (not eyeballed) and darkened where they fell short of 4.5:1.
- **API** (`GET /wells`, `GET /wells/{id}`, `GET /wells/{id}/curves/{mnemonic}`, `POST /wells/{id}/query`, `GET /health`) — connection-pooled, parameterized, Pydantic response models throughout.
- **Grounded query engine**: this is structured data, not free text, so retrieval here means fetching exact records (a curve's summary stats, or a well's quality-flag summary) from Postgres — not vector search. The LLM (Gemini) receives only those retrieved records plus an explicit instruction to answer strictly from what's given, or say so plainly if it can't. A citation is attached only when the model's answer is grounded; a question that matches nothing still goes to the model, with an explicit "no matching data" context, so a refusal reflects the model's own judgment rather than a keyword filter deciding before the model is ever consulted — and no citation is ever fabricated for that fallback path, regardless of what the model claims.
- **Benchmark harness**: a small, versioned test set (`benchmark/test_cases.py`) run end to end against the live API, independently re-checking ground truth from the `GET` endpoints rather than trusting the query engine's own internals. Reports three metrics: query accuracy (golden set), refusal rate (unanswerable set), and groundedness rate (does the citation actually support the claim).
- **Tests & CI**: a `pytest` suite (`backend/tests/`) exercises every endpoint against a real Postgres fixture, with the LLM call mocked so the suite runs free of any external API dependency. GitHub Actions runs it on every push against a fresh Postgres service container.
- **Production hardening**: two real post-deployment incidents, found live and fixed, not hypothetical. A pooled Postgres connection could go stale after Neon's free-tier compute auto-suspended from inactivity — fixed with a cheap `SELECT 1` health check that discards and replaces a dead connection before the real query runs. Separately, Gemini's free-tier rate limit was surfacing as client-side timeouts instead of a clean `429` — fixed with a one-time retry on transient errors in `call_llm()`, plus slowing the benchmark's own request pacing to match the real per-minute cap it had been exceeding.

## Data

Real well-log data from the Volve field (FORCE 2020 Lithofacies dataset), 5 wells, ingested as-is with all their real messiness — duplicate depths, sensor gaps, tool-fault flatlines, and at least one genuinely mislabeled null convention this project found and fixed. At real scale, that's roughly 28 MB of source LAS files, 83 stored curve series, and about 1.75M depth/value pairs — computed directly from the same files the ingestion pipeline reads.

## Project structure

```
backend/
  src/          api.py, las_parser.py, quality_checks.py
  scripts/      one-off/maintenance scripts (recompute flags, backfill locations, ...)
  benchmark/    test_cases.py, run_benchmark.py
  tests/        pytest suite + Postgres fixture
  sql/          schema.sql
  sample_data/  real Volve LAS files
frontend/
  src/
    App.tsx       thin top-level component: route switch + top-level state
    api.ts        typed fetch helpers, shared API types
    components/   OverviewPage, WellsPage, WellWorkspace, ExploreMap,
                  WellLogViewer, LogTrack, GroundedQueryPanel, ...
    hooks/        useWells, useWellDetail, useAllWellDetails, useRoute
    data/         static SLB technology-center data
    styles/       tokens.css (design tokens), base.css (shared primitives)
.github/workflows/ci.yml
```

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

## Talking to the query engine

The query endpoint isn't free-text NLU — it's deliberately simple and inspectable. `POST /wells/{well_id}/query` with `{"question": "..."}` checks your question for two things before it ever calls the LLM:

1. **An exact curve mnemonic**, case-insensitive, as a whole word (e.g. `GR`, `NPHI`) — if one of the well's real curves is named in the question, that curve's summary stats get fetched and handed to the model.
2. **A quality-flag keyword** — `flag`, `flagged`, `quality`, `problem`, `issue`, `gap`, `missing`, `flatline`, `duplicate`, `out of range` — matched anywhere in the question, which fetches that well's quality-flag list instead.

Match neither, and the question still goes to Gemini — just with no real data behind it, so a correct answer is a refusal, not a guess.

Curve mnemonics differ per well (16–18 curves each); `GET /wells/{well_id}` lists exactly what's available before you query. For well 1 (15/9-13), the queryable curves are: `CALI`, `MUDWEIGHT`, `ROP`, `RDEP`, `RSHA`, `RMED`, `RXO`, `SP`, `DTC`, `NPHI`, `PEF`, `GR`, `RHOB`, `DRHO`.

```bash
curl -X POST https://slb-groundlog.onrender.com/wells/1/query \
  -H "Content-Type: application/json" \
  -d '{"question": "what does the GR log show"}'
# {"grounded": true, "answer": "...", "citation": "well 1, curve GR"}
```

Questions verified against the live benchmark set (`backend/benchmark/test_cases.py`):

| Question | What happens | Why |
|---|---|---|
| "what does the GR log show" | Grounded, cites `well 1, curve GR` | `GR` is a real curve on this well |
| "are there any flatline flags on this well" | Grounded, cites `well 1 quality_flags` | `flatline` is a quality keyword |
| "what is the range of NPHI values" | Grounded, cites `well 1, curve NPHI` | `NPHI` is a real curve |
| "what is the ILD reading" | Refused | `ILD` isn't in this dataset — the resistivity curves here are `RDEP`/`RMED`/`RSHA`/`RXO` instead |
| "how deep was this well drilled" | Refused | depth range is well metadata, not a curve or quality keyword this path recognizes |
| "what is the weather like today" | Refused | no curve or keyword match, and nothing for the model to ground an answer in either |

That last distinction is the point: a refusal on "ILD reading" and a refusal on "weather today" happen through the same code path, but only one of them is really "no data for this" versus "not even a real well-log question" — the model, not a keyword filter, is what tells those two apart.

## Known limitations — stated honestly, not glossed over

- `PHYSICAL_RANGES` bounds (the `out_of_range` check) are illustrative plausibility bounds calibrated against this dataset's real observed values, not certified petrophysical QC thresholds.
- Two curves (`MUDWEIGHT`, `ROPA`) are deliberately excluded from range-checking — their unit field is an undocumented placeholder in these files, and guessing a bound without a real unit convention would be less honest than skipping it.
- The near-vertical-well assumption behind excluding `X_LOC`/`Y_LOC` from quality checks was verified against real coordinate drift (6–50m across ~3000m of depth per well), not just asserted.
- API authentication (`X-API-Key`) is deliberately deferred — this is a demo service, not a multi-tenant product — and stated as such rather than forgotten.
- The query engine answers single-curve or single-quality-flag questions; it doesn't yet reason across multiple curves in one question.
- Gemini's free-tier request quota is small enough that sustained interactive use (or repeated benchmark runs) can hit a real rate limit — discovered directly while building this, not a hypothetical.
- No database indexes beyond what the primary keys create implicitly — `quality_flags.well_id` is filtered directly in `GET /wells/{id}` but does a full sequential scan; fine at the current ~1,800-row scale, a real gap at a bigger one.
- No upsert/dedup logic on ingestion — re-running the ingestion script against the same LAS file creates a duplicate well row instead of updating the existing one.
- No formal migration framework — `schema.sql` is a single static file, applied once; schema changes are made by editing it directly rather than through versioned migrations.
- The frontend's accessibility work covers real WCAG contrast checks and keyboard-reachable focus states by construction (everything interactive is a real `<button>`/`<input>`, nothing is a click handler on a bare `<div>`) — but it hasn't had an actual screen-reader or full manual keyboard walkthrough, so that's a verified-on-paper, not verified-in-use, claim.

## Data source

Well-log data from the [FORCE 2020 Lithofacies Prediction](https://xeek.ai/challenges/force-well-logs) dataset (Volve field, Equinor), used under its open license for this non-commercial demo.