import lasio
import numpy as np

COMMON_NULL_SENTINELS = (-999.25, -999.9, -9999.0, -9999.25)
NULL_TOLERANCE = 0.05

def sanitize_null_sentinels(values):
    values = np.asarray(values, dtype=float)
    for sentinel in COMMON_NULL_SENTINELS:
        values = np.where(np.abs(values - sentinel) < NULL_TOLERANCE, np.nan, values)
    return values

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
    "CALI": (4, 30),        # inches - normal bit sizes 6-17in, washouts push higher
    "BS": (4, 40),          # inches - bit size, standardized sizes up to ~36in
    "RDEP": (0.01, 5000),   # ohm.m - wide log-scale range, resistive zones legitimately reach high values
    "RSHA": (0.01, 5000),
    "RMED": (0.01, 5000),
    "RXO": (0.01, 5000),    # resistivity can't be negative - the observed -999.9 is a null sentinel that slipped through
    "SP": (-300, 300),      # mV - SP baselines drift, generous bound
    "DTC": (30, 240),       # us/ft - faster than ~30 isn't physically real for sedimentary rock
    "DTS": (60, 400),       # us/ft - shear sonic, slower than compressional
    "NPHI": (-0.15, 1.0),   # m3/m3 fraction - slightly negative possible from gas effect, can't exceed 1.0
    "PEF": (0, 30),         # barns/electron - barite-weighted mud can push this unusually high
    "RHOB": (1.0, 3.5),     # g/cm3
    "DRHO": (-1.0, 1.0),    # g/cm3 - normal bad-hole corrections rarely exceed +-0.5
    "DCAL": (-20, 30),      # in - differential caliper, small deviations expected
    "SGR": (0, 300),        # gAPI - gamma ray can't be negative
    "ROP": (0, 500),        # m/h - sustained rates far beyond this aren't physically achievable
}
# MUDWEIGHT and ROPA excluded: their unit field is stored as '_' (undocumented/
# placeholder) in these LAS files, and their observed value ranges don't map
# cleanly onto any standard mud-weight or ROP unit convention with enough
# confidence to set a defensible bound. Flagged as a known gap, not guessed.

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