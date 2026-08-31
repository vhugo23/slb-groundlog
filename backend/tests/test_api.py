from fastapi.testclient import TestClient

from api import app

from unittest.mock import patch

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_list_wells_includes_fixture(fixture_well):
    response = client.get("/wells")
    assert response.status_code == 200
    wells_by_id = {w["id"]: w for w in response.json()}
    assert fixture_well in wells_by_id
    fixture = wells_by_id[fixture_well]
    assert fixture["name"] == "PYTEST-FIXTURE-WELL"
    assert fixture["quality_status"] == "flagged"
    assert fixture["curve_count"] == 1


def test_get_well_detail(fixture_well):
    response = client.get(f"/wells/{fixture_well}")
    assert response.status_code == 200
    body = response.json()
    assert body["curves"] == ["GR"]
    assert len(body["quality_flags"]) == 1
    assert body["quality_flags"][0]["flag_type"] == "curve_gap"


def test_get_well_not_found():
    response = client.get("/wells/999999")
    assert response.status_code == 404


def test_get_curve(fixture_well):
    response = client.get(f"/wells/{fixture_well}/curves/GR")
    assert response.status_code == 200
    assert response.json()["values"] == [50.0, 55.0, None]


def test_get_curve_not_found(fixture_well):
    response = client.get(f"/wells/{fixture_well}/curves/NOPE")
    assert response.status_code == 404
    
def test_query_matches_curve(fixture_well):
    with patch("api.call_llm", return_value="The GR log averages about 52.5 API across the logged interval."):
        response = client.post(f"/wells/{fixture_well}/query", json={"question": "what does the GR log show"})
    assert response.status_code == 200
    body = response.json()
    assert body["grounded"] is True
    assert body["citation"] == f"well {fixture_well}, curve GR"


def test_query_matches_quality_keyword(fixture_well):
    with patch("api.call_llm", return_value="This well has one curve_gap flag on GR."):
        response = client.post(f"/wells/{fixture_well}/query", json={"question": "are there any quality flags"})
    assert response.status_code == 200
    body = response.json()
    assert body["grounded"] is True
    assert body["citation"] == f"well {fixture_well} quality_flags"


def test_query_fallback_refuses(fixture_well):
    with patch("api.call_llm", return_value="INSUFFICIENT_DATA"):
        response = client.post(f"/wells/{fixture_well}/query", json={"question": "what is the ILD reading"})
    assert response.status_code == 200
    body = response.json()
    assert body["grounded"] is False
    assert body["citation"] is None


def test_query_fallback_never_fabricates_citation(fixture_well):
    # Even if the model ignores the "answer only from DATA" instruction and
    # returns text without the INSUFFICIENT_DATA sentinel, there is no real
    # retrieved record in this branch - so citation must stay None
    # regardless of what the model claims. This is the specific safety
    # property the query-engine-honesty fix relies on.
    with patch("api.call_llm", return_value="The reading is approximately 42."):
        response = client.post(f"/wells/{fixture_well}/query", json={"question": "what is the ILD reading"})
    assert response.status_code == 200
    assert response.json()["citation"] is None