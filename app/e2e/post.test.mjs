// The live five-site post (Ben, 08:12: "a live demo of posting one draft to 5 places at once ... toggle on off the
// beautification (both the non ai and the ai one) and showing that live before going into a posting"), on the stage world.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start } from './behavior.mjs';

const STAGE = '/item/it_stage/post?world=stage&flip=poshmark,mercari,facebook';
let app;
before(async () => { app = await start(); });
after(async () => { await app?.stop(); });

// A switch is pressed by a click on its button, so the test does not wait on the sheet's entrance animation.
const flip = (s, id) => s.page.getByTestId(id).tap({ force: true });
const covers = s => s.page.locator('[data-part="listing-preview"] [data-part="photo-card"] img').evaluateAll(els => els.map(e => e.getAttribute('src')));

test('post: one draft goes to all five sites with one tap that says so', async () => {
  const s = await app.open(STAGE);
  await s.shows(/on 5 sites/);
  assert.equal(await s.page.locator('[data-part="listing-preview"]').count(), 5);
  await s.page.close();
});

test('post: Clean up and Enhance with AI change every site’s cover live', async () => {
  const s = await app.open(STAGE);
  await s.shows('Enhance with AI');
  const ai = await covers(s);
  assert.equal(new Set(ai).size, 1, 'every site shows the same cover');
  await flip(s, 'look-ai');
  const clean = await covers(s);
  assert.notEqual(clean[0], ai[0], 'turning the AI off shows the cleaned-up photo');
  await flip(s, 'look-clean');
  const original = await covers(s);
  assert.notEqual(original[0], clean[0], 'turning Clean up off shows the photo as shot');
  await s.page.close();
});
