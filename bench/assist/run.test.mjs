import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSet, runCli } from './run.mjs';
import { checkLog } from '../../spec/log.mjs';
import { checkSet, resolveImage } from './check-set.mjs';
import { converse } from '../../app/src/edge/assist/converse.ts';
import { TOOL_DEFS, runTool, defaultDeps } from '../../app/src/edge/assist/tools.ts';
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
    assert.deepEqual(Buffer.from(input.image.data_base64,'base64'),await readFile(image)); return answer();
  }});
});
test('off-brand evidence records exclude_brand without saving arbitrary tool inputs',async()=>{
  const a=answer(); a.calls=[{tool:'search_market',input:{exclude_brand:'Carhartt',private_field:'must not be saved'}}];
  const result=await runSet([f.question],{outRoot:await mkdtemp(join(tmpdir(),'assist-tools-')),converse:async()=>a});
  assert.deepEqual(result.records[0].tool_calls,[{tool:'search_market',exclude_brand:'Carhartt'}]);
  assert.equal(JSON.stringify(result.records).includes('private_field'),false);
});

test('runner uses the real converse contract, image, dependencies and a fresh deadline per question', async () => {
  const message=JSON.parse(await readFile(new URL('../../app/src/edge/assist/fixtures/converse/answer.json',import.meta.url)))[0];
  message.content=[{type:'text',text:'Ready to help.',citations:null}];
  const requests=[],signals=[]; let depsCalls=0;
  const client={messages:{stream(params,options){
    requests.push(structuredClone(params)); signals.push(options.signal);
    return {on(){},async finalMessage(){return structuredClone(message);}};
  }}};
  const photo=questions.find(q=>q.category==='identify_photo');
  const result=await runSet([f.question,photo],{converse,client,TOOL_DEFS,runTool,
    defaultDeps:(env,fetch,log)=>{depsCalls++; assert.equal(env,process.env); assert.equal(typeof fetch,'function'); assert.equal(typeof log.error,'function'); return defaultDeps(env,fetch,log);},
    outRoot:await mkdtemp(join(tmpdir(),'assist-real-'))});
  assert.deepEqual(result.records.map(r=>r.state),['answered','answered']);
  assert.equal(depsCalls,1);
  assert.equal(requests.length,2);
  assert.equal(signals[0].aborted,false);
  assert.notEqual(signals[0],signals[1]);
  assert.ok(requests[0].tools.some(t=>t.name==='value_item'));
  assert.equal(requests[1].messages[0].content[0].type,'image');
  assert.equal(requests[1].messages[0].content[0].source.data,(await readFile(await resolveImage(photo.image))).toString('base64'));
  assert.deepEqual(checkLog(await readFile(join(result.dir,'run.jsonl'),'utf8')).problems,[]);
});

test('runner tool adapter gives runTool the constructed deps and the question signal', async () => {
  const messages=JSON.parse(await readFile(new URL('../../app/src/edge/assist/fixtures/converse/one-tool.json',import.meta.url)));
  let round=0, depsCalls=0, toolsRun=0; const deps={marker:true}; let questionSignal;
  const client={messages:{stream(_params,options){questionSignal=options.signal;return {on(){},async finalMessage(){return structuredClone(messages[round++]);}};}}};
  const result=await runSet([f.question],{converse,client,TOOL_DEFS,defaultDeps:()=>{depsCalls++;return deps;},
    runTool:async(name,input,actualDeps,signal)=>{
      toolsRun++; assert.equal(name,'value_item'); assert.equal(input.query,'wool jacket');
      assert.equal(actualDeps,deps); assert.equal(signal,questionSignal);
      return {...structuredClone(f.answer.results.r1),as_of:'2026-11-15',citation_ids:['c1'],not_built:[],ms:0};
    },outRoot:await mkdtemp(join(tmpdir(),'assist-adapter-'))});
  assert.equal(result.records[0].state,'answered'); assert.equal(depsCalls,1); assert.equal(toolsRun,1);
});

test('dry CLI runs all 25 questions through real converse without keys or network', async () => {
  const output=[]; const originalFetch=globalThis.fetch; const originalEnv=process.env;
  globalThis.fetch=()=>{throw Error('dry run touched network');};
  process.env=new Proxy(originalEnv,{
    get(target,key){
      if(typeof key==='string' && /key|token|secret|password/i.test(key)) throw Error('dry run read a key');
      return Reflect.get(target,key);
    },
    ownKeys(){throw Error('dry run enumerated credentials');},
  });
  const outRoot=await mkdtemp(join(tmpdir(),'assist-dry-'));
  try {
    const code=await runCli({args:['--effort','low','--dry'],outRoot,
      load:async()=>({converse,TOOL_DEFS,runTool:()=>{throw Error('dry tool called');},defaultDeps:()=>{throw Error('dry deps read credentials');},clientFromEnv:()=>{throw Error('dry client read a key');}}),
      write:line=>output.push(line)});
    assert.equal(code,0,output.join('\n'));
    const folders=await readdir(outRoot); assert.equal(folders.length,1);
    const dir=join(outRoot,folders[0]);
    const answers=(await readFile(join(dir,'answers.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(answers.length,25);
    assert.ok(answers.every(a=>a.state==='answered' && a.blocks[0].text==='No tool was called in a dry run.'));
    assert.equal(JSON.parse(await readFile(join(dir,'questions.json'),'utf8')).length,25);
    assert.deepEqual(checkLog(await readFile(join(dir,'run.jsonl'),'utf8')).problems,[]);
  } finally {globalThis.fetch=originalFetch;process.env=originalEnv;}
});
