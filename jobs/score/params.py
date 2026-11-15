"""Score fit priors; read is the registry callable, never a private registry."""
DECLARED = [
    {'name': 'score_min_band', 'family': 'scalar', 'prior': 20, 'guard_lo': 1,
     'scopes': ['site', 'person'],
     'source': 'spec/engines/audit.md#score (fit.py:27 existing sample gate; agent proposal)'},
    {'name': 'score_bootstrap_n', 'family': 'scalar', 'prior': 2000, 'guard_lo': 1,
     'scopes': ['site'], 'source': 'spec/features/score.md#data-flow (agent proposal: existing bootstrap start value)'},
    {'name': 'score_bootstrap_alpha', 'family': 'scalar', 'prior': .025, 'guard_lo': 0, 'guard_hi': 1,
     'scopes': ['site'], 'source': 'spec/features/score.md#data-flow (agent proposal: existing bootstrap start value)'},
]


def resolve(read=None, scope=None):
    scope = scope or {}
    priors = {entry['name']: entry['prior'] for entry in DECLARED}
    if read is None:
        read = lambda name, scope: {'value': priors[name], 'version': 0}
    values, versions = {}, {}
    for entry in DECLARED:
        row = read(entry['name'], {key: scope[key] for key in entry['scopes'] if key in scope})
        value = row['value']
        import math
        if not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError(f"invalid param {entry['name']}")
        if value < entry.get('guard_lo', -math.inf) or value > entry.get('guard_hi', math.inf):
            raise ValueError(f"param {entry['name']} outside guard")
        values[entry['name']], versions[entry['name']] = value, row['version']
    return {'values': values, 'versions': versions}
