import lasio

las_path = "sample_data/clean_well.las"
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
readings_literal = "{" + ",".join(str(v) for v in las["GR"]) + "}"

print(depths_literal)
print(readings_literal)

mnemonic = las.curves["GR"].mnemonic
unit = las.curves["GR"].unit

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