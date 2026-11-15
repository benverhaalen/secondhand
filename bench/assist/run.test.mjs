import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSet, runCli } from './run.mjs';
import { checkLog } from '../../spec/log.mjs';
import { checkSet, resolveImage } from './check-set.mjs';
const f=JSON.parse(await readFile(new URL('./fixtures/answers.json',import.meta.url)));
const questions=JSON.parse(await readFile(new URL('./questions.json',import.meta.url)));
const answer=()=>({...structuredClone(f.answer),calls:[{tool:'search_market'}],ms:{first_text:100,done:700}});
test('runner asks once sequentially, writes one line each and never serializes an env value',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'assist-run-')); let active=0; const asked=[];
  const secret=['test','credential','not','for','output'].join('-'); process.env.ASSIST_TEST_SECRET=secret;
  try {
    const result=await runSet([f.question,{...f.question,id:'second'}],{outRoot:dir,effort:'medium',model:'fixture',now:()=>new Date('2026-11-15T12:00:00Z'),converse:async q=>{
      assert.equal(active++,0); asked.push(q.text); await Promise.resolve(); active--;
      const a=answer(); a.blocks.push({type:'text',text:secret}); a.unexpected=process.env; return a;
    }});
    const lines=(await readFile(join(result.dir,'answers.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(lines.length,2); assert.equal(asked.length,2); assert.equal(lines[1].question_id,'second');
    assert.equal(lines[0].effort,'medium'); assert.equal(lines[0].done_ms,700);
    assert.deepEqual(lines[0].tools_called,['search_market']); assert.ok(lines[0].results.r1.rows.length);
    for(const file of await readdir(result.dir)) assert.equal((await readFile(join(result.dir,file),'utf8')).includes(secret),false,file);
  } finally { delete process.env.ASSIST_TEST_SECRET; }
});
test('a thrown conversation is recorded as failed and later questions still run',async()=>{
  let n=0; const result=await runSet([f.question,{...f.question,id:'second'}],{outRoot:await mkdtemp(join(tmpdir(),'assist-fail-')),converse:async()=>{if(!n++)throw Error('failure');return answer();}});
  assert.equal(result.records[0].state,'failed'); assert.equal(result.records[1].state,'answered');
  assert.deepEqual(checkLog(await readFile(join(result.dir,'run.jsonl'),'utf8')).problems,[]);
});
test('missing client exits 2 with a plain message without calling converse',async()=>{
  const output=[];
  const code=await runCli({args:['--effort','low'],load:async()=>({clientFromEnv:()=>null}),write:line=>output.push(line)});
  assert.equal(code,2); assert.match(output.join(''),/key|client/i);
});
test('CLI rejects missing effort, unknown effort and unknown question ids',async()=>{
  for(const args of [[],['--effort','high'],['--effort','low','--only','unknown']]) assert.equal(await runCli({args,write:()=>{}}),1);
});
test('set has the category counts and rejects malformed entries and image escapes',()=>{
  assert.equal(checkSet(questions).length,0);
  assert.equal(questions.length,25);
  for(const patch of [{id:questions[1].id},{category:'unknown'},{tools:{all:['unknown']}},{image:'spec/items/../../escape.jpg'},{must:[]}]) {
    const qs=structuredClone(questions); Object.assign(qs[0],patch); assert.ok(checkSet(qs).length,JSON.stringify(patch));
  }
});
test('real capture photos resolve and arrive as base64 images',async()=>{
  const q=questions.find(q=>q.category==='identify_photo');
  const image=await resolveImage(q.image); assert.ok((await readFile(image)).length>0);
  await runSet([q],{outRoot:await mkdtemp(join(tmpdir(),'assist-image-')),converse:async input=>{
    assert.equal(input.image.media_type,'image/jpeg');
    assert.deepEqual(Buffer.from(input.image.data,'base64'),await readFile(image)); return answer();
  }});
});
test('off-brand evidence records exclude_brand without saving arbitrary tool inputs',async()=>{
  const a=answer(); a.calls=[{tool:'search_market',input:{exclude_brand:'Carhartt',private_field:'must not be saved'}}];
  const result=await runSet([f.question],{outRoot:await mkdtemp(join(tmpdir(),'assist-tools-')),converse:async()=>a});
  assert.deepEqual(result.records[0].tool_calls,[{tool:'search_market',exclude_brand:'Carhartt'}]);
  assert.equal(JSON.stringify(result.records).includes('private_field'),false);
});
