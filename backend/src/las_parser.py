import sys
import glob
import os

import lasio
import psycopg2

from quality_checks import (
    check_duplicate_depth,
    check_curve_gap,
    check_flatline,
    check_out_of_range,
    PHYSICAL_RANGES,
)

# Location/index metadata columns, not petrophysical log curves. Left in
# they'd flatline-flag as "tool faults" for hundreds of meters (x_loc/y_loc
# are constant for a near-vertical well, DEPTH_MD duplicates the index) -
# noise, not a real finding, so they're excluded from ingestion + checks.
SKIP_CURVES = {"DEPT", "DEPTH_MD", "X_LOC", "Y_LOC", "Z_LOC"}

# Interpreted/categorical columns, not continuous physical measurements.
# A lithology label is SUPPOSED to hold the same value for tens of
# meters at a stretch - that's what a rock formation is - so the
# flatline check (built to catch a stuck tool reading a constant
# physical value) fires on them constantly and isn't a real finding.
SKIP_FLATLINE_CURVES = {"FORCE_2020_LITHOFACIES_LITHOLOGY", "FORCE_2020_LITHOFACIES_CONFIDENCE"}


def get_connection():
    return psycopg2.connect(
        dbname=os.environ.get("GROUNDLOG_DB", "groundlog"),
        user=os.environ.get("GROUNDLOG_DB_USER", "postgres"),
        password=os.environ.get("PGPASSWORD"),
        host=os.environ.get("GROUNDLOG_DB_HOST", "localhost"),
    )


def insert_quality_flag(cur, well_id, flag_type, curve, depth_start, depth_end, detail):
    cur.execute(
        """
        INSERT INTO quality_flags (well_id, flag_type, curve, depth_start, depth_end, detail)
        VALUES (%s, %s, %s, %s, %s, %s);
        """,
        (well_id, flag_type, curve, depth_start, depth_end, detail),
    )


def ingest_las(conn, las_path):
    print(f"\n=== Ingesting {las_path} ===")
    las = lasio.read(las_path)

    name = las.well.WELL.value
    start_depth = float(las.well.STRT.value)
    stop_depth = float(las.well.STOP.value)
    step = float(las.well.STEP.value)
    null_value = float(las.well.NULL.value)

    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO wells (name, start_depth, stop_depth, step, null_value, source_file)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id;
        """,
        (name, start_depth, stop_depth, step, null_value, las_path),
    )
    well_id = cur.fetchone()[0]
    print(f"well_id={well_id} name={name!r}")

    depths = [float(d) for d in las.index]
    flags_found = 0

    # Well-level check: run once against the depth index itself, not per curve.
    for depth in check_duplicate_depth(depths):
        insert_quality_flag(
            cur, well_id, "duplicate_depth", None, depth, depth,
            f"Depth {depth} appears more than once in the index",
        )
        flags_found += 1

    for curve in las.curves:
        if curve.mnemonic.upper() in SKIP_CURVES:
            continue

        mnemonic = curve.mnemonic
        unit = curve.unit or ""
        data = [float(v) for v in curve.data]

        cur.execute(
            """
            INSERT INTO curves (well_id, mnemonic, unit, depths, readings)
            VALUES (%s, %s, %s, %s, %s);
            """,
            (well_id, mnemonic, unit, depths, data),
        )

        # Per-curve checks: each runs against THIS curve's own data, inside
        # the loop, so every curve gets checked (not just whichever curve
        # happened to be last when the loop variables were read afterward).
        for start, end in check_curve_gap(depths, data):
            insert_quality_flag(
                cur, well_id, "curve_gap", mnemonic, start, end,
                f"{mnemonic} missing for depths {start}-{end}",
            )
            flags_found += 1

        if mnemonic.upper() not in SKIP_FLATLINE_CURVES:
            for start, end in check_flatline(depths, data):
                insert_quality_flag(
                    cur, well_id, "flatline", mnemonic, start, end,
                    f"{mnemonic} constant from {start} to {end} - possible tool fault",
                )
                flags_found += 1

        if mnemonic in PHYSICAL_RANGES:
            for depth, value in check_out_of_range(depths, data, mnemonic):
                insert_quality_flag(
                    cur, well_id, "out_of_range", mnemonic, depth, depth,
                    f"{mnemonic} reading of {value} outside expected range",
                )
                flags_found += 1

    conn.commit()
    cur.close()
    print(f"  -> {flags_found} quality flags recorded")
    return well_id, flags_found


if __name__ == "__main__":
    if len(sys.argv) > 1:
        paths = sys.argv[1:]
    else:
        paths = sorted(glob.glob("sample_data/force2020/*.las"))

    if not paths:
        print("No LAS files found. Pass path(s) as arguments, or put files in sample_data/force2020/.")
        sys.exit(1)

    conn = get_connection()

    total_wells = 0
    total_flags = 0
    for p in paths:
        well_id, flags = ingest_las(conn, p)
        if well_id is not None:
            total_wells += 1
            total_flags += flags

    conn.close()
    print(f"\nDone. {total_wells}/{len(paths)} well(s) ingested, {total_flags} total quality flags.")