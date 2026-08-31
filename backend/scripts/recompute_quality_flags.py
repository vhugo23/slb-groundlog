import glob
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

import lasio

from quality_checks import (
    check_duplicate_depth,
    check_curve_gap,
    check_flatline,
    check_out_of_range,
    PHYSICAL_RANGES,
)
from las_parser import run_sql, insert_quality_flag, sql_escape, SKIP_CURVES, SKIP_FLATLINE_CURVES


def get_well_id(name):
    result = run_sql(f"SELECT id FROM wells WHERE name = '{sql_escape(name)}';", capture=True).strip()
    return int(result) if result else None


def recompute_las(las_path):
    las = lasio.read(las_path)
    name = las.well.WELL.value
    well_id = get_well_id(name)
    if well_id is None:
        print(f"  !! no matching well found for {name!r}, skipping")
        return

    print(f"\n=== Recomputing quality flags for {name!r} (well_id={well_id}) ===")
    run_sql(f"DELETE FROM quality_flags WHERE well_id = {well_id};")

    depths = las.index
    flags_found = 0

    for depth in check_duplicate_depth(depths):
        insert_quality_flag(
            well_id, "duplicate_depth", None, depth, depth,
            f"Depth {depth} appears more than once in the index",
        )
        flags_found += 1

    for curve in las.curves:
        if curve.mnemonic.upper() in SKIP_CURVES:
            continue

        mnemonic = curve.mnemonic
        data = curve.data

        for start, end in check_curve_gap(depths, data):
            insert_quality_flag(
                well_id, "curve_gap", mnemonic, start, end,
                f"{mnemonic} missing for depths {start}-{end}",
            )
            flags_found += 1

        if mnemonic.upper() not in SKIP_FLATLINE_CURVES:
            for start, end in check_flatline(depths, data):
                insert_quality_flag(
                    well_id, "flatline", mnemonic, start, end,
                    f"{mnemonic} constant from {start} to {end} - possible tool fault",
                )
                flags_found += 1

        if mnemonic in PHYSICAL_RANGES:
            for depth, value in check_out_of_range(depths, data, mnemonic):
                insert_quality_flag(
                    well_id, "out_of_range", mnemonic, depth, depth,
                    f"{mnemonic} reading of {value} outside expected range",
                )
                flags_found += 1

    print(f"  -> {flags_found} quality flags recorded")


if __name__ == "__main__":
    paths = sorted(glob.glob("sample_data/force2020/*.las"))
    for p in paths:
        recompute_las(p)
    print("\nDone.")