# backend/benchmark/test_cases.py
#
# PRD §10: a small, versioned test set. Every case names the well it targets
# (curve lists and flag types differ per well, so "unanswerable" only means
# something relative to a specific well's actual data) and the grounded
# value we expect back.

TEST_CASES = [
    # Golden set: questions this well's real, ingested data supports.
    {"well_id": 1, "question": "what does the GR log show", "type": "golden", "expect_grounded": True},
    {"well_id": 1, "question": "does this well have any quality flags", "type": "golden", "expect_grounded": True},
    {"well_id": 1, "question": "what is the range of NPHI values", "type": "golden", "expect_grounded": True},
    {"well_id": 1, "question": "are there any flatline flags on this well", "type": "golden", "expect_grounded": True},

    # Unanswerable set: nothing in this well's data could support an answer.
    {"well_id": 1, "question": "what is the weather like today", "type": "unanswerable", "expect_grounded": False},
    {"well_id": 1, "question": "who is the president of the united states", "type": "unanswerable", "expect_grounded": False},
]