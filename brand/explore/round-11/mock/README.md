# Round 11 mocks, in code

The round 10 screens, rebuilt from Ben's [round 10 picks and notes](../../../../product/words.md#2026-11-15-round-10-picks) and his [questions on black, the outline and the gray box](../../../../product/words.md#2026-11-15-a-constitution-with-little-wiggle-room-the-heavy-black-the-black-outline-and-the-gray-box). Round 10 stays as he saw it in [../../round-10/mock/](../../round-10/mock/README.md).

Open [index.html](index.html) in a browser. It shows four screens at 390 wide: Today, Sell, an item and a sale. The switches at the top turn each open choice on and off, so any mix can be compared.

| In the address | Shows |
|---|---|
| `?only=today` | One screen with nothing around it, for a screenshot |
| `?o=now` | Round 10's choices: gray boxes, a black pill on every decision, an outline second button |
| `?sep=tint`, `white`, `gray`, `rows` | What separates a card from the page (R29). With no `sep` it is `white` |
| `?o=fill,one,more` | Choices by name. With no `o`, fill and one are on |
| `?wm=left` | The wordmark left with the inbox right, which Ben turned down in round 11. With no `wm` it is centered (L3) |
| `?states=old` | Failed and ended as round 10 drew them |
| `?sel=live`, `?from=4` | On Sell: which state chip is chosen, and which item the grid starts at |
| `?touches=hand,tags` | The two touches Ben has not ruled on |

What changed from round 10:

| Change | Why | Ledger |
|---|---|---|
| Cards, photos, tags, buttons and the nav take the sizes Ben approved on the Today render | Ben: "the spacing i like", "ensure that there are primitives of it all" | L46 |
| Today is the screen Ben approved: the wash, the week's money, cards by kind, a notice that leads somewhere | Ben: "love 95% of this" | L44, L46 |
| The selected tab keeps its weight | Ben tapped it | L29 |
| The sum is a receipt, on white paper | Ben: "i like the B. the receipt thing". The eBay logo blended into gray paper | L41 |
| No "laid on a table" | Ben tapped Drop | |
| Live is sky, sold is mint, paid is lime. Anything about shipping is mint with the parcel, because Ben is color blind and no fifth color survives | Ben: "green not brown" | L39, L45, A10 |
| Failed is a brick fill; ended is dark gray with white text on a photo without its color | Ben: they "kinda blend in a bit" | R30 |
| A tag is 20 with a 12 icon, 4 from three edges | Ben: the tag's padding "doesn't feel balanced" | A9, L46 |
| Labels are trimmed to their ink, so they sit in the true middle | Ben: "they seem not centered" | A8 |
| Sell: state chips are tags at chip size; Store and Type open lists | Ben's note on the selections at the top | R32 |
| A card is white on a tinted page, with the card's shadow | Ben: the gray box "doesn't feel as separate" | R29 |
| The second button is a light fill | Ben: nothing else has a black outline | R33 |
| One black pill per view, on the field | Ben: the heavy black | R34 |
| The item page shows what you keep and opens the receipt on a tap; listing actions are rows at the foot | Ben: show only what the common person needs; consider footers | R31 |

The brand checker (`node scripts/brand-check.mjs brand/explore/round-11/mock/check.html --medium app`) still reports what it has not been taught about the approved screen: the wordmark on the left, the wash, gray text on the field and the tinted page. Those are with the thread that owns the checker.

| File | Holds |
|---|---|
| [screens.css](screens.css) | Every style. Values are tokens from [brand/tokens.css](../../../tokens.css). The block at the top lists each value Ben has not locked, one line each |
| [screens.js](screens.js) | The four screens as functions of the open choices |
| [icons.js](icons.js) | The Hugeicons these screens use (MIT), made by a script from the package |
| `fonts.local.css` | Not in git. Three `@font-face` rules that name the PP Neue Montreal and Clofie files on your machine, under the families `PP Neue Montreal` (400, 500) and `Clofie` (600). Without it the type falls back |

The items are the generated demo photos in [assets/demo-items/](../../../../assets/demo-items/). The amounts are made up for the mock.
