"""Monthly season factors for the store categories that sit next to ours, by M12's method.

Data: US Census Monthly Retail Trade, not seasonally adjusted, millions of dollars, read from FRED
on 2026-11-15 (series pages updated 2026-10-15). Used merchandise stores is the secondhand series;
the others are where new goods of the same kinds are bought, so their peaks are when buying new
competes with buying used. Method (market-insight M12): ratio to a centred 12-month moving average,
averaged per calendar month, normalised to average 1; shown only when the factors' range is over
twice the year-to-year spread of a month.

Run: python3 scripts/bench/seasons.py [--out scripts/bench/out/seasons.json]
"""
import json
import sys

import numpy as np

SERIES = {
    "used_merchandise MRTSSM45330USN": {
        2023: [1615, 1528, 1770, 1847, 1623, 1558, 1589, 1630, 1665, 1801, 1608, 1739],
        2024: [1565, 1591, 1806, 1681, 1834, 1671, 1709, 1733, 1806, 1866, 1753, 1788],
        2025: [1591, 1643, 2013, 1808, 1973, 1882, 1941, 2045, 2036, 2207, 2037, 2173],
        2026: [None, None, None, 2109, 2135, 2158, 2201, 2296]},
    "clothing MRTSSM4481USN": {
        2023: [12506, 13118, 16190, 16153, 16844, 16007, 16556, 17290, 15537, 16100, 19213, 24904],
        2024: [12471, 13914, 16646, 16001, 18104, 16782, 16906, 17866, 15315, 16954, 20355, 25477],
        2025: [13533, 13858, 17576, 17424, 19463, 17635, 18697, 19358, 16827, 18560, 22218, 27542],
        2026: [14289, 15086, 18948, 18269, 20395, 18690, 19792, 20377]},
    "furniture MRTSSM442USN": {
        2023: [10747, 10286, 11636, 10451, 11081, 10845, 10498, 11195, 10557, 10157, 11383, 10965],
        2024: [9255, 9600, 10214, 9772, 10507, 9950, 10462, 10949, 10369, 10504, 11644, 11800],
        2025: [9826, 9821, 10860, 10509, 10997, 10368, 11075, 10941, 10232, 10475, 11068, 11175],
        2026: [9320, 9312, 10782, 10133, 10826, 10518, 10770, 10760]},
    "electronics MRTSSM443USN": {
        2023: [6973, 6330, 6920, 6157, 6686, 6751, 6599, 7003, 6858, 6772, 7986, 9087],
        2024: [6727, 6606, 6557, 6345, 6951, 6625, 6943, 6960, 6379, 6627, 8047, 9516],
        2025: [6549, 6146, 6698, 6371, 6964, 6724, 7212, 7158, 6942, 7005, 8283, 9916],
        2026: [6850, 6507, 7177, 6942, 7372, 7273, 7570, 7759]},
    "sporting_hobby_books MRTSSM451USN": {
        2023: [6559, 6094, 7399, 7145, 7477, 7754, 7652, 8332, 7427, 7182, 8489, 10811],
        2024: [6528, 6375, 7424, 6844, 7513, 7666, 7538, 8370, 7308, 7408, 8712, 11245],
        2025: [6584, 6101, 7598, 7038, 7723, 7574, 7839, 8738, 7456, 7694, 8946, 11888],
        2026: [6921, 6624, 8050, 7758, 8539, 8611, 8623, 9495]},
}
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()


def factors(by_year):
    x = np.array([v if v is not None else np.nan for y in sorted(by_year) for v in by_year[y]], float)
    ma = np.full(len(x), np.nan)
    for i in range(6, len(x) - 6):
        ma[i] = (0.5 * x[i - 6] + x[i - 5:i + 6].sum() + 0.5 * x[i + 6]) / 12
    r = x / ma
    f = np.array([np.nanmean(r[m::12]) for m in range(12)])
    spread = np.array([np.nanstd(r[m::12]) for m in range(12)])
    f = f / f.mean()
    return f, spread, int(np.sum(~np.isnan(r)))


def main():
    out = {}
    for name, data in SERIES.items():
        f, spread, n = factors(data)
        rng = float(f.max() - f.min())
        out[name] = {"factors": {m: round(float(v), 3) for m, v in zip(MONTHS, f)},
                     "high": MONTHS[int(f.argmax())], "low": MONTHS[int(f.argmin())],
                     "range": round(rng, 3), "max_spread": round(float(spread.max()), 3),
                     "shown_by_m12_rule": bool(rng > 2 * spread.max()), "months_of_ratios": n}
    dst = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else None
    if dst:
        json.dump(out, open(dst, "w"), indent=1)
    for name, o in out.items():
        print(f"{name:36s} " + " ".join(f"{v:.2f}" for v in o["factors"].values())
              + f"  high {o['high']} low {o['low']} shown {o['shown_by_m12_rule']}")


if __name__ == "__main__":
    main()
