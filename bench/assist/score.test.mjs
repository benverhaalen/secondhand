import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scoreAnswer, scoreRun, percentile, validateJudge, judgeWithClient } from './score.mjs';
const f = JSON.parse(await readFile(new URL('./fixtures/answers.json', import.meta.url)));
const copy = () => structuredClone(f.answer);
const judge = async () => JSON.stringify(f.judge);
test('perfect recorded answer scores 1 including all rubric lines', async () => {
  assert.equal((await scoreAnswer(f.question, copy(), { judge })).score, 1);
});
test('missing must-tool loses exactly its point', async () => {
  const a=copy(); a.tools_called=[];
  const s=await scoreAnswer(f.question,a,{judge});
  assert.equal(s.checks.find(c=>c.id==='tool:all:search_market').met,false);
  assert.equal(s.score,(s.checks.length-1)/s.checks.length);
});
test('a price is not a refusal', async () => {
  const q={...f.question,refuse:true,tools:{}}; const a=copy(); a.blocks=[{type:'text',text:'The price is $42.'}];
  assert.equal((await scoreAnswer(q,a)).checks.find(c=>c.id==='refusal').met,false);
  a.blocks=[{type:'text',text:'I cannot buy it on your behalf.'}];
  assert.equal((await scoreAnswer(q,a)).checks.find(c=>c.id==='refusal').met,true);
});
test('p50 and p95 use nearest rank on seven hand sorted values', () => {
  assert.equal(percentile(f.seven_values,.5),7);
  assert.equal(percentile(f.seven_values,.95),23);
  assert.equal(percentile([],.5),null);
});
test('invalid, incomplete or duplicate judge JSON fails every rubric line', async () => {
  for(const reply of ['not json','{}',JSON.stringify({lines:[f.judge.lines[0],f.judge.lines[0]]})]) {
    const s=await scoreAnswer(f.question,copy(),{judge:async()=>reply});
    assert.equal(s.judge_failure,true);
    assert.equal(s.checks.filter(c=>c.id.startsWith('must')).filter(c=>c.met).length,0);
  }
  assert.throws(()=>validateJudge({lines:[{id:'must:0',met:'true',quote:'x'}]},f.question));
});
test('widgets, thin counts, any/none tools and gate cuts are checked', async () => {
  const q={...f.question,thin_ok:true,tools:{any:['value_item','price_trend'],none:['search_market']}};
  const a=copy(); a.blocks=[{type:'text',text:'Too few listings.'},{type:'widget',widget:'listings',result_id:'missing'}]; a.gate={cut:2};
  const s=await scoreAnswer(q,a);
  for(const id of ['tool:any','tool:none:search_market','thin_count','widget:1']) assert.equal(s.checks.find(c=>c.id===id).met,false,id);
  assert.equal(s.gate_cut,2);
  delete a.gate; assert.equal((await scoreAnswer(q,a)).checks.find(c=>c.id==='gate_reported').met,false);
});
test('judge receives rendered rows and strict tool schema with low effort',async()=>{
  let request;
  const client={messages:{create:async r=>{request=r;return {content:[{type:'tool_use',name:'grade_answer',input:f.judge}]};}}};
  const reply=await judgeWithClient(client,'openrouter')(f.question,copy());
  assert.deepEqual(JSON.parse(reply),f.judge);
  assert.equal(request.model,'anthropic/claude-haiku-5.5');
  assert.equal(request.output_config.effort,'low');
  assert.equal(request.tools[0].strict,true);
  assert.match(request.messages[0].content,/poshmark/);
  assert.match(request.messages[0].content,/must_not/);
});
test('report includes missing answers as zero, unknown cost, intervals and worst reasons',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'assist-score-'));
  await writeFile(join(dir,'questions.json'),JSON.stringify([f.question,{...f.question,id:'missing'}]));
  const a=copy(); delete a.usage.cost_usd;
  await writeFile(join(dir,'answers.jsonl'),JSON.stringify(a)+'\n');
  const s=await scoreRun(dir,{judge});
  assert.equal(s.overall.mean,0.5); assert.equal(s.overall.perfect.n,1); assert.equal(s.overall.perfect.of,2);
  assert.equal(s.cost_usd.unknown,1); assert.equal(s.cost_usd.total,null);
  assert.equal(s.worst[0].question_id,'missing');
  assert.match(await readFile(join(dir,'report.md'),'utf8'),/missing_answer/);
  assert.ok(JSON.parse(await readFile(join(dir,'scores.json'))).overall.perfect.interval95);
  await writeFile(join(dir,'answers.jsonl'),JSON.stringify(a)+'\n'+JSON.stringify(a)+'\n');
  await assert.rejects(scoreRun(dir),/duplicate/);
});
test('a widget also needs the saved result rows, not just summary metadata',async()=>{
  const a=copy(); delete a.results.r1;
  assert.equal((await scoreAnswer(f.question,a)).checks.find(c=>c.id==='widget:1').met,false);
});
test('snapshot changes are rejected rather than silently rescoring another rubric',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'assist-hash-')); const a=copy(); a.questions_sha256='not-the-snapshot-hash';
  await writeFile(join(dir,'questions.json'),JSON.stringify([f.question]));
  await writeFile(join(dir,'answers.jsonl'),JSON.stringify(a)+'\n');
  await assert.rejects(scoreRun(dir),/hash/);
});
test('judge can verify prose-only claims against saved tool results',async()=>{
  const a=copy(); a.blocks=a.blocks.filter(b=>b.type==='text');
  let payload;
  const client={messages:{create:async request=>{payload=JSON.parse(request.messages[0].content);return {content:[{type:'tool_use',name:'grade_answer',input:f.judge}]};}}};
  await judgeWithClient(client,'anthropic')(f.question,a);
  assert.deepEqual(payload.results,a.results);
});
test('a widget must be supported by its referenced tool result',async()=>{
  const a=copy(); a.results.r1.widgets=['listings']; a.blocks[1].widget='price_trend';
  assert.equal((await scoreAnswer(f.question,a)).checks.find(c=>c.id==='widget:1').met,false);
});
