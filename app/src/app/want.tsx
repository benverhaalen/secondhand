// Want (pages §6.14; spec/features/watch.md, "Building a want by touch"): what to look for, set by touch, then left to run.
// Ben (words.md 2026-11-15): "i want it around a price. i can adjust my range etc. i can say shipped or pickup or both etc.
// color." So every value that changes which listings match is a control, not a typed field: the price is a two-thumb range
// over the sales, ship or pickup is a three-way toggle with a radius, colour is swatches, size is a size picker, how worn
// and which sites are chips. Only the chips that matter for the thing appear (a Grey Fog Dunk has no colour chip). Clothes
// also get who they're cut for, because a women's or youth L is a different garment (research/watch/ben/brewers-alert-trial.md).
// A new want comes guessed from the words that started it, and the person starts it with one tap, because it sets a price
// (the hand-off rule). A saved want saves each change at once with Undo and looks again at once. While it looks, the page
// says so per site ("Looking on 5 sites", "4m ago", "Behind", "Found 6 so far"), and the person can leave at any time.
// The page's reasons and states are in app/behavior/want.json.
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';
import {
  ALL_SITES, CONDITIONS, conditionId, CUTS, coloursFor, draftOf, firstPass, kindOf, priceBounds, RADII, sizesFor, soldDots, wantFromWords, type How, type WantDraft,
} from '@/buy/read';
import { afterListing, parseStage, SAMPLE, type StageAlert } from '@/buy/stage';
import { Failed, Loading, OfflineLine } from '@/buy/states';
import { href, usePage } from '@/buy/world';
import { ago, product, usd, type Cut, type Site } from '@/demo';
import {
  Approve, Blank, ChoiceChips, ColourSwatches, EmptyState, Guess, Line, MatchCard, Nav, Pill, RangeSlider, Row, Screen, Section, SiteStrip, SizePicker, Stack, Txt,
  UndoToast, log, type SiteSlot,
} from '@/ui';

const hour = (hhmm: string) => { const h = Number(hhmm.slice(0, 2)); return `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`; };
const whole = (text: string) => Math.round(Number(text.replace(/[^0-9.]/g, '')));
// How long each site takes to answer in the demo's look, so a look reads as sites coming in one by one.
const STEP = 450;
// The live buy beat reads the stage watcher this often (product/live-buy-demo.md): a find shows within 2 s of the watcher's.
const LIVE_EVERY_MS = 2000;
const SKIP = 'one: a want is one thing, with no list in it to hold one or many; dense: the same, a want has no list to fill';

export default function Want() {
  const { w, state } = usePage();
  const params = useLocalSearchParams<{ id?: string; q?: string; live?: string }>();
  // A state named with no want in the address draws the world's first want, or a new one from the demo's Dunks search.
  const q = params.q || (state === 'new' ? 'nike dunk low grey 10' : '');
  const saved = state === 'empty' ? undefined : w.wants.find(x => x.id === params.id) ?? (state && state !== 'new' && !q ? w.wants[0] : undefined);
  const fresh = !saved;
  const [x, setX] = useState<WantDraft | null>(() => (state === 'empty' ? null : saved ? draftOf(saved) : q ? wantFromWords(q) : null));
  const [status, setStatus] = useState<'ready' | 'working' | 'done'>('ready');
  const [toast, setToast] = useState<{ text: string; undo: () => void } | null>(null);
  // A look across the sites, as it comes in: how many have answered and what they found.
  const [look, setLook] = useState<{ answered: number; found: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // Live finds from the stage watcher, newest first. ?live=1 reads GET /v1/stage; ?live=sample is the render checks' fixed find.
  const [live, setLive] = useState<{ alerts: StageAlert[]; reached: boolean }>({ alerts: params.live === 'sample' ? SAMPLE : [], reached: true });
  useEffect(() => {
    if (params.live !== '1') return;
    let stop = false, seen = 0, timer: ReturnType<typeof setTimeout> | undefined;
    const read = () => log.call('http', 'stage.read', { route: '/v1/stage' }, () => fetch('/v1/stage', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(`stage ${r.status}`); return r.json(); }), raw => ({ result: { alerts: parseStage(raw).alerts.length } }))
      .then(raw => {
        const { alerts } = parseStage(raw);
        if (alerts.length > seen && Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(e => log.error('want.live_haptic', e));
        seen = alerts.length;
        if (!stop) setLive({ alerts, reached: true });
      })
      .catch(e => { log.error('want.live_read', e); if (!stop) setLive(l => ({ ...l, reached: false })); })
      .finally(() => { if (!stop) timer = setTimeout(read, LIVE_EVERY_MS); });
    read();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [params.live]);

  const nav = <Nav back={() => router.back()} />;
  if (state === 'loading') return <Loading name="want" nav={nav} rows="notice" skip={SKIP} />;
  if (state === 'failed') return <Failed name="want" nav={nav} what="this want" again={href(w, '/want')} skip={SKIP} />;
  if (!x) {
    return (
      <Screen name="want" state="empty" skip={SKIP} nav={nav}>
        <EmptyState title="Nothing to watch yet" line="Search for something, then watch the search." action={{ id: 'want-empty-search', label: 'Search', onPress: () => router.replace(href(w, '/buy')) }} />
      </Screen>
    );
  }

  const p = x.product_id ? product(x.product_id) : null;
  const kind = kindOf(x.text, p?.category), sizes = sizesFor(kind), colours = coloursFor(x.text, x.product_id);
  const dots = soldDots(p), most = x.max_total_cents, low = x.low_cents;
  const lookAgain = (next: WantDraft) => {
    timers.current.forEach(clearTimeout);
    const pass = firstPass(next);
    setLook({ answered: 0, found: 0 });
    pass.forEach((_, i) => timers.current.push(setTimeout(() => setLook({ answered: i + 1, found: pass.slice(0, i + 1).reduce((n, s) => n + s.found, 0) }), STEP * (i + 1))));
  };
  // A saved want saves each change at once, offers Undo, and looks again; a new one only changes the guess until it starts.
  const edit = (next: WantDraft, what = 'Saved', again = true) => {
    const before = x;
    setX(next);
    if (fresh) return;
    setToast({ text: what, undo: () => { setX(before); setToast(null); } });
    if (again && next.state === 'active') lookAgain(next);
  };
  const setPrice = (lo: number, hi: number) => edit({ ...x, low_cents: lo * 100, max_total_cents: hi * 100 });
  const typed = (v: string) => { const n = whole(v); if (n > 0) setPrice(Math.round(n * 0.8), Math.round(n * 1.2)); };

  const on = x.sites.filter(s => ALL_SITES.includes(s));
  const running = fresh ? status === 'done' : x.state === 'active';
  const slot = (site: Site): SiteSlot => {
    if (!x.sites.includes(site)) return { site, state: 'off' };
    if (look) return on.indexOf(site) < look.answered ? { site, state: 'in', note: 'Just now' } : { site, state: 'waiting' };
    if (fresh) return { site, state: 'in', note: 'On' };
    if (x.behind.includes(site)) return { site, state: 'behind' };
    return x.checked[site] ? { site, state: 'in', note: ago(x.checked[site] ?? '') } : { site, state: 'waiting' };
  };
  const toggle = (site: Site) => edit({ ...x, sites: x.sites.includes(site) ? x.sites.filter(s => s !== site) : [...x.sites, site] }, x.sites.includes(site) ? 'Site off' : 'Site on');
  const found = look ? look.found : w.matches.filter(m => m.want_id === x.id).length;
  const where = !running ? (fresh ? 'Where' : x.state === 'paused' ? 'Paused' : 'Ended') : `Looking on ${on.length} ${on.length === 1 ? 'site' : 'sites'}`;
  const progress = (
    <Section title={where}>
      <Stack gap="tight">
        <SiteStrip id="want-site" slots={ALL_SITES.map(slot)} onToggle={toggle} />
        {running ? <Txt role="caption">{found ? `Found ${found} so far` : look && look.answered < on.length ? 'Nothing yet' : 'Nothing yet. You hear when one turns up.'}</Txt> : null}
      </Stack>
    </Section>
  );

  const finds = running && params.live && (live.alerts.length || !live.reached) ? (
    <Section title="Found">
      <Stack gap="tight">
        {live.alerts.map(a => (
          <MatchCard key={a.id} id={`want-found-${a.id}`} title={a.title} photo={a.image} site={a.site} verdict="under" what="Listed at" amount={usd(a.price_cents)}
            when={afterListing(a)} onPress={() => { Linking.openURL(a.url).catch(e => log.error('want.open_site', e, { site: a.site })); }} />
        ))}
        {live.reached ? null : <Txt role="caption">Behind. Trying again.</Txt>}
      </Stack>
    </Section>
  ) : null;

  const foot = toast ? <UndoToast id="want-undo" text={toast.text} onUndo={toast.undo} onGone={() => setToast(null)} />
    : fresh ? <Approve id="want-start" does={most ? `Watch for ${usd(most)} or less` : 'Watch for this'} status={status} step="Starting"
        done="Watching. You can leave and come back." onApprove={() => { setStatus('working'); timers.current.push(setTimeout(() => { setStatus('done'); lookAgain(x); }, 600)); }} />
    : undefined;

  return (
    <Screen name="want" state={state ?? (fresh ? 'new' : 'typical')} skip={SKIP} foot={foot} nav={nav}>
      {state === 'offline' ? <OfflineLine /> : null}
      <Stack gap="tight">
        <Txt role="heading">{fresh ? 'Watch for' : 'Watching for'}</Txt>
        <Guess id="want-what" look="body" name="What to look for" value={x.text} changed={!fresh} onChange={v => edit({ ...x, text: v })} />
      </Stack>

      {finds}
      {fresh ? null : progress}

      <Section title="Price, delivered">
        {most != null && low != null ? (
          <Stack gap="tight">
            <Txt role="headline">{`${usd(low)} to ${usd(most)}`}</Txt>
            <RangeSlider id="want-price" label="Price, delivered" {...priceBounds(low / 100, most / 100, dots)} low={low / 100} high={most / 100} dots={dots}
              caption={dots.length ? `Each dot is a sale of the same one: ${dots.length} sold` : 'Not enough sales yet to show'} onChange={setPrice} />
          </Stack>
        ) : <Blank id="want-most" look="body" name="Around what price?" numeric onChange={typed} />}
      </Section>

      <Section title="How it gets to you">
        <Stack gap="tight">
          <ChoiceChips id="want-how" label="How it gets to you" value={x.how}
            options={[{ id: 'ship', label: 'Ship' }, { id: 'pickup', label: 'Pickup' }, { id: 'both', label: 'Both' }]}
            onChange={v => edit({ ...x, how: v as How, fit: { ...x.fit, radius_mi: v === 'ship' ? undefined : x.fit.radius_mi ?? 15 } })} />
          {x.how !== 'ship' ? (
            <ChoiceChips id="want-radius" label="Pickup within" value={String(x.fit.radius_mi ?? 15)}
              options={[...new Set([...RADII, x.fit.radius_mi ?? 15])].sort((a, b) => a - b).map(r => ({ id: String(r), label: `${r} mi` }))} onChange={v => edit({ ...x, fit: { ...x.fit, radius_mi: Number(v) } })} />
          ) : null}
        </Stack>
      </Section>

      {colours.length ? (
        <Section title="Colour">
          <ColourSwatches id="want-colour" swatches={colours} value={x.colours}
            onChange={c => edit({ ...x, colours: c === 'any' ? [] : x.colours.includes(c) ? x.colours.filter(k => k !== c) : [...x.colours, c] })} />
        </Section>
      ) : null}

      {kind === 'apparel' ? (
        <Section title="Cut">
          <ChoiceChips id="want-cut" label="Cut" value={x.fit.cut ?? 'any'} options={CUTS}
            onChange={v => edit({ ...x, fit: { ...x.fit, cut: v === 'any' ? undefined : v as Cut } })} />
        </Section>
      ) : null}

      {sizes.length ? (
        <Section title="Size">
          <SizePicker id="want-size" systems={sizes} system={x.size_system ?? sizes[0].id} value={x.fit.size ?? null}
            onChange={(system, size) => edit({ ...x, size_system: system, fit: { ...x.fit, size: size ?? undefined } })} />
        </Section>
      ) : null}

      <Section title="At least">
        <ChoiceChips id="want-condition" label="Condition, at least" value={conditionId(x.fit.condition_floor)}
          options={CONDITIONS.map(c => ({ id: c.id, label: c.label }))}
          onChange={v => edit({ ...x, fit: { ...x.fit, condition_floor: CONDITIONS.find(c => c.id === v)?.floor } })} />
      </Section>

      <Section title="Tell me">
        <Stack gap="tight">
          <ChoiceChips id="want-alert" label="Tell me" value={x.alert} onChange={k => edit({ ...x, alert: k as WantDraft['alert'] }, 'Saved', false)}
            options={[{ id: 'under', label: most != null ? `Under ${usd(most)}` : 'Under my price' }, { id: 'available', label: 'Any new one' }]} />
          <Row>
            <Txt role="caption">Quiet</Txt>
            {x.quiet_hours ? <Guess id="want-quiet" look="body" name="Quiet hours" value={`${hour(x.quiet_hours.from)} to ${hour(x.quiet_hours.to)}`} changed={!fresh} onChange={() => edit(x, 'Saved', false)} />
              : <Blank id="want-quiet" look="body" name="No quiet hours" onChange={() => edit({ ...x, quiet_hours: { from: '22:00', to: '07:00' } }, 'Saved', false)} />}
          </Row>
        </Stack>
      </Section>

      {fresh ? progress : (
        <Line>
          <Pill id="want-pause" kind="second" label={x.state === 'paused' ? 'Resume' : 'Pause'} icon={x.state === 'paused' ? 'refresh' : 'clock-01'}
            onPress={() => edit({ ...x, state: x.state === 'paused' ? 'active' : 'paused' }, x.state === 'paused' ? 'Looking again' : 'Paused', false)} />
          <Pill id="want-end" kind="second" label="End" icon="cancel-01" onPress={() => edit({ ...x, state: 'ended' }, 'Ended', false)} />
        </Line>
      )}
    </Screen>
  );
}
