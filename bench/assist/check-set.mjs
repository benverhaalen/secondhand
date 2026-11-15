import { readFile, access } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
export const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export const SET=fileURLToPath(new URL('./questions.json',import.meta.url));
export const CATEGORIES={identify_words:3,identify_photo:3,price_trend:4,where_when:3,off_brand:3,corpus:3,general_web:3,refuse_or_thin:3};
export const TOOLS=['search_market','value_item','price_trend','where_to_list','market_store','web_search'];
export const TREND_QUESTION='What are the latest fashion trends millenials are wearing, what about gen z';
const nonempty=s=>typeof s==='string' && s.trim().length>0;
export function checkSet(questions) {
  if(!Array.isArray(questions)) return ['set must be an array'];
  const errors=[]; const ids=new Set();
  if(questions.length!==25) errors.push('set must have 25 questions');
  for(const [category,count] of Object.entries(CATEGORIES)) if(questions.filter(q=>q?.category===category).length!==count) errors.push(`${category}: expected ${count}`);
  for(const q of questions) {
    const err=why=>errors.push(`${q?.id ?? '?'}: ${why}`);
    if(!q || typeof q!=='object' || Array.isArray(q)) {err('question must be an object');continue;}
    if(!nonempty(q.id) || !/^[a-z0-9-]+$/.test(q.id) || ids.has(q.id)) err('id must be unique and use lowercase words and hyphens'); ids.add(q.id);
    if(!(q.category in CATEGORIES)) err('unknown category');
    if(!nonempty(q.text)) err('text is required');
    if(/https?:\/\/|\$\s*\d/.test(q.text)) err('question must not contain a URL or a price');
    for(const key of ['must','must_not']) if(!Array.isArray(q[key]) || !q[key].length || !q[key].every(nonempty)) err(`${key} needs checkable lines`);
    if(!q.tools || typeof q.tools!=='object' || Array.isArray(q.tools)) err('tools must be an object');
    else for(const [key,list] of Object.entries(q.tools)) {
      if(!['all','any','none'].includes(key) || !Array.isArray(list) || !list.length || !list.every(t=>TOOLS.includes(t)) || new Set(list).size!==list.length) err('invalid tools rule');
    }
    if((q.tools?.none??[]).some(t=>(q.tools?.all??[]).includes(t))) err('a tool cannot be both required and forbidden');
    for(const flag of ['refuse','thin_ok']) if(flag in q && q[flag]!==true) err(`${flag} must be true when supplied`);
    if(q.image!==undefined && (typeof q.image!=='string' || !/^spec\/items\/.+\.(jpg|jpeg|png|webp)$/.test(q.image) || q.image.includes('\\') || q.image.split('/').some(p=>['..','.',''].includes(p)))) err('image must stay under spec/items/');
    if(q.category==='identify_photo' && !q.image) err('photo question needs an image');
    for(const key of Object.keys(q)) if(!['id','category','text','image','must','must_not','tools','refuse','thin_ok'].includes(key)) err(`unknown field ${key}`);
  }
  const trend=questions.filter(q=>q?.text===TREND_QUESTION);
  if(trend.length!==1 || trend[0].category!=='general_web' || !['web_search','search_market'].every(t=>trend[0].tools?.all?.includes(t))) errors.push('the generation question must occur exactly once with both required tools');
  return errors;
}
// capture-real is a catalog; its photo bytes live in assets/. Keep the set's references in the spec namespace.
export async function resolveImage(image) {
  if(typeof image!=='string' || !/^spec\/items\//.test(image) || image.split('/').some(p=>['..','.',''].includes(p)) || image.includes('\\')) throw Error('image must stay under spec/items/');
  const direct=resolve(ROOT,image);
  try { await access(direct); return direct; } catch(error) { if(error.code!=='ENOENT') throw error; }
  const [,item,file]=/^spec\/items\/capture-real\/([^/]+)\/([^/]+)$/.exec(image)??[];
  const catalog=JSON.parse(await readFile(resolve(ROOT,'spec/items/capture-real/2026-11-15.json'),'utf8'));
  const photo=catalog.items.find(i=>i.item===item)?.photos.find(p=>basename(p.file)===file);
  if(!photo || !photo.file.startsWith('assets/demo-items/real/') || relative(ROOT,resolve(ROOT,photo.file)).startsWith('..')) throw Error(`photo not in capture-real catalog: ${image}`);
  const path=resolve(ROOT,photo.file); await access(path); return path;
}
export async function checkCli() {
  const questions=JSON.parse(await readFile(SET,'utf8')); const errors=checkSet(questions);
  if(errors.length) throw Error(errors.join('\n'));
  for(const q of questions.filter(q=>q.image)) await resolveImage(q.image);
  for(const [category,count] of Object.entries(CATEGORIES)) process.stdout.write(`${category}: ${count}\n`);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try { await checkCli(); } catch(error) { process.stderr.write(error.message+'\n'); process.exitCode=1; }
}
