# Round 11 mocks, in code

The round 10 screens, rebuilt from Ben's [round 10 picks and notes](../../../../product/words.md#2026-11-15-round-10-picks) and his [questions on black, the outline and the gray box](../../../../product/words.md#2026-11-15-a-constitution-with-little-wiggle-room-the-heavy-black-the-black-outline-and-the-gray-box). Round 10 stays as he saw it in [../../round-10/mock/](../../round-10/mock/README.md).

Open [index.html](index.html) in a browser. It shows four screens at 390 wide: Today, Sell, an item and a sale. The switches at the top turn each open choice on and off, so any mix can be compared.

| In the address | Shows |
|---|---|
| `?only=today` | One screen with nothing around it, for a screenshot |
| `?o=now` | Round 10's choices: gray item boxes, a black pill on every decision, an outline second button |
| `?o=rows,fill,one,more` | Choices by name. With no `o`, rows, fill and one are on |
| `?ship=peach` | Shipping in peach in place of lilac |
| `?sel=live`, `?from=4` | On Sell: which state chip is chosen, and which item the grid starts at |
| `?touches=hand,tags` | The two touches Ben has not ruled on |

What changed from round 10:

| Change | Why | Ledger |
|---|---|---|
| The selected tab keeps its weight | Ben tapped it | L29 |
| The sum is a receipt, on white paper | Ben: "i like the B. the receipt thing". The eBay logo blended into gray paper | L41, R31 |
| No "laid on a table" | Ben tapped Drop | |
| Live is sky, sold is mint, paid is lime, shipping is lilac | Ben's note on colors | L39, R28 |
| Failed is a brick fill; ended is a darker gray on a washed photo | Ben: they "kinda blend in a bit" | R30 |
| A tag is 24 with a 16 icon, 4 from three edges | Ben: the tag's padding "doesn't feel balanced" | A9 |
| Labels are trimmed to their ink, so they sit in the true middle | Ben: "they seem not centered" | A8 |
| Sell: state chips are tags at chip size; Store and Type open lists | Ben's note on the selections at the top | R32 |
| Items in a feed are rows on white | Ben: the gray box "doesn't feel as separate" | R29 |
| The second button is a light fill | Ben: nothing else has a black outline | R33 |
| One black pill per view, on the field | Ben: the heavy black | R34 |
| The item page shows what you keep and opens the receipt on a tap; listing actions are rows at the foot | Ben: show only what the common person needs; consider footers | R31 |

| File | Holds |
|---|---|
| [screens.css](screens.css) | Every style. Values are tokens from [brand/tokens.css](../../../tokens.css). The block at the top lists each value Ben has not locked, one line each |
| [screens.js](screens.js) | The four screens as functions of the open choices |
| [icons.js](icons.js) | The Hugeicons these screens use (MIT), made by a script from the package |
| `fonts.local.css` | Not in git. Three `@font-face` rules that name the PP Neue Montreal and Clofie files on your machine, under the families `PP Neue Montreal` (400, 500) and `Clofie` (600). Without it the type falls back |

The items are the generated demo photos in [assets/demo-items/](../../../../assets/demo-items/). The amounts are made up for the mock.
