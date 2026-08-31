import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from quality_checks import sanitize_null_sentinels
from las_parser import get_connection


def fix_well_curves(conn):
    cur = conn.cursor()
    cur.execute("SELECT id FROM wells ORDER BY id;")
    well_ids = [row[0] for row in cur.fetchall()]

    total_fixed_curves = 0
    total_fixed_values = 0

    for well_id in well_ids:
        cur.execute("SELECT mnemonic, readings FROM curves WHERE well_id = %s;", (well_id,))
        rows = cur.fetchall()
        for mnemonic, readings in rows:
            original = np.asarray(readings, dtype=float)
            cleaned = sanitize_null_sentinels(original)
            changed = int(np.sum(~np.isnan(original) & np.isnan(cleaned)))
            if changed > 0:
                cur.execute(
                    "UPDATE curves SET readings = %s WHERE well_id = %s AND mnemonic = %s;",
                    (cleaned.tolist(), well_id, mnemonic),
                )
                print(f"well_id={well_id} {mnemonic}: nulled {changed} sentinel value(s)")
                total_fixed_curves += 1
                total_fixed_values += changed

    conn.commit()
    cur.close()
    print(f"\nDone. {total_fixed_curves} curve(s) updated, {total_fixed_values} sentinel value(s) nulled.")


if __name__ == "__main__":
    conn = get_connection()
    fix_well_curves(conn)
    conn.close()