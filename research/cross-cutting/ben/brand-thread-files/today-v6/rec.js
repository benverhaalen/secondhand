const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--allow-file-access-from-files']});
const c=await b.newContext({viewport:{width:760,height:894},recordVideo:{dir:'vid',size:{width:760,height:894}}});
const p=await c.newPage();await p.goto('file://'+process.cwd()+'/anim.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(400);
await p.evaluate(()=>run());await p.waitForTimeout(8600);await p.screenshot({path:'anim-end.png'});await c.close();await b.close()})();
