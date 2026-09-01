# backend/benchmark/run_benchmark.py
#
# PRD §10: runs each test case against the live API and reports pass/fail
# plus the three named metrics — query accuracy (golden set), refusal rate
# (unanswerable set), and groundedness rate — measured, not asserted.
#
# Groundedness check: for golden cases that name a "curve" or "flag_type",
# the ground truth is fetched independently from the API's own GET
# endpoints (not from the query engine's LLM path) and compared against
# what the LLM's answer actually says. This is what proves a citation
# supports its claim, rather than just checking the model agreed to answer.

import re
import time
import requests
from test_cases import TEST_CASES

BASE_URL = "http://127.0.0.1:8000"

# The benchmark now calls the LLM on every case, including refusals (that's
# the whole point of the query-engine-honesty fix). That means more real
# Gemini calls per run than before, which makes colliding with the
# free-tier rate limit more likely - not a code bug, just more traffic.
# Retry once or twice with a backoff rather than failing the whole run on
# a transient 429 (which surfaces to us as our own API's 500, since the
# API doesn't distinguish it from any other unhandled exception).
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 15
REQUEST_DELAY_SECONDS = 3

def extract_numbers(text: str) -> list[float]:
    return [float(n) for n in re.findall(r"-?\d+\.\d+|-?\d+", text)]


def answer_mentions_value(answer: str, expected: float, tolerance: float = 0.5) -> bool:
    return any(abs(n - expected) < tolerance for n in extract_numbers(answer))


def get_curve_stat(well_id: int, mnemonic: str, stat: str) -> float:
    response = requests.get(f"{BASE_URL}/wells/{well_id}/curves/{mnemonic}", timeout=60)
    response.raise_for_status()
    values = [v for v in response.json()["values"] if v is not None]
    if stat == "max":
        return max(values)
    elif stat == "min":
        return min(values)
    elif stat == "mean":
        return sum(values) / len(values)
    raise ValueError(f"unknown stat: {stat}")


def get_flag_count(well_id: int, flag_type: str) -> int:
    response = requests.get(f"{BASE_URL}/wells/{well_id}", timeout=30)
    response.raise_for_status()
    flags = response.json()["quality_flags"]
    return sum(1 for f in flags if f["flag_type"] == flag_type)


def check_content(case: dict, answer: str):
    """Returns True/False if a content check applies to this case, None if not."""
    if "curve" in case:
        expected = get_curve_stat(case["well_id"], case["curve"], case["check_stat"])
        return answer_mentions_value(answer, expected)
    if "flag_type" in case:
        expected = get_flag_count(case["well_id"], case["flag_type"])
        return answer_mentions_value(answer, float(expected))
    return None


def run_case(case: dict) -> dict:
    response = None
    for attempt in range(MAX_RETRIES):
        response = requests.post(
            f"{BASE_URL}/wells/{case['well_id']}/query",
            json={"question": case["question"]},
            timeout=60,
        )
        if response.status_code == 500 and attempt < MAX_RETRIES - 1:
            print(f'  (500 on "{case["question"]}" - possible rate limit, retrying in {RETRY_BACKOFF_SECONDS}s)')
            time.sleep(RETRY_BACKOFF_SECONDS)
            continue
        break

    response.raise_for_status()
    result = response.json()
    grounded_correct = result["grounded"] == case["expect_grounded"]
    content_correct = check_content(case, result["answer"]) if result["grounded"] else None
    passed = grounded_correct and (content_correct is not False)
    return {
        **case,
        "actual_grounded": result["grounded"],
        "answer": result["answer"],
        "grounded_correct": grounded_correct,
        "content_correct": content_correct,
        "passed": passed,
    }


def main():
    results = []
    for case in TEST_CASES:
        results.append(run_case(case))
        time.sleep(REQUEST_DELAY_SECONDS)

    for r in results:
        status = "PASS" if r["passed"] else "FAIL"
        content_note = f", content={r['content_correct']}" if r["content_correct"] is not None else ""
        print(f'[{status}] ({r["type"]}) "{r["question"]}" -> grounded={r["actual_grounded"]} (expected {r["expect_grounded"]}){content_note}')

    golden = [r for r in results if r["type"] == "golden"]
    unanswerable = [r for r in results if r["type"] == "unanswerable"]
    groundedness_checked = [r for r in golden if r["content_correct"] is not None]

    golden_accuracy = sum(r["passed"] for r in golden) / len(golden) if golden else 0
    refusal_rate = sum(r["passed"] for r in unanswerable) / len(unanswerable) if unanswerable else 0
    groundedness_rate = (
        sum(r["content_correct"] for r in groundedness_checked) / len(groundedness_checked)
        if groundedness_checked else 0
    )

    print(f"\nQuery accuracy (golden set): {golden_accuracy:.0%} ({sum(r['passed'] for r in golden)}/{len(golden)})")
    print(f"Refusal rate (unanswerable set): {refusal_rate:.0%} ({sum(r['passed'] for r in unanswerable)}/{len(unanswerable)})")
    print(f"Groundedness rate (citation supports claim): {groundedness_rate:.0%} ({sum(r['content_correct'] for r in groundedness_checked)}/{len(groundedness_checked)})")


if __name__ == "__main__":
    main()