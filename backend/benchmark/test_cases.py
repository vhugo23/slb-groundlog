# backend/benchmark/test_cases.py
#
# PRD §10: a small, versioned test set. Every case names the well it targets
# (curve lists and flag types differ per well, so "unanswerable" only means
# something relative to a specific well's actual data) and the grounded
# value we expect back. Golden cases can optionally name a "curve" (to
# independently verify a stat from /curves against the LLM's answer text)
# or a "flag_type" (to independently verify a flag count the same way).

TEST_CASES = [
    # Golden set: questions this well's real, ingested data supports.
    {"well_id": 1, "question": "what does the GR log show", "type": "golden", "expect_grounded": True, "curve": "GR", "check_stat": "max"},
    {"well_id": 1, "question": "does this well have any quality flags", "type": "golden", "expect_grounded": True, "flag_type": "flatline"},
    {"well_id": 1, "question": "what is the range of NPHI values", "type": "golden", "expect_grounded": True, "curve": "NPHI", "check_stat": "max"},
    {"well_id": 1, "question": "are there any flatline flags on this well", "type": "golden", "expect_grounded": True, "flag_type": "flatline"},

    # Unanswerable set: nothing in this well's data could support an answer.
    {"well_id": 1, "question": "what is the weather like today", "type": "unanswerable", "expect_grounded": False},
    {"well_id": 1, "question": "who is the president of the united states", "type": "unanswerable", "expect_grounded": False},

    # Borderline unanswerable: legitimate-sounding well-log questions that
    # still don't match any curve this well has or any quality keyword -
    # these are the cases that used to get a canned refusal without ever
    # reaching the LLM, and now genuinely exercise the model's own
    # INSUFFICIENT_DATA judgment instead.
    {"well_id": 1, "question": "what is the ILD reading", "type": "unanswerable", "expect_grounded": False},
    {"well_id": 1, "question": "how deep was this well drilled", "type": "unanswerable", "expect_grounded": False},
]