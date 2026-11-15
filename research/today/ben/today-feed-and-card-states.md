# What does the top of Today do, how is the feed ordered, and what state can each card be in?
Researched 2026-11-15 by Ben (Claude Code, thread "Roll the UI system out everywhere"). Feature: today.

Ben, [03:17](../../../product/words.md#2026-11-15-new-takes-the-screen-a-live-point-cloud-stage-bubbles-and-the-found-pop-up-item-details-per-site-the-person-takes-the-photo-a-male-voice): "what should the top of the today really need to do. think if the today should be segmented or like a listed feed by risk. like labelled or something". [03:22](../../../product/words.md#2026-11-15-faded-stacks-with-depth-connect-every-site-the-tab-you-are-on-the-wash-as-an-accent-above-the-first-card): stacks that fade with depth, connect states, the tab you are on, "You" in the wordmark face, readable layered color, "the new dynamic ui that the x posts refer to as well as otherwise using decision models and templates. i know there are states like print labels ... ensure you know with all these you will have to make them work well in a way that pleases our personas and the business and our goals." Ben picked "News since you last looked" for the top (03:17, decision card). Render: [today-v7-feed-connect-you.png](today-v7-feed-connect-you.png).

Marks: *observed* (read at the source), *asserted* (claimed without method, or from memory), *inferred* (our reasoning).

## 1. What the top must do

Today answers two questions in the first second: is it working, and do I need to do anything (*inferred* from the personas in [today-wants-alerts-and-clickability.md §1](today-wants-alerts-and-clickability.md#1-who-opens-the-app-next-to-what-they-already-use)). The first card answers the second question, so the top only answers the first: money kept since you last looked, when there is some, which is what Ben picked. A chart does not belong here. It needs many sales to show a shape, the person clearing out has a handful, and a chart asks to be read rather than glanced at. It lives on You ([top-of-today-and-stacking.md §1](top-of-today-and-stacking.md#1-the-good-news)).

## 2. One feed, ordered by what ignoring it costs

**Common answer:** sections by type ("Offers", "To ship", "Messages"). Dropped: it sorts by what the app knows rather than by what the person loses, and a section of one card is a header for one card (*inferred*).

**Recommend:** one feed, ordered by risk, meaning what ignoring the card costs, in three tiers. Airbnb's host Today orders by urgency the same way: time-sensitive alerts first, then upcoming, then next steps, then tips (*observed*, [structure-references.md](structure-references.md)).

| Tier | What ignoring it costs | Order inside | Label, shown only where two tiers meet |
|---|---|---|---|
| Now | Money or a promise, within a day: an offer that expires, a label due, a pickup, a dispute, a site that disconnected | Soonest deadline | "Now" |
| When you can | Something over days: a first post, a markdown, a reply, a photo to approve | Money at stake, then age | "When you can" |
| Good to know | Nothing: value moved, demand rose, a review to leave | Newest | "Good to know" |

Each card already names its kind with a tag and carries its own countdown, so the tier label is the only extra word, and it appears only when the feed holds more than one tier (*inferred*). The spec's order (deadline, then money, then age) is this table without the labels ([spec/features/today.md](../../../spec/features/today.md)).

## 3. Every card kind, its form, and its states

The spec lists 40 decision kinds ([today.md, The cards](../../../spec/features/today.md#the-cards)). Each takes one form when several of the same kind are open (*agent proposal*):

| Form | When | Kinds |
|---|---|---|
| Single, always | Each one carries its own deadline or risk | `accept_offer` (one per item, every offer listed), `price_below_floor`, `pickup_outside_hours`, `share_address`, `scam_warning`, `move_off_site`, `double_sale`, `no_show`, `cancel_sale`, `refund`, `return_claim`, `claim_reply`, `dispute`, `failed_delist`, `relink`, `site_warning`, `offer_over_ceiling`, `seller_counter`, `complete_purchase`, `buy_offer` |
| Batch: one tap does all | The same action fits every one | `buy_label` and `ship_by` ("Print 3 labels"; the spec already has "Buy all due today"), `leave_review`, `markdown`, `relist`, `save_match`, `bulk_action` |
| Queue, drawn as a stack | Each needs its own look, none is due within a day | `first_post`, `studio_approve`, `measure_review`, `confirm_flaw`, `retake`, `missing_shot`, `clarify`, `identity_claim`, `agent_revision`, `approve_groups`, `category_unsure` |
| Single, low | Rare, no deadline | `failed_post`, `site_changed_listing`, `end_unsold`, `reply_other`, `unbacked_claim`, `merge_items`, `did_you_buy`, `replace_after_sale`, `rule_expiring` |

Every card moves through the same states, so a person learns them once: **open** (tag, countdown, actions), **working** (the pressed button shows the step, from `job.stage`), **done** (the card leaves; Undo in a toast and the log), **failed** (the card stays with what failed and Retry). A batch shows progress as a count ("2 of 3 labels") and fails per item, never all at once. A queue opens full screen, one item at a time, and the stack under it shrinks as items are done.

The stack's look (Ben, 03:22): the cards under it fade (75%, then 40%), scale down (97%, 93%) and sit 12 apart with a soft shadow, so it reads as depth, not as more cards to read.

## 4. Templates, decision models and the dynamic parts

- **Templates.** Each kind has fixed words with slots; the model fills only names and quotes, and every number is a guarded number with its citation ([spec](../../../spec/features/today.md#design-choices)). A person learns the template, and copy-lint can check it.
- **Decision models.** Which action is suggested, and when a kind may move to automatic after three unedited approvals, come from the decision system ([decisions](../../../product/decisions.md#2026-11-14-automation-runs-in-tiers-that-learn)). Price, an address and a pickup always need the person's tap; a human stays in the loop, which is part of the pitch (Ben, 03:17).
- **The dynamic parts** (Garlic's X-post research, [assist.md](../../../spec/features/assist.md)): when a card needs more than a tap, the model assembles the input from a fixed catalog of parts. A counter amount is a picker of three amounts ending in "Something else". A reply draft marks the words the model guessed with a dotted underline, solid once the person changes them (Feedforward). A field nobody knows yet is a blank with a solid underline (Leaving Blanks), as the camera's "Size" chip is. The model chooses which parts and fills them; it never draws new ones.
- **Voice.** Each template has a spoken line, generated once per template; names and amounts are spoken at run time by a fast model (ElevenLabs v4 turbo, Microsoft MAI Voice 2.1 Flash; *observed* on OpenRouter's text-to-speech collection, prices per million characters $40 and $15).

## 5. "You" in the wordmark face?

**No** (*inferred*). The wordmark is the one place the display face appears; setting tab titles in it makes every tab read as a logo, and the mark stops being special. iOS titles every tab in the text face (*asserted*), and Ben's own record favors what feels familiar ([taste-evidence.md](../../cross-cutting/ben/taste-evidence.md), reading 6). The want under his note is that "You" looked weak. The render gives it presence by size and weight: 21, Medium, centered.

## 6. The tab you are on

The current tab was marked only by darker ink, which Ben called "super faint". The render marks it the way Material 3's navigation bar does, with a pill behind the icon (*asserted*). Brand ledger L29, which Ben picked in round 10, says the current tab is the filled icon with nothing under it, and Art. 6.9 keeps a label's weight the same in every state, so the label stays Book and the pill waits on Ben's pick.

## 7. Is a layered color readable?

Measure the rendered pixels, not the tokens. For every text element, hide the text, sample the composite background under its box (a field gradient, the wash, a photo), and take the worst point; it must reach 4.5:1, or 3:1 at 24 px and up (WCAG 2.2). The brand check composites a flat fill with transparency over its ground today (`B6` in `.agents/checks/render.mjs`, *observed*); gradients and photos need the sampled version. Text on a photo always sits on a shade, as the camera does.

## Limits

- No person has used any of this.
- The tier of each kind is a first sort; Nate's determinations may move some.
- The voice models were read from OpenRouter's pages; none was listened to.
