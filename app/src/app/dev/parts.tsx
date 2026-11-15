// The parts sheet: every part in every state and variant, at 390 wide. This is how a part is vetted: render it
// (/dev/parts for light, /dev/parts?scheme=dark for dark), measure every [data-part] box against brand/tokens.css,
// and look. A new part gets a row here before any screen uses it (.agents/ui-build/README.md, "Missing part").
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Amount, Approve, Blank, Composer, Count, DecisionCard, Draft, EmptyState, FootButton, Grid, Guess, IconButton, ItemCard, Line, List, Message, Meta, Nav, Notice, Pill,
  Screen, Section, Sheet, SiteBadge, SiteLink, Skeleton, Stack, Tag, TabBar, Theme, ThreadRow, TimeSpan, TopSlot, Txt, UndoToast, type PhotoSrc, type TabKey, type TagState,
  CamButton, CamNote, CaptureFrame, CamWord, ChoiceCapsule, Chips, FactChip, FeedSwatch, FixChip, Instruction, Modes, Shutter, StageBubbles,
  Feed, QueueView, MoneyNews, Pile, type SoldThing,
} from '@/ui';
import { ChoiceChips, ColourSwatches, Gallery, MatchCard, OfferSheet, PriceChart, PriceRange, RangeSlider, SearchField, SiteStrip, SizePicker } from '@/ui';
import { CardGroup } from '@/ui/parts/card-group';
import { ConvoRow } from '@/ui/parts/convo-row';
import { Glance } from '@/ui/parts/glance';
import { GoalBar } from '@/ui/parts/goal-bar';
import { ListRow } from '@/ui/parts/list-row';
import { Switch } from '@/ui/parts/switch';
import { TabNav } from '@/ui/parts/tab-nav';
import { WeekBars } from '@/ui/parts/week-bars';
import { WeekChart } from '@/ui/parts/week-chart';
import { MoneyBar } from '@/ui/parts/money-bar';
import { StateBar } from '@/ui/parts/state-bar';
import { PulseKey, PulseRow } from '@/ui/parts/pulse-row';
import { Chip, Choice, FilterRow } from '@/ui/parts/chip';
import { SiteChip } from '@/ui/parts/site-chip';
import { Shelf, Tile } from '@/ui/parts/tile';
import { KeepRow, Range } from '@/ui/parts/worth';
import { photo } from '@/demo/photos';
import { GuessPick } from '@/ui/parts/pick';
import { ItemParts } from '@/ui/parts/item-parts-sheet';
import colourData from '@/buy/colours.json' with { type: 'json' };

const HOUR = 3600000;
// Deadlines are fixed offsets from the moment the sheet opens, so each strength of a state gradient shows.
const at = (h: number) => Date.now() + h * HOUR;
const QUEUE: Record<string, { title: string; photo: 'brass-lamp' | 'kindle' | 'ikea-chair' }> = {
  q1: { title: 'Brass desk lamp', photo: 'brass-lamp' }, q2: { title: 'Kindle Paperwhite', photo: 'kindle' }, q3: { title: 'IKEA Stefan chair', photo: 'ikea-chair' },
};
const QUEUE_SITES: ('ebay' | 'depop')[] = ['ebay', 'depop'];
const PILE: { id: string; kind: 'ship' | 'live' | 'need'; word: string; title: string; photo: 'kindle' | 'switch-oled' | 'brass-lamp'; fact: string; act: string }[] = [
  { id: 'p1', kind: 'ship', word: 'Ship 2', title: '2 to ship', photo: 'kindle', fact: 'Labels cost $6.40', act: 'Buy 2 labels' },
  { id: 'p2', kind: 'live', word: 'Ready', title: 'Nintendo Switch OLED', photo: 'switch-oled', fact: 'Lists at $235', act: 'Post to 2 sites' },
  { id: 'p3', kind: 'need', word: 'Price', title: 'Brass desk lamp', photo: 'brass-lamp', fact: 'Sells about $38', act: 'Lower to $38' },
];
const MONEY_SOLD: SoldThing[] = [
  { id: 'm1', title: 'IKEA Stefan chair', photo: 'ikea-chair', site: 'facebook' }, { id: 'm2', title: 'Nike Dunk Low', photo: 'nike-dunks', site: 'depop' },
  { id: 'm3', title: 'Kindle Paperwhite', photo: 'kindle', site: 'ebay' }, { id: 'm4', title: 'Brass desk lamp', photo: 'brass-lamp', site: 'ebay' },
  { id: 'm5', title: 'Levi’s 501', photo: 'levis-501', site: 'poshmark' },
];
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
  const [on, setOn] = useState(true);
  const [fed, setFed] = useState(['f-a', 'f-b']);
  const [queued, setQueued] = useState<string[] | null>(null);
  const [piled, setPiled] = useState(false);
  const [msg, setMsg] = useState('');
  const [span, setSpan] = useState({ start: 28, end: 32 });
  return (
    <Screen name="parts" state="all" sheet="parts" wash nav={<Nav inbox={{ count: 2 }} />}>
      <TopSlot news={{ since: 'Since yesterday', kept: 96.2, line: '2 sold, after fees' }} />

      <Section title="Decision card, the lead (state gradients, by time left)">
        <DecisionCard id="d-need" kind="need" word="Offer" title="Carhartt Detroit jacket" photo="carhartt-jacket" site="depop" fact={{ label: 'You get', amount: 33.44 }}
          due={at(3.67)} lead primary={{ id: 'd-need-accept', label: 'Accept $38' }} second={{ id: 'd-need-counter', label: 'Counter' }} more={{ id: 'd-need-more', label: 'More' }} />
        <DecisionCard id="d-ship" kind="ship" word="Ship" title="Nike Dunk Low, 10.5" photo={photo('nike-dunks') as PhotoSrc} site="ebay" fact={{ label: 'You get', amount: 31.4 }}
          due={at(30)} lead primary={{ id: 'd-ship-print', label: 'Print label' }} second={{ id: 'd-ship-spots', label: 'Drop-off spots' }} />
        <DecisionCard id="d-live" kind="live" word="Price" title="Patagonia Synchilla, L" photo={photo('patagonia-fleece') as PhotoSrc} site="poshmark" fact={{ label: 'Lower to', amount: 52 }}
          lead primary={{ id: 'd-live-lower', label: 'Lower to $52' }} second={{ id: 'd-live-keep', label: 'Keep $58' }} />
        <DecisionCard id="d-paid" kind="paid" word="Paid" title="Levi’s 501, 32 × 32" photo="levis-501" site="poshmark" fact={{ label: 'You get', amount: 44.1 }}
          due={at(47)} lead primary={{ id: 'd-paid-out', label: 'Cash out' }} second={{ id: 'd-paid-later', label: 'Later' }} />
      </Section>

      <Section title="Decision card, every state">
        <DecisionCard id="d-open" kind="need" word="Offer" title="Brass desk lamp" photo="brass-lamp" site="ebay" fact={{ label: 'You get', amount: 28.9 }}
          due={at(20)} primary={{ id: 'd-open-accept', label: 'Accept $32' }} second={{ id: 'd-open-counter', label: 'Counter' }} />
        <DecisionCard id="d-working" kind="ship" word="Ship" title="Nike Dunk Low, 10.5" photo={photo('nike-dunks') as PhotoSrc} site="ebay" fact={{ label: 'You get', amount: 31.4 }}
          due={at(21)} status="working" step="Printing" primary={{ id: 'd-working-print', label: 'Print label' }} second={{ id: 'd-working-spots', label: 'Drop-off spots' }} />
        <DecisionCard id="d-failed" kind="ship" word="Ship" title="Switch OLED" photo="switch-oled" site="mercari" fact={{ label: 'You get', amount: 210 }}
          status="failed" step="The label did not print" primary={{ id: 'd-failed-print', label: 'Print label' }} second={{ id: 'd-failed-help', label: 'Get help' }} />
        <Txt role="caption">Done: the card leaves and this shows in its place</Txt>
        <UndoToast id="d-done-undo" text="Label printed" onUndo={() => {}} />
      </Section>

      <Section title="Decision card, batch and queue">
        <DecisionCard id="d-batch" kind="ship" word="Ship 3" title="3 sold today" photo="brass-lamp" site="ebay" fact={{ label: 'You get', amount: 104.2 }}
          due={at(22)} form="batch" primary={{ id: 'd-batch-print', label: 'Print 3 labels' }} second={{ id: 'd-batch-each', label: 'One by one' }} />
        <DecisionCard id="d-batch-run" kind="ship" word="Ship 3" title="3 sold today" photo="brass-lamp" site="ebay" fact={{ label: 'You get', amount: 104.2 }}
          due={at(22)} form="batch" status="working" step="2 of 3" primary={{ id: 'd-batch-run-print', label: 'Print 3 labels' }} second={{ id: 'd-batch-run-each', label: 'One by one' }} />
        <DecisionCard id="d-queue" kind="need" word="Offer" title="Kindle Paperwhite" photo={photo('kindle') as PhotoSrc} site="ebay" fact={{ label: 'You get', amount: 51 }}
          due={at(6)} form="queue" waiting={4} primary={{ id: 'd-queue-accept', label: 'Accept $58' }} second={{ id: 'd-queue-counter', label: 'Counter' }} />
      </Section>

      <Section title="Feed: an answered card leaves and the gap closes">
        <Feed>
          {fed.map(k => (
            <DecisionCard key={k} id={k} kind="need" word="Offer" title={k === 'f-a' ? 'Brass desk lamp' : 'Kindle Paperwhite'} photo={k === 'f-a' ? 'brass-lamp' : 'kindle'} site="ebay"
              fact={{ label: 'You get', amount: 28.9 }} primary={{ id: `${k}-accept`, label: 'Accept $32', onPress: () => setFed(f => f.filter(x => x !== k)) }} />
          ))}
        </Feed>
        <Line><Pill id="f-reset" kind="second" label="Bring them back" onPress={() => setFed(['f-a', 'f-b'])} /></Line>
      </Section>

      <Section title="Pile: the lower tiers, layered, fanned out on a tap">
        <Shelf id="p" title="Can wait" count={3} onAll={piled ? undefined : () => setPiled(true)} onFold={piled ? () => setPiled(false) : undefined}>
          <Pile id="p" open={piled} onOpen={() => setPiled(true)}>
            {PILE.map(k => (
              <DecisionCard key={k.id} id={k.id} kind={k.kind} word={k.word} title={k.title} photo={k.photo} site="ebay"
                fact={{ label: k.fact }} primary={{ id: `${k.id}-act`, label: k.act }} />
            ))}
          </Pile>
        </Shelf>
      </Section>

      <Section title="Money news: what was kept, and what sold">
        {/* One per view: an amount is the one peak number (C6). Five sold shows two photos and +3; Today shows the two-sold case. */}
        <MoneyNews id="mn-five" caption="Since Monday" figure="$1,204.50" line="5 sold, after fees" things={MONEY_SOLD} />
      </Section>

      <Section title="Queue view: one of many, full screen">
        <Line><Pill id="q-open" kind="second" label="Open a queue of 3" onPress={() => setQueued(['q1', 'q2', 'q3'])} /></Line>
        <QueueView id="q" open={!!queued} title="Ready to post" total={3} does="Post at $45 on 2 sites" onClose={() => setQueued(null)}
          entries={(queued ?? []).map(k => ({ id: k, title: QUEUE[k].title, photo: QUEUE[k].photo, price: '$45', sites: QUEUE_SITES }))}
          onApprove={e => setQueued(q => (q && q.length > 1 ? q.filter(x => x !== e.id) : null))} onSkip={e => setQueued(q => (q && q.length > 1 ? q.filter(x => x !== e.id) : null))} onEdit={() => setQueued(null)} />
      </Section>

      <Section title="Item card">
        <ItemCard id="i-live" title="Patagonia Synchilla, L" photo={photo('patagonia-fleece') as PhotoSrc} site="poshmark" state="live" fact={{ label: 'Listed at', amount: 58 }} />
        <ItemCard id="i-hot" title="Nike Dunk Low, 10.5" photo={photo('nike-dunks') as PhotoSrc} site="depop" state="hot" fact={{ label: '14 watching' }} />
        <ItemCard id="i-ship" title="Brass desk lamp" photo="brass-lamp" site="ebay" state="ship" word="Ship by Tue" fact={{ label: 'You get', amount: 31.12 }} due={at(40)} />
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

      <Section title="Guess among choices, tile">
        <Stack gap="tight">
          <Txt role="caption">Picked by the agent, not yet touched; then by the person</Txt>
          <GuessPick id="gp-agent" name="What’s left Thursday" value="free" choices={[{ id: 'free', label: 'What’s left goes up free', does: 'Free for pickup at your spot.' }, { id: 'keep', label: 'What’s left gets packed', does: 'Comes with you.' }]} />
          <GuessPick id="gp-person" name="What’s left Thursday" value="keep" changed choices={[{ id: 'free', label: 'What’s left goes up free' }, { id: 'keep', label: 'What’s left gets packed' }]} />
        </Stack>
        <Grid columns={3}>
          <Tile id="t-live" title="Patagonia Retro-X fleece" photo={photo('patagonia-fleece') as PhotoSrc} state="hot"><Txt role="caption">For $110</Txt></Tile>
          <Tile id="t-none" title="Nike Dunk Low" photo={photo('nike-dunks') as PhotoSrc}><Txt role="caption">Still wear them</Txt></Tile>
          <Tile id="t-gone" title="Kindle Paperwhite" photo={photo('kindle') as PhotoSrc} state="sold" faded><Txt role="caption">You get $61.12</Txt></Tile>
          <Tile id="t-empty" title="Still looking" state="working"><Txt role="caption">Pricing</Txt></Tile>
        </Grid>
      </Section>

      <Section title="Amount">
        <Amount value={46.95} what="You get, after fees" />
        <Glance value={163.63} what="You got from 4 sales, after fees" stats={[{ value: '$132.33', word: 'On its way' }, { value: '4', word: 'Live' }]} />
        <CardGroup label="Looking for"><ItemCard id="cg-want" title="Standing desk" photo={null} state="working" word="2 of 3 sites" fact={{ label: 'Nothing yet under', amount: '$150' }} /></CardGroup>
      </Section>

      <Section title="Grid tile, shelf, filter row (Sell)">
        <FilterRow>
          <Chip id="c-sort" icon="sorting-01" label="Latest" onPress={() => {}} />
          <Chip id="c-all" label="All" picked onPress={() => {}} />
          <Chip id="c-need" label="Needs you" count={8} onPress={() => {}} />
          <SiteChip id="c-ebay" site="ebay" onPress={() => {}} />
          <SiteChip id="c-depop" site="depop" picked onPress={() => {}} />
        </FilterRow>
        <Shelf id="p-need" title="Needs you" count={8} onAll={() => {}}>
          <Grid columns={2}>
            <Tile id="p-t-idle" title="Carhartt Detroit jacket" photo={photo('carhartt-jacket') as PhotoSrc} state="need" word="Offer" sites={['ebay', 'depop']} fact={{ label: 'Offered', amount: '$85' }} onPress={() => {}} />
            <Tile id="p-t-faded" title="Nike Dunk Low, 10.5" photo={photo('nike-dunks') as PhotoSrc} state="ended" word="Unsold" faded fact={{ label: 'Worth', amount: '$60 to $80' }} onPress={() => {}} />
            <Tile id="p-t-on" title="Patagonia Synchilla, L" photo={photo('patagonia-fleece') as PhotoSrc} state="live" sites={['poshmark']} select="on" fact={{ label: 'Listed at', amount: '$58' }} onPress={() => {}} />
            <Tile id="p-t-picked" title="Patagonia Synchilla, L" photo={photo('patagonia-fleece') as PhotoSrc} state="paid" word="Paid" select="picked" fact={{ label: 'In your bank' }} onPress={() => {}} />
          </Grid>
        </Shelf>
        <Shelf id="p-kept" title="Kept" count={3} folded onFold={() => {}} />
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
      <ItemParts />

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

      <Section title="Messages: thread row, message, draft, composer">
        <List>
          <ThreadRow id="tr-need" who="canvasfan" photo="carhartt-jacket" title="Carhartt Detroit jacket" site="depop" need={{ state: 'need', word: 'Offer' }} last="Would you take $85?" time="5m ago" unread={2} />
          <ThreadRow id="tr-did" who="vintage_workwear_collector_and_reseller_since_2009" photo="nike-dunks" title="Nike Dunk Low, 10.5" site="ebay" did="Sent for you" last="Yes, it’s still available. It ships tomorrow." mine time="Yesterday" unread={0} />
        </List>
        <List>
          <ConvoRow id="cr-draft" who="canvasfan" photo="carhartt-jacket" name="Carhartt Detroit jacket" site="depop" note="draft" last="Is the inseam really 36?" time="9h ago" unread={1} />
          <ConvoRow id="cr-scam" who="Alex" photo="nike-dunks" name="Nike Dunk Low" site="facebook" note="scam" last="Can you text me? I’ll pay by Zelle" time="10h ago" unread={1} />
          <ConvoRow id="cr-read" who="vintage_workwear_collector_and_reseller_since_2009" photo={null} name="Nike Dunk Low" site="ebay" last="Yes, it’s still available." time="Yesterday" unread={0} />
          <ConvoRow id="cr-auto" who="workwear_co" photo="carhartt-jacket" name="Carhartt Detroit jacket" site="ebay" note="auto" last="It ships tomorrow." time="5h ago" unread={0} />
        </List>
        <Message side="theirs" meta={<Meta text="canvasfan, 5m ago" />}>What’s the inseam?</Message>
        <Message side="mine" meta={<Meta text="Sent for you, 4m ago" info />}>It’s 32 inches.</Message>
        <Draft id="dr-a" who="canvasfan" spans={[{ text: 'It’s ' }, { text: '36', guess: true }, { text: '. I measured it flat, ' }, { text: 'photo 3', guess: true, mine: true }, { text: '.' }]}
          facts={[{ text: '36 inseam', from: 'the label' }, { text: '35 in', from: 'your tape' }]} />
        <Draft id="dr-f" who="canvasfan" spans={[{ text: 'It’s 36.' }]} status="failed" failed="The site did not answer" lead={false} />
        <Composer id="co" to="canvasfan" value={msg} onChange={setMsg} onSend={() => setMsg('')} />
      </Section>

      <Section title="Time span">
        <TimeSpan id="ts-day" day="Mon 16" words="2 to 4 pm" value={span} onChange={setSpan} />
        <TimeSpan id="ts-dark" day="Fri 20" words="6 to 8 pm" value={{ start: 36, end: 40 }} onChange={() => {}} note="Ends after dark" />
      </Section>

      <Section title="Site link">
        <Line>
          <SiteLink id="sl-depop" site="depop" onPress={() => {}} />
          <SiteLink id="sl-ebay" site="ebay" onPress={() => {}} />
        </Line>
      </Section>

      <BuySide />
      <Section title="New and the camera (on the bar)">
        <FeedSwatch>
          <ChoiceCapsule id="nc-sell" label="Sell an item" icon="tag-01" lead index={0} shown />
          <ChoiceCapsule id="nc-worth" label="Appraise an item" icon="money-03" index={1} shown />
          <CaptureFrame sample band={<Chips><FactChip id="nc-frame-brand" name="Brand" value="Carhartt" /><FactChip id="nc-frame-size" name="Size" /></Chips>} />
          <StageBubbles stages={[{ name: 'Kind', state: 'done' }, { name: 'Photos', state: 'now' }, { name: 'Label', state: 'skipped' }, { name: 'Measure', state: 'later' }, { name: 'Condition', state: 'later' }]} />
          <Instruction text="Closer on the tag" />
          <Chips>
            <FactChip id="nc-brand" name="Brand" value="Carhartt" />
            <FactChip id="nc-size" name="Size" />
            <CamNote icon="clock-01" text="2 photos waiting for signal" />
            <FixChip id="nc-clean" label="Clean up" on onPress={() => {}} />
            <FixChip id="nc-ai" label="Enhance with AI" on={false} onPress={() => {}} />
          </Chips>
          <Modes modes={[{ mode: 'sell', label: 'Sell', icon: 'tag-01' }, { mode: 'worth', label: 'Worth', icon: 'money-03' }, { mode: 'find', label: 'Find', icon: 'search-01' }]} current="sell" onPick={() => {}} />
          <Line gap="group">
            <CamButton id="nc-library" icon="image-01" label="Choose photos" />
            <Shutter id="nc-shutter" />
            <Shutter id="nc-shutter-wait" waiting />
            <CamWord id="nc-skip" label="Skip" />
          </Line>
        </FeedSwatch>
      </Section>

      <Section title="You: tab nav, list rows, switch, goal, week bars">
        <TabNav title="You" inbox={{ count: 2 }} />
        <List>
          <ListRow id="lr-plain" lead="money-03" label="Payouts" onPress={() => {}} />
          <ListRow id="lr-value" label="On its way" value="$132.33" tabular onPress={() => {}} />
          <ListRow id="lr-fact" label="Money" value="US dollars" />
          <ListRow id="lr-switch" label="Pause selling" detail="Sites use their own away mode. The rest end and come back on your date" trail={<Switch id="sw-1" label="Pause selling" on={on} onChange={setOn} />} />
          <ListRow id="lr-off" label="Buy shipping labels" detail="Asks you first. Approved 2 of 3 times without a change" trail={<Switch id="sw-2" label="Buy shipping labels" on={false} disabled />} />
          <ListRow id="lr-site" site="depop" label="Linked" detail="Checked 5m ago" onPress={() => {}} />
          <ListRow id="lr-link" site="mercari" label="Not linked" trail={<Pill id="lr-link-p" kind="second" label="Link" />} />
          <ListRow id="lr-linking" site="ebay" label="Signing in" trail={<Pill id="lr-linking-p" kind="second" label="Link" state="working" />} />
          <ListRow id="lr-error" site="poshmark" tone="brick" label="Didn’t link" trail={<Pill id="lr-error-p" kind="second" label="Retry" icon="refresh" />} />
        </List>
        <GoalBar label="November goal" kept={132.33} target={300} />
        <WeekBars weeks={[{ label: 'Sep 22', amount: 31.3 }, { label: '29', amount: 0 }, { label: 'Oct 6', amount: 64 }, { label: '13', amount: 12.5 }, { label: '20', amount: 0 }, { label: '27', amount: 88.1 }, { label: 'Nov 3', amount: 40 }, { label: '10', amount: 132.33, now: true }]} />
      </Section>

      <Section title="You: the dashboard's week chart, money bar, state bar and how each is doing">
        <WeekChart top={200} axis="After fees" count={{ name: 'Sales', one: 'sale', many: 'sales' }}
          weeks={[{ label: 'Sep 21', amount: 0, n: 0 }, { label: '28', amount: 0, n: 0 }, { label: 'Oct 5', amount: 64, n: 2 }, { label: '12', amount: 0, n: 0 }, { label: '19', amount: 31.3, n: 1 }, { label: '26', amount: 0, n: 0 }, { label: 'Nov 2', amount: 120, n: 1 }, { label: '9', amount: 132.33, n: 3, now: true }]} />
        <MoneyBar parts={[
          { id: 'mb-paid', label: 'Paid out', detail: 'In your bank or your hand', value: '$31.30', low: 3130, fill: 'lime', onPress: () => {} },
          { id: 'mb-way', label: 'On its way', detail: 'Ready on the site about Tuesday', value: '$132.33', low: 13233, fill: 'mint', onPress: () => {} },
          { id: 'mb-could', label: 'Could still earn', detail: 'If your 4 live things sell', value: '$253 to $276', low: 25341, high: 27563, fill: 'sky', onPress: () => {} },
        ]} />
        <StateBar onOpen={() => {}} parts={[
          { id: 'sb-ready', word: 'Getting ready', count: 2, fill: 'gray', icon: 'search-01' }, { id: 'sb-live', word: 'Live', count: 4, fill: 'sky', icon: 'live-streaming-02' },
          { id: 'sb-sold', word: 'Sold', count: 4, fill: 'mint', icon: 'money-03' }, { id: 'sb-kept', word: 'Kept', count: 1, fill: 'lilac', icon: 'store-01', note: 'worth $70 to $95' },
        ]} />
        <List>
          <PulseRow id="pr-1" title="Carhartt Detroit Jacket J97, brown duck, L" photo="carhartt-jacket" sites={['ebay', 'depop']} price="$95 to $98" line="Third cheapest of 14 like it. Should sell this week."
            cells={[{ value: '63', word: 'views', share: 0.53, said: '63 views, about usual (usual 59)' }, { value: '15', word: 'likes', share: 0.47, said: '15 likes, about usual (usual 16)' },
              { value: '2', word: 'offers', share: null, said: '2 offers' }, { value: '8', word: 'days up', share: 0.57, said: '8 days up, about usual (usual 7)' }]} onPress={() => {}} />
          <PulseRow id="pr-2" title="Patagonia Retro-X fleece, cream, M" photo="patagonia-fleece" sites={['depop', 'poshmark']} price="$110 to $118" line="31 likes in 3 days. Similar ones get 8."
            cells={[{ value: 'Not shown', word: 'views', share: null, said: 'No views shown on this site', muted: true }, { value: '37', word: 'likes', share: 1, said: '37 likes, more than usual (usual 9)' },
              { value: '0', word: 'offers', share: null, said: '0 offers' }, { value: '3', word: 'days up', share: 0.09, said: '3 days up, shorter than usual (usual 16)' }]} onPress={() => {}} />
        </List>
        <PulseKey text="The tick is what’s usual for it" />
      </Section>

      <Section title="Tab bar">
        <TabBar current={tab} badges={{ buy: true }} onTab={k => k !== 'new' && setTab(k)} />
      </Section>
    </Screen>
  );
}

// The buy side's parts, every state: the search box, a found listing, where a search looked, a price against its range,
// the history, the photos, one answer of a few, and the offer sheet.
function BuySide() {
  const [offer, setOffer] = useState(false);
  return (
    <>
      <Section title="Search field: empty, filled, working">
        <SearchField id="sf-empty" placeholder="Find an item or paste a link" onCamera={() => {}} />
        <SearchField id="sf-filled" value="nike dunk low grey 10" placeholder="Find an item or paste a link" onCamera={() => {}} />
        <SearchField id="sf-working" value="nike dunk low grey 10" placeholder="Find an item or paste a link" working />
      </Section>
      <Section title="Match card: good, fair, high, not the same, gone">
        <MatchCard id="m-good" title="Nike Dunk Low Grey Fog, men’s 10" photo="nike-dunks" site="mercari" verdict="good" what="Delivered" amount="$72.50" when="12m ago" />
        <MatchCard id="m-fair" title="Nike Dunk Low Grey Fog, men’s 10" photo="nike-dunks" site="ebay" verdict="fair" what="Delivered" amount="$76.50" />
        <MatchCard id="m-high" title="Nike Dunk Low Grey Fog, men’s 10" photo="nike-dunks" site="ebay" verdict="high" what="Delivered" amount="$119" />
        <MatchCard id="m-like" title="Kindle Paperwhite, 16 GB, signature edition" photo="kindle" site="mercari" verdict="high" likeness="likely_same_model" what="Delivered" amount="$96.50" />
        <MatchCard id="m-gone" title="Nike Dunk Low Grey Fog, men’s 10" photo="nike-dunks" site="depop" verdict="fair" what="Delivered" amount="$93" gone />
      </Section>
      <Section title="Site strip: in, waiting, none, behind, off; as toggles">
        <SiteStrip id="ss" slots={[{ site: 'ebay', state: 'in', note: '41' }, { site: 'mercari', state: 'waiting' }, { site: 'depop', state: 'in', note: '4m' }, { site: 'facebook', state: 'none' }, { site: 'poshmark', state: 'off' }]} />
        <SiteStrip id="ss2" slots={[{ site: 'ebay', state: 'in', note: '4m ago' }, { site: 'mercari', state: 'behind' }, { site: 'depop', state: 'in', note: 'Just now' }, { site: 'facebook', state: 'waiting' }, { site: 'poshmark', state: 'off' }]} />
        <SiteStrip id="ss3" onToggle={() => {}} slots={[{ site: 'ebay', state: 'in', note: '4m ago' }, { site: 'mercari', state: 'behind' }, { site: 'depop', state: 'in', note: 'Just now' }, { site: 'facebook', state: 'waiting' }, { site: 'poshmark', state: 'off' }]} />
      </Section>
      <Section title="Price range, with a price and without">
        <PriceRange low={65} high={95} at={76.5} words="The same one sold for" />
        <PriceRange low={65} high={95} at={119} words="The same one sold for" />
        <PriceRange low={65} high={95} />
      </Section>
      <Section title="Price chart">
        <PriceChart id="pc" points={[{ label: 'Jun', value: 98 }, { label: 'Jul', value: 94 }, { label: 'Aug', value: 90 }, { label: 'Sep', value: 86 }, { label: 'Oct', value: 82 }, { label: 'Nov', value: 79 }]} reference={{ label: 'New', value: 115 }} />
      </Section>
      <Section title="Gallery, three photos">
        <Gallery id="gal" photos={['nike-dunks', 'levis-501', 'kindle']} label="Nike Dunk Low" />
      </Section>
      <Section title="Offer sheet">
        <Line><Pill id="os-open" kind="second" label="Make an offer" onPress={() => setOffer(true)} /></Line>
        <OfferSheet id="os" open={offer} amounts={[60, 65, 68]} notes={{ 65: 'Your most' }} pick={65} onSend={() => setOffer(false)} onClose={() => setOffer(false)} />
      </Section>
      <WantByTouch />
    </>
  );
}

// A want set by touch (spec/features/watch.md): the range over the sales, the toggle and chips, the swatches, the sizes.
function WantByTouch() {
  const [range, setRange] = useState<[number, number]>([64, 80]);
  const [how, setHow] = useState('both');
  const [cond, setCond] = useState('good');
  const [colours, setColours] = useState<string[]>(['navy']);
  const [size, setSize] = useState<[string, string | null]>(['mens', '10']);
  const sold = [68, 70, 71, 72, 74, 75, 75, 76, 77, 78, 78, 79, 80, 80, 81, 82, 83, 84, 86, 88, 90, 92];
  return (
    <>
      <Section title="Range slider: with sales, without">
        <RangeSlider id="rs" label="Price, delivered" min={35} max={125} low={range[0]} high={range[1]} dots={sold} caption={`Each dot is a sale of the same one: ${sold.length} sold`} onChange={(a, b) => setRange([a, b])} />
        <RangeSlider id="rs-none" label="Price, delivered" min={25} max={95} low={48} high={72} caption="Not enough sales yet to show" onChange={() => {}} />
      </Section>
      <Section title="Chips: a three-way toggle, a wrapping row">
        <ChoiceChips id="chips-how" label="How it gets to you" value={how} onChange={setHow} options={[{ id: 'ship', label: 'Ship' }, { id: 'pickup', label: 'Pickup' }, { id: 'both', label: 'Both' }]} />
        <ChoiceChips id="chips-cond" label="Condition, at least" value={cond} onChange={setCond} options={[{ id: 'new', label: 'New with tags' }, { id: 'like-new', label: 'Like new' }, { id: 'good', label: 'Good' }, { id: 'fair', label: 'Fair' }]} />
      </Section>
      <Section title="Colour swatches: any, one picked">
        <ColourSwatches id="cs" value={colours} onChange={c => setColours(c === 'any' ? [] : colours.includes(c) ? colours.filter(k => k !== c) : [...colours, c])}
          swatches={colourData.jersey} />
      </Section>
      <Section title="Size picker: two systems, one">
        <SizePicker id="sp" system={size[0]} value={size[1]} onChange={(a, b) => setSize([a, b])}
          systems={[{ id: 'mens', label: 'Men’s US', sizes: ['8', '8.5', '9', '9.5', '10', '10.5', '11', '12'] }, { id: 'womens', label: 'Women’s US', sizes: ['6', '7', '8', '9', '10'] }]} />
        <SizePicker id="sp-one" system="letter" value={null} onChange={() => {}} systems={[{ id: 'letter', label: 'Letter', sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] }]} />
      </Section>
    </>
  );
}
