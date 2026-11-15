const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--allow-file-access-from-files']});
const p=await b.newPage({viewport:{width:1740,height:930},deviceScaleFactor:+(process.argv[3]||2)});
await p.goto('file://'+process.cwd()+'/spec4.html');await p.evaluate(()=>document.fonts.ready);
console.log(await p.evaluate(()=>['400 15px NM','500 15px NM','600 21px CL'].map(f=>document.fonts.check(f)).join(' ')));
const r=await p.evaluate(()=>{const o={};document.querySelectorAll('.ph').forEach((ph,i)=>{ph.querySelectorAll('[data-part]').forEach(e=>{const b=e.getBoundingClientRect();const k=(i?'D ':'L ')+e.dataset.part;(o[k]=o[k]||new Set()).add(Math.round(b.width)+'x'+Math.round(b.height))})});return Object.entries(o).map(([k,v])=>k+' '+[...v].join(','))});
console.log(r.join('\n'));await p.screenshot({path:process.argv[2]||'today4.png',fullPage:true});await b.close()})();
