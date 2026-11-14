// The one way secondhand code writes a log line, in the app, the server and Node jobs. No imports, so it runs in Expo, Node and a browser.
// Contract: ../spec/events.json. Checker: node spec/log.mjs <file>. How to use it: README.md.
// The MASK_ lists, MAX_INLINE and BLOB_HEAD repeat spec/events.json so the app can bundle this file alone; spec/log.test.mjs fails if they drift.

export const MASK_WORDS = ['token', 'secret', 'password', 'passcode', 'pwd', 'authorization', 'cookie', 'apikey', 'address', 'email', 'phone', 'card', 'cvv', 'ssn', 'text', 'body', 'content', 'message', 'prompt', 'username', 'firstname', 'lastname', 'fullname'];
export const MASK_NOT_WHEN_LAST = ['id', 'ids', 'count', 'type', 'len', 'length', 'at', 'ms', 'in', 'out', 'hash'];
export const MASK_PATTERNS = [
  ["secret", String.raw`\b(?:sk-[A-Za-z0-9_-]{20,}|(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{24,}|dapi[0-9a-f]{32}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})`],
  ["secret", String.raw`\bBearer[ \t\r\n\u00a0]+[A-Za-z0-9._~+/=-]{16,}`],
  ["secret", String.raw`\b(?:access_token|refresh_token|id_token|api_key|apikey|client_secret|password|token|secret|signature|sig)=[^&# \t\r\n\u00a0"']{6,}`],
  ["email", String.raw`[A-Za-z0-9._%+-]{1,64}@(?:[A-Za-z0-9-]{1,63}\.){1,8}(?!(?:png|jpe?g|gif|webp|svg|heic|pdf|js|ts|css|md|json)\b)[A-Za-z]{2,24}\b`],
  ["card", String.raw`\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b`],
  ["phone", String.raw`(?:\B\+\d{10,15}|(?:\+?1[ .-]?)?(?:\(\d{3}\)[ \t\r\n\u00a0]?|\b\d{3}[ .\u00a0-])\d{3}[ .\u00a0-]\d{4})\b`],
  ["address", String.raw`\b\d{1,5}[ \t\r\n\u00a0]+(?:[A-Za-z0-9.']+[ \t\r\n\u00a0]+){1,3}(?:[Ss]treet|[Ss]t|[Aa]venue|[Aa]ve|[Rr]oad|[Rr]d|[Bb]oulevard|[Bb]lvd)\b`],
];
export const MAX_INLINE = 2000;
export const BLOB_HEAD = 200;
const ENVELOPE = ['ts', 'session', 'seq', 'src', 'level', 'event'];
const MAX_DEPTH = 8;

const patterns = MASK_PATTERNS.map(([label, source]) => [label, new RegExp(source, 'g')]);
const keyWords = key => String(key).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const maskWord = w => MASK_WORDS.includes(w) || (w.endsWith('es') && MASK_WORDS.includes(w.slice(0, -2))) || (w.endsWith('s') && MASK_WORDS.includes(w.slice(0, -1)));
// A key is masked when one of its words, or two neighbours joined (api + key), names personal data or a secret.
// A key that ends in a word such as id, count or ms describes the thing without holding it (message_id, tokens_in, card_ms).
export function isMaskedKey(key) {
  const w = keyWords(key);
  if (!w.length || MASK_NOT_WHEN_LAST.includes(w[w.length - 1])) return false;
  return w.some((x, i) => maskWord(x) || (i > 0 && maskWord(w[i - 1] + x)));
}
export const maskText = text => patterns.reduce((t, [label, re]) => t.replace(re, `[${label}]`), text);
export const errorOf = e => e instanceof Error ? { type: e.name, msg: e.message, stack: e.stack } : { type: typeof e, msg: String(e) };

// Personal data is masked by default: a value under a masked key is replaced whole, and matches inside any other string are replaced in place.
// It never throws: a value that cannot be read becomes '[unreadable]'.
export function mask(value, depth = 0) {
  try {
    if (value === undefined || value === null || typeof value === 'boolean') return value;
    if (typeof value === 'string') return maskText(value);
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'bigint') return String(value);
    if (typeof value !== 'object') return undefined; // a function or symbol is not data
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (value instanceof Error) return mask(errorOf(value), depth);
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return { bytes: value.byteLength };
    if (typeof URL !== 'undefined' && value instanceof URL) return maskText(value.href);
    if (depth >= MAX_DEPTH) return '[deep]';
    if (value instanceof Set) value = [...value];
    if (value instanceof Map) value = Object.fromEntries([...value].map(([k, v]) => [String(k), v]));
    if (Array.isArray(value)) return value.map(v => mask(v, depth + 1) ?? null);
    const out = {};
    for (const k of Object.keys(value)) {
      let m; try { const v = value[k]; m = isMaskedKey(k) && v != null ? { masked: 'key' } : mask(v, depth + 1); } catch { m = '[unreadable]'; }
      if (m !== undefined) out[maskText(k)] = m;
    }
    return out;
  } catch { return '[unreadable]'; }
}

// A plain copy of an object's own fields. It never throws: a field that cannot be read becomes '[unreadable]', and anything that is not an object gives {}.
function own(obj) {
  const out = {};
  if (obj === null || typeof obj !== 'object') return out;
  try { for (const k of Object.keys(obj)) { try { out[k] = obj[k]; } catch { out[k] = '[unreadable]'; } } } catch { /* fields that cannot be listed are left out */ }
  return out;
}
// The named fields win over the caller's extras.
function join(named, extra) {
  const out = { ...named };
  for (const [k, v] of Object.entries(own(extra))) if (!(k in out)) out[k] = v;
  return out;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// createLog({ src, build, sink }) starts a session and writes session.start. Every method writes one line and returns it. No method throws.
// src: which program this is ('app', 'server', 'job.relight', 'agent.list.depop'). build: version plus commit. sink: a function that takes one JSON line.
// from: the "session#seq" of the line that started this program. config: flags, model names and prompt versions, anything else that changes behavior.
// blob(id, json): where a value too large for a line goes; without it the line keeps only the start of the value.
export function createLog({ src, build, sink, seed, session, from, platform, config, now = () => new Date(), blob } = {}) {
  if (typeof src !== 'string' || !src || typeof build !== 'string' || !build || typeof sink !== 'function') throw new Error('createLog needs src, build and sink (see log/README.md)');
  if (!Number.isInteger(seed)) seed = (Math.random() * 2 ** 32) >>> 0;
  if (typeof session !== 'string' || !session) session = `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const state = { seq: 0, calls: 0, runs: 0, random: mulberry32(seed) };
  const time = () => { try { const t = now(); return Number.isNaN(t.getTime()) ? new Date() : t; } catch { return new Date(); } };

  function emit(bound, src, event, fields, level = 'info') {
    const line = { ts: time().toISOString(), session, seq: state.seq, src, level, event };
    try {
      const masked = mask(join(bound, fields));
      for (const [k, v] of Object.entries(masked)) {
        if (ENVELOPE.includes(k)) continue; // a field can never overwrite the envelope
        const json = JSON.stringify(v);
        if (json.length <= MAX_INLINE) { line[k] = v; continue; }
        const id = `${session}-${line.seq}-${k}`;
        try { blob?.(id, json); } catch { /* the line still holds the start of the value */ }
        line[k] = { blob: id, chars: json.length, head: json.slice(0, BLOB_HEAD) };
      }
    } catch (e) { line.log_error = { type: e?.name ?? typeof e, msg: maskText(String(e?.message ?? e)) }; }
    state.seq++; // taken only now, so a line that could not be built leaves no gap
    try { sink(JSON.stringify(line)); } catch { /* logging never breaks the program; the missing seq shows the loss */ }
    return line;
  }

  const make = (bound, src) => {
    const event = (name, fields, level) => emit(bound, src, name, fields, level);
    const log = {
      session, seed, event,
      show: (screen, fields) => event('ui.show', join({ screen }, fields)),
      input: (screen, control, fields) => event('user.input', join({ screen, control }, fields)),
      change: (entity, id, to, fields) => event('state.change', join({ entity, id, to }, fields)),
      action: (item, action, actor, fields) => event('item.action', join({ item, action, actor }, fields)),
      job: (job, kind, state, fields) => event('job.state', join({ job, kind, state }, fields), state === 'failed' ? 'error' : 'info'),
      stage: (job, stage, fields) => event('job.stage', join({ job, stage }, fields)),
      ask: (decision, kind, tier, fields) => event('decision.open', join({ decision, kind, tier }, fields)),
      answer: (decision, option, fields) => event('decision.answer', join({ decision, option }, fields)),
      close: (decision, reason, fields) => event('decision.close', join({ decision, reason }, fields)),
      error: (where, e, fields) => event('error', join({ where, error: errorOf(e) }, fields), 'error'),
      note: (msg, fields, level = 'debug') => event('note', join({ msg }, fields), level),
      // Wrap every outside call: await log.call('model', 'gpt-6-luna', input, () => callIt(), out => ({ result: {...}, cost_usd })).
      // describe picks what to keep from the result. Without it the whole result is logged, masked, and cut to its start if large.
      // fn gets { call, from }: send from as the x-secondhand-from header so the other side's log links back to this line.
      async call(kind, name, input, fn, describe = out => ({ result: out })) {
        const call = `c${++state.calls}`, t0 = time().getTime();
        const start = event('call.start', { call, kind, name, input });
        let out;
        try { out = await fn({ call, from: `${session}#${start.seq}` }); } catch (e) { event('call.end', { call, ok: false, ms: time().getTime() - t0, error: errorOf(e) }, 'error'); throw e; }
        let kept; try { kept = describe(out); } catch (e) { kept = { describe_error: errorOf(e) }; }
        if (kept === null || typeof kept !== 'object' || Array.isArray(kept)) kept = { result: kept };
        event('call.end', join({ call, ok: true, ms: time().getTime() - t0 }, kept));
        return out;
      },
      // const run = log.agent('list.depop', { item, goal }); run.step({ action, why }); await run.call('tool', ...); run.end({ ok: true, result }).
      agent(agent, fields) {
        const run = `r${++state.runs}`, t0 = time().getTime(), child = make({ ...bound, run }, src);
        let n = 0;
        child.event('agent.start', join({ agent }, fields));
        return { run, log: child, call: child.call,
          step: f => child.event('agent.step', join({ n: ++n }, f)),
          end: f => { const ok = own(f).ok !== false; return child.event('agent.end', join({ ok, steps: n, ms: time().getTime() - t0 }, f), ok ? 'info' : 'error'); } };
      },
      // Bind ids to every later line: log.child({ item, job, trace }). A new src names a part of the program: log.child({}, 'app.capture').
      child: (ids, childSrc) => make({ ...bound, ...own(ids) }, typeof childSrc === 'string' && childSrc ? childSrc : src),
      random: () => state.random(), // use this instead of Math.random so a run can be replayed from its seed
      end: fields => event('session.end', fields),
    };
    return log;
  };
  const log = make({}, src);
  log.event('session.start', { build, seed, platform, from, config });
  return log;
}

// Sinks. A sink is a function that takes one JSON line. It must not return a promise that rejects. The Node file sink is in ./node.js.
export function memorySink() { const lines = []; const sink = line => { lines.push(line); }; sink.lines = lines; sink.text = () => lines.map(l => l + '\n').join(''); return sink; }
export const consoleSink = line => { console.log(line); };
export const teeSink = (...sinks) => line => { for (const s of sinks) try { Promise.resolve(s(line)).catch(() => {}); } catch { /* one broken sink does not stop the others */ } };
// The app's sink: lines are sent to the server in batches as newline-delimited JSON. A failed send keeps the lines and tries again on a timer.
// Call sink.flush() when the app goes to the background and after log.error, so the last lines leave before the process can die.
export function httpSink(url, { fetch = globalThis.fetch, size = 20, everyMs = 2000, headers = {}, keep = 5000 } = {}) {
  let buffer = [], timer = null, sending = null;
  const arm = () => { timer ??= setTimeout(() => { timer = null; flush(); }, everyMs); };
  async function send() {
    const batch = buffer; buffer = [];
    try { const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-ndjson', ...headers }, body: batch.map(l => l + '\n').join('') }); if (!r.ok) throw new Error(`log sink ${r.status}`); }
    catch { buffer = [...batch, ...buffer].slice(-keep); arm(); return; }
    if (buffer.length) await send(); // lines that arrived while this batch was in flight
  }
  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!sending && buffer.length) sending = send().catch(() => {}).finally(() => { sending = null; });
    return sending ?? Promise.resolve();
  }
  const sink = line => { buffer.push(line); if (buffer.length >= size) flush(); else arm(); };
  sink.flush = flush;
  return sink;
}
