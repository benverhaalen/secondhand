// New, the ＋: the one way a thing gets in (spec/pages.md §6.4; app/behavior/new.json). The button grows into a circle
// that covers the screen and its three choices rise out of it; a choice opens the camera out of the circle it was touched
// on; × plays it back into the button. Paste a link and Describe it are the ways in without the camera (ways-out §6.4).
import { Stack, router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { usd } from '@/demo';
import { ordered, rememberMode, type Mode } from '@/demo/capture';
import { cents, described, priceAsk } from '@/demo/capture-edges';
import { feed } from '@/demo/capture-photos';
import {
  BarPill, Blank, ChoiceCapsule, ChoiceColumn, CircleStage, FeedLayer, FootButton, MODE_ICON, OVER, PlusClose, Sheet, TakeoverPlace, WaysOut, usePlus, wellCenter,
  Txt, type CirclePhase,
} from '@/ui';

type Way = 'link' | 'describe';
// The states the checks look for that New has no reason to draw (B35).
const SKIP = 'new: the same three doors for a new person; empty: there are always three choices; one: there are always three; dense: there are only ever three; loading: nothing here waits on anything; failed: nothing here can fail, a link that will not come in fails on the draft; offline: a choice opens the camera, which keeps stills until signal returns';

export default function New() {
  const params = useLocalSearchParams<{ sheet?: string; link?: string; what?: string; price?: string; ask?: string }>();
  const plus = usePlus();
  const [phase, setPhase] = useState<CirclePhase>('opening');
  const [picked, setPicked] = useState<{ mode: Mode; index: number } | null>(null);
  const [sheet, setSheet] = useState<Way | null>(params.sheet === 'link' || params.sheet === 'describe' ? params.sheet : null);
  const [link, setLink] = useState(params.link ?? '');
  const [what, setWhat] = useState(params.what ?? '');
  const [price, setPrice] = useState(params.price ?? '');
  const [choices] = useState(ordered);
  // What the words name, spelled the catalog's way ("carhart detroit" is the Carhartt Detroit Jacket), and its sold range.
  const match = described(what);
  const typedCents = cents(price);
  const ask = match && typedCents != null ? priceAsk(typedCents, match.used_price.range) : null;
  // A price far outside the sold range asks once, with the range; the next tap makes the draft at that price.
  const [asked, setAsked] = useState(params.ask === '1' && !!ask);
  const shown = (phase === 'opening' || phase === 'open') && !picked;

  // Back where it came from; opened on its own (a link, a test), back to Today.
  const leave = useCallback(() => { if (router.canGoBack()) router.back(); else router.replace('/' as Href); }, []);
  const settled = useCallback((p: CirclePhase) => { if (p === 'closed') leave(); }, [leave]);
  const opened = useCallback((p: CirclePhase) => {
    if (p === 'open' && picked) router.replace({ pathname: '/camera', params: { mode: picked.mode } } as Href);
  }, [picked]);
  const choose = (mode: Mode, index: number) => { rememberMode(mode); setPicked({ mode, index }); };
  const draft = () => router.replace('/sell' as Href);
  const make = () => { if (ask && !asked) { setAsked(true); return; } draft(); };

  return (
    <TakeoverPlace name="new" state={sheet === 'describe' && asked ? 'ask' : sheet ?? 'typical'} skip={SKIP}>
      <Stack.Screen options={OVER} />
      {/* The choices live inside the circle, so they rise out of it and go back into the button with it. */}
      <CircleStage origin={plus} phase={phase} ground="bar" onSettled={settled}>
        <ChoiceColumn
          ways={(
            <WaysOut shown={shown} count={choices.length}>
              <BarPill id="new-link" icon="link-01" label="Paste a link" onPress={() => setSheet('link')} />
              <BarPill id="new-describe" icon="pencil-edit-02" label="Describe it" onPress={() => setSheet('describe')} />
            </WaysOut>
          )}>
          {choices.map((c, i) => (
            <ChoiceCapsule key={c.mode} id={`new-${c.mode}`} label={c.label} icon={MODE_ICON[c.mode]} lead={i === 0} index={i} shown={shown} onPress={() => choose(c.mode, i)} />
          ))}
        </ChoiceColumn>
      </CircleStage>
      <PlusClose open={shown} onPress={() => setPhase('closing')} />
      {picked ? (
        // The camera opens out of the touched choice's circle. On a phone the live camera starts dark, so the circle is too.
        <CircleStage origin={wellCenter(picked.index, plus)} phase="opening" ground="bar" onSettled={opened}>
          <FeedLayer feed={Platform.OS === 'web' ? feed('front') : null} />
        </CircleStage>
      ) : null}
      <Sheet open={sheet === 'link'} title="Paste a link" onClose={() => setSheet(null)}>
        <Blank id="link-field" name="Link" value={link} onChange={setLink} />
        <FootButton id="link-go" label="Bring it in" state={link ? 'idle' : 'disabled'} onPress={draft} />
      </Sheet>
      <Sheet open={sheet === 'describe'} title="Describe it" onClose={() => setSheet(null)}>
        <Blank id="describe-field" name="What it is" value={what} onChange={v => { setWhat(v); setAsked(false); }} />
        {match ? <Txt role="caption">{`${match.brand} ${match.model}`}</Txt> : null}
        <Blank id="describe-price" name="Your price" numeric value={price} onChange={v => { setPrice(v); setAsked(false); }} />
        {asked && ask ? <Txt role="body">{ask}</Txt> : null}
        <FootButton id="describe-go" label={asked && typedCents != null ? `List at ${usd(typedCents)}` : 'Make a draft'} state={what ? 'idle' : 'disabled'} onPress={make} />
      </Sheet>
    </TakeoverPlace>
  );
}
