# Copy: show, don't say

Decided by Ben on 2026-11-14 at 19:45 ([words](words.md#2026-11-14-show-not-say), [decision](decisions.md)). Applies to every screen, card, notification and generated mock, by any agent.

## The two sources

1. **Show rather than say.** If the screen can show it, the screen does not say it.
2. **Ben's anti-claudish skill**, which is the `writing` skill in his harness (built from the declauding skill). Every UI string goes through it before a screen counts as done. See [The anti-claudish skill](#the-anti-claudish-skill) below.

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

Ben's "anti-claudish" skill is the `writing` skill in his harness (`~/.local/share/harness/skills/writing/`, built from oaustegard's declauding skill, MIT). The harness has no git remote, so Nate's agent can't read it; the rules for app copy (its `references/app-copy.md`, surface `product`) are summarized here. On Ben's Mac, run `python3 scripts/lint.py --surface product` on the strings.

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

## Check before a screen is done

- Cover the text: can you still tell the item's state and the next action? If not, the visuals are doing too little.
- Count sentences: more than one per card needs a reason.
- Run the anti-claudish pass (table above, or the lint on Ben's Mac) on every string.
- No em dashes anywhere in the UI.
