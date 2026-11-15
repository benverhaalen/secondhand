// Sweep the real policy with the real actor and price fields; no marketplace calls.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, MODE_FOR, NEVER_PERFORMED } from '../app/src/edge/events/policy.ts';
import { createLog } from '../log/index.js';
import { fileSink } from '../log/node.js';

export function sweep(path = 'logs/policy-sweep.jsonl') {
  const policy_version = createHash('sha256').update(readFileSync(new URL('../app/src/edge/events/policy.ts', import.meta.url))).digest('hex').slice(0, 12);
  const actions = [...new Set([...Object.keys(MODE_FOR), ...NEVER_PERFORMED])].sort();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '');
  // Session boundaries use the writer but only decision.answer lines belong in this fixture file.
  const sink = fileSink(path);
  const log = createLog({ src: 'policy_sweep', build: process.env.SECONDHAND_BUILD ?? 'dev',
    sink: line => { if (JSON.parse(line).event === 'decision.answer') sink(line); } });
  for (const action of actions) {
    for (const site of ['ebay', 'depop', 'poshmark', 'mercari']) {
      for (const promoted of [false, true]) {
        const result = check({ action, decision_kind: action, actor: 'auto', site,
          promoted: new Set(promoted ? actions : []),
          // The promoted markdown tuple exercises the floor overriding an auto kind.
          ...(action === 'price_below_floor' || (action === 'markdown' && promoted)
            ? { price_cents: 99, floor_cents: 100 } : {}) });
        const mode = result.allow ? 'auto' : result.mode;
        const why = result.allow ? 'policy allowed' : result.hint.do === 'handoff' ? 'person acts on site' : `policy ${mode}`;
        log.event('decision.answer', { decision: `sweep_${action}_${site}_${promoted}`, option: result.allow ? 'allow' : 'hold',
          action, site, kind: result.allow ? action : result.decision_kind, mode, allow: result.allow,
          promoted, policy_version, why });
      }
    }
  }
  log.end();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) sweep(process.argv[2]);
