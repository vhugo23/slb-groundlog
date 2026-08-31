import lasio
import numpy as np

las = lasio.read("sample_data/force2020/15_9-15.las")
data = np.asarray(las["RXO"], dtype=float)
finite = data[~np.isnan(data)]

print("min:", finite.min())
print("max:", finite.max())
print("count < 0.01:", int((finite < 0.01).sum()))
print("count <= 0:", int((finite <= 0).sum()))
print("count > 5000:", int((finite > 5000).sum()))
print("total finite samples:", len(finite))