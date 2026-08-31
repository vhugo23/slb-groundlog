# backend/scripts/backfill_well_locations.py
#
# One-time migration: the FORCE 2020 LAS files carry x_loc/y_loc as
# per-depth curves (UTM Zone 31N easting/northing), but las_parser.py's
# normal ingestion pipeline doesn't pull them in - they're a wellhead
# location repeated down the file, not a real log curve. This script reads
# that location directly from each LAS file, converts it to lat/lon, and
# updates the already-ingested `wells` rows. It does not touch
# las_parser.py or re-run ingestion - this is a one-time backfill.

import glob
import os
import psycopg2
from pyproj import Transformer

# UTM Zone 31N -> WGS84 lat/lon. Assumes WGS84-equivalent UTM 31N rather
# than the older ED50 datum some legacy North Sea data uses - the
# difference is on the order of 100-200m, invisible at any zoom level this
# map uses. Stated simplification, not hidden.
transformer = Transformer.from_crs("EPSG:32631", "EPSG:4326", always_xy=True)


def parse_curve_names(lines: list[str]) -> list[str]:
    """Return curve mnemonics in file order, from the ~Curve section."""
    names = []
    in_curve_section = False
    for line in lines:
        if line.strip().upper().startswith("~CURVE"):
            in_curve_section = True
            continue
        if line.strip().startswith("~") and in_curve_section:
            break
        if in_curve_section and line.strip() and not line.strip().startswith("#"):
            mnemonic = line.split(".")[0].strip()
            names.append(mnemonic)
    return names


def find_wellhead_location(las_path: str):
    with open(las_path) as f:
        lines = f.readlines()

    curve_names = parse_curve_names(lines)
    if "x_loc" not in curve_names or "y_loc" not in curve_names:
        return None
    x_index = curve_names.index("x_loc")
    y_index = curve_names.index("y_loc")

    well_name = None
    in_ascii = False
    for line in lines:
        if not in_ascii and line.strip().upper().startswith("WELL."):
            # Value sits BEFORE the colon, not after (after it is a
            # description comment) - and before that, after the mnemonic's
            # own dot.
            value_part = line.split(":")[0]
            well_name = value_part.split(".", 1)[1].strip()
        if line.strip().upper().startswith("~ASCII"):
            in_ascii = True
            continue
        if in_ascii:
            parts = line.split()
            if len(parts) <= max(x_index, y_index):
                continue
            x_val = float(parts[x_index])
            y_val = float(parts[y_index])
            # Real UTM eastings/northings here are large positive numbers;
            # the LAS null sentinel (-999.25) is the only negative value
            # that shape, so this is a safe "is this real data" check.
            if x_val > 0 and y_val > 0 and well_name:
                return well_name, x_val, y_val
    return None


def main():
    conn = psycopg2.connect(
        dbname=os.environ.get("GROUNDLOG_DB", "groundlog"),
        user=os.environ.get("GROUNDLOG_DB_USER", "postgres"),
        password=os.environ.get("PGPASSWORD"),
        host=os.environ.get("GROUNDLOG_DB_HOST", "localhost"),
    )
    cur = conn.cursor()

    for las_path in glob.glob("sample_data/force2020/*.las"):
        result = find_wellhead_location(las_path)
        if result is None:
            print(f"SKIP {las_path}: no x_loc/y_loc found")
            continue
        well_name, x_val, y_val = result
        lon, lat = transformer.transform(x_val, y_val)
        cur.execute(
            "UPDATE wells SET latitude = %s, longitude = %s WHERE name = %s;",
            (lat, lon, well_name),
        )
        print(f"{well_name}: UTM({x_val:.1f}, {y_val:.1f}) -> lat/lon({lat:.5f}, {lon:.5f}), rows updated: {cur.rowcount}")

    conn.commit()
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()