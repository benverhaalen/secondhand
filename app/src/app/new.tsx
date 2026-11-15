// New, the ＋: the one way a thing gets in (spec/pages.md §6.4; app/behavior/new.json). The button grows into a circle of
// the brand's field that covers the screen, and its four jobs rise out of it, centered (Ben, 11:29 and 11:32): Appraise an
// item (what the secondhand market pays for it now), Sell an item (the draft), Track an item (watch for one secondhand, a
// Brewers jersey) and Find an item (what a thing is). A job opens the camera out of the circle it was touched on; × plays it
// back into the button. The pencils that typed a job in are gone (Ben, 11:29); words or a link come in through Buy's search
// field, and a link shared into the app still opens its job's sheet here (?sheet=, ?link=). Where each result lives after:
// spec/redesign/new-results.md.
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { usd } from '@/demo';
import { CHOICES, DRAFT_ID, ordered, rememberMode, type Mode } from '@/demo/capture';
import { cents, described, priceAsk } from '@/demo/capture-edges';
import { feed } from '@/demo/capture-photos';
import {
  Blank, ChoiceCapsule, ChoiceColumn, CircleStage, FeedLayer, FootButton, MODE_ICON, OVER, PlusClose, Sheet, TakeoverPlace, Txt, useChoices, usePlus,
  type CirclePhase,
} from '@/ui';

const MODES: Mode[] = ['sell', 'worth', 'track', 'find'];
// The states the checks look for that New has no reason to draw (B35).
const SKIP = 'new: the same four jobs for a new person; empty: there are always four jobs; one: there are always four; dense: there are only ever four; loading: nothing here waits on anything; failed: nothing here can fail, a link that will not come in fails on the draft; offline: a job opens the camera, which keeps stills until signal returns';
const isLink = (s: string) => /^https?:\/\/\S+$/i.test(s.trim());

export default function New() {
  const params = useLocalSearchParams<{ sheet?: string; what?: string; link?: string; price?: string; ask?: string }>();
  const plus = usePlus();
  const [phase, setPhase] = useState<CirclePhase>('opening');
  const [picked, setPicked] = useState<{ mode: Mode; index: number } | null>(null);
  // A link shared in from outside lands in Sell it, the job a listing link most often starts (Ben, 05:47: cross-list the
  // listings already on Depop).
  const [sheet, setSheet] = useState<Mode | null>(MODES.includes(params.sheet as Mode) ? (params.sheet as Mode) : params.link ? 'sell' : null);
  const [what, setWhat] = useState(params.what ?? params.link ?? '');
  const [price, setPrice] = useState(params.price ?? '');
  const [choices] = useState(ordered);
  const at = useChoices(choices.length);
  const link = isLink(what);
  // What the words name, spelled the catalog's way ("carhart detroit" is the Carhartt Detroit Jacket), and its sold range.
  const match = link ? null : described(what);
  const typedCents = cents(price);
  const ask = sheet === 'sell' && match && typedCents != null ? priceAsk(typedCents, match.used_price.range) : null;
  // A price far outside the sold range asks once, with the range; the next tap makes the draft at that price.
  const [asked, setAsked] = useState(params.ask === '1' && !!ask);
  const shown = (phase === 'opening' || phase === 'open') && !picked;

  // Back where it came from; opened on its own (a link, a test), back to Today.
  const leave = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace('/' as Href); }, []);
  const settled = useCallback((p: CirclePhase) => { if (p === 'closed') leave(); }, [leave]);
  const opened = useCallback((p: CirclePhase) => {
    if (p === 'open' && picked) router.replace({ pathname: '/camera', params: { mode: picked.mode } } as Href);
  }, [picked]);
  const choose = (mode: Mode, index: number) => {
    rememberMode(mode);
    if (mode === 'track') { router.replace('/want' as Href); return; }
    setPicked({ mode, index });
  };
  // Each job ends where its camera ends: a draft to review, the value page, the matches.
  const go = () => {
    if (sheet === 'sell') { if (ask && !asked) { setAsked(true); return; } router.replace(`/item/${DRAFT_ID}` as Href); return; }
    if (sheet === 'worth') { router.replace((match ? `/worth?product=${match.id}` : '/worth') as Href); return; }
    const q = match ? `${match.brand} ${match.model}` : what.trim();
    if (sheet === 'track') { router.replace({ pathname: '/want', params: { q } } as Href); return; }
    router.replace((match ? `/product/${match.id}` : { pathname: '/search', params: { q } }) as Href);
  };
  const job = CHOICES.find(c => c.mode === sheet);
  const goLabel = sheet === 'sell' ? (asked && typedCents != null ? `List at ${usd(typedCents)}` : link ? 'Bring it in' : 'Make a draft')
    : sheet === 'worth' ? 'See what it’s worth' : sheet === 'track' ? 'Watch for it' : 'See what it is';

  return (
    <TakeoverPlace name="new" state={sheet === 'sell' && asked ? 'ask' : sheet ?? 'typical'} skip={SKIP}>
      <Stack.Screen options={OVER} />
      {/* The jobs live inside the circle, so they rise out of it and go back into the button with it. */}
      <CircleStage origin={plus} phase={phase} ground="field" onSettled={settled}>
        <ChoiceColumn count={choices.length}>
          {choices.map((c, i) => (
            <ChoiceCapsule key={c.mode} id={`new-${c.mode}`} label={c.label} icon={MODE_ICON[c.mode]} lead={i === 0} index={i} shown={shown}
              onPress={() => choose(c.mode, i)} />
          ))}
        </ChoiceColumn>
      </CircleStage>
      <PlusClose open={shown} onPress={() => setPhase('closing')} />
      {picked ? (
        // The camera opens out of the touched job's icon well. On a phone the live camera starts dark, so the circle is too.
        <CircleStage origin={at.well(picked.index)} phase="opening" ground="bar" onSettled={opened}>
          <FeedLayer feed={Platform.OS === 'web' ? feed('front') : null} />
        </CircleStage>
      ) : null}
      <Sheet open={!!sheet} title={job?.label ?? ''} onClose={() => setSheet(null)}>
        <Blank id="type-field" live name="What it is, or a link" value={what} onChange={v => { setWhat(v); setAsked(false); }} />
        {match ? <Txt role="caption">{`${match.brand} ${match.model}`}</Txt> : null}
        {sheet === 'sell' && !link ? <Blank id="type-price" live name="Your price" numeric value={price} onChange={v => { setPrice(v); setAsked(false); }} /> : null}
        {asked && ask ? <Txt role="body">{ask}</Txt> : null}
        <FootButton id={`${sheet ?? 'sell'}-go`} label={goLabel} state={what.trim() ? 'idle' : 'disabled'} onPress={go} />
      </Sheet>
    </TakeoverPlace>
  );
}
