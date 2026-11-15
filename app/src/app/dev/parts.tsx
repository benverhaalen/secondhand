// The parts sheet: every part in every state and variant, at 390 wide. This is how a part is vetted: render it
// (/dev/parts for light, /dev/parts?scheme=dark for dark), measure every [data-part] box against brand/tokens.css,
// and look. A new part gets a row here before any screen uses it (.agents/ui-build/README.md, "Missing part").
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Amount, Approve, Blank, Count, DecisionCard, EmptyState, FootButton, Grid, Guess, IconButton, ItemCard, Line, List, Nav, Notice, Pill,
  Screen, Section, Sheet, SiteBadge, Skeleton, Stack, Tag, TabBar, Theme, TopSlot, Txt, UndoToast, type PhotoSrc, type TabKey, type TagState,
} from '@/ui';
import { Chip, Choice, FilterRow } from '@/ui/parts/chip';
import { Shelf, Tile } from '@/ui/parts/tile';
import { KeepRow, Range } from '@/ui/parts/worth';
import { photo } from '@/demo/photos';

const HOUR = 3600000;
// Deadlines are fixed offsets from the moment the sheet opens, so each strength of a state gradient shows.
const at = (h: number) => Date.now() + h * HOUR;
const STATES: TagState[] = ['need', 'live', 'hot', 'stuck', 'sold', 'ship', 'paid', 'failed', 'draft', 'ended', 'working'];

export default function Parts() {
  const { scheme } = useLocalSearchParams<{ scheme?: string }>();
  if (scheme !== 'dark' && scheme !== 'light') return <Sheetful />;
  return (
    <Theme scheme={scheme}>
      <Sheetful />
    </Theme>
  );
}

function Sheetful() {
  const [tab, setTab] = useState<TabKey>('index');
  const [sheet, setSheet] = useState(false);
  const [size, setSize] = useState('');
  return (
    <Screen name="parts" state="all" wash nav={<Nav inbox={{ count: 2 }} />}>
      <TopSlot news={{ since: 'Since yesterday', kept: 96.2, line: '2 sold, after fees' }} />

      <Section title="Decision card, the lead (state gradients, by time left)">
        <DecisionCard id="d-need" kind="need" word="Offer" title="Carhartt Detroit jacket" photo="carhartt-jacket" site="depop" fact={{ label: 'You keep', amount: 33.44 }}
          due={at(3.67)} lead primary={{ id: 'd-need-accept', label: 'Accept $38' }} second={{ id: 'd-need-counter', label: 'Counter' }} more={{ id: 'd-need-more', label: 'More' }} />
        <DecisionCard id="d-ship" kind="ship" word="Ship" title="Nike Dunk Low, 10.5" photo="nike-dunks" site="ebay" fact={{ label: 'You keep', amount: 31.4 }}
          due={at(30)} lead primary={{ id: 'd-ship-print', label: 'Print label' }} second={{ id: 'd-ship-spots', label: 'Drop-off spots' }} />
        <DecisionCard id="d-live" kind="live" word="Price" title="Patagonia Synchilla, L" photo="patagonia-fleece" site="poshmark" fact={{ label: 'Lower to', amount: 52 }}
          lead primary={{ id: 'd-live-lower', label: 'Lower to $52' }} second={{ id: 'd-live-keep', label: 'Keep $58' }} />
        <DecisionCard id="d-paid" kind="paid" word="Paid" title="Levi’s 501, 32 × 32" photo="levis-501" site="poshmark" fact={{ label: 'You keep', amount: 44.1 }}
          due={at(47)} lead primary={{ id: 'd-paid-out', label: 'Cash out' }} second={{ id: 'd-paid-later', label: 'Later' }} />
      </Section>

      <Section title="Decision card, every state">
        <DecisionCard id="d-open" kind="need" word="Offer" title="Brass desk lamp" photo="brass-lamp" site="ebay" fact={{ label: 'You keep', amount: 28.9 }}
          due={at(20)} primary={{ id: 'd-open-accept', label: 'Accept $32' }} second={{ id: 'd-open-counter', label: 'Counter' }} />
        <DecisionCard id="d-working" kind="ship" word="Ship" title="Nike Dunk Low, 10.5" photo="nike-dunks" site="ebay" fact={{ label: 'You keep', amount: 31.4 }}
          due={at(21)} status="working" step="Printing" primary={{ id: 'd-working-print', label: 'Print label' }} second={{ id: 'd-working-spots', label: 'Drop-off spots' }} />
        <DecisionCard id="d-failed" kind="ship" word="Ship" title="Switch OLED" photo="switch-oled" site="mercari" fact={{ label: 'You keep', amount: 210 }}
          status="failed" step="The label did not print" primary={{ id: 'd-failed-print', label: 'Print label' }} second={{ id: 'd-failed-help', label: 'Get help' }} />
        <Txt role="caption">Done: the card leaves and this shows in its place</Txt>
        <UndoToast id="d-done-undo" text="Label printed" onUndo={() => {}} />
      </Section>

      <Section title="Decision card, batch and queue">
        <DecisionCard id="d-batch" kind="ship" word="Ship 3" title="3 sold today" photo="brass-lamp" site="ebay" fact={{ label: 'You keep', amount: 104.2 }}
          due={at(22)} form="batch" primary={{ id: 'd-batch-print', label: 'Print 3 labels' }} second={{ id: 'd-batch-each', label: 'One by one' }} />
        <DecisionCard id="d-batch-run" kind="ship" word="Ship 3" title="3 sold today" photo="brass-lamp" site="ebay" fact={{ label: 'You keep', amount: 104.2 }}
          due={at(22)} form="batch" status="working" step="2 of 3" primary={{ id: 'd-batch-run-print', label: 'Print 3 labels' }} second={{ id: 'd-batch-run-each', label: 'One by one' }} />
        <DecisionCard id="d-queue" kind="need" word="Offer" title="Kindle Paperwhite" photo="kindle" site="ebay" fact={{ label: 'You keep', amount: 51 }}
          due={at(6)} form="queue" waiting={4} primary={{ id: 'd-queue-accept', label: 'Accept $58' }} second={{ id: 'd-queue-counter', label: 'Counter' }} />
      </Section>

      <Section title="Item card">
        <ItemCard id="i-live" title="Patagonia Synchilla, L" photo="patagonia-fleece" site="poshmark" state="live" fact={{ label: 'Listed at', amount: 58 }} />
        <ItemCard id="i-hot" title="Nike Dunk Low, 10.5" photo="nike-dunks" site="depop" state="hot" fact={{ label: '14 watching' }} />
        <ItemCard id="i-ship" title="Brass desk lamp" photo="brass-lamp" site="ebay" state="ship" word="Ship by Tue" fact={{ label: 'You keep', amount: 31.12 }} due={at(40)} />
        <ItemCard id="i-ended" title="IKEA Poäng chair" photo="ikea-chair" site="facebook" state="ended" fact={{ label: 'Listed at', amount: 40 }} />
        <ItemCard id="i-nophoto" title="A very long title that runs on past the edge of the card" state="draft" fact={{ label: 'Pricing' }} />
      </Section>

      <Section title="Notice">
        <Notice id="n-plain" icon="tick-02" text="Handled 6 things today" />
        <Notice id="n-need" icon="waving-hand-01" text="2 questions from buyers" tone="need" />
      </Section>

      <Section title="Tag, every state">
        <Line>{STATES.map(s => <Tag key={s} state={s} />)}</Line>
        <Line><Tag state="ship" word="Ship by Tue" /><Tag state="need" word="Offer" /></Line>
      </Section>

      <Section title="Count, site badge">
        <Line gap="group">
          <Count n={2} /><Count n={14} /><Count n={120} />
          <SiteBadge site="ebay" /><SiteBadge site="depop" /><SiteBadge site="poshmark" /><SiteBadge site="mercari" /><SiteBadge site="facebook" />
        </Line>
      </Section>

      <Section title="Pill, icon button">
        <Line><Pill id="p-1" label="Accept $38" /><Pill id="p-2" kind="second" label="Counter" /><IconButton id="p-3" icon="more-horizontal" label="More" /></Line>
        <Line><Pill id="p-4" label="Post" /><Pill id="p-5" kind="second" label="Edit" icon="edit-02" /><IconButton id="p-6" icon="share-08" label="Share" look="plain" /></Line>
        <Line><Pill id="p-7" label="Print label" state="working" step="Printing" /><Pill id="p-8" kind="second" label="Counter" state="disabled" /></Line>
      </Section>

      <Section title="Foot button">
        <FootButton id="f-1" label="Post to 3 sites" />
        <FootButton id="f-2" kind="second" label="Save for later" />
        <FootButton id="f-3" label="Post to 3 sites" state="working" step="Posting, 1 of 2" />
      </Section>

      <Section title="Human in the loop">
        <Stack gap="tight">
          <Txt role="caption">Guessed by the agent, not yet touched</Txt>
          <Guess id="g-title" name="Title" value="Carhartt Detroit jacket, brown, M" />
        </Stack>
        <Stack gap="tight">
          <Txt role="caption">Changed by the person</Txt>
          <Guess id="g-price" name="Price" value="$45" changed numeric />
        </Stack>
        <Stack gap="tight">
          <Txt role="caption">Nobody knows yet</Txt>
          <Line><Blank id="b-size" name="Size" value={size} onChange={setSize} /><Blank id="b-color" name="Color" value="Brown" /></Line>
        </Stack>
        <Approve id="a-ready" does="Post at $45 on 2 sites" />
        <Approve id="a-working" does="Post at $45 on 2 sites" status="working" step="Posting, 1 of 2" />
        <Approve id="a-done" does="Post at $45 on 2 sites" status="done" done="Posted at $45 on 2 sites" onUndo={() => {}} />
        <Approve id="a-failed" does="Post at $45 on 2 sites" status="failed" failed="A site did not answer. Nothing was posted." />
      </Section>

      <Section title="Amount">
        <Amount value={46.95} what="You keep, after fees" />
      </Section>

      <Section title="Grid tile, shelf, filter row (Sell)">
        <FilterRow>
          <Chip id="c-sort" icon="sorting-01" label="Latest" onPress={() => {}} />
          <Chip id="c-all" label="All" picked onPress={() => {}} />
          <Chip id="c-need" label="Needs you" count={8} onPress={() => {}} />
          <Chip id="c-ebay" site="ebay" onPress={() => {}} />
        </FilterRow>
        <Shelf id="p-need" title="Needs you" count={8} onAll={() => {}}>
          <Grid columns={2}>
            <Tile id="p-t-idle" title="Carhartt Detroit jacket" photo={photo('carhartt-jacket') as PhotoSrc} state="need" word="Offer" sites={['ebay', 'depop']} fact={{ label: 'Offered', amount: '$85' }} onPress={() => {}} />
            <Tile id="p-t-faded" title="Nike Dunk Low, 10.5" photo={photo('nike-dunks') as PhotoSrc} state="ended" word="Unsold" faded fact={{ label: 'Worth', amount: '$60 to $80' }} onPress={() => {}} />
            <Tile id="p-t-on" title="Patagonia Synchilla, L" photo={photo('patagonia-fleece') as PhotoSrc} state="live" sites={['poshmark']} select="on" fact={{ label: 'Listed at', amount: '$58' }} onPress={() => {}} />
            <Tile id="p-t-picked" title="Patagonia Synchilla, L" photo={photo('patagonia-fleece') as PhotoSrc} state="paid" word="Paid" select="picked" fact={{ label: 'In your bank' }} onPress={() => {}} />
          </Grid>
        </Shelf>
        <Shelf id="p-kept" title="Kept" count={3} folded onOpen={() => {}} />
      </Section>

      <Section title="Range, keep rows, choices (What's it worth)">
        <Range low="$60" high="$80" what="What similar ones sold for lately" />
        <List>
          <KeepRow site="ebay" keep="$52 to $70" line="Sells in about 6 days" />
          <KeepRow site="poshmark" line="Too few sales here" note="Not linked" />
        </List>
        <List>
          <Choice id="p-c-pick" label="Price, high" picked onPress={() => {}} />
          <Choice id="p-c-leads" icon="store-01" label="See the sales" leads onPress={() => {}} />
          <Choice id="p-c-off" icon="search-01" label="Looking deeper" line="It lands on Today when it’s done." disabled onPress={() => {}} />
        </List>
      </Section>

      <Section title="Sheet, toast">
        <Line><Pill id="s-open" kind="second" label="Open a sheet" onPress={() => setSheet(true)} /></Line>
        <UndoToast id="t-undo" text="Offer accepted" onUndo={() => {}} />
        <Sheet open={sheet} title="Counter at" onClose={() => setSheet(false)}>
          <Guess id="s-price" name="Counter price" value="$42" numeric />
          <FootButton id="s-send" label="Send $42" onPress={() => setSheet(false)} />
        </Sheet>
      </Section>

      <Section title="Loading and empty">
        <Skeleton of="card-decision" />
        <Skeleton of="card-item" />
        <Skeleton of="notice" />
        <EmptyState title="Nothing needs you" line="New offers and sales show up here." action={{ id: 'e-add', label: 'Sell something' }} />
      </Section>

      <Section title="Top slot, a new person">
        <TopSlot setup={{ id: 'top-setup', line: 'Next step', step: 'Connect a site' }} />
      </Section>

      <Section title="Tab bar">
        <TabBar current={tab} badges={{ buy: true }} onTab={k => k !== 'new' && setTab(k)} />
      </Section>
    </Screen>
  );
}
