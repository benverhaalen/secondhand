// Trust labels and prints (spec/engines/trust.md §6, §7; product.md `trust_signal`, `trust_label`, `script_print`).
// A label is a seller's outcome on one thread. It updates two Beta rows per signal:
//   trust_q.<s>  P(signal | scam)      trust_r.<s>  P(signal | any thread)      weight = ln(q / r)
// Rows are person-scoped: one person's labels move only that person's read; the shared row is moved by the nightly fit (jobs/trust/fit.py).
// Nothing a buyer wrote is kept: the span is masked on write, dropped at close or after the claim window; prints are salted hashes.
import { createHash } from 'node:crypto';
import type { ParamStore, Scope } from '../param/param.ts';
import { resolve } from './params.ts';
import { hamming, printOf, saltsFor, SCORED_NAMES } from './signals.ts';

export type LabelIn = {
  thread_id: string; person?: string; buyer: string; site: string;
  outcome: 'scam' | 'fine'; weight: number;            // how sure the seller's mark is (an Ignore with a reason is 1)
  present: string[]; absent: string[];                  // scored signals the thread had, and those it was read for and lacked
  span?: string; at: string;
};
export type LabelRow = { thread_id: string; person: string; subject: string; site: string; outcome: 'scam' | 'fine'; weight: number; present: string[]; span: string | null; at: string };
type PrintRow = { print: bigint; salt: string; seller: string; buyer: string; at: string };

const sha = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 32);
// The span is evidence for the claim only: numbers, emails and long tokens are masked at write.
const mask = (t: string) => t.replace(/\S+@\S+/g, '[email]').replace(/\d[\d\s().-]{4,}\d|\d+/g, '[num]').slice(0, 160);
const DAY = 86_400_000;
const days = (a: string, b: string) => (Date.parse(a) - Date.parse(b)) / DAY;

export function weightOf(store: ParamStore, signal: string, scope: Scope): number {
  const q = store.read(`trust_q.${signal}`, scope).value as { alpha: number; beta: number };
  const r = store.read(`trust_r.${signal}`, scope).value as { alpha: number; beta: number };
  return Math.log(q.alpha / (q.alpha + q.beta) / (r.alpha / (r.alpha + r.beta)));
}

export function createLabels(store: ParamStore, pepper: string) {
  const events = new Map<string, string>();
  const labels = new Map<string, LabelRow>(); // person|thread
  const prints: PrintRow[] = [];
  const spent = new Map<string, number>();     // person|param -> weight this person has put in: the poison cap's ledger
  resolve(store, {});
  const num = (n: string, scope: Scope = {}) => store.read(n, scope).value as number;

  // Poison cap: one person's total weight into one row stays within trust_seller_cap of that row's mass without it.
  // It covers negatives as well as positives; the ledger is the total weight added, never the sign.
  function put(person: string, name: string, scope: Scope, success: 0 | 1, w: number, at: string) {
    const h = store.read(name, scope).value as { alpha: number; beta: number };
    const k = `${person}|${name}|${scope.site}`;
    const used = spent.get(k) ?? 0;
    const room = Math.max(0, num('trust_seller_cap', scope) * (h.alpha + h.beta - used) - used);
    const x = Math.min(w, room);
    if (x <= 0) return;
    if (store.observe(name, scope, { success, weight: x }, at).applied) spent.set(k, used + x);
  }

  return {
    // One label per person per thread: a second replaces the first row. (Counts already folded stay; the cap bounds them.)
    addLabel(l: LabelIn) {
      const person = l.person ?? 'shared';
      const scope: Scope = l.person ? { site: l.site, person: l.person } : { site: l.site };
      if (!Number.isFinite(l.weight) || l.weight < 0) throw new RangeError('label weight');
      const event = JSON.stringify([l.site, l.outcome, l.weight, [...l.present].sort(), [...l.absent].sort()]);
      const key = `${person}|${l.thread_id}`;
      if (events.get(key) === event) return;
      events.set(key, event);
      labels.set(`${person}|${l.thread_id}`, {
        thread_id: l.thread_id, person, subject: sha(`${pepper}|${person}|${l.buyer}`), site: l.site, outcome: l.outcome, weight: l.weight,
        present: l.present.filter((s) => (SCORED_NAMES as string[]).includes(s)), span: l.span === undefined ? null : mask(l.span), at: l.at,
      });
      for (const s of SCORED_NAMES) {
        const seen = l.present.includes(s), read = seen || l.absent.includes(s);
        if (!read) continue;
        put(person, `trust_r.${s}`, scope, seen ? 1 : 0, l.weight, l.at);
        if (l.outcome === 'scam') put(person, `trust_q.${s}`, scope, seen ? 1 : 0, l.weight, l.at);
      }
    },
    labelsFor: (person: string) => [...labels.values()].filter((l) => l.person === person),
    // A print needs enough words and no prefill (printOf); the row holds hashes only.
    addPrint(text: string, strip: string[], seller: string, buyer: string, at: string): boolean {
      const salt = saltsFor(at, resolve(store, {}).values)[0];
      const p = printOf(text, salt, strip, num('trust_print_tokens'));
      if (p === null) return false;
      prints.push({ print: p, salt, seller: sha(`${pepper}|${seller}`), buyer: sha(`${pepper}|${buyer}`), at });
      return true;
    },
    // Counts of distinct sellers and buyers with a near-match inside 7 days, under this month's salt and, for 7 days, last month's.
    printHits(text: string, strip: string[], now: string) {
      const sellers = new Set<string>(), buyers = new Set<string>();
      for (const salt of saltsFor(now, resolve(store, {}).values)) {
        const p = printOf(text, salt, strip, num('trust_print_tokens'));
        if (p === null) continue;
        for (const r of prints) {
          if (r.salt !== salt || (days(now, r.at) < 0 || days(now, r.at) > num('trust_print_days')) || hamming(r.print, p) > num('trust_print_hamming')) continue;
          sellers.add(r.seller); buyers.add(r.buyer);
        }
      }
      return { sellers: sellers.size, buyers: buyers.size };
    },
    closeSale(thread_id: string) { for (const l of labels.values()) if (l.thread_id === thread_id) l.span = null; },
    // Past the claim window nothing a buyer said remains.
    sweep(now: string) {
      for (const l of labels.values()) if (days(now, l.at) > num('trust_retention_days')) l.span = null;
      for (let i = prints.length - 1; i >= 0; i--) if (days(now, prints[i].at) > num('trust_print_days')) prints.splice(i, 1);
    },
    dump: () => ({ labels: [...labels.values()].map((l) => ({ ...l })), prints: prints.map((p) => ({ ...p, print: p.print.toString(16) })) }),
  };
}
