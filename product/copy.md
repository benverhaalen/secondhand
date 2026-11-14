# Copy: show, don't say

Decided by Ben on 2026-11-14 at 19:45 ([words](words.md#2026-11-14-show-not-say), [decision](decisions.md)). Applies to every screen, card, notification and generated mock, by any agent.

## The two sources

1. **Show rather than say.** If the screen can show it, the screen does not say it.
2. **Ben's anti-claudish skill**, from his harness. Every UI string goes through it before a screen counts as done. See [The anti-claudish skill](#the-anti-claudish-skill) below.

## Rules for secondhand (*agent proposal*, derived from the two sources and the decided screens)

| Instead of saying | Show |
|---|---|
| "Your item is now live on eBay and Depop" | The photo tile with a green Live pill and two site badges |
| "We're researching your item, this may take a minute" | The draft filling in field by field, with a thin progress line |
| "This price was estimated from 14 similar sold items" | `$42` with a mono label `14 SOLD · EBAY` |
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
- **Numbers carry their source** in a mono label, never in a sentence (see the brand [coder card](../brand/coder-card.md) rule 7).
- **Safety copy is the exception.** Never-alone actions (address, pickup time, payment) keep one plain sentence saying what will happen.

## The anti-claudish skill

Lives in Ben's harness on his Mac, not in this repo. Summary pending from the Mac lookup.

## Check before a screen is done

- Cover the text: can you still tell the item's state and the next action? If not, the visuals are doing too little.
- Count sentences: more than one per card needs a reason.
- Run the anti-claudish pass on every string.
