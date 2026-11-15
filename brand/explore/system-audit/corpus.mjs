// Runs every file in breaker/ through the brand checker and says where the checker stands.
// A file is named <kind>-<what>.<medium>.html. evade: breaks a rule and should fail. false: follows the rules and should pass.
// control: a plain page, on brand or off. Run: node brand/explore/system-audit/corpus.mjs
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { check, playwright } from '../../../scripts/brand-check.mjs';

const dir = fileURLToPath(new URL('./breaker/', import.meta.url)), pw = playwright();
if (!pw) { console.error('Playwright is not installed here'); process.exit(2); }
const browser = await pw.chromium.launch(), res = { evade: [0, 0], false: [0, 0], control: [0, 0], robust: [0, 0] }, lines = [];
for (const f of readdirSync(dir).filter(f => f.endsWith('.html')).sort()) {
  const kind = f.split('-')[0], medium = f.split('.').at(-2); let errs;
  if (f.includes('never-returns')) continue;
  try { errs = (await Promise.race([check(dir + f, medium, { browser }), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 40000))])).findings.filter(o => o.level === 'error'); } catch (e) { lines.push(`CRASH ${f} ${e.message.slice(0, 80)}`); continue; }
  res[kind][errs.length ? 1 : 0]++;
  if (kind === 'evade' && !errs.length) lines.push(`still passes  ${f}`);
  if (kind === 'false' && errs.length) lines.push(`still fails   ${f}  ${[...new Set(errs.map(e => e.id))].join(',')}: ${errs[0].msg.slice(0, 90)}`);
  if (kind === 'control' && f.includes('onbrand') && errs.length) lines.push(`control fails ${f}  ${errs[0].id}: ${errs[0].msg.slice(0, 100)}`);
}
await browser.close(); console.log(lines.join('\n'));
console.log(`evade: ${res.evade[1]} of ${res.evade[0] + res.evade[1]} caught. false: ${res.false[0]} of ${res.false[0] + res.false[1]} pass. control: ${res.control[0]} pass, ${res.control[1]} fail.`);
