import { readFile, mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { createLog, maskText } from '../../log/index.js';
import { fileSink } from '../../log/node.js';
import { SET, checkSet, resolveImage } from './check-set.mjs';

export const ASSIST_QUESTION_TIMEOUT_MS = 120_000;
// Agent proposal: per-turn ceiling pending a measured low/medium run.
export const ASSIST_TURN_MAX_USD = 0.25;

export function redact(value, env=process.env) {
  const secrets=Object.entries(env).filter(([key,v])=>v && (v.length>=8 || /key|token|secret|password/i.test(key))).map(([,v])=>v).sort((a,b)=>b.length-a.length);
  const clean=s=>maskText(secrets.reduce((s,v)=>s.split(v).join('[redacted]'),s));
  function visit(v) {
    if(typeof v==='string') return clean(v);
    if(Array.isArray(v)) return v.map(visit);
    if(v && typeof v==='object') return Object.fromEntries(Object.entries(v).map(([k,x])=>[clean(k),visit(x)]));
    return v;
  }
  return visit(value);
}
export async function loadConversation() {
  const conversation=await import('../../app/src/edge/assist/converse.ts');
  const tools=await import('../../app/src/edge/assist/tools.ts');
  return {...conversation,...tools};
}
export async function runSet(questions, {converse, now=()=>new Date(), effort='low', model='claude-sonnet-5-5', outRoot=fileURLToPath(new URL('./out/',import.meta.url)), client, TOOL_DEFS=[], runTool, defaultDeps=()=>undefined, dry=false}={}) {
  if(typeof converse!=='function') throw Error('converse is required');
  if(!['low','medium'].includes(effort)) throw Error('effort must be low or medium');
  const clean=value=>redact(value,dry?{}:process.env);
  const stamp=()=>new Date(now());
  const run_id=stamp().toISOString().replace(/[:.]/g,'-')+'-'+effort+'-'+randomUUID().slice(0,8);
  const dir=join(outRoot,run_id); await mkdir(dir,{recursive:true});
  const sink=fileSink(join(dir,'run.jsonl'));
  const log=createLog({src:'bench.assist.run',build:'dev',sink:line=>sink(clean(line))});
  const snapshot=JSON.stringify(clean(questions),null,2)+'\n';
  const questions_sha256=createHash('sha256').update(snapshot).digest('hex');
  await writeFile(join(dir,'questions.json'),snapshot,{flag:'wx'});
  await writeFile(join(dir,'answers.jsonl'),'',{flag:'wx'});
  const records=[];
  const deps=dry?undefined:defaultDeps(process.env,fetch,log);
  const tools={defs:TOOL_DEFS,run:(name,input,signal)=>{
    if(dry) throw Error('tool_called_in_dry_run');
    return runTool(name,input,deps,signal);
  }};
  log.note('benchmark input',{count:questions.length,model,effort,questions_sha256});
  try {
    for(const question of questions) {
      const asked=stamp(); let answer;
      try {
        let image;
        if(question.image) {
          const path=await resolveImage(question.image);
          const media_type={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}[extname(path)];
          image={media_type,data_base64:(await readFile(path)).toString('base64')};
        }
        answer=await log.call('model',model,{question_id:question.id,effort,has_image:Boolean(image)},async()=>{try {return await converse({text:question.text,image,client,model,effort,tools,now:Date.now,log,signal:AbortSignal.timeout(ASSIST_QUESTION_TIMEOUT_MS),max_cost_usd:ASSIST_TURN_MAX_USD});} catch {throw Error('conversation_failed');}},a=>({result:{state:a.state,tool_count:a.calls?.length??0},cost_usd:a.usage?.cost_usd}));
      } catch {
        // Do not persist provider errors: they may echo credentials or request contents.
        log.note('conversation failed',{question_id:question.id,reason:'conversation_failed'});
        answer={state:'failed',reason:'conversation_failed',blocks:[],results:{},sources:[],calls:[],usage:null,gate:null,ms:{first_text:null,done:stamp()-asked}};
      }
      const results=answer.results??{};
      const record=clean({run_id,question_id:question.id,questions_sha256,model,effort,asked_at:asked.toISOString(),first_text_ms:answer.ms?.first_text??null,done_ms:answer.ms?.done??stamp()-asked,state:answer.state,reason:answer.reason,tools_called:(answer.calls??[]).map(c=>c.tool),tool_calls:(answer.calls??[]).map(c=>({tool:c.tool,...(c.tool==='search_market' && typeof c.input?.exclude_brand==='string'?{exclude_brand:c.input.exclude_brand}:{})})),usage:answer.usage,gate:answer.gate,blocks:answer.blocks,sources:answer.sources,
        results_summary:Object.fromEntries(Object.entries(results).map(([id,r])=>[id,{tool:r.tool,ok:r.ok,reason:r.reason,counts:r.counts}])),
        results:Object.fromEntries(Object.entries(results).map(([id,r])=>[id,{tool:r.tool,ok:r.ok,reason:r.reason,rows:r.rows,counts:r.counts,basis:r.basis,as_of:r.as_of,citation_ids:r.citation_ids,not_built:r.not_built,widgets:r.widgets}]))});
      await appendFile(join(dir,'answers.jsonl'),JSON.stringify(record)+'\n'); records.push(record);
      log.note('answer recorded',{question_id:question.id,state:record.state,tool_count:record.tools_called.length,gate_cut:record.gate?.cut});
    }
  } finally {log.end();}
  return {dir,records};
}
function dryClient() {
  return {messages:{stream(){
    return {on(){},async finalMessage(){return {
      id:'dry',type:'message',role:'assistant',model:'claude-sonnet-5-5',
      content:[{type:'text',text:'No tool was called in a dry run.',citations:null}],
      stop_reason:'end_turn',stop_sequence:null,
      usage:{input_tokens:0,output_tokens:0,cost:0},
    };}};
  }}};
}
export async function runCli({args=process.argv.slice(2),load=loadConversation,outRoot,write=s=>process.stderr.write(s+'\n')}={}) {
  const opts={};
  try {
    for(let i=0;i<args.length;i++) {
      if(args[i]==='--dry' && !opts.dry) {opts.dry=true;continue;}
      const key={'--effort':'effort','--only':'only','--model':'model'}[args[i]];
      if(!key || !args[i+1] || args[i+1].startsWith('--') || key in opts) throw Error('usage: node bench/assist/run.mjs --effort low|medium [--only id,id] [--model <id>] [--dry]');
      opts[key]=args[++i];
    }
    if(!['low','medium'].includes(opts.effort)) throw Error('effort must be low or medium');
    let questions=JSON.parse(await readFile(SET,'utf8')); const errors=checkSet(questions); if(errors.length) throw Error(errors.join('; '));
    if(opts.only) {
      const ids=opts.only.split(','); if(ids.some(id=>!questions.some(q=>q.id===id))) throw Error('unknown question id in --only');
      questions=questions.filter(q=>ids.includes(q.id));
    }
    const modules=await load(); const config=opts.dry?{client:dryClient(),model:'claude-sonnet-5-5'}:await modules.clientFromEnv(process.env);
    if(!config) {write('No model client: set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.');return 2;}
    const client=config.client??config;
    const model=opts.model??config.model??(process.env.ANTHROPIC_API_KEY!==undefined?'claude-sonnet-5-5':'anthropic/claude-sonnet-5.5');
    const result=await runSet(questions,{...modules,client,model,effort:opts.effort,outRoot,dry:Boolean(opts.dry)});
    write(redact(`Answers written to ${result.dir}`,opts.dry?{}:process.env)); return 0;
  } catch(error) {
    write(error.code==='ERR_MODULE_NOT_FOUND'?'Conversation modules are missing; build app/src/edge/assist/converse.ts and tools.ts first.':redact(error.message,opts.dry?{}:process.env)); return 1;
  }
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) process.exitCode=await runCli();
