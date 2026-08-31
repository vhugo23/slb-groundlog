# Diagnostics

One-off investigation scripts kept as committed documentation of real debugging done during this project (the flatline-tolerance saga, the RXO null-sentinel bug, early LLM/prompt experiments) — not part of the running application, and not meant to be re-run routinely.

**Run these from `backend/`, not from inside this folder** — they read sample data via paths relative to `backend/` (e.g. `sample_data/force2020/*.las`):

```powershell
cd backend
python diagnostics/verify_flatline_fix.py
```