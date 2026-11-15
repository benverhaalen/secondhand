// hp-7 The recon agent: record how the site's own client does each verb (spec/engines/protocol-and-adapters.md §3.3, §3.7).
// Server only. It drives one page from the pool and keeps, per verb, what an author needs to write a deterministic command:
// the JSON the site's own client fetched (redacted), the state embedded in the page (__NEXT_DATA__, ld+json, initial-state
// blobs) and the page's controls (forbidden ones dropped). It never runs on a person's account without Nate's go, and a
// challenge page pauses it for the person; nothing here solves or skips one.
import { isForbidden, redact, type Control, type NetworkCapture } from '../primitives.ts';
import type { Site, Verb } from '../protocol.ts';

// The slice of a Playwright page recon uses (the pool hands one over).
export type ReconResponse = { url(): string; status(): number; headers(): Record<string, string>; request(): { method(): string; resourceType(): string }; text(): Promise<string> };
export type ReconPage = {
  on(ev: 'response', fn: (r: ReconResponse) => void): void;
  goto(url: string, o?: { waitUntil?: 'domcontentloaded' | 'load'; timeout?: number }): Promise<{ status(): number } | null>;
  waitForTimeout(ms: number): Promise<void>;
  title(): Promise<string>;
  evaluate<T>(fn: () => T): Promise<T>;
};

export type Embedded = { source: string; json: unknown };
export type RecordingBundle = {
  site: Site; verb: Verb; url: string; recorded_at: string; status: number; title: string;
  network: NetworkCapture[]; embedded: Embedded[]; controls: Control[]; ms: { load: number; total: number };
};
export type ReconResult = { ok: true; bundle: RecordingBundle } | { ok: false; paused: 'challenge' | 'login_wall'; ask: string } | { ok: false; refused: string };

const CHALLENGE = /just a moment|verify you are human|are you a robot|press (and|&) hold|unusual traffic|captcha|attention required/i;
const LOGIN_WALL = /^(log ?in|sign ?in)\b|log in to continue|sign in to continue/i;
const MAX_BODY = 200_000, MAX_CAPTURES = 40;

// Runs in the page: embedded state blobs and the visible controls. Plain data only.
function inPage(): { embedded: { source: string; text: string }[]; controls: { ref: string; name?: string; role?: string; type?: string; href?: string }[]; body: string } {
  const embedded: { source: string; text: string }[] = [];
  document.querySelectorAll('script#__NEXT_DATA__, script[type="application/ld+json"], script[type="application/json"]').forEach((s, i) =>
    embedded.push({ source: s.id ? `script#${s.id}` : `script[type="${s.getAttribute('type')}"]:${i}`, text: s.textContent ?? '' }));
  for (const k of ['__INITIAL_STATE__', '__PRELOADED_STATE__', '__APOLLO_STATE__', '__NUXT__']) {
    const v = (window as unknown as Record<string, unknown>)[k];
    if (v !== undefined) try { embedded.push({ source: `window.${k}`, text: JSON.stringify(v) }); } catch { /* not serialisable */ }
  }
  const controls = [...document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')].slice(0, 400).map((el, i) => {
    const e = el as HTMLElement & { name?: string; type?: string; href?: string };
    const id = e.id ? `#${CSS.escape(e.id)}` : e.getAttribute('data-testid') ? `[data-testid="${e.getAttribute('data-testid')}"]` : `${e.tagName.toLowerCase()}:nth-of-type(${i + 1})`;
    return { ref: id, name: (e.getAttribute('aria-label') ?? e.innerText ?? e.name ?? '').trim().slice(0, 80) || undefined, role: e.getAttribute('role') ?? e.tagName.toLowerCase(),
      type: e.type || undefined, href: e.href || undefined };
  });
  return { embedded, controls, body: (document.body?.innerText ?? '').slice(0, 3000) };
}

export async function recordVerb({ page, site, verb, url, account, nate_go = false, settleMs = 3000, now = () => new Date() }: {
  page: ReconPage; site: Site; verb: Verb; url: string; account: 'public' | 'test' | 'live'; nate_go?: boolean; settleMs?: number; now?: () => Date;
}): Promise<ReconResult> {
  if (account === 'live' && !nate_go) return { ok: false, refused: 'recon on a person\'s account needs Nate\'s go for this site' };
  const t0 = Date.now(), pending: Promise<NetworkCapture | undefined>[] = [];
  // Only the site's own client calls count (its registrable domain and subdomains); trackers and ad pixels are not the site.
  const own = new URL(url).hostname.split('.').slice(-2).join('.');
  const firstParty = (u: string) => { try { const h = new URL(u).hostname; return h === own || h.endsWith(`.${own}`); } catch { return false; } };
  page.on('response', r => {
    const kind = r.request().resourceType(), type = r.headers()['content-type'] ?? '';
    if (pending.length >= MAX_CAPTURES || !(kind === 'xhr' || kind === 'fetch') || !/json/.test(type) || !firstParty(r.url())) return;
    pending.push(r.text().then(text => text.length > MAX_BODY ? undefined
      : redact({ url: r.url(), method: r.request().method(), status: r.status(), headers: { 'content-type': type }, response: text }), () => undefined));
  });
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  const load = Date.now() - t0;
  await page.waitForTimeout(settleMs);
  const title = await page.title();
  const seen = await page.evaluate(inPage);
  if (CHALLENGE.test(title) || CHALLENGE.test(seen.body.slice(0, 600)))
    return { ok: false, paused: 'challenge', ask: `${site} showed a check page ("${title.slice(0, 60)}"); the person clears it in the live browser, then recon resumes` };
  if (LOGIN_WALL.test(title) && account !== 'public') return { ok: false, paused: 'login_wall', ask: `${site} asked to sign in; relink the account` };
  const network = (await Promise.all(pending)).filter((c): c is NetworkCapture => !!c);
  const embedded = seen.embedded.flatMap(e => { try { return [{ source: e.source, json: (redact({ url, response: e.text }).response) }]; } catch { return []; } });
  const controls = seen.controls.filter(c => !isForbidden(c));
  return { ok: true, bundle: { site, verb, url, recorded_at: now().toISOString(), status: res?.status() ?? 0, title, network, embedded, controls, ms: { load, total: Date.now() - t0 } } };
}
