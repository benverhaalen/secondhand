# app/src/ui: the parts every screen is built from

A screen imports from `@/ui` and composes these parts. It never imports `View`, `Text`, `Pressable` or `StyleSheet` from react-native, never writes a size, a color or a font, and never asks whether it is light or dark: `node .agents/check.mjs` fails it otherwise. Ben asked for this in [round 7](../../../product/words.md#2026-11-15-round-7-picks): "a deterministic set of components". Each part has one size from [constitution Art. 7.8](../../../brand/constitution.md), whatever is inside it, every state drawn, and a `data-part` the render check measures. Variants are a short union of names; there are no style or number props.

See every part in every state at **`/dev/parts`** (light) and **`/dev/parts?scheme=dark`**. Renders: [features/app/renders](../../../features/app/renders/). A part is vetted there before a screen uses it.

## Layout

| Part | Props | Use it for |
|---|---|---|
| `Screen` | `nav?`, `wash?`, `name?`, `state?`, `foot?`, `center?` | Every route. Safe area, the 20 gutter, one scroll. `nav` sits 8 above the content. `wash` draws the header gradient (main screens with news on top). `name` and `state` set `data-screen` and `data-state` for tests and the gallery: always set them. `foot` pins the page's one act |
| `Section` | `title?` | One topic; cards in it sit 16 apart; sections sit 32 apart |
| `Stack` | `gap?: 'tight' \| 'group' \| 'cards'` | A few things that belong together (8, 12, 16) |
| `Line` | `gap?: 'tight' \| 'group'` | Small things side by side that wrap: tags, two buttons outside a card |
| `Row` | `lead?`, `trail?` | Photo or icon, words, then an amount or action |
| `List` | | Rows of one kind, with hairlines |
| `Card` | | A question that is not one of the fixed cards (prefer `DecisionCard`) |
| `Grid` | `columns` | Photo tiles, 16 apart |

## Atoms

| Part | Props | Notes |
|---|---|---|
| `Txt` | `role?: 'caption' \| 'body' \| 'headline' \| 'title' \| 'heading' \| 'amount'`, `tone?: 'ink' \| 'ink-2' \| 'on-ink' \| 'on-color'`, `lines?`, `tabular?`, `label?` | 13, 15, 18, 21 Clofie, 36 Clofie, 50. One weight, 500. `heading` is the screen title, one per view. `tabular` only for an amount that changes in place or sits in a column. On a field the ink follows by itself |
| `Icon` | `name: IconName`, `size?: 12 \| 20 \| 24`, `tone?`, `filled?`, `label?` | Hugeicons Stroke Rounded. A name not in `icons.generated.ts` does not compile: add it in `scripts/icons-to-ts.mjs` |
| `Photo` | `src?: PhotoSrc`, `label`, `fit?: 'card' \| 'row' \| 'fill'`, `faded?` | 72 in a card, 40 as a `ListRow`'s lead (round, as a site's logo is there), or square at column width. Corner 20, inner edge, dark veil. `src` is a demo name (`'nike-dunks'`, see `DEMO_PHOTOS`), a URL or a `require()` |
| `Press` | `id`, `label?`, `onPress?`, `disabled?`, `selected?`, `hit?`, `children` (node or `({pressed}) => node`) | Every pressable thing. Scale .97 spring, 44 hit area (`slop(w, h, gap)`), focus ring, and it logs `{ type: 'tap', id }` to the app log and `globalThis.__events` on web. Parts use it; a screen rarely needs it |
| `Surface` | `kind: 'card' \| 'gray' \| 'field' \| 'sheet'` | For parts only |
| `Theme` | `scheme: 'light' \| 'dark'` | The parts sheet and state gradients only. Screens follow the system |

## Parts

| Part | Size | Props |
|---|---|---|
| `DecisionCard` | 350 x 156, r36 | `id`, `kind: 'need' \| 'ship' \| 'live' \| 'paid' \| 'sold' \| 'stuck'`, `word` ("Offer"), `title`, `photo?`, `site?`, `fact: { label, amount? }`, `due?` (ms), `primary: Action`, `second?: Action`, `more?: Action`, `status?: 'open' \| 'working' \| 'done' \| 'failed'`, `step?` (working: "Printing", "2 of 3"; failed: what failed), `form?: 'single' \| 'batch' \| 'queue'`, `waiting?` (queue depth), `lead?`, `onOpen?`. `Action = { id, label, onPress? }`. Set `lead` on the one card nearest its deadline to emphasize its primary action. Cards share the same plain surface. `done` renders nothing: show `UndoToast`. `failed` turns the act into Retry |
| `ItemCard` | 350 x 104, r36 | `id`, `title`, `photo?`, `site?`, `state: TagState`, `word?`, `fact`, `due?`, `onPress?` |
| `Notice` | 350 x 56, r28 | `id`, `icon`, `text`, `tone?: 'plain' \| 'need'`, `onPress?`. Always leads somewhere: the chevron says so |
| `Tag` | 20 tall | `state: TagState`, `word?`, `place?: 'inline' \| 'photo'`. `TagState`: need, live, hot, stuck, sold, ship, paid, failed, draft, ended, working. Fill, icon and word from `states.ts` (`TAGS`). White on a field |
| `Count` | 20 + a 2 ring | `n`. Nothing at 0; 99+ |
| `SiteBadge` | 24 | `site: 'ebay' \| 'depop' \| 'poshmark' \| 'mercari' \| 'facebook'`. The site's own square logo; the name is its label. Never write a site's name as words |
| `Pill` | 40 tall, 20 a side, at least 88 | `id`, `label`, `kind?: 'primary' \| 'second'`, `icon?`, `state?: 'idle' \| 'working' \| 'disabled'`, `step?`, `onPress?`. One black pill per view (L50) |
| `IconButton` | 40 circle | `id`, `icon`, `label`, `look?: 'fill' \| 'plain'`, `onPress?`, `children?` (a Count) |
| `FootButton` | 350 x 48 | `id`, `label`, `kind?`, `icon?`, `state?`, `step?`, `onPress?`. One per screen |
| `Amount` | 50 + its line | `value`, `what` ("You keep, after fees"), `currency?` |
| `Guess` | text 18 or 15 | `id`, `name`, `value`, `onChange?`, `changed?`, `look?: 'headline' \| 'body'`, `numeric?`. What the agent guessed: dotted underline until the person changes it, then solid. Tap edits in place |
| `Blank` | text 18 or 15 | `id`, `name`, `value?`, `onChange?`, `look?`, `numeric?`. A field nobody knows yet: the name of what is missing on a solid line |
| `GuessPick` (`@/ui/parts/pick`) | text 18 or 15 | `id`, `name`, `value` (a choice id), `choices: { id, label, does? }[]`, `onPick?`, `look?`, `changed?`, `lead?` (the word an amount needs: "For" $225, under the same line). A guess that is one of a few (an ending, which hours): reads like Guess, and a tap opens a sheet of the choices with what each does. `Choices` is that sheet's rows, for a screen that opens its own |
| `Approve` | 350 x 48 | `id`, `does` (exactly what it will do: "Post at $45 on 2 sites"), `status?: 'ready' \| 'working' \| 'done' \| 'failed'`, `step?`, `done?`, `failed?`, `onApprove?`, `onUndo?`. Price, an address and a pickup always wait for this tap |
| `Sheet` | full width, r20 top | `open`, `title?`, `onClose`, `children` |
| `UndoToast` | 350 x 48 | `id`, `text`, `onUndo`, `onGone?` (after 5 s). One at a time |
| `EmptyState` | | `title` (Clofie 21), `line?`, `action?: { id, label, onPress? }` |
| `Skeleton` | as the part it stands for | `of: 'card-decision' \| 'card-item' \| 'notice'` |
| `Nav` | 350 x 44 | Main: `inbox?: { count, onPress? }`, the wordmark centered. Pushed: `back` (a function) and `action?: { id, icon, label, onPress? }`; the page's title is its own `heading` below |
| `TopSlot` | | `news?: { since, kept, line, onPress? }` or `setup?: { id, step, line, onPress? }`. Nothing new: no slot. Never $0.00 |
| `TabBar` | 390 x 84 | `current: TabKey`, `badges?`, `onTab`. Already in `(tabs)/_layout.tsx`; a screen never draws it |
| `Wash` | 390 x 236 | Drawn by `Screen wash`; never by hand |
| `ThreadRow` | 350 x 96 | `id`, `who`, `photo`, `title`, `site`, `need?: { state, word }`, `did?` ("Sent for you"), `last`, `mine?`, `time`, `unread`, `onPress?`. One conversation in Messages; a `List` of them |
| `Message` | its words, at most 84% wide | `side: 'theirs' \| 'mine'`, `children`, `meta?` (a `Meta`), `id?`, `label?`, `onPress?` (a message the agent sent opens its Why?). Not a sized part: as tall as its words |
| `Meta` | a caption line | `text`, `icon?`, `info?`. Who and when under a bubble, or a note of what was done |
| `Draft` | full width | `id`, `who`, `spans: Span[]`, `facts?: { text, from }[]`, `status?: 'ready' \| 'editing' \| 'sending' \| 'sent' \| 'failed'`, `lead?`, `hold?`, `failed?`, `onSend?`, `onChange?`, `onMine?`. The agent's reply held for a tap: guessed words dotted, solid once changed (`remark` works out which), a chip per fact with its source. Send, Edit, Take over |
| `Composer` | full width, 40 tall and grows | `id`, `to`, `value`, `onChange`, `onSend`, `sending?`. The person's own message; Send waits for words |
| `TimeSpan` | full width x 40, the day and words above | `id`, `day`, `words` ("2 to 4 pm"), `value: { start, end }` in half hours, `onChange`, `from?`, `to?`, `note?`. A span on one day, dragged by its two knobs; snaps to half hours |
| `SiteLink` | content width x 40 | `id`, `site`, `onPress`. The way back to the site: its logo at 24 and "Open on the site", never the site's name in words (C5) |
| `SiteCopy` | a sheet | `id`, `open`, `site`, `shot?`, `saved?`, `onOpen`, `onClose`. The site's own screenshot of what we say it shows, with when it was saved, and `${id}-site` to open the site. With no screenshot yet, it says so |
| `Tile` (parts/tile) | a grid column | `id`, `title`, `photo`, `state?`, `word?`, `sites?`, `fact?: { label, amount? }`, `faded?`, `select?: 'off' \| 'on' \| 'picked'`, `price?`, `onPress`, `children?`. A thing in a photo grid (Sell, a room's plan): the tag on the photo's top left, site badges on its bottom right corner 4 apart. No `state`: nothing is news, no tag. `children` is the screen's own second line in place of `fact`, outside the tile's button |
| `Shelf` (parts/tile) | header 24 | `id`, `title`, `count`, `onAll?` (See all), `folded?`, `onFold?`, `children`. A section of a grid with its count; the header folds and opens it, the count showing either way |
| `FilterRow`, `Chip` (parts/chip) | 40 tall | `FilterRow` scrolls sideways past the gutter. `Chip`: `id`, `label?`, `count?`, `icon?`, `site?` (the logo alone), `picked?`, `onPress`. One row of filters |
| `Choice` (parts/chip) | 56 | `id`, `label`, `line?`, `icon?`, `picked?`, `leads?` (a chevron), `disabled?`, `onPress`. A row in a `List` that does one thing: a pick in a sheet, or a way out at a page's end |
| `Range` (parts/worth) | 50 + its line | `low`, `high`, `what`. A value as a range, one piece of text that breaks at a space |
| `KeepRow` (parts/worth) | 56 | `site`, `keep?`, `line`, `note?`. What the person keeps on one site; no `keep` when there are too few sales |
| `WeekChart` (parts/week-chart) | content width x 160 + three caption rows | `weeks: { label, amount, n, now? }[]`, `top` (a round axis top, dollars), `axis` (its title: "After fees"), `count: { name, one, many }`. A bar per week on a titled dollar axis, the day, the month and the count under each week |
| `MoneyBar` (parts/money-bar) | a 12 bar, then 56 rows | `parts: { id, label, detail?, value, low, high?, fill: 'lime' \| 'mint' \| 'sky', onPress }[]`. Shares of one amount on one scale; a range draws its unsure part in the quieter step of its hue; each part is a row with its swatch |
| `StateBar` (parts/state-bar) | a 12 bar, then 72 tiles two to a row | `parts: { id, word, count, fill, icon, note? }[]`, `onOpen(id)`. Counts by state on one bar, then a tile per state with its swatch, count, word and icon |
| `PulseRow`, `PulseKey` (parts/pulse-row) | a 72 photo row, then a row of counts | `PulseRow`: `id`, `title`, `photo`, `sites`, `price`, `line?`, `cells: { value, word, share, said, muted? }[]`, `onPress?`. Each count over a track with the usual as a tick in its middle. `PulseKey`: `text`, the same mark as a legend |
| `PriceTrack` (parts/price-track) | content width, a 12 tick row over a 24 thumb, then a caption | `id`, `label`, `min`, `max`, `value` (dollars), `ticks?` (sold prices), `caption`, `onChange`. One price dragged along what similar ones sold for (the Plan's posture slider); ticks at or under the price in ink. A tap logs a tap, a drag logs its value |
| `WhySheet` (parts/why) | a `Sheet` | `id`, `open`, `title`, `says`, `numbers` (rows), `basis?`, `onClose`, `children?`. Why? on a number: the reason in words first, `See the numbers` (`${id}-numbers`) under it, then the rows and where they come from; `Done` is `${id}-done`. Open it from an `IconButton` with `information-circle` |

### New and the camera (`parts/takeover.tsx`, `parts/camera.tsx`)
The camera draws on its bar (`useBar()`): ink black with page white on it in light, the dark page and its ink in dark, so nothing light covers the screen at night; a control on the bar is the bar's opposite, filled or at 12%. New grows in the brand field (`--field`, deep in dark) and its jobs are raised capsules on it; a job opens the camera out of its well on the bar.
Both draw on the camera's bar (`useBar()`): ink black with page white on it in light, so the ＋ visibly becomes the circle; the dark page and its ink in dark, so nothing light covers the screen at night. A control on the bar is the bar's opposite, filled or at 12%.

| Part | Size | Props |
|---|---|---|
| `TakeoverPlace` | the screen | `name`, `state`, `skip?`. New's root: `data-screen`, `data-state` and the states it does not draw |
| `CircleStage` | a circle from a point to the whole screen | `origin`, `start?` (56), `phase: 'opening' \| 'open' \| 'closing' \| 'closed'`, `ground?: 'bar' \| 'field'` (the camera's bar, or `--field` over the whole screen), `onSettled?`, `children?`. Grows out of what was touched in `newOpen`, shrinks back in `--t-select`. What is inside stays where it is on the screen |
| `PlusClose` | 56 circle where the ＋ is | `open`, `onPress`. Its ＋ turns 45° to × (`new-close`) |
| `ChoiceColumn` | content width, centered between the top and the × | `count`, children (choices, bottom up). `useChoices(count)` gives its place and each well's center |
| `ChoiceCapsule` | 350 x 88, a 56 icon well, a 40 pencil at its end | `id`, `label`, `icon`, `lead?` (the last used: filled), `index`, `shown`, `onPress?` (the camera), `onType?` (the same job from words or a link: `<id>-type`). Rises 30 ms after the one before |
| `Viewfinder` | the screen | `state`, `mode?`, `feed?` (the photo on the web), `live?` + `camera?` (the phone's camera), `blink?`, `top?`, `cloud?`, `bottom?`, `framed?`, `facts?`. `top` and `bottom` sit on solid bars; `framed` draws the capture frame between them, with `facts` in it under the square |
| `CaptureFrame` (`parts/camera-frame.tsx`) | the largest 3:4 upright between the bars | `top?`, `bottom?` (the bars' heights), `band?`, `sample?`. Outside dimmed, 20 corners of 2, the square ticked; `frameRect(area)` and `ASPECT` for the math (research/capture/ben/listing-photo-frame.md) |
| `CameraBar` | 44 row | `left?`, `right?`, children (the bubbles) |
| `CamButton` | 40 circle, the bar's opposite at 12% | `id`, `icon`, `label`, `onPress?` |
| `CamWord` | 32 tall word and arrow | `id`, `label`, `onPress?` (Skip) |
| `StageBubbles` | 22 each, 8 apart | `stages: { name, state: 'later' \| 'now' \| 'done' \| 'skipped' }[]`. Shape carries the state; done fills to a check in `stageDone` |
| `Instruction` | 18/24, the text face, lines centered | `text`. Crossfades when it changes |
| `FoundPop` | 44 tall, a 28 check | `text`, `to` (its bubble's center), `stay?`, `onLanded?`. Drops in 250 ms, holds 1.5 s (`HOLD`), flies 300 ms; a light haptic with it |
| `PointCloud` | the screen | `outline`, `features` (0 to 1 in the photo), `phase: 'outline' \| 'gather' \| 'gone'`, `spread` (ms). Points land in clusters where features were found |
| `Chips`, `FactChip`, `CamNote` | 32 tall surface bars, one line that slides sideways | `FactChip`: `id`, `name`, `value?`, `onChange?`: a check and the value, or a `Blank` with the name. `CamNote`: `icon`, `text` |
| `Modes` | 32 tall | `modes`, `current`, `onPick`. Sell, Worth, Find, the current one on the bar's opposite |
| `Shutter`, `ShutterRow`, `CameraAct`, `CameraFoot` | 76 | `Shutter`: `id`, `waiting?`, `onPress?`. `CameraAct` (`id`, `label`, `onPress?`) holds the one act in the shutter's place once done |
| `CameraOff` | the screen | `title`, `line`, `acts: { id, label, onPress? }[]`: the camera is off; the first act filled, the rest outlined |
| `FixChip` (`parts/camera-fix.tsx`) | 32 tall surface chip | `id`, `label`, `on`, `onPress`. Clean up and Enhance with AI, side by side: a plus when off, a check when on |
| `FeedSwatch` | | The camera's ground on the parts sheet only |

Helpers: `useBar()` (the bar's colors and tones), `cue(event)` (the log, and `globalThis.__events` on the web), `haptic.light()` and `haptic.success()` (expo-haptics; logged on the web), `useCameraLayout()`, `usePlus()`, `useChoices(count)`, `onScreen(spot, screen)`.

Helpers: `money(amount)`, `timeLeft(due, now)`, `useMinute()` (a clock that ticks once a minute), `log` and `tap` (the app log), `MOTIONS` (every motion and its reason).

## Which to reach for

| You need | Reach for |
|---|---|
| The person must decide something, with a button | `DecisionCard`; the one nearest its deadline gets `lead` |
| A thing to look at and open | `ItemCard`, or `Photo fit="fill"` tiles in a `Grid` |
| A line that opens a list or a page | `Notice` |
| A value the agent filled in | `Guess`; a value nobody knows: `Blank` |
| An outward or costly act (post, send an address, a price) | `Approve`, saying exactly what it does |
| The page's one act at the foot | `Screen foot={<FootButton/>}` |
| Something done that can be undone | `UndoToast` |
| A choice that needs more room | `Sheet` |

## Which separator means what

| They are | Separate them with | In code |
|---|---|---|
| Parts of one thing (a title and its price) | 8 | `<Stack gap="tight">` |
| Things in one group | 12 | `<Stack>` |
| Cards one under another | 16 | `<Section>` or `<Stack gap="cards">` |
| Rows of the same kind in a list | A hairline | `<List>` |
| Different topics | 32, and no line | Two `Section`s in a `Screen` |

## Adding a part

When no part fits: write it in its own file under `parts/`, with the reason above it, every state, a `data-part` name (`mark()` in `parts/mark.ts`), a fixed size from tokens, and a row on `/dev/parts`. Values come from `tokens.generated.ts`, which `node scripts/tokens-to-ts.mjs` writes from [brand/tokens.css](../../../brand/tokens.css). Fonts are licensed and not in git: copy them into `app/assets/fonts/`; without them the app falls back to the platform face.
