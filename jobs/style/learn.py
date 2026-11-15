"""Reproducible style learning, recommendation-and-style §4.

Impression ids deduplicate; posterior penalties always multiply the unpenalised
weight. Fit uses an explicit allowlist and pre-holdout impressions only. Paired
query NDCG bootstrap decides promotion through the shared param registry.
"""
import hashlib
import math
import random
from collections import defaultdict
from datetime import timedelta

import numpy as np
from scipy.optimize import minimize
from scipy.special import expit
from .facets import START
from .params import resolved
from .evidence import publish

FEATURES=tuple(START)+('deal','q','exact','likely_same_model','similarity')


def impression(state, impression_id, attrs, *, tapped, pooled_mean, recipient=None, log=None, params=None, as_of=None):
    params=resolved(params)
    v=params['values']
    if not math.isfinite(pooled_mean) or pooled_mean<=0 or pooled_mean>1:
        raise ValueError('pooled tap rate must be in (0, 1]')
    if impression_id in state.seen:
        return
    state.seen.add(impression_id)
    for f in state.facets:
        if f.get('recipient')!=recipient or attrs.get(f['name'])!=f['value'] or f.get('pinned'):
            continue
        key=(recipient,f['name'],f['value'])
        row=state.passed.setdefault(key,dict(n=0,taps=0,base=f['weight'],applied=f['weight']))
        if f['weight']!=row['applied']:
            row['base']=f['weight']
        row['n']+=1
        row['taps']+=int(tapped)
        if row['n']>=v['style_passed_impressions']:
            multiplier=max(v['style_passed_floor'],min(v['style_passed_ceiling'],(v['style_tap_prior']['alpha']+row['taps'])/(v['style_tap_prior']['alpha']+v['style_tap_prior']['beta']+row['n'])/pooled_mean))
            f['weight']=row['base']*multiplier
            row['applied']=f['weight']
            f['passed_over']=row['n']-row['taps']
            basis=(f['citation']['basis'] if 'citation' in f else [dict(id='facet:'+repr(key),base=row['base'])])
            basis=[b for b in basis if b['id']!='passed:'+repr(key)]
            basis.append(dict(id='passed:'+repr(key),n=row['n'],taps=row['taps'],base=row['base'],pooled_mean=pooled_mean))
            f.update(publish({'weight':f['weight'],'count':f.get('count',0),'passed_over':f['passed_over']},
                             basis,as_of or f.get('citation',{}).get('computed_at'),params,metric='passed_over'))
    state.stale=True
    if log:
        log.change('style_profile',state.person,'impression',impression_id=impression_id,tapped=tapped)


def dismiss(state, cluster_id, log=None):
    for cache in state.shelf or []:
        cache['shelf']=[r for r in cache['shelf'] if r.get('cluster_id')!=cluster_id]
    state.stale=True
    if log:
        log.change('for_you_cache',state.person,'dismissed',cluster_id=cluster_id)


def _sig(z):
    return float(expit(z))


def fit_ranker(rows, *, params=None):
    v=resolved(params)["values"]
    if not rows:
        raise ValueError('ranker needs training impressions')
    X=np.array([[1]+[r['features'].get(k,0) for k in FEATURES] for r in rows],dtype=float)
    y=np.array([int(r['saved'] or r['tapped']) for r in rows])
    def objective(beta):
        z=X@beta
        loss=float(np.mean(np.logaddexp(0,z)-y*z)+v['style_ranker_l2']*np.sum(beta[1:]**2))
        p=expit(z)
        grad=X.T@(p-y)/len(rows)
        grad[1:]+=2*v['style_ranker_l2']*beta[1:]
        return loss,grad
    fit=minimize(objective,np.zeros(len(FEATURES)+1),jac=True,method='L-BFGS-B')
    if not fit.success:
        raise RuntimeError(f'ranker fit failed: {fit.message}')
    return dict(intercept=float(fit.x[0]),coefficients={k:float(v) for k,v in zip(FEATURES,fit.x[1:])})


def predict(model, features):
    return _sig(model['intercept']+sum(model['coefficients'][k]*features.get(k,0) for k in FEATURES))


def guarded_weights(coefficients, *, params=None):
    v=resolved(params)['values']
    starts={k:v['style_'+k+'_taste'] for k in START}
    starts['not_for_me']=-v['style_cluster_penalty']
    scale=coefficients.get('want',1)
    scale=scale if scale>0 else 1
    weights={}
    for k,start in starts.items():
        value=coefficients.get(k,start)/scale
        lo,hi=sorted(((1-v['style_source_guard_fraction'])*start,(1+v['style_source_guard_fraction'])*start))
        weights[k]=max(lo,min(hi,value))
    weights['want']=v['style_want_taste']
    for k in weights:
        if weights[k]>weights['want']:
            weights[k]=weights['want']
    return weights


def ndcg(labels, scores, k=10, *, ids=None):
    # Compatibility callers without identifiers use relevance as a permutation-invariant tie key.
    ties=ids if ids is not None else labels
    if len(labels)!=len(scores) or len(ties)!=len(labels):
        raise ValueError('ndcg labels, scores and ids must align')
    def dcg(indices):
        return sum((2**labels[i]-1)/math.log2(j+2) for j,i in enumerate(indices[:k]))
    ideal=dcg(sorted(range(len(labels)),key=lambda i:-labels[i]))
    return dcg(sorted(range(len(labels)),key=lambda i:(-scores[i],ties[i])))/ideal if ideal else 0.


def nightly(store, rows, now, scope, *, seed, draws=None, min_impressions=None, min_saves=None, log=None, params=None):
    params=resolved(params)
    v=params['values']
    draws=int(v['style_bootstrap_draws']) if draws is None else draws
    min_impressions=v['style_min_impressions'] if min_impressions is None else min_impressions
    min_saves=v['style_min_saves'] if min_saves is None else min_saves
    cutoff=now-timedelta(days=v['style_holdout_days'])
    rows=sorted({r['id']:r for r in rows if r.get('consent',False) and r['at']<=now}.values(),key=lambda r:(r['at'],r['id']))
    train=[r for r in rows if r['at']<cutoff]
    held=[r for r in rows if cutoff<=r['at']<now]
    if not train or len(held)<min_impressions or sum(r['saved'] for r in held)<min_saves:
        return dict(promoted=False,fallback='parent' if scope else 'prior')
    model=fit_ranker(train,params=params)
    groups=defaultdict(list)
    for r in held:
        groups[r['query_id']].append(r)
    rng=random.Random(seed)
    prior_weights={k:v['style_'+k+'_taste'] for k in START}
    prior_weights['not_for_me']=-v['style_cluster_penalty']
    def weighted(weights,features):
        return sum(weights[k]*features.get(k,0) for k in weights)*features.get('deal',1)*features.get('q',1)
    results={}
    for name,value in (('style.ranker',model),('style.source_weights',guarded_weights(model['coefficients'],params=params))):
        current=store.champion(name,scope)
        candidate_score=(lambda f:predict(value,f)) if name=='style.ranker' else (lambda f:weighted(value,f))
        if current and name=='style.ranker':
            champion_score=lambda f:predict(current['value_or_hyperparams'],f)
        else:
            champion_weights={k:v[0] for k,v in current['value_or_hyperparams'].items()} if current else prior_weights
            champion_score=lambda f:weighted(champion_weights,f)
        scores=[]
        for group in groups.values():
            labels=[r['saved'] for r in group]
            scores.append((ndcg(labels,[candidate_score(r['features']) for r in group],ids=[r['id'] for r in group]),
                           ndcg(labels,[champion_score(r['features']) for r in group],ids=[r['id'] for r in group])))
        diffs=[a-b for a,b in scores]
        boots=sorted(sum(rng.choices(diffs,k=len(diffs)))/len(diffs) for _ in range(draws))
        latest=max((r['version'] for r in store.history(name,scope)),default=0)
        ch=store.propose(dict(name=name,scope=scope,family='model_ref',value_or_hyperparams=({k:(weight,v['style_'+k+'_size']) for k,weight in value.items()} if name=='style.source_weights' else value),prior=None,
                              n_eff=len(train),metric='ndcg10_saves_14d',held_out_score=sum(a for a,b in scores)/len(scores),
                              fitted_on_ids_hash=hashlib.sha256('\n'.join(sorted(r['id'] for r in train)).encode()).hexdigest()),latest)
        ok,_=store.promote(name,scope,ch['version'],0,now.isoformat()) if boots[int(v['style_bootstrap_tail']*draws)]>0 else (False,'bootstrap noise')
        results[name]=dict(promoted=ok,interval=(boots[int(v['style_bootstrap_tail']*draws)],boots[min(draws-1,int((1-v['style_bootstrap_tail'])*draws))]))
        if log:
            log.change('param',name,'champion' if ok else 'challenger',version=ch['version'],seed=seed)
    return dict(promoted=results['style.ranker']['promoted'],interval=results['style.ranker']['interval'],
                source_weights_promoted=results['style.source_weights']['promoted'])
