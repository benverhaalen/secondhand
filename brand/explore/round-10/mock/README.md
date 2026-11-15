# Round 10 mocks, in code

Ben, [round 9](../../../../product/words.md#2026-11-15-round-9-picks): "dont use image gen now start using code to mock but make sure the mocks are completely accurate to the decisions so far so i can fairly critique them".

Open [index.html](index.html) in a browser. It shows four screens at 390 wide: Today, Sell, an item and a sale. `?only=today` shows one screen with nothing around it, and `?touches=hand,tags,receipt,table` turns the proposed touches on.

| File | Holds |
|---|---|
| [screens.css](screens.css) | Every style. Values are tokens from [brand/tokens.css](../../../tokens.css). The block at the top lists each value Ben has not locked, one line each |
| [screens.js](screens.js) | The four screens and the list of touches |
| [icons.js](icons.js) | The Hugeicons these screens use (MIT), made by a script from the package |
| `fonts.local.css` | Not in git. Three `@font-face` rules that name the Neue Montreal and Clofie files on your machine. Without it the type falls back |

The items are the generated demo photos in [assets/demo-items/](../../../../assets/demo-items/). The amounts are made up for the mock.
