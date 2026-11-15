// One site, audited (Ben 05:18: "audit wherever whenever from one app what is happening in the other apps"). The site is its
// logo and its state, never its name in words (C5). What doesn't match comes first, each with Open on the site; then what we read
// there, what we did there with what the check after found, and what changed there that we didn't do. Unlinking is the page's
// one act at the foot, and can be undone for a few seconds (ways-out, Get me out). Behavior: app/behavior/you/connections/[site].json.
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ago, type Site } from '@/demo';
import { FootButton, List, Nav, Pill, Screen, Section, Txt, UndoToast } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { MismatchRow } from './mismatch-row';
import { at, audit, type AuditRow } from './site-audit';
import { PageStatus } from './page-status';
import { plural, SITE_ORDER, useGo, useLinks, usePage } from './state';

const WORD = { connected: 'Linked', loading: 'Signing in', error: 'Needs you', not_connected: 'Not linked' } as const;

export function SitePage() {
  const { site: raw } = useLocalSearchParams<{ site: string }>();
  const { w, asked } = usePage(), go = useGo();
  const { links, link, unlink } = useLinks(w);
  const [undo, setUndo] = useState(false);
  const back = () => go.back('/you/connections');
  const site = SITE_ORDER.includes(raw as Site) ? (raw as Site) : null;
  if (!site) {
    return (
      <Screen name="you-site" state="empty" nav={<Nav back={back} />} skip="new: a site that is not one of the five is not found for anyone; one: nothing to count; typical: nothing to count; dense: nothing to count; loading: nothing to load; failed: nothing to load; offline: nothing to load">
        <Txt role="heading">Not found</Txt>
      </Screen>
    );
  }
  const a = audit(w, site), l = links[site];
  const row = (r: AuditRow) => <ListRow key={r.id} id={r.id} label={r.label} detail={r.detail} value={at(r.at, w.now)} onPress={r.item_id ? () => go.to(`/item/${r.item_id}`) : undefined} />;
  const rows = a.did.length + a.changed.length + a.mismatches.length;
  const state = asked ?? (l.state === 'loading' ? 'loading' : l.state === 'error' ? 'failed' : l.state === 'not_connected' ? 'new' : rows ? (w.items.length > 30 ? 'dense' : 'typical') : 'empty');
  return (
    <Screen name="you-site" state={state} nav={<Nav back={back} />}
      skip="one: a site page counts its rows in sections, so one row is drawn as typical"
      foot={undo ? <UndoToast id="site-undo" text="Unlinked" onUndo={() => { link(site); setUndo(false); }} onGone={() => setUndo(false)} />
        : l.state === 'connected' ? <FootButton id="site-unlink" kind="second" label="Unlink" onPress={() => { unlink(site); setUndo(true); }} /> : undefined}>
      <PageStatus asked={asked} what="this site">
      <List>
        <ListRow id="site-state" site={site} label={WORD[l.state]} tone={l.state === 'error' ? 'brick' : 'ink'}
          detail={l.state === 'error' ? (l.note ?? 'Signed out') : l.state === 'connected' ? (a.read.checked_at ? `Checked ${ago(a.read.checked_at, w.now).toLowerCase()}` : 'Checked just now') : l.state === 'loading' ? 'Finish on the site’s own sign-in page' : 'Unlinking left your listings up'}
          trail={l.state === 'connected' ? undefined : <Pill id={`link-${site}`} kind="second" label={l.state === 'error' ? 'Try again' : 'Link'} icon={l.state === 'error' ? 'refresh' : undefined} state={l.state === 'loading' ? 'working' : 'idle'} onPress={() => link(site)} />} />
      </List>

      {a.mismatches.length ? (
        <Section title="Doesn’t match">
          <List>{a.mismatches.map(m => <MismatchRow key={m.id} row={m} />)}</List>
        </Section>
      ) : null}

      <Section title="What we read">
        <List>
          {a.read.can_read ? (
            <>
              <ListRow id="read-listings" lead="tag-01" label={plural(a.read.listings, 'live listing', 'live listings')} />
              <ListRow id="read-threads" lead="bubble-chat" label={plural(a.read.threads, 'thread with buyers', 'threads with buyers')} />
              <ListRow id="read-sales" lead="money-03" label={plural(a.read.sales, 'sale', 'sales')} />
            </>
          ) : (
            <ListRow id="read-none" lead="alert-02" tone="brick" label="Nothing until you sign in again" detail={a.read.listings ? `Your ${plural(a.read.listings, 'live listing', 'live listings')} there stay up, unchecked` : undefined} />
          )}
        </List>
      </Section>

      <Section title="What we did">
        {a.did.length ? <List>{a.did.map(row)}</List> : <Txt role="body" tone="ink-2">Nothing yet. Each step shows here with what the site showed after.</Txt>}
      </Section>

      <Section title="Changed there, not by us">
        {a.changed.length ? <List>{a.changed.map(row)}</List> : <Txt role="body" tone="ink-2">Nothing since the last check.</Txt>}
      </Section>
      </PageStatus>
    </Screen>
  );
}
