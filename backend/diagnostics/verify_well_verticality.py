import glob
import lasio
import numpy as np

for path in sorted(glob.glob("sample_data/force2020/*.las")):
    las = lasio.read(path)
    curve_names = [c.mnemonic.upper() for c in las.curves]
    if "X_LOC" not in curve_names or "Y_LOC" not in curve_names:
        print(f"{path}: no x_loc/y_loc curves")
        continue
    x = las["X_LOC"]
    y = las["Y_LOC"]
    name = las.well.WELL.value
    x_range = np.nanmax(x) - np.nanmin(x)
    y_range = np.nanmax(y) - np.nanmin(y)
    print(f"{name}: x_loc range={x_range:.2f}m, y_loc range={y_range:.2f}m")