// Nothing secret or personal reaches this public repo.
import { read, err, warn } from './util.mjs';

const KEYS = [
  ['OpenAI key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,}/],
  ['Databricks token', /\bdapi[0-9a-f]{32}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ['AWS key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const EMAIL_OK = /noreply|@example\.|@users\.noreply\.github\.com/i;

export function secrets(root, { files }) {
  const out = [];
  for (const f of files) {
    if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.example')) out.push(err(f, '.env files are never committed; add an .env.example with names only'));
    if (/\.(png|jpe?g|gif|webp|svg|ico|pdf|woff2?|ttf|otf|m4a|mp4|zip)$/i.test(f)) continue;
    const text = read(root, f) ?? '';
    for (const [name, re] of KEYS) if (re.test(text)) out.push(err(f, `looks like a ${name}; remove it and rotate it`));
    for (const m of text.matchAll(/[\w.+-]+@[A-Za-z][\w-]*(?:\.[\w-]+)*\.[A-Za-z]{2,}\b/g))
      if (!EMAIL_OK.test(m[0]) && !/\.(png|jpe?g|svg|webp|gif|js|css|md)$/i.test(m[0])) out.push(warn(f, `email address ${m[0]}: is it personal data?`));
  }
  return out;
}
