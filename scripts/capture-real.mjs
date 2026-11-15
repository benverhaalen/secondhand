// Prove: node --test --test-concurrency=1 scripts/capture-real.test.mjs
// Mapping contract: cap-real-1 brief; names: spec/product.md §3 and capture/select.ts.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { select } from '../app/src/engines/capture/select.ts';
import { plan } from '../app/src/engines/capture/plan.ts';
import { memoryStore } from '../app/src/engines/param/param.ts';
import { createLog } from '../log/index.js';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const output = resolve(root, 'spec/items/capture-real/2026-11-15.json');
const real = 'assets/demo-items/real';
const runs = 'research/studio/ben/slides/runs';
const json = path => JSON.parse(readFileSync(resolve(root,path),'utf8'));
const photosIn = item => readdirSync(resolve(root,real,item)).filter(file=>/\.(jpg|jpeg|png)$/i.test(file)).sort();

export function loadInputs() {
  return readdirSync(resolve(root,real),{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>entry.name).sort().map(item=>{
    const run = readdirSync(resolve(root,runs)).sort().reverse().find(run=>existsSync(resolve(root,runs,run,item,'manifest.json')));
    if (!run) throw new Error(`${item}: no recorded studio manifest`);
    const manifest = `${runs}/${run}/${item}/manifest.json`;
    const {read,read_model} = json(manifest);
    if (!read || typeof read.tag_text !== 'string' || typeof read.name !== 'string' || !Array.isArray(read.photos) || !read_model) throw new Error(`${manifest}: incomplete recorded read`);
    const tapeFile = `${real}/${item}/tape.json`;
    return {item,manifest,read,read_model,tape:existsSync(resolve(root,tapeFile)) ? json(tapeFile) : null};
  });
}

export const inchesToCm = inches => Math.round(inches * 2.54 * 10) / 10;
const words = text => text.match(/[\p{L}\p{N}]+/gu) ?? [];
function brandOverlap(tag, name) {
  const a=words(tag), b=words(name).map(word=>word.toLowerCase());
  for(let length=a.length;length>=2;length--) for(let start=0;start+length<=a.length;start++) {
    const phrase=a.slice(start,start+length);
    if(b.some((_,i)=>phrase.every((word,j)=>word.toLowerCase()===b[i+j]))) return phrase.join(' ');
  }
}

export function mapRead({item,read,tape}) {
  const facts={}, rules={};
  const add = (field,value,rule,source='label',confidence=0) => {
    facts[field]={value,source,confidence}; rules[field]=rule;
  };
  // Recorded reads have no confidence. Tag proposals stay label/0; any future
  // photo or item_text proposal must stay seen/0. No colour or condition rule.
  const sizes=[...read.tag_text.matchAll(/\b(?:XXXL|XXL|XL|XS|S|M|L|\d+\s*x\s*\d+)\b/gi)];
  if(sizes.length===1) add('size_label',(/\d/.test(sizes[0][0]) ? sizes[0][0].replace(/\s/g,'').toLowerCase() : sizes[0][0].toUpperCase()), 'one size token in tag_text (XS/S/M/L/XL/XXL/XXXL or WxL)');
  const fabric=read.tag_text.match(/\b\d+(?:\.\d+)?%\s+[A-Za-z]+\b/);
  if(fabric) add('fabric',fabric[0],'<n>% <WORD> phrase in tag_text');
  const brand=brandOverlap(read.tag_text,read.name);
  if(brand) add('brand',brand,'longest contiguous word run shared by tag_text and read.name, case-insensitive, at least two words');
  if(item==='marquette-tee' && tape) {
    for(const key of ['pit_to_pit','length']) if(!Number.isFinite(tape[key])) throw new Error(`${item}: tape.${key} must be inches`);
    add('dimensions',{pit_to_pit:inchesToCm(tape.pit_to_pit),length:inchesToCm(tape.length)},'marquette-tee/tape.json: Ben’s inches × 2.54, rounded to 0.1 cm; read by eye, about a quarter inch','you_said',1);
  }
  // Ben picked type; no identify was run. A lookup needs network catalogue or
  // vision hits. Ordinary RGB photos supply neither depth nor Object Capture.
  const state={capture_id:`cap_real_${item}`,item_id:`it_real_${item}`,purpose:'sell',confirm_mode:'tap',has_lidar:false,object_capture:false,
    sites:['ebay','depop','poshmark'],type:'apparel',kept:[],retakes:{},facts,lookups:'none',refused:[]};
  const roles=new Set(read.photos.map(photo=>photo.role));
  state.kept=select(state,memoryStore()).process.filter(step=>roles.has(step.key)).map(step=>step.key);
  return {state,rules};
}

export function scorePhoto(file,role) {
  const result=spawnSync(resolve(root,'.venv/bin/python'),[resolve(root,'scripts/capture_real_score.py'),resolve(root,file),role],{cwd:root,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  if(result.error) throw result.error;
  if(result.status!==0) throw new Error(`${file}: photo score exited ${result.status}: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

export function recordItem(input,score=scorePhoto) {
  const files=photosIn(input.item);
  // slides_run.py sorts these same extensions before the model reads them.
  const indices=input.read.photos.map(photo=>photo.index).sort((a,b)=>a-b);
  if(JSON.stringify(indices)!==JSON.stringify(files.map((_,i)=>i))) throw new Error(`${input.item}: photo indices must cover every sorted real photo exactly once`);
  if(input.read.photos.some(photo=>typeof photo.role!=='string')) throw new Error(`${input.item}: missing photo role`);
  const {state,rules}=mapRead(input);
  const result=plan(state,memoryStore());
  return {item:input.item,manifest:input.manifest,read_model:input.read_model,
    photos:files.map((name,index)=>{
      const file=`${real}/${input.item}/${name}`, role=input.read.photos.find(photo=>photo.index===index).role;
      return {file,role,...score(file,role)};
    }),
    scoring:'jobs/photo/score.py score(): original RGB pixels, recorded role, no mask; fill, centring and background are neutral 0.5',
    state,facts:Object.entries(state.facts).map(([field,fact])=>({field,...fact,rule:rules[field]})),
    flaws:input.read.photos.flatMap(photo=>(photo.flaws ?? []).map(flaw=>({index:photo.index,flaw}))),
    status:result.status,fields:result.fields,
    questions:result.questions.map(q=>[q.shot?.step ?? q.field,q.kind,q.options.find(option=>option.proposed)?.value ?? null]),complete:result.complete};
}

export function main() {
  const log=createLog({src:'capture-real',build:'cap-real-1',sink:line=>process.stderr.write(`${line}\n`)});
  try {
    const inputs=loadInputs();
    if(inputs.length!==3) throw new Error(`expected three real items, got ${inputs.length}`);
    const models=[...new Set(inputs.map(input=>input.read_model))];
    if(models.length!==1) throw new Error('recorded read_model differs between items');
    const items=inputs.map(input=>{
      log.note('recorded input',{item_id:input.item,manifest:input.manifest,photo_count:input.read.photos.length});
      const item=recordItem(input,(file,role)=>log.timed('photo.score',()=>scorePhoto(file,role),{file,role}));
      log.change('capture',item.state.capture_id,item.status);
      return item;
    });
    const record={header:{data:'captured',items:3,
      what_is_real:"Ben's photos of three real garments and a recorded vision-model read of them",
      what_is_not:'no identify run, no phone reads or depth, confidences absent from the read',date:'2026-11-15',read_model:models[0]},items};
    mkdirSync(dirname(output),{recursive:true});
    writeFileSync(output,`${JSON.stringify(record,null,2)}\n`);
    log.note('record written',{file:'spec/items/capture-real/2026-11-15.json',item_count:items.length});
    for(const item of items) console.log(`${item.item}: captured; ${item.photos.length} photos scored; ${item.status}; ${item.questions.length} questions; complete ${Object.entries(item.complete).map(([site,c])=>`${site}=${c.ready}`).join(', ')}; one run on three items, not accuracy`);
    log.end();
    return record;
  } catch(error) {
    log.error('capture-real',error); log.end(); throw error;
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main();
