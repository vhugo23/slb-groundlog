# GroundLog — Design Decisions, Mapped to Evidence

This document does one thing: for every real engineering decision in this project, it names the specific SLB evidence behind it and rates how directly that evidence supports the decision — using the same High/Medium/Low confidence discipline the research dossier behind this project was built on. Collapsing "the posting said X" into "SLB wants X" is exactly the mistake that discipline exists to avoid, and this writeup tries not to make it. Where a decision serves the booth demo rather than a sourced problem, or where this project's own thinking changed since the original plan, that's stated plainly rather than smoothed over.

Structured for the two audiences the PRD itself names: a skimmable table for a 60–90 second conversation, then the detail for a 30–45 minute "walk me through it" follow-up.

## The chain

> SLB → Digital/subsurface data business → fragmented legacy data feeding physically consequential AI recommendations → need for a data-quality layer and grounded, evaluated AI reasoning on top of it → this project.

Every decision below traces back to some link in that chain, sourced from live job postings and SLB's own investor/executive materials — not from "a technology I wanted to learn."

## The 90-second version

| Decision | SLB evidence | Confidence |
|---|---|---|
| Ingestion + 4 automated quality checks on real, messy data | "Silent data corruption at ingestion" and "schema drift" are named, documented failure patterns in SLB's own OSDU ecosystem | High |
| Grounded query engine: retrieval → LLM → citation → explicit refusal | CEO: SLB's AI has moved "beyond simple application features to foundation models... enabling autonomous operations" — autonomous recommendations on ungrounded data is the named risk | High (the strategic bet); Medium (that grounding/refusal is the right engineering answer — this project's synthesis) |
| Benchmark harness scoring accuracy, refusal rate, groundedness | "Benchmark datasets, evaluation metrics, and acceptance criteria" — named independently in two separate live postings | High |
| REST API, parameterized SQL throughout, tests + CI | "Elastically scalable and secure by design/default" (Full Stack SWE posting); CI/CD named directly (Cloud SWE posting) | High |
| Map frontend, SLB technology-center layer | Not JD-evidenced — a demo-necessity layer, stated as such | — (explicitly not a claimed match) |
| No Kubernetes, no multi-tenant auth, no distributed tracing | None of the four sourced postings are entry-level (all require 4+ years or an MS/PhD) — building to a senior-req's infra bar would be the wrong kind of over-engineering for what's actually being evaluated | High (the seniority gates); Medium (the scoping conclusion drawn from them) |

## The detailed version

### 1. Why a data-quality pipeline at all

SLB's own ecosystem has documented "ingest first, fix later" as a named anti-pattern, alongside schema drift and legacy-format non-compliance, in a first-party OSDU integrator's own writeup (High confidence — this is one of the few genuinely sourced incident-shaped artifacts in the whole research dossier, flagged in file 10 as doing "a lot of evidentiary work" precisely because so little else is public). A project that only demonstrates cleaning/normalizing data would be answering a problem SLB mostly already solved in 2019 with OSDU (file 11) — so ingestion had to be paired with something that uses the cleaned data for a harder claim, not left as the whole project.

What got built: a real LAS 2.0 parser (`lasio`) over five real Volve field wells, four quality checks (`duplicate_depth`, `curve_gap`, `flatline`, `out_of_range`), each producing a flag rather than rejecting the well — because a real ingestion pipeline that silently drops imperfect real-world data is worse than one that surfaces the imperfection and keeps going.

**What this looked like in practice, not just in theory:** the flatline check's tolerance was originally one fixed number applied to every curve regardless of physical scale — correct-ish for a 0–250 range curve, wildly wrong for a curve whose entire meaningful range is a few tenths of a unit. It took three iterations, each verified against real data before touching the live database, to land on a percentile-relative tolerance that behaves sanely across curves with very different scales — including one iteration that, caught early, would have quietly shipped worse false-positive noise than the bug it was fixing. Separately, expanding the out-of-range check's reference table surfaced a real per-curve null-sentinel bug: one curve on one well used a different "missing value" convention than the file's own declared header value, which `lasio` doesn't catch because it only matches exact declared values — a genuine instance of the "legacy apps only partially comply with the standard" problem named in the SLB research, found in five real wells, not staged.

### 2. Why a grounded query engine, not just a chatbot

The opportunity matrix scored a generic "oil & gas AI chatbot" at one star specifically because it touches AI-cluster keywords without mapping to any named strategic priority or demonstrating real technical depth. What SLB's own materials actually name as the priority is autonomous AI reasoning *on top of clean data* — the CEO's own language about moving "beyond simple application features to foundation models... enabling autonomous operations," backed by a stated $2B 2030 digital-ARR target, not five-year-old digital-transformation language. The risk implicit in that bet — confident recommendations sitting on ungrounded data — is this project's actual thesis.

What got built: retrieval here is not vector-search RAG, on purpose — this is structured data, so "retrieval" means fetching the exact Postgres records a question needs (a curve's summary stats, or a well's quality-flag summary), never passing raw rows to the model. The LLM receives only those retrieved records with an explicit instruction to answer strictly from what's given or say so plainly if it can't; a citation is attached only when the answer is actually grounded, since a refusal citing a source would be a self-contradiction.

**The honest evolution of this decision:** the first working version routed any question that didn't match a known curve or quality keyword straight to a hardcoded refusal string, without ever calling the LLM — a real gap, since it meant the "the model says INSUFFICIENT_DATA when it doesn't know" claim only actually got exercised by questions that happened to match the router. Fixed by routing every question through the model, with an explicit "no matching data" context on the fallback path — and hard-coding the citation to `None` on that path regardless of what the model claims, since there's no real retrieved record to honestly cite even if the model ignores its instructions. That fix, and the two new benchmark cases written to actually exercise it (a real wireline mnemonic this dataset doesn't carry, and a legitimate-sounding metadata question the router doesn't recognize), is a small, direct rehearsal of exactly the "does the system know what it doesn't know" question the benchmark harness exists to answer.

### 3. Why the benchmark harness is the single most load-bearing decision here

"Benchmark datasets, evaluation metrics, and acceptance criteria" is not a phrase invented for this project — it appears, independently sourced, in more than one live SLB posting, which is the strongest, most-repeated piece of evidence in the entire research dossier. Most of what a project could build is a judgment call