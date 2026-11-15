"""Style offline proofs; generated histories are labelled synthetic throughout."""
import json
import math
import random
from datetime import datetime, timedelta
from time import perf_counter

from style.edits import PersonState, edit, fold, remove, reset
from style.facets import Event
from style.learn import ndcg
from style.rank import for_you, within_bands


def synthetic_set(*,seed):
    rng=random.Random(seed)
    now=datetime(2026,11,15)
    rows=[]
    for brand in range(20):
        for j in range(30):
            i=brand*30+j
            rows.append(dict(id=f'ls_sim{i}',state='live',person='other',product_id=f'product_sim{i}',
                seller_ref_hash=f'seller_sim{i}',cluster_id=f'cluster_sim{i}',fits=True,recalled=False,label='exact',
                attrs=dict(brand=f'brand_sim{brand}',category='coat',size='M'),delivered_cents=100,low=100,high=200,
                quality=None,posted_at=(now-timedelta(days=30-j)).isoformat(),band=0,popularity=rng.random()+20-brand))
    histories=[]
    for person in range(20):
        brand=(person+1)%20
        picks=[brand*30+j for j in list(range(8))+[28,29]]
        histories.append([Event(f'ev_sim{person}_{j}',f'p_sim{person}','save',now-timedelta(days=40-3*j),
                                dict(rows[i]['attrs'],listing_id=rows[i]['id'])) for j,i in enumerate(picks)])
    return rows,histories,now


def _profile(history,now):
    saved=sorted((e for e in history if e.source=='save'),key=lambda e:e.at)
    cut=math.floor(.8*len(saved))
    train=saved[:cut]
    held=saved[cut:]
    state=PersonState(history[0].person)
    fold(state,train,now)
    return state,held,train


def evaluate(listings,histories,now,*,seed,draws=1000):
    gains=[]
    sizes=[]
    for history in histories:
        state,held,_=_profile(history,now)
        ids={e.attrs['listing_id'] for e in held}
        ranked=within_bands(sorted(listings,key=lambda r:r['posted_at'],reverse=True),state)
        labels=[int(r['id'] in ids) for r in ranked]
        score=[len(ranked)-i for i in range(len(ranked))]
        popular=[r['popularity'] for r in ranked]
        gains.append(ndcg(labels,score)-ndcg(labels,popular))
        size=next((f['value'] for f in state.facets if f['name']=='size'),None)
        sizes += [int(size==e.attrs['size']) for e in held]
    rng=random.Random(seed)
    bootstrap=sorted(sum(rng.choices(gains,k=len(gains)))/len(gains) for _ in range(draws))
    return dict(mode='synthetic',seed=seed,ndcg_gain_interval=(bootstrap[int(.05*draws)],bootstrap[int(.95*draws)]),
                size_accuracy=sum(sizes)/len(sizes),real_proof='not usable yet',
                missing=['600 real live listings','20 real account histories','held-out you_said sizes','fixed successor-release demand snapshot'])


def referral_invariance(listings,histories,now,*,seed):
    rng=random.Random(seed)
    for history in histories:
        expected=None
        for attach in (None,0,'random'):
            state,_,train=_profile(history,now)
            rows=[{**r,**({} if attach is None else dict(referral=rng.random() if attach=='random' else 0,commission=rng.random(),placement=rng.random()))} for r in listings]
            shelf=for_you(state,rows,now,opted_in=True,signal_count=len(train))
            search=[r['id'] for r in within_bands(rows,state)]
            data=json.dumps(dict(shelf=shelf,search=search),sort_keys=True)
            if expected is None:
                expected=data
            elif data!=expected:
                return False
    return True


def removal_and_edit(history,now):
    state,_,train=_profile(history,now)
    brand=train[0].attrs['brand']
    remove(state,'brand',brand,now)
    other=[Event(f'unrelated_sim{i}',state.person,'save',now+timedelta(days=i+1),dict(brand='unrelated_sim')) for i in range(50)]
    fold(state,train+other,now+timedelta(days=51))
    if any(f['name']=='brand' and f['value']==brand for f in state.facets):
        return False
    edit(state,'brand',brand,weight=.9)
    fold(state,train+other,now+timedelta(days=51))
    if not any(f['name']=='brand' and f['value']==brand and f['pinned'] and f['weight']==.9 for f in state.facets):
        return False
    reset(state,now+timedelta(days=52))
    return state.facets==[] and state.shelf is None and state.alert_bar is None


def shelf_speed(listings,histories,now):
    times=[]
    for history in histories:
        state,_,train=_profile(history,now)
        start=perf_counter()
        for_you(state,listings,now,opted_in=True,signal_count=len(train))
        times.append((perf_counter()-start)*1000)
    return dict(p95_ms=sorted(times)[math.ceil(.95*len(times))-1],mode='synthetic',listings=len(listings),histories=len(histories))
