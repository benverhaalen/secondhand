"""Trust fit priors, resolved through the registry read callable."""
DECLARED = [
    dict(name=name, family='scalar', prior=prior, scopes=['kind', 'site', 'segment', 'person'], source=source)
    for name, prior, source in [
        ('trust_isotonic_n', 1000, 'spec/engines/trust.md#4-learning'),
        ('trust_fit_ridge', .01, 'spec/engines/trust.md#4-learning'),
        ('trust_fit_steps', 40, 'spec/engines/trust.md#4-learning'),
        ('trust_fit_det_min', 1e-12, 'spec/engines/trust.md#4-learning'),
        ('trust_fit_tolerance', 1e-9, 'spec/engines/trust.md#4-learning'),
        ('trust_holdout_every', 4, 'spec/engines/trust.md#4-learning'),
        ('trust_ece_bins', 10, 'spec/engines/trust.md#4-learning'),
        ('trust_watch_tolerance', .05, 'spec/engines/trust.md#4-learning'),
        ('trust_half_life_days', 30, 'spec/engines/trust.md#4-learning'),
        ('trust_prior_sd', .5, 'spec/engines/trust.md#4-learning'),
        ('trust_predicate_recall', .95, 'spec/engines/trust.md#4-learning'),
    ]
]

def prior_read(name, scope):
    return {'value': next(d['prior'] for d in DECLARED if d['name'] == name), 'version': 0}

def resolve(read=prior_read, scope=None):
    rows = {d['name']: read(d['name'], scope or {}) for d in DECLARED}
    return dict(values={n:r['value'] for n,r in rows.items()}, versions={n:r['version'] for n,r in rows.items()})

def value(values, name):
    import math
    if name not in values or not isinstance(values[name], (int, float)) or not math.isfinite(values[name]):
        raise ValueError(name)
    return values[name]

# Agent-proposal solver priors; the spec names the objective but not solver controls.
DECLARED.extend(dict(name=n, family='scalar', prior=p, scopes=['kind','site','segment','person'], source='spec/engines/trust.md#4-learning') for n,p in [
    ('trust_holdout_days',30), ('trust_weight_band',.5), ('trust_weight_support',30), ('trust_weight_reverse_support',100),
    ('trust_switch_positive_weight',30), ('trust_bootstrap_n',500), ('trust_bootstrap_tail',.025), ('trust_fit_seed',0),
    ('trust_b',-4.), ('trust_loss_min_cents',2000), ('trust_c_tap_cents',100), ('trust_delta',.0538), ('trust_m_ask',.1),
    ('trust_predicate_code_start',.1), ('trust_predicate_start',.2),
])
