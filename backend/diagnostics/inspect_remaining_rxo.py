import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from las_parser import get_connection

conn = get_connection()
cur = conn.cursor()
cur.execute("SELECT readings FROM curves WHERE well_id = 3 AND mnemonic = 'RXO';")
data = np.asarray(cur.fetchone()[0], dtype=float)
cur.close()
conn.close()

finite = data[~np.isnan(data)]
remaining = finite[finite <= 0]
print("remaining <= 0 count:", len(remaining))
print("remaining <= 0 unique values (rounded to 2dp):", sorted(set(round(v, 2) for v in remaining))[:20])