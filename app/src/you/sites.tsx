// Your sites (spec/pages.md §6.16 Accounts; spec/features/connect.md): every site with its own logo and state, and the one act
// each state allows. Linking one never blocks the rest. Anything where a site and our record disagree goes first, across every
// site, each with Open on the site (Ben 05:18, audit every site from one app). A linked site opens its own page: what we read
// there, what we did with what the check after found, and what changed there that we didn't do. Unlinking lives on that page.
import { ago, type Site } from '@/demo';
import { List, Nav, Screen, Section, Txt } from '@/ui';
import { LinkRow } from './link-row';
import { MismatchRow } from './mismatch-row';
import { allMismatches } from './site-audit';
import { drawn, PAGES, SITE_ORDER, skips, useGo, useLinks, useWorld, type LinkState } from './state';

export function Sites() {
  const w = useWorld(), go = useGo();
  const { links, link } = useLinks(w);
  const checked = (site: Site) => w.connections.find(c => c.site === site)?.account?.checked_at;
  const detail = (site: Site, l: LinkState): string | undefined => {
    if (l.state === 'connected') { const t = checked(site); const soon = w.connections.find(c => c.site === site)?.account?.health === 'expiring'; return soon ? 'Its sign-in ends soon. Link again to keep it' : t ? `Checked ${ago(t, w.now).toLowerCase()}` : 'Checked just now'; }
    if (l.state === 'loading') return 'Finish on the site’s own sign-in page';
    if (l.state === 'error') return undefined;
    return 'Post, answer buyers and end listings here';
  };
  const linked = SITE_ORDER.filter(s => links[s].state === 'connected').length;
  const off = allMismatches(w, SITE_ORDER);
  const state = SITE_ORDER.some(s => links[s].state === 'loading') ? 'loading' : drawn(w, linked);
  return (
    <Screen name="you-connections" state={state} nav={<Nav back={() => go.back()} />}
      skip={skips(state, { empty: 'drawn with world=new, where no site is linked', loading: 'drawn after Link, while that site signs in', failed: 'drawn after the first Link on Mercari, which times out', offline: 'each row says its own error when a site can’t be reached' })}>
      <Txt role="heading">{PAGES.connections.title}</Txt>
      {off.length ? (
        <Section title="Doesn’t match">
          <List>
            {off.map(m => <MismatchRow key={m.id} row={m} site={m.site} />)}
          </List>
        </Section>
      ) : null}
      <Section>
        <List>
          {SITE_ORDER.map(s => <LinkRow key={s} site={s} link={links[s]} detail={detail(s, links[s])} onLink={() => link(s)} onOpen={() => go.to(`/you/connections/${s}`)} />)}
        </List>
        <Txt role="caption">Your password goes to the site, never to secondhand.</Txt>
      </Section>
    </Screen>
  );
}
