// Nothing secret or personal reaches this public repo.
import { read, err, warn } from './util.mjs';

const KEYS = [
  ['OpenAI key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['Databricks token', /\bdapi[0-9a-f]{32}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['GitHub fine-grained token', /\bgithub_pat_[A-Za-z0-9_]{40,}/],
  ['Stripe key', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}|\bwhsec_[A-Za-z0-9]{24,}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}/],
  ['JSON web token', /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}/],
  ['AWS key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const EMAIL_OK = /noreply|@example\.|@users\.noreply\.github\.com/i;

// Anyone can unzip the shipped app and read it, so a secret must never reach the bundle.
// Expo compiles EXPO_PUBLIC_ values and app.json `extra` into the app; server routes (+api) and src/edge/ stay on the server.
const SECRET_NAME = /KEY|TOKEN|SECRET|PASSWORD|PRIVATE|CREDENTIAL/i;
const MEANT_PUBLIC = /PUBLISHABLE|ANON_KEY/i; // keys a vendor issues to ship in clients, such as Stripe publishable or Supabase anon
const serverSide = f => /\+api\.[tj]sx?$/.test(f) || f.startsWith('app/src/edge/');
// Tests and recorded fixtures run in Node and no screen imports them, so Metro never bundles them.
const neverShipped = f => /\.test\.[tj]sx?$/.test(f) || f.includes('/fixtures/');
// A type-only import is erased at build and ships nothing; a value import from edge/ would bundle server code.
const typeOnly = spec => /^type\b/.test(spec) || (/^\{[^}]*\}$/.test(spec) && spec.slice(1, -1).split(',').map(x => x.trim()).filter(Boolean).every(x => /^type\b/.test(x)));
const valueFromEdge = text => [...text.matchAll(/\b(?:import|export)\s+([^;]*?)\s+from\s+['"][^'"]*\/edge\//g)].some(([, spec]) => !typeOnly(spec.trim()));
function shipped(f, text) {
  const out = [];
  for (const m of text.matchAll(/\bEXPO_PUBLIC_\w+/g))
    if (SECRET_NAME.test(m[0].slice(12)) && !MEANT_PUBLIC.test(m[0])) out.push(err(f, `${m[0]} is compiled into the app, where anyone can read it: keep the secret on the server and call a /v1 route`));
  if (f.startsWith('app/src/') && /\.[tj]sx?$/.test(f) && !serverSide(f) && !neverShipped(f) && valueFromEdge(text))
    out.push(err(f, 'a screen imports from edge/, which holds server credentials: call the /v1 route instead'));
  if (f === 'app/app.json') {
    const walk = (o, path) => Object.entries(o ?? {}).forEach(([k, v]) => { if (SECRET_NAME.test(k)) out.push(err(f, `extra.${[...path, k].join('.')} ships inside the app, where anyone can read it`)); else if (v && typeof v === 'object') walk(v, [...path, k]); });
    try { walk(JSON.parse(text).expo?.extra, []); } catch (e) { out.push(err(f, `app.json does not parse: ${e.message}`)); }
  }
  return out;
}

export function secrets(root, { files }) {
  const out = [];
  for (const f of files) {
    if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.example')) out.push(err(f, '.env files are never committed; add an .env.example with names only'));
    // The brand faces are licensed and this repo is public: they live in the BRAND_FONTS secret and fonts/ (ignored) only.
    // An open-licensed fallback face may be committed, in a fonts-open/ folder with its licence file; a brand face never is.
    if (/\.(woff2?|ttf|otf)$/i.test(f)) {
      if (!/(^|\/)fonts-open\//.test(f)) out.push(err(f, 'a font file is committed: the brand faces are licensed, so keep them in fonts/ (ignored) or the BRAND_FONTS secret'));
      else if (!files.some(x => x.startsWith(f.slice(0, f.lastIndexOf('/') + 1)) && /OFL|LICEN[SC]E/i.test(x))) out.push(err(f, 'an open font is committed without its licence file beside it'));
      continue;
    }
    if (/\.(png|jpe?g|gif|webp|ico|pdf|m4a|mp4|zip)$/i.test(f)) continue;
    const text = read(root, f) ?? '';
    for (const [name, re] of KEYS) if (re.test(text)) out.push(err(f, `looks like a ${name}; remove it and rotate it`));
    if (/data:(?:font\/|application\/(?:x-)?font)[^;,]*;base64,/i.test(text)) out.push(err(f, 'embeds a font as data: the brand faces are licensed, so draw pages that inject them from a temp folder, never into the repo'));
    if (f.startsWith('app/')) out.push(...shipped(f, text));
    if (f.startsWith('.agents/vendor/')) continue; // third-party text kept unchanged: keys above still fail, sample emails don't
    for (const m of text.matchAll(/[\w.+-]+@[A-Za-z][\w-]*(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g))
      if (!EMAIL_OK.test(m[0]) && !/\.(png|jpe?g|svg|webp|gif|js|css|md)$/i.test(m[0])) out.push(warn(f, `email address ${m[0]}: is it personal data?`));
  }
  return out;
}
