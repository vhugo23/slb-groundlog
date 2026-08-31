import lasio
import numpy as np

def check_duplicate_depth(depths):
    seen = set()
    duplicates = []
    for depth in depths:
        if depth in seen:
            duplicates.append(depth)
        seen.add(depth)
    return duplicates

def check_curve_gap(depths, values, min_run=3):
    gaps = []
    run_start = None
    run_length = 0

    for i, value in enumerate(values):
        if np.isnan(value):
            if run_length == 0:
                run_start = i
            run_length += 1
        else:
            if run_length >= min_run:
                gaps.append((depths[run_start], depths[i - 1]))
            run_length = 0
    if run_length >= min_run:
        gaps.append((depths[run_start], depths[len(values) - 1]))

    return gaps

def check_flatline(depths, values, min_run=20, tolerance_pct=0.002):
    values = np.asarray(values, dtype=float)
    finite_values = values[~np.isnan(values)]
    if len(finite_values) == 0:
        return []
    p_low, p_high = np.percentile(finite_values, [5, 95])
    curve_range = p_high - p_low
    tolerance = curve_range * tolerance_pct

    flats = []
    run_start = 0
    run_length = 1
    run_value = values[0]

    for i in range(1, len(values)):
        value = values[i]
        if not np.isnan(value) and not np.isnan(run_value) and abs(value - run_value) <= tolerance:
            run_length += 1
        else:
            if run_length >= min_run:
                flats.append((depths[run_start], depths[i - 1]))
            run_start = i
            run_length = 1
            run_value = value

    if run_length >= min_run:
        flats.append((depths[run_start], depths[len(values) - 1]))
    return flats

PHYSICAL_RANGES = {
    "GR": (0, 250),
}

def check_out_of_range(depths, values, mnemonic):
    low, high = PHYSICAL_RANGES[mnemonic]
    flags = []
    for depth, value in zip(depths, values):
        if not np.isnan(value) and (value < low or value > high):
            flags.append((depth, value))
    return flags

if __name__ == "__main__":
    las = lasio.read("sample_data/flagged_well.las")
    print(check_duplicate_depth(las.index))
    print(check_curve_gap(las.index, las["GR"]))
    print(check_flatline(las.index, las["GR"]))
    print(check_out_of_range(las.index, las["GR"], "GR"))