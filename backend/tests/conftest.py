# backend/tests/conftest.py
#
# Seeds one clearly-named synthetic well directly via SQL before tests run,
# and deletes it afterward - same principle as manually testing
# SQL-hardened las_parser.py against a fixture well and cleaning up
# earlier this session, just automated so every test run starts from the
# same known state instead of depending on whatever's in the dev DB.

import os

import psycopg2
import pytest

FIXTURE_WELL_NAME = "PYTEST-FIXTURE-WELL"


def get_raw_connection():
    return psycopg2.connect(
        dbname=os.environ.get("GROUNDLOG_DB", "groundlog"),
        user=os.environ.get("GROUNDLOG_DB_USER", "postgres"),
        password=os.environ.get("PGPASSWORD"),
        host=os.environ.get("GROUNDLOG_DB_HOST", "localhost"),
    )


@pytest.fixture(scope="session")
def fixture_well():
    conn = get_raw_connection()
    cur = conn.cursor()

    # Idempotent: clean up any leftover fixture well from a previous run
    # that crashed before its own teardown ran. Children first - wells'
    # foreign keys from curves/quality_flags aren't ON DELETE CASCADE.
    cur.execute("DELETE FROM curves WHERE well_id IN (SELECT id FROM wells WHERE name = %s);", (FIXTURE_WELL_NAME,))
    cur.execute("DELETE FROM quality_flags WHERE well_id IN (SELECT id FROM wells WHERE name = %s);", (FIXTURE_WELL_NAME,))
    cur.execute("DELETE FROM wells WHERE name = %s;", (FIXTURE_WELL_NAME,))

    cur.execute(
        """
        INSERT INTO wells (name, start_depth, stop_depth, step, null_value, source_file, latitude, longitude)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (FIXTURE_WELL_NAME, 1000.0, 1010.0, 1.0, -999.25, "pytest-fixture", 58.5, 1.8),
    )
    well_id = cur.fetchone()[0]

    cur.execute(
        """
        INSERT INTO curves (well_id, mnemonic, unit, depths, readings)
        VALUES (%s, %s, %s, %s, %s);
        """,
        (well_id, "GR", "API", [1000.0, 1001.0, 1002.0], [50.0, 55.0, float("nan")]),
    )

    cur.execute(
        """
        INSERT INTO quality_flags (well_id, flag_type, curve, depth_start, depth_end, detail)
        VALUES (%s, %s, %s, %s, %s, %s);
        """,
        (well_id, "curve_gap", "GR", 1002.0, 1002.0, "GR missing for depths 1002.0-1002.0"),
    )

    conn.commit()
    cur.close()
    conn.close()

    yield well_id

    conn = get_raw_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM curves WHERE well_id = %s;", (well_id,))
    cur.execute("DELETE FROM quality_flags WHERE well_id = %s;", (well_id,))
    cur.execute("DELETE FROM wells WHERE id = %s;", (well_id,))
    conn.commit()
    cur.close()
    conn.close()