// Reads platform-fit.json and answers "where does this go?".
//   node fit.mjs                 the fit matrix as a markdown table
//   node fit.mjs sets            the set list for each platform, and the "all" set
//   node fit.mjs <product type>  the route for one product type
//   node fit.mjs check           every type has a verdict and a reason on every platform
import data from './platform-fit.json' with { type: 'json' }; // static, no import.meta: the app's server bundle includes this file

const RANK = { best: 4, good: 3, ok: 2, avoid: 1, blocked: 0 };
const ids = Object.keys(data.platforms);
const posting = ids.filter(p => data.platforms[p].role === 'post');

// Where one product type goes. `reach: true` also posts to the "ok" platforms.
export function route(type, { reach = false, platforms = posting } = {}) {
  const row = data.fit[type];
  if (!row) throw new Error(`unknown product type: ${type}`);
  const out = { post: [], offer: [], warn: [], never: [] };
  for (const p of platforms) {
    const [verdict, reason] = row[p];
    const entry = { platform: p, verdict, reason };
    if (RANK[verdict] >= 3) out.post.push(entry);
    else if (verdict === 'ok') (reach ? out.post : out.offer).push(entry);
    else if (verdict === 'avoid') out.warn.push(entry);
    else out.never.push(entry);
  }
  out.post.sort((a, b) => RANK[b.verdict] - RANK[a.verdict]);
  return out;
}

// Product types that no posting platform refuses or warns about.
export const allSet = () =>
  Object.keys(data.types).filter(t => posting.every(p => RANK[data.fit[t][p][0]] >= 2));

export function check() {
  const errors = [];
  for (const t of Object.keys(data.types))
    for (const p of ids) {
      const cell = data.fit[t]?.[p];
      if (!cell || !(cell[0] in RANK) || !cell[1]) errors.push(`${t} on ${p}`);
    }
  for (const t of Object.keys(data.fit)) if (!data.types[t]) errors.push(`fit row without a type: ${t}`);
  return errors;
}

const arg = process.argv[2];
const label = t => data.types[t];
if (process.argv[1]?.endsWith('fit.mjs')) {
  if (arg === 'check') {
    const errors = check();
    console.log(errors.length ? errors.join('\n') : 'fit ok');
    process.exit(errors.length ? 1 : 0);
  } else if (arg === 'sets') {
    console.log(`all: ${allSet().map(label).join('; ')}\n`);
    for (const p of ids) {
      console.log(data.platforms[p].name);
      for (const v of Object.keys(RANK)) {
        const ts = Object.keys(data.types).filter(t => data.fit[t][p][0] === v);
        if (ts.length) console.log(`  ${v}: ${ts.map(label).join('; ')}`);
      }
    }
  } else if (arg) {
    const r = route(arg);
    const line = (k, es) => es.length && console.log(`${k}: ${es.map(e => `${data.platforms[e.platform].name} (${e.verdict}: ${e.reason})`).join('\n      ')}`);
    console.log(label(arg));
    line('post ', r.post); line('offer', r.offer); line('warn ', r.warn); line('never', r.never);
  } else {
    console.log(`| Product type | ${ids.map(p => data.platforms[p].name).join(' | ')} |`);
    console.log(`|---|${ids.map(() => '---').join('|')}|`);
    for (const t of Object.keys(data.types))
      console.log(`| ${label(t)} | ${ids.map(p => data.fit[t][p][0]).join(' | ')} |`);
  }
}
