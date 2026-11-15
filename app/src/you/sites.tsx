// Your sites (spec/pages.md §6.16 Accounts; spec/features/connect.md): every site with its own logo and state, and the one act
// each state allows. Linking one never blocks the rest. A linked site opens a sheet that can unlink it (ways-out "Get me out");
// unlinking stops the agent there and leaves the listings up, and it can be undone for a few seconds.
import { useState } from 'react';
import { ago, type Site } from '@/demo';
import { FootButton, List, Nav, Screen, Section, Sheet, Txt, UndoToast } from '@/ui';
import { ListRow } from '@/ui/parts/list-row';
import { LinkRow } from './link-row';
import { drawn, PAGES, SITE_ORDER, useGo, useLinks, useWorld, type LinkState } from './state';

export function Sites() {
  const w = useWorld(), go = useGo();
  const { links, link, unlink } = useLinks(w);
  const [open, setOpen] = useState<Site | null>(null);
  const [undo, setUndo] = useState<Site | null>(null);
  const checked = (site: Site) => w.connections.find(c => c.site === site)?.account?.checked_at;
  const detail = (site: Site, l: LinkState): string | undefined => {
    if (l.state === 'connected') { const t = checked(site); const soon = w.connections.find(c => c.site === site)?.account?.health === 'expiring'; return soon ? 'Its sign-in ends soon. Link again to keep it' : t ? `Checked ${ago(t, w.now).toLowerCase()}` : 'Checked just now'; }
    if (l.state === 'loading') return 'Finish on the site’s own sign-in page';
    if (l.state === 'error') return undefined;
    return 'Post, answer buyers and end listings here';
  };
  const linked = SITE_ORDER.filter(s => links[s].state === 'connected').length;

  return (
    <Screen name="you-connections" state={SITE_ORDER.some(s => links[s].state === 'loading') ? 'loading' : drawn(w, linked)} nav={<Nav back={() => go.back()} />}
      foot={undo ? <UndoToast id="sites-undo" text="Unlinked" onUndo={() => { link(undo); setUndo(null); }} onGone={() => setUndo(null)} /> : undefined}>
      <Txt role="heading">{PAGES.connections.title}</Txt>
      <Section>
        <List>
          {SITE_ORDER.map(s => <LinkRow key={s} site={s} link={links[s]} detail={detail(s, links[s])} onLink={() => link(s)} onOpen={() => setOpen(s)} />)}
        </List>
        <Txt role="caption">Your password goes to the site, never to secondhand.</Txt>
      </Section>

      <Sheet open={open !== null} onClose={() => setOpen(null)}>
        <List>
          {open ? <ListRow id="site-sheet-site" site={open} label="Linked" /> : null}
          <ListRow id="site-sheet-runs" lead="checkmark-circle-02" label="Posts, answers and ends listings" />
          <ListRow id="site-sheet-stays" lead="information-circle" label="Unlinking leaves your listings up" />
        </List>
        <FootButton id="site-unlink" kind="second" label="Unlink" onPress={() => { if (open) { unlink(open); setUndo(open); } setOpen(null); }} />
      </Sheet>
    </Screen>
  );
}
