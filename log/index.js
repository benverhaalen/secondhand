// The one way secondhand code writes a log line, in the app, the server and Node jobs. No imports, so it runs in Expo, Node and a browser.
// Contract: ../spec/events.json. Checker: node spec/log.mjs <file>. How to use it: README.md.
// MASK_WORDS, MASK_PATTERNS and MAX_INLINE repeat spec/events.json so the app can bundle this file alone; spec/log.test.mjs fails if they drift.

export const MASK_WORDS = ['token', 'secret', 'password', 'authorization', 'cookie', 'apikey', 'address', 'email', 'phone', 'card', 'cvv', 'text', 'body', 'content', 'message', 'username'];
export const MASK_PATTERNS = [
  ['secret', '\\b(?:sk-[A-Za-z0-9_-]{20,}|dapi[0-9a-f]{32}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,})'],
  ['secret', '\\bBearer\\s+[A-Za-z0-9._~+/=-]{16,}'],
  ['email', '[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+'],
  ['phone', '(?:\\+\\d{10,15}|(?:\\+?1[\\s.-]?)?\\(?\\b\\d{3}\\)?[\\s.-]\\d{3}[\\s.-]\\d{4})\\b'],
  ['address', '\\b\\d{1,5}\\s+(?:[A-Z][a-z]+\\s+){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place)\\b'],
];
export const MAX_INLINE = 2000;
const ENVELOPE = ['ts', 'session', 'seq', 'src', 'level', 'event'];
const MAX_DEPTH = 8;

const patterns = MASK_PATTERNS.map(([label, source]) => [label, new RegExp(source, 'g')]);
const keyWords = key => String(key).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
export const isMaskedKey = key => keyWords(key).some(w => MASK_WORDS.includes(w));
export const maskText = text => patterns.reduce((t, [label, re]) => t.replace(re, `[${label}]`), text);
export const errorOf = e => e instanceof Error ? { type: e.name, msg: e.message, stack: e.stack } : { type: typeof e, msg: String(e) };

// Personal data is masked by default: a value under a masked key is replaced whole, and matches inside any other string are replaced in place.
export function mask(value, depth = 0) {
  if (value === undefined || value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return maskText(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return String(value);
  if (typeof value !== 'object') return undefined; // a function or symbol is not data
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return mask(errorOf(value), depth);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return { bytes: value.byteLength };
  if (depth >= MAX_DEPTH) return '[deep]';
  if (Array.isArray(value)) return value.map(v => mask(v, depth + 1) ?? null);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const m = isMaskedKey(k) && v != null ? { masked: 'key' } : mask(v, depth + 1);
    if (m !== undefined) out[k] = m;
  }
  return out;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// createLog({ src, build, sink }) starts a session and writes session.start. Every method writes one line and returns it.
// src: which program this is ('app', 'server', 'job.relight', 'agent.list.depop'). build: version plus commit. sink: a function that takes one JSON line.
export function createLog({ src, build, sink, seed = (Math.random() * 2 ** 32) >>> 0, session = `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
  from, platform, now = () => new Date(), blob } = {}) {
  if (!src || !build || typeof sink !== 'function') throw new Error('createLog needs src, build and sink (see log/README.md)');
  const state = { seq: 0, calls: 0, runs: 0, random: mulberry32(seed) };

  function emit(bound, src, event, fields = {}, level = 'info') {
    const line = { ts: now().toISOString(), session, seq: state.seq++, src, level, event };
    const masked = mask({ ...bound, ...fields });
    for (const [k, v] of Object.entries(masked)) {
      if (ENVELOPE.includes(k)) continue; // a field can never overwrite the envelope
      const json = JSON.stringify(v);
      if (json.length > MAX_INLINE) { const id = `${session}-${line.seq}-${k}`; try { blob?.(id, json); } catch { /* the line still says a blob was cut */ } line[k] = { blob: id }; }
      else line[k] = v;
    }
    try { sink(JSON.stringify(line)); } catch { /* logging never breaks the program; the missing seq shows the loss */ }
    return line;
  }

  const make = (bound, src) => {
    const event = (name, fields, level) => emit(bound, src, name, fields, level);
    const log = {
      session, seed, event,
      show: (screen, fields) => event('ui.show', { screen, ...fields }),
      input: (screen, control, fields) => event('user.input', { screen, control, ...fields }),
      change: (entity, id, to, fields) => event('state.change', { entity, id, to, ...fields }),
      action: (item, action, actor, fields) => event('item.action', { item, action, actor, ...fields }),
      job: (job, kind, state, fields) => event('job.state', { job, kind, state, ...fields }, state === 'failed' ? 'error' : 'info'),
      stage: (job, stage, fields) => event('job.stage', { job, stage, ...fields }),
      ask: (decision, kind, tier, fields) => event('decision.open', { decision, kind, tier, ...fields }),
      answer: (decision, option, fields) => event('decision.answer', { decision, option, ...fields }),
      close: (decision, reason, fields) => event('decision.close', { decision, reason, ...fields }),
      error: (where, e, fields) => event('error', { where, error: errorOf(e), ...fields }, 'error'),
      note: (msg, fields, level = 'debug') => event('note', { msg, ...fields }, level),
      // Wrap every outside call: await log.call('model', 'gpt-6-luna', input, () => callIt(), out => ({ result: {...}, cost_usd })).
      // describe picks what to keep from the result; without it the whole result is logged (masked, and cut to a blob if large).
      async call(kind, name, input, fn, describe = out => ({ result: out })) {
        const call = `c${++state.calls}`, t0 = now().getTime();
        const start = event('call.start', { call, kind, name, input });
        let out; // fn gets { from }: send it as the x-secondhand-from header so the other side's log links back to this line
        try { out = await fn({ call, from: `${session}#${start.seq}` }); } catch (e) { event('call.end', { call, ok: false, ms: now().getTime() - t0, error: errorOf(e) }, 'error'); throw e; }
        let kept; try { kept = describe(out); } catch (e) { kept = { describe_error: errorOf(e) }; }
        event('call.end', { call, ok: true, ms: now().getTime() - t0, ...kept });
        return out;
      },
      // const run = log.agent('list.depop', { item, goal }); run.step({ action, why }); await run.call('tool', ...); run.end({ ok: true, result }).
      agent(agent, fields) {
        const run = `r${++state.runs}`, t0 = now().getTime(), child = make({ ...bound, run }, src);
        let n = 0;
        child.event('agent.start', { agent, ...fields });
        return { run, log: child, call: child.call,
          step: f => child.event('agent.step', { n: ++n, ...f }),
          end: ({ ok = true, ...f } = {}) => child.event('agent.end', { ok, steps: n, ms: now().getTime() - t0, ...f }, ok ? 'info' : 'error') };
      },
      // Bind ids to every later line: log.child({ item, job, trace }). A new src names a part of the program: log.child({}, 'app.capture').
      child: (ids = {}, childSrc = src) => make({ ...bound, ...ids }, childSrc),
      random: () => state.random(), // use this instead of Math.random so a run can be replayed from its seed
      end: fields => event('session.end', fields),
    };
    return log;
  };
  const log = make({}, src);
  log.event('session.start', { build, seed, platform, from });
  return log;
}

// Sinks. A sink is a function that takes one JSON line. The Node file sink is in ./node.js.
export function memorySink() { const lines = []; const sink = line => { lines.push(line); }; sink.lines = lines; sink.text = () => lines.map(l => l + '\n').join(''); return sink; }
export const consoleSink = line => { console.log(line); };
export const teeSink = (...sinks) => line => { for (const s of sinks) try { s(line); } catch { /* one broken sink does not stop the others */ } };
// The app's sink: lines are sent to the server in batches as newline-delimited JSON. A failed send keeps the lines and tries again.
export function httpSink(url, { fetch = globalThis.fetch, size = 20, everyMs = 2000, headers = {}, keep = 5000 } = {}) {
  let buffer = [], timer = null, sending = false;
  async function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (sending || !buffer.length) return;
    const batch = buffer; buffer = []; sending = true;
    try { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-ndjson', ...headers }, body: batch.map(l => l + '\n').join('') }); if (!r.ok) throw new Error(`log sink ${r.status}`); }
    catch { buffer = [...batch, ...buffer].slice(-keep); }
    finally { sending = false; }
  }
  const sink = line => { buffer.push(line); if (buffer.length >= size) flush(); else timer ??= setTimeout(flush, everyMs); };
  sink.flush = flush;
  return sink;
}
