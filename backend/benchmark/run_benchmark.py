# backend/benchmark/run_benchmark.py
#
# PRD §10: runs each test case against the live API and reports pass/fail
# plus the two named metrics — query accuracy (golden set) and refusal rate
# (unanswerable set) — measured, not asserted.

import requests
from test_cases import TEST_CASES

BASE_URL = "http://127.0.0.1:8000"


def run_case(case: dict) -> dict:
    response = requests.post(
        f"{BASE_URL}/wells/{case['well_id']}/query",
        json={"question": case["question"]},
        timeout=30,
    )
    response.raise_for_status()
    result = response.json()
    passed = result["grounded"] == case["expect_grounded"]
    return {**case, "actual_grounded": result["grounded"], "answer": result["answer"], "passed": passed}


def main():
    results = [run_case(case) for case in TEST_CASES]

    for r in results:
        status = "PASS" if r["passed"] else "FAIL"
        print(f'[{status}] ({r["type"]}) "{r["question"]}" -> grounded={r["actual_grounded"]} (expected {r["expect_grounded"]})')

    golden = [r for r in results if r["type"] == "golden"]
    unanswerable = [r for r in results if r["type"] == "unanswerable"]

    golden_accuracy = sum(r["passed"] for r in golden) / len(golden) if golden else 0
    refusal_rate = sum(r["passed"] for r in unanswerable) / len(unanswerable) if unanswerable else 0

    print(f"\nQuery accuracy (golden set): {golden_accuracy:.0%} ({sum(r['passed'] for r in golden)}/{len(golden)})")
    print(f"Refusal rate (unanswerable set): {refusal_rate:.0%} ({sum(r['passed'] for r in unanswerable)}/{len(unanswerable)})")


if __name__ == "__main__":
    main()