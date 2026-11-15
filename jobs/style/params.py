"""Scoped priors from recommendation-and-style; resolve accepts registry.read."""
from copy import deepcopy
import math

SPEC = 'spec/engines/recommendation-and-style.md'
DECLARED = []


def _declare(what, prior, section, lo=0, hi=None, family='scalar'):
    DECLARED.append(dict(name='style_'+what, family=family, prior=prior, guard_lo=lo,
                         **({'guard_hi': hi} if hi is not None else {}),
                         scopes=['kind','site','segment','person'], source=SPEC+section))


for source, taste, size in [('want',1.,1.),('you_said',1.,1.),('save',.8,.6),('follow',.6,0.),
                            ('purchase',.5,.8),('kept',.4,.8),('sold',.2,.4),('not_for_me',0.,0.)]:
    for axis, value in [('taste',taste),('size',size)]:
        _declare(source+'_'+axis,value,'#2-signals',value*.5,value*1.5)
for what, prior, section in [
    ('size_share',.7,'#3-the-calculation'),('event_blend',3.,'#3-the-calculation'),
    ('day_blend',2.,'#3-the-calculation'),('affinity_k',2.,'#3-the-calculation'),
    ('half_life_days',365.,'#2-signals'),('child_half_life_days',365.,'#2-signals'),
    ('brand_penalty',.3,'#2-signals'),('cluster_penalty',1.,'#2-signals'),
    ('deal_low',1.,'#3-the-calculation'),('deal_high',.5,'#3-the-calculation'),
    ('quality_low',.8,'#3-the-calculation'),('quality_high',1.2,'#3-the-calculation'),
    ('shelf_blend',3.,'#3-the-calculation'),('product_cap',2,'#1-what-it-decides'),
    ('seller_cap',3,'#8-protections'),('seller_window',20,'#8-protections'),
    ('shelf_limit',40,'#1-what-it-decides'),('alert_quantile',.9,'#3-the-calculation'),
    ('alert_spacing_days',7.,'#3-the-calculation'),('passed_impressions',10,'#4-learning'),
    ('passed_floor',.5,'#4-learning'),('passed_ceiling',1.,'#4-learning'),
    ('min_impressions',2000,'#4-learning'),('min_saves',100,'#4-learning'),
    ('holdout_days',14.,'#4-learning'),('bootstrap_draws',1000,'#4-learning'),
    ('source_guard_fraction',.5,'#4-learning'),('similarity_bar',.75,'#3-the-calculation'),
    ('price_ratio',.75,'#3-the-calculation'),('sell_fit_base',1.5,'#3-the-calculation'),('bootstrap_tail',.05,'#9-proof'),
]:
    _declare(what,prior,section)
_declare('tap_prior',{'alpha':1.,'beta':1.},'#4-learning',family='beta')
# Existing expert-note heuristics: explicit priors, pending real-history calibration.
for what, prior in [('sourcing_days',30.),('offset_people',5),('unassigned_steps',1.),('edit_weight',.5),('ranker_l2',.001)]:
    _declare(what,prior,'#10-build-tasks')
    DECLARED[-1]['prior_status']='agent proposal: inherited heuristic; spec has no numeric prior'
    DECLARED[-1]['evidence_source']='research/cross-cutting/nate/recommendation-and-style-expert-session.md'


POSITIVE = {'style_'+n for n in ('event_blend','day_blend','affinity_k','half_life_days','child_half_life_days',
                                'shelf_blend','product_cap','seller_cap','seller_window','shelf_limit',
                                'bootstrap_draws','offset_people')}
COUNTS = {'style_'+n for n in ('product_cap','seller_cap','seller_window','shelf_limit','bootstrap_draws',
                              'passed_impressions','min_impressions','min_saves','offset_people')}
UNIT = {'style_'+n for n in ('size_share','alert_quantile','passed_floor','passed_ceiling','source_guard_fraction',
                            'similarity_bar','price_ratio','bootstrap_tail')}
for declaration in DECLARED:
    if declaration['name'] in UNIT:
        declaration['guard_hi']=1.


def _validate(d, value):
    name=d['name']
    if d['family']=='beta':
        if not isinstance(value,dict) or any(not isinstance(value.get(k),(int,float)) or not math.isfinite(value[k]) or value[k]<=0 for k in ('alpha','beta')):
            raise ValueError(name+' needs positive finite alpha and beta')
        return
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value<d['guard_lo'] or ('guard_hi' in d and value>d['guard_hi']):
        raise ValueError(name+' outside guards')
    if (name in POSITIVE and value<=0) or (name in COUNTS and not float(value).is_integer()):
        raise ValueError(name+' outside positive/count guards')


def resolve(read=None, scope=None):
    values, versions = {}, {}
    for d in DECLARED:
        row = read(d['name'],scope or {}) if read else dict(value=deepcopy(d['prior']),version=0)
        value = row['value']
        _validate(d,value)
        values[d['name']], versions[d['name']] = value, row['version']
    return dict(values=values,versions=versions)


def resolved(params):
    result = resolve() if params is None else params
    for d in DECLARED:
        result['values'][d['name']]
        result['versions'][d['name']]
    return result
