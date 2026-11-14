# UI principles: familiar, show don't say

Decided by Ben on 2026-11-14 at 19:45 ([words](words.md#2026-11-14-show-not-say), [decision](decisions.md)). Familiar patterns and attention added by Ben at 19:46 ([words](words.md#2026-11-14-familiar-and-attention)). Applies to every screen, card, notification and generated mock, by any agent.

## The three sources

1. **Show rather than say.** If the screen can show it, the screen does not say it.
2. **Ben's anti-claudish skill**, which is the `writing` skill in his harness (built from the declauding skill). Every UI string goes through it before a screen counts as done. See [The anti-claudish skill](#the-anti-claudish-skill) below.
3. **Familiar first, attention on purpose.** Say as much as possible through patterns people already use in the apps they know, and spend color, size and position only where the user's attention should go. See [Familiar patterns and attention](#familiar-patterns-and-attention).

## Rules for secondhand (*agent proposal*, derived from the two sources and the decided screens)

| Instead of saying | Show |
|---|---|
| "Your item is now live on eBay and Depop" | The photo tile with a green Live pill and the eBay and Depop logos |
| "We're researching your item, this may take a minute" | The draft filling in field by field, with a thin progress line |
| "This price was estimated from 14 similar sold items" | `$42` with a small source label `14 sold` and the eBay logo |
| "You'll keep $36.40 after fees" | `KEEP $36.40` under the price |
| "This listing failed to delist. Tap to retry" | A red ✕ on the badge and one button: `Retry` |
| "Great news! Your item sold!" | The tile moves to Sold, with the amount you keep |
| "Would you like us to answer this automatically?" | The drafted reply with `Send` and `Always` |
| An empty state paragraph | One line and the action that fills it: "Nothing listed" + `＋` |
| A tooltip explaining a field | The field marked *measured*, *estimated* or *you said* |

Limits:
- **Buttons:** one or two words, a verb. `Post`, `Counter $38`, `Retry`.
- **Labels:** nouns, no sentences. `Live`, `Ship by Tue`, `3 offers`.
- **Body text:** at most one short sentence per card, and only when a picture or number can't carry it (a scam warning, an address the agent won't share without you).
- **No** exclamation marks, "Great!", "Oops", "We've…", "Let's…", "Just…", emojis in UI, or narration of what the AI is doing.
- **Platforms are logos, not words.** "Live on Depop" is a Live pill plus the Depop logo. Ben, [19:59](words.md#2026-11-14-platform-logos-no-mono).
- **Numbers carry their source** in a small label, never in a sentence (see the brand [coder card](../brand/coder-card.md) rule 7).
- **Safety copy is the exception.** Never-alone actions (address, pickup time, payment) keep one plain sentence saying what will happen.

## The anti-claudish skill

Ben's "anti-claudish" skill is the `writing` skill in his harness (`~/.local/share/harness/skills/writing/`, built from oaustegard's declauding skill, MIT). The harness has no git remote, so Nate's agent can't read it; the rules for app copy (its `references/app-copy.md`, surface `product`) are summarized here. Run `node scripts/copy-lint.mjs <files>`, a port of its product rules. On Ben's Mac the original is `python3 scripts/lint.py --surface product`. His Stop hook (`reply_check.py`) checks agents' replies to him, not screen text.

**The test for every line:** could the user act on it or decide with it, and would a person say it this way across a table? If not, cut it. Ben's reason, which outranks the rules: "what i really dont want is having to waste my brain power and attention". Cut words, not information: a price without its source or a warning without its reason costs more attention, not less.

**Never invent a number, customer, quote or claim.** A number with no source is a defect. Leave a marked empty slot instead.

| # | Tell | Fix |
|---|---|---|
| C1 | Stock outcome verbs: "Unlock", "Streamline" | Who it's for, what it does, with real nouns |
| C2 | Empty adjectives: powerful, seamless, intuitive, AI-powered | Something the user can check |
| C3 | Proof nobody supplied: "Trusted by 10,000 sellers" | Delete, or get the real figure and source |
| C4 | "Oops! Something went wrong" | What failed and the next step: "Delist failed on Depop. Retry" |
| C5 | Emoji or sparkles on headings, buttons, list items | Remove |
| C6 | "Get started", "Learn more", "Submit" | Verb and object: `Post to 3 sites`, `Counter $38` |
| C7 | Chatter: greetings, taglines, status chatter, explaining the app | Delete it and show the user's real items. Ben banned "Welcome back, Ben", "Good morning", "Here's what's on your plate", "All 5 classes connected". "Labels of 1–3 words. No paragraphs." A feeling is carried by the design, never stated |
| C8 | "It's not just X, it's Y", "Whether you're a buyer or a seller" | State Y. Name the one audience |
| C9 | "Your trusted partner", "Tailored to you" | How it works, or cut |
| C10 | "Success! Saved successfully", "Working our magic…" | `Saved`. For loading, say what is loading: "Pricing on eBay" |
| C11 | "Nothing here yet! Start your journey" | Why it's empty and the one action: "Nothing listed" + `＋` |
| C12 | Hard-coded year, lorem ipsum, placeholder logos | Compute it, or mark the slot empty |
| Always | Em dashes | "never use any em dashes in the ui ever." |

One hit is punctuation; a cluster is a tell. Fix clusters first. Visual tells (purple gradients, sparkles, icon-topped cards) are handled by the brand [anti-pillars](../brand/anti-pillars.md), not here.

## Familiar patterns and attention

Principles expert designers use, each turned into a rule for this app. *Agent proposal*; the principles are *asserted* from standard UX literature (Nielsen Norman Group, Apple HIG, Material, Laws of UX), not re-checked this session.

**Borrow what people already know (Jakob's law: users spend most of their time in other apps).**
- Bottom tab bar, segmented controls, swipe actions and share sheets behave exactly as in iOS. No custom gestures without a visible fallback.
- Each surface copies one app people already use for that job: Sell grid ← Depop / Instagram profile grid; Today ← Airbnb host Today and an email inbox; a message thread ← iMessage; an offer ← eBay's Accept / Counter / Decline; Buy search ← Amazon's search box and result rows; the camera ← the iOS camera with a shot strip.
- Use the meaning icons and colors already have: green for live or paid, red for failed, amber for needs you, grey for ended. A red badge with a count means "needs you" and nothing else.

**Spend attention deliberately (pre-attentive attributes: color, size, position and motion are seen before anything is read).**
- One focal point per screen: the item photo or the one number that matters. Everything else steps down in size or to 65% black.
- Color is a signal, not decoration. Accent color appears only on state pills, the primary action and alerts. If everything is colored, nothing is.
- One primary button per screen or card (black, full width or rightmost). Secondary actions are quieter. Destructive actions are never primary.
- The thing that differs gets noticed (isolation effect), so reserve it: a Failed tile is the only red one in a grid of calm tiles.
- Motion only to show cause and effect: a tile sliding from Live to Sold, a draft filling in. Never as decoration.

**Make choices cheap.**
- Fewer options decide faster (Hick's law), but choice overload is conditional ([psychology §3](../research/cross-cutting/ben/psychology.md)). Curate the first view: a card shows up to three actions, and more go behind "More".
- Recognition over recall: show the photo, price and site badges on every row instead of asking the user to remember which item "Lamp 2" was.
- Progressive disclosure: the price is visible; the comps behind it are one tap away. Advanced settings live in You.
- Smart defaults the user can see and change (default effect): pickup windows, floor price and markdown are pre-filled with the reason in a small label.
- Big targets where thumbs are (Fitts's law): primary actions at the bottom of the screen, 44 px minimum, 48 px for main buttons.

**Group so the eye reads structure, not text (Gestalt proximity and similarity).**
- Things that belong together sit together with tight spacing; groups are separated by space, not lines or boxes.
- The same kind of thing looks the same everywhere: an item is always a photo tile, a decision is always a card with buttons, a platform is always its logo.
- Scanning follows the layout: the photo leads on the left, then title, then price on the right edge, like every marketplace row.

**Use psychology honestly.**
- Show progress toward done (goal gradient, light use per [psychology §9](../research/cross-cutting/ben/psychology.md)): "2 of 7 shots", Today counting down to empty.
- End on the outcome (peak-end): a sale ends on the amount you keep, not on a form.
- Losses feel bigger than gains, so show what you keep after fees and what an underpriced item leaves on the table, but never with fake urgency, fake scarcity or guilt. No dark patterns.
- Trust comes from showing the work: every number shows its source, every automatic action is labelled and undoable.

**Check:** squint at the screen (or blur it). The first thing you see should be the thing that matters most, and the second should be the next action.

## Check before a screen is done

- Cover the text: can you still tell the item's state and the next action? If not, the visuals are doing too little.
- Count sentences: more than one per card needs a reason.
- Run `node scripts/copy-lint.mjs` on every string.
- No em dashes anywhere in the UI.
- Squint test: focal point first, next action second.
- Name the familiar app each pattern borrows from. If there isn't one, the pattern needs a reason.

The full build, judge and audit standard, including motion, is [frontend-standard.md](frontend-standard.md).
