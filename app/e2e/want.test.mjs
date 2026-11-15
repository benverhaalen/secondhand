// The want page's behavior (app/behavior/want.json), on the web build: every state and every control in the table.
// Plus the drag a table can't hold: the price range moves by touch (Ben, words.md 2026-11-15: "i can adjust my range").
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { start, WAIT } from './behavior.mjs';
import { tableTests } from './table-tests.mjs';

tableTests(test, 'want', 'want');

let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

test('want: dragging the top of the range left lowers the most, and the foot follows, logged as a drag', async () => {
  const v = await app.open('/want?q=brewers%20jersey%20around%20%2460');
  await v.shows('Watch for $72 or less', { timeout: WAIT });
  const box = await v.page.getByTestId('want-price').boundingBox();
  // The track runs $25 to $95 across the part; the top thumb sits at $72.
  const at = usd => box.x + ((usd - 25) / 70) * box.width, y = box.y + box.height - 12;
  await v.page.mouse.move(at(72), y);
  await v.page.mouse.down();
  for (const usd of [70, 66, 62]) await v.page.mouse.move(at(usd), y, { steps: 4 });
  await v.page.mouse.up();
  await v.shows('Watch for $62 or less', { timeout: WAIT });
  await v.shows('$48 to $62');
  assert.ok((await v.events()).some(e => e.type === 'drag' && e.id === 'want-price'), 'a drag is logged as a drag');
});
