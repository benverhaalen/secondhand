"""Synthetic trust label stream and offline production-code timing (§9, tr-6).

No account inputs are accepted. Node imports the actual trust decision, signal
and label modules; the extractor is a fixture, never a network call. Process
startup is outside timing. The code budget uses the full fixture-predicate path
(including score and promise scheduling), a conservative bound. This cannot prove a live extractor's latency or
recover signal weights until the nightly signal-weight learner exists.
"""
import json
import math
import random
import subprocess
from pathlib import Path

from param.registry import MemoryStore
from trust.fit import fit, brier, split

ROOT=Path(__file__).resolve().parents[2]


def label_stream(*,seed,n,weights):
    rng=random.Random(seed)
    rows=[]
    for i in range(n):
        signals={k:int(rng.random()<.3) for k in weights}
        z=-2+sum(weights[k]*v for k,v in signals.items())
        y=int(rng.random()<1/(1+math.exp(-z)))
        rows.append(dict(mode='synthetic',signals=signals,z=z,
            trust_label=dict(subject_id=f'thread_sim{i}',kind='scam',value=y,weight=1.,source='simulation',
                             observed_at='2026-11-01T00:00:00Z',resolved_at='2026-11-02T00:00:00Z')))
    return rows


def calibration_trial(*,seed,n):
    stream=label_stream(seed=seed,n=n,weights={'off_platform':2.,'new_account':.7})
    # Deliberate score miscalibration, holding the production fit to unseen labels.
    rows=[(r['z']+4,r['trust_label']['value']) for r in stream]
    store=MemoryStore()
    result=fit(store,rows,'2026-11-03T00:00:00Z')
    champion=store.champion('trust_calib',{})
    _,held=split(rows)
    baseline=brier(dict(kind='platt',a=1,b=0),held)
    cur=champion['held_out_score']
    bad=store.propose(dict(champion,held_out_score=cur-1),result.version)
    bad_promoted=store.promote('trust_calib',{},bad['version'],0,'2026-11-04T00:00:00Z')[0]
    return dict(mode='synthetic',held_out_brier=-cur,uncalibrated_brier=baseline,bad_promoted=bad_promoted,
                missing=['nightly signal-weight regression','live text-predicate latency'])


BRIDGE=r"""
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { memoryStore } from './app/src/engines/param/param.ts';
import { declareTrust, codeSignals } from './app/src/engines/trust/signals.ts';
import { decideThread } from './app/src/engines/trust/decide.ts';
import { createLabels } from './app/src/engines/trust/labels.ts';
const input=JSON.parse(readFileSync(0,'utf8'));
const store=memoryStore();
declareTrust(store);
let out;
if(input.op==='poison') {
  const labels=createLabels(store,'simulation-only-public-fixture');
  const initial=store.read('trust_q.off_platform',{}).value;
  for(let i=0;i<input.n;i++) {
    labels.addLabel({thread_id:`positive_sim${i}`,person:'seller_sim',buyer:`buyer_sim${i}`,site:'ebay',outcome:'scam',weight:1,present:['off_platform'],absent:[],at:'2026-11-01T00:00:00Z'});
    labels.addLabel({thread_id:`negative_sim${i}`,person:'seller_neg_sim',buyer:`buyer_sim${i}`,site:'ebay',outcome:'fine',weight:1,present:[],absent:['off_platform'],at:'2026-11-01T00:00:00Z'});
  }
  const q=store.read('trust_q.off_platform',{site:'ebay',person:'seller_sim'}).value;
  const r=store.read('trust_r.off_platform',{site:'ebay',person:'seller_neg_sim'}).value;
  const priorR=store.read('trust_r.off_platform',{}).value;
  out={positive_mass:q.alpha+q.beta-initial.alpha-initial.beta,negative_mass:r.alpha+r.beta-priorR.alpha-priorR.beta,
       cap_mass:store.read('trust_seller_cap',{}).value*(initial.alpha+initial.beta),labels:labels.labelsFor('seller_sim').length};
} else {
  let networkCalls=0;
  globalThis.fetch=async()=>{networkCalls++;throw new Error('network forbidden in synthetic trust bench');};
  const p=n=>store.read(n,{}).value;
  const code=[],full=[],actions=[];
  let hardBlocked=0,modelDownAsked=0;
  for(let offset=0;offset<input.n;offset+=input.burst) {
    await Promise.all(Array.from({length:Math.min(input.burst,input.n-offset)},async(_,j)=>{
      const i=offset+j;
      const msg={id:`msg_sim${i}`,thread_id:`thread_sim${i}`,site:'facebook',n:1,text:i%4===0?'Pay with an Apple gift card':'Does this include the case?',at:'2026-11-01T00:00:00Z'};
      const ctx={buyer:{age_days:900,ratings:60,good_purchases:12},banner:false,urgent:false,price_usd:80,printHits:{sellers:0,buyers:0},sameTextListings10m:0,p};
      let start=performance.now();
      codeSignals(msg,ctx);
      code.push(performance.now()-start);
      start=performance.now();
      const result=await decideThread({store,model:async()=>{if(i%4===1)throw new Error('fixture extractor down');return i%4===2?[{signal:'off_platform',confidence:.9,span:'fixture predicate'}]:[];}},
        {msg,ctx,group:'facebook_local',checkout:false,orderPaid:false,local:true,keep_q50:80,refund_asked:0});
      full.push(performance.now()-start);
      actions.push(result.action);
      if(i%4===0&&result.action==='block')hardBlocked++;
      if(i%4===1&&result.action==='ask')modelDownAsked++;
    }));
  }
  const p95=xs=>xs.sort((a,b)=>a-b)[Math.ceil(xs.length*.95)-1];
  out={count:actions.length,signal_p95_ms:p95(code),code_p95_ms:p95(full),full_p95_ms:p95(full),hard_blocked:hardBlocked,
       model_down_asked:modelDownAsked,network_calls:networkCalls,model:'fixture',mode:'synthetic'};
}
process.stdout.write(JSON.stringify(out));
"""


def _bridge(payload,log=None):
    def run():
        result=subprocess.run(['node','--input-type=module','-e',BRIDGE],input=json.dumps(payload),text=True,
                              capture_output=True,cwd=ROOT,timeout=60,check=True)
        return json.loads(result.stdout)
    if log:
        return log.call('tool','trust.synthetic',payload,run,lambda result:dict(result=result))
    return run()


def poison_trial(*,n=500,log=None):
    if n<=0:
        raise ValueError('positive synthetic label count required')
    return _bridge(dict(op='poison',n=n),log)


def production_bench(*,n=1000,burst=50,mode='synthetic',log=None):
    if mode!='synthetic':
        raise ValueError('trust bench accepts synthetic threads only')
    if n<=0 or burst<=0:
        raise ValueError('positive synthetic count and burst required')
    return _bridge(dict(op='bench',n=n,burst=burst),log)
