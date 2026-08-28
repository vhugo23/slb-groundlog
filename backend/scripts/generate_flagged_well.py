rows = [
    (100.0, 120),
    (100.5, 135),
    (101.0, 140),
    (101.0, 150),      # duplicate depth
    (101.5, 130),
    (102.0, 125),
    (102.5, 138),
    (103.0, -999.25),  # curve_gap starts
    (103.5, -999.25),
    (104.0, -999.25),  # 3 consecutive nulls
    (104.5, 128),
    (105.0, 480),      # out_of_range
    (105.5, 132),
]

step = 0.5

flatline_start = 106.0
flatline_value = 100.0

for i in range(20):
    depth = flatline_start + i * step
    rows.append((depth, flatline_value))

strt = rows[0][0]
stop = rows[-1][0]

ascii_lines = "\n".join(f"{depth} {value}" for depth, value in rows)

las_text = f"""~VERSION INFORMATION
VERS. 2.0 : CWLS LAS VERSION 2.0
WRAP. NO  : ONE LINE PER DEPTH STEP

~WELL INFORMATION
STRT.M {strt} : START DEPTH
STOP.M {stop} : STOP DEPTH
STEP.M {step} : STEP
NULL. -999.25 : NULL VALUE
WELL.  FLAGGED-1 : WELL NAME

~CURVE INFORMATION
DEPT.M : DEPTH
GR.API : GAMMA RAY

~ASCII
{ascii_lines}
"""

with open("sample_data/flagged_well.las", "w") as f:
    f.write(las_text)