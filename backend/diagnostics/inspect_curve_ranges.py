import glob
import lasio
import numpy as np

seen = {}
for path in sorted(glob.glob("sample_data/force2020/*.las")):
    las = lasio.read(path)
    for curve in las.curves:
        mnemonic = curve.mnemonic.upper()
        if mnemonic in ("DEPT", "DEPTH_MD", "X_LOC", "Y_LOC", "Z_LOC",
                        "FORCE_2020_LITHOFACIES_LITHOLOGY", "FORCE_2020_LITHOFACIES_CONFIDENCE"):
            continue
        data = np.asarray(curve.data, dtype=float)
        finite = data[~np.isnan(data)]
        if len(finite) == 0:
            continue
        entry = seen.setdefault(mnemonic, {"unit": curve.unit, "min": finite.min(), "max": finite.max()})
        entry["min"] = min(entry["min"], finite.min())
        entry["max"] = max(entry["max"], finite.max())

for mnemonic, info in seen.items():
    print(f"{mnemonic}: unit={info['unit']!r}, observed range=({info['min']:.3f}, {info['max']:.3f})")