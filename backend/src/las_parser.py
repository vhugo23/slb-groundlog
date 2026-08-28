import lasio
from quality_checks import check_duplicate_depth, check_curve_gap, check_flatline, check_out_of_range, PHYSICAL_RANGES

las_path = "sample_data/flagged_well.las"
las = lasio.read(las_path)

name = las.well.WELL.value
start_depth = las.well.STRT.value
stop_depth = las.well.STOP.value
step = las.well.STEP.value
null_value = las.well.NULL.value

insert_well_sql = f"""
INSERT INTO wells (name, start_depth, stop_depth, step, null_value, source_file)
VALUES ('{name}', {start_depth}, {stop_depth}, {step}, {null_value}, '{las_path}')
returning id;
"""

import subprocess

result = subprocess.run(
    ["psql", "-U", "postgres", "-d", "groundlog", "-t", "-A", "-q"],
    input = insert_well_sql,
    text = True,
    capture_output = True,
)
well_id = int(result.stdout.strip())
print(well_id)

depths_literal = "{" + ",".join(str(d) for d in las.index) + "}"

print(depths_literal)


for curve in las.curves:
    if curve.mnemonic == "DEPT":
        continue

    mnemonic = curve.mnemonic
    unit = curve.unit
    data = curve.data
    readings_literal = "{" + ",".join(str(v) for v in data) + "}"

    insert_curve_sql = f"""
    INSERT INTO curves (well_id, mnemonic, unit, depths, readings)
    VALUES ({well_id}, '{mnemonic}', '{unit}', '{depths_literal}', '{readings_literal}');
    """

    result2 = subprocess.run(
        ["psql", "-U", "postgres", "-d", "groundlog"],
        input = insert_curve_sql,
        text = True,
        capture_output = True,
    )
    print(result2.stdout)
    print(result2.stderr)

def insert_quality_flag(well_id, flag_type, curve, depth_start, depth_end, detail):
    curve_sql = "NULL" if curve is None else f"'{curve}'"
    depth_start_sql = "NULL" if depth_start is None else str(depth_start)
    depth_end_sql = "NULL" if depth_end is None else str(depth_end)

    sql = f"""
    INSERT INTO quality_flags (well_id, flag_type, curve, depth_start, depth_end, detail)
    VALUES ({well_id}, '{flag_type}', {curve_sql}, {depth_start_sql}, {depth_end_sql}, '{detail}');
    """
    result = subprocess.run(
        ["psql", "-U", "postgres", "-d", "groundlog"],
        input=sql,
        text=True,
        capture_output=True,
    )
    print(result.stdout)
    print(result.stderr)

for depth in check_duplicate_depth(las.index):
        insert_quality_flag(
            well_id,
            "duplicate_depth",
            None,
            depth,
            depth,
            f"Depth {depth} appears more than once in the index",
        )

for start, end in check_curve_gap(las.index, data):
    insert_quality_flag(
        well_id,
        "curve_gap",
        mnemonic,
        start,
        end,
        f"{mnemonic} missing for depths {start}-{end}",
    )

for start, end in check_flatline(las.index, data):
    insert_quality_flag(
        well_id,
        "flatline",
        mnemonic,
        start,
        end,
        f"{mnemonic} constant from {start} to {end} - possible tool fault",
    )

if mnemonic in PHYSICAL_RANGES:
    for depth, value in check_out_of_range(las.index, data, mnemonic):
        insert_quality_flag(
            well_id,
            "out_of_range",
            mnemonic,
            depth,
            depth,
            f"{mnemonic} reading of {value} outside expected range",
        )