# app/src/ui: the parts every screen is built from

A screen file never imports `View`, `Text` or `StyleSheet`. It composes these parts, and `node .agents/check.mjs` fails it otherwise. Ben asked for this in [round 7](../../../product/words.md#2026-11-15-round-7-picks): "a deterministic set of components" in place of "a huge md file". The set is an *agent proposal* until he has seen a screen built from it.

| Part | Use it for | Example |
|---|---|---|
| `Screen` | The whole view: safe area, side gutter, one scroll | Every route |
| `Section` | One topic, with an optional title | "Needs you" on Today |
| `Stack` | A few things that belong together | A title over its price |
| `Row` | Photo or icon, then words, then an amount or action | A message, a sale, a setting |
| `List` | Rows of the same kind | The message list |
| `Card` | Something that asks the person to decide | An offer with Accept and Counter |
| `Grid` | Photo tiles | The Sell grid |
| `Txt` | Every word | Roles: caption, body, headline, heading, amount |

## Which separator means what

Ask what the two things are to each other, and take the first row that fits.

| They are | Separate them with | In code |
|---|---|---|
| Parts of one thing (a title and its price) | 8 | `<Stack gap="tight">` |
| Things in one group (two cards in a section) | 12 | `<Stack>` or inside `Section` |
| Rows of the same kind in a list | A hairline | `<List>` |
| Different topics | 32, and no line | Two `Section`s in a `Screen` |
| A question for the person | A border around it | `<Card>` |

When none fits, use more space before reaching for a line or a box: things that sit close read as belonging together, and a line adds something to look at.

## Adding a part

Add one here when two screens need the same thing, with the reason in a comment above it. Values come from `tokens.generated.ts`, which `node scripts/tokens-to-ts.mjs` writes from [brand/tokens.css](../../../brand/tokens.css).
