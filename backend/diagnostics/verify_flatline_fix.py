import lasio
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from quality_checks import check_flatline

SKIP_CURVES = {"DEPT", "DEPTH_MD", "X_LOC", "Y_LOC", "Z_LOC"}
SKIP_FLATLINE_CURVES = {"FORCE_2020_LITHOFACIES_LITHOLOGY", "FORCE_2020_LITHOFACIES_CONFIDENCE"}

las = lasio.read("sample_data/force2020/15_9-13.las")
depths = las.index

total = 0
for curve in las.curves:
    mnemonic = curve.mnemonic
    if mnemonic.upper() in SKIP_CURVES or mnemonic.upper() in SKIP_FLATLINE_CURVES:
        continue
    flats = check_flatline(depths, curve.data)
    total += len(flats)
    print(f"{mnemonic}: {len(flats)} flatline runs")

print(f"\nTotal flatline flags: {total}")