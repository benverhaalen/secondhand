// One site, audited from one app (Ben 05:18: "ensuring a user can go audit wherever whenever from one app what is happening in
// the other apps"). Three lists per site: what we read there, what we did there with what the read-back found, and what changed
// there that we didn't do. Anything where the site and our record disagree is a mismatch, and mismatches go first.
// The read-back is the harness's check after every write (spec/product.md, "every write is read back"; a delist is recorded only
// from a read-back): an event in the log is a write the site confirmed, unless the listing it touched says otherwise.
import { ago, type Iso, type LogEvent, type Site, type World } from '@/demo';
import { cash } from './state';

export type AuditRow = { id: string; item_id: string | null; label: string; detail: string; at: Iso | null; url: string | null };
export type Audit = {
  site: Site;
  read: { listings: number; threads: number; sales: number; checked_at: Iso | null; can_read: boolean };
  did: AuditRow[];
  changed: AuditRow[];
  mismatches: AuditRow[];
};

const ENDED = ['delist_after_sale', 'listing.ended', 'end_listing'];
const POSTED = ['listing.posted', 'post', 'relist'];

export function audit(w: World, site: Site): Audit {
  const title = (id: string | null) => (id ? w.items.find(i => i.id === id)?.title ?? '' : '');
  const listing = (item: string | null) => (item ? w.items.find(i => i.id === item)?.listings.find(l => l.site === site) : undefined);
  const conn = w.connections.find(c => c.site === site);
  const listings = w.items.flatMap(i => i.listings).filter(l => l.site === site && l.state === 'live');
  const mismatches: AuditRow[] = [];
  const did: AuditRow[] = [];

  // What we did, and what checking the site after found.
  for (const e of w.events.filter(x => x.site === site && x.actor !== 'site').sort((a, b) => b.at.localeCompare(a.at))) {
    const l = listing(e.item_id), off = ENDED.includes(e.action) && l && l.state !== 'delisted', missing = POSTED.includes(e.action) && l && l.state !== 'live';
    if (off || missing) {
      mismatches.push({ id: `mismatch-${e.event_id}`, item_id: e.item_id, label: title(e.item_id), at: e.at, url: l?.url ?? null,
        detail: off ? 'We ended it, and the site still shows it' : 'We posted it, and the site doesn’t show it' });
    }
    did.push({ id: `did-${e.event_id}`, item_id: e.item_id, label: title(e.item_id) || e.why, at: e.at, url: l?.url ?? null,
      detail: `${e.why}. ${off || missing ? 'The site shows otherwise' : 'Checked on the site after'}` });
  }

  // Listings the site refused or kept, with no event to hang them on.
  for (const i of w.items) for (const l of i.listings.filter(x => x.site === site)) {
    if (mismatches.some(m => m.item_id === i.id)) continue;
    if (l.state === 'postFailed') mismatches.push({ id: `mismatch-${l.id}`, item_id: i.id, label: i.title, at: i.updated_at, url: l.url, detail: l.error ? `Not on the site. ${l.error}` : 'Not on the site' });
    if (l.state === 'delistFailed') mismatches.push({ id: `mismatch-${l.id}`, item_id: i.id, label: i.title, at: i.updated_at, url: l.url, detail: 'Still up on the site after we ended it' });
  }
  // A step the agent took that the site did not take, or a change the site made to a listing (site_changed_listing).
  for (const d of w.decisions.filter(x => x.site === site && (x.kind === 'site_changed_listing' || (x.state === 'failed' && x.item_id)))) {
    if (mismatches.some(m => m.item_id === d.item_id)) continue;
    mismatches.push({ id: `mismatch-${d.id}`, item_id: d.item_id, label: title(d.item_id), at: d.created_at, url: listing(d.item_id)?.url ?? null,
      detail: d.kind === 'site_changed_listing' ? d.why : `It didn’t take on the site. ${d.error ?? d.why}` });
  }

  // What changed there that we didn't do: a buyer's sale, offer or message, and anything the site itself did.
  const changed: AuditRow[] = [
    ...w.orders.filter(o => o.site === site && o.kind === 'sale').map(o => ({ id: `sale-${o.id}`, item_id: o.item_id, label: title(o.item_id), at: o.created_at as Iso, url: null, detail: `A buyer bought it for ${cash(o.price_cents)}` })),
    ...w.offers.filter(o => o.site === site && o.direction === 'in').map(o => {
      const it = w.items.find(i => i.listings.some(l => l.id === o.listing_id));
      return { id: `offer-${o.id}`, item_id: it?.id ?? null, label: it?.title ?? '', at: o.sent_at as Iso, url: null, detail: `A buyer offered ${cash(o.amount_cents)}` };
    }),
    ...w.messages.filter(m => m.actor === 'counterpart' && w.conversations.find(c => c.id === m.conversation_id)?.site === site).map(m => {
      const c = w.conversations.find(x => x.id === m.conversation_id)!;
      return { id: `message-${m.id}`, item_id: c.item_id, label: title(c.item_id), at: m.sent_at as Iso, url: null, detail: 'A buyer wrote' };
    }),
    ...w.events.filter(e => e.site === site && e.actor === 'site').map((e: LogEvent) => ({ id: `site-${e.event_id}`, item_id: e.item_id, label: title(e.item_id), at: e.at, url: listing(e.item_id)?.url ?? null, detail: e.why })),
  ].filter(r => r.label).sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

  return {
    site,
    read: {
      listings: listings.length,
      threads: w.conversations.filter(c => c.site === site).length,
      sales: w.orders.filter(o => o.site === site && o.kind === 'sale').length,
      checked_at: conn?.account?.checked_at ?? null,
      can_read: !!conn?.account && conn.account.health !== 'broken' && !conn.error,
    },
    did, changed, mismatches,
  };
}

// Every site's mismatches, for the top of Your sites.
export const allMismatches = (w: World, sites: Site[]) => sites.flatMap(s => audit(w, s).mismatches.map(m => ({ ...m, site: s })));

// "8m ago", "Yesterday": when a row happened, short enough for a row's value.
export const at = (t: Iso | null, now: Iso) => (t ? ago(t, now) : '');
