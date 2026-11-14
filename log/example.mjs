#!/usr/bin/env node
// One item's life as the app, the server and a studio job would log it: node log/example.mjs
// It writes logs/example-*.jsonl and is the working example of every event. spec/log.test.mjs runs it, so it cannot go stale.
import { fileURLToPath } from 'node:url';
import { createLog } from './index.js';

export async function runExample(sinkFor, build = '0.1.0+example') {
  // The app: what the person saw and tapped.
  const app = createLog({ src: 'app', build, sink: sinkFor('app'), seed: 7, platform: 'ios' });
  app.show('sell', { state: 'empty' });
  app.input('tabbar', 'plus');
  const native = app.child({}, 'app.capture'); // the Swift camera sends its events to JS, which logs them under its own src
  await native.call('native', 'CaptureKit.takePhoto', { role: 'front' }, async () => ({ photo: 'ph_1', sharpness: 0.91 }));
  app.input('capture', 'note', { text: 'Bought in 2019, pick up at 12 Oak Street' }); // typed words are masked
  let sent; // the app sends `from` as the x-secondhand-from header, so the server's line links back to this call
  const upload = await app.call('http', 'POST /api/items', { photos: ['ph_1'] }, async ({ from }) => { sent = from; return { item: 'it_1', job: 'jb_1' }; }, out => ({ status: 201, result: out }));

  // The server: every request is an input, and every Job and Decision changes state here.
  const server = createLog({ src: 'server', build, sink: sinkFor('server'), seed: 8 });
  const req = server.child({ req: 'q1', item: upload.item });
  req.event('request.start', { method: 'POST', route: '/api/items', from: sent });
  req.job('jb_1', 'relight', 'queued');
  req.event('request.end', { status: 201, ms: 12 });

  // A cloud job running an agent loop: render, check, repair.
  const job = createLog({ src: 'job.relight', build, sink: sinkFor('job'), seed: 9, from: `${server.session}#2` }).child({ item: 'it_1', job: 'jb_1', trace: 'tr_abc123' });
  job.job('jb_1', 'relight', 'running');
  const run = job.agent('studio.relight', { goal: 'a studio render that keeps the real logo and flaws' });
  job.stage('jb_1', 'rendering', { n: 1, of: 2 });
  run.step({ action: 'render', why: 'no candidate yet' });
  await run.call('model', 'seedream-5', { scene: 'studio', photos: ['ph_1'] }, async () => ({ image: 'rn_1', usd: 0.04 }),
    out => ({ model: 'seedream-5', cost_usd: out.usd, result: { image: out.image } }));
  job.stage('jb_1', 'checking');
  run.step({ action: 'gate', why: 'every render is compared with the real photo' });
  await run.call('tool', 'gate', { image: 'rn_1' }, async () => ({ pass: false, box: [10, 20, 80, 60], reason: 'logo drift' }));
  job.stage('jb_1', 'repairing', { detail: 'logo' });
  run.step({ action: 'repair', why: 'the gate flagged the logo' });
  try { await run.call('tool', 'repair', { image: 'rn_1' }, async () => { throw new Error('mask is empty'); }); }
  catch (e) { job.error('studio.repair', e); }
  run.step({ action: 'keep_real', why: 'repair failed once, so the real photo leads' });
  run.end({ ok: true, result: { kept: 'ph_1', renders: [] } });
  job.job('jb_1', 'relight', 'done', { ms: 31000 });
  job.end();

  // A Decision, the person's tap, then the item's life on two sites (the names come from spec/lifecycle.mjs).
  const item = server.child({ item: 'it_1' });
  item.ask('dc_1', 'firstPost', 'ask', { options: ['post', 'edit', 'skip'], why: 'first post of this item', trace: 'tr_abc123' });
  app.show('today', { state: 'card', decision: 'dc_1', item: 'it_1' });
  app.input('today', 'card.option', { decision: 'dc_1', value: 'post' });
  item.answer('dc_1', 'post', { edited: false, ms_on_card: 4200 });
  for (const site of ['ebay', 'depop']) item.action('it_1', 'post', 'user', { site, price: 60, floor: 50 });
  for (const site of ['ebay', 'depop']) {
    await item.call('browser', `${site}.post`, { item: 'it_1' }, async () => ({ url: `https://${site}.example/listing/1` }));
    item.action('it_1', 'postOk', 'site', { site });
  }
  item.action('it_1', 'buyerPays', 'site', { site: 'ebay' });
  item.action('it_1', 'delist', 'auto', { site: 'depop' });
  item.action('it_1', 'delistOk', 'site', { site: 'depop' });
  item.ask('dc_2', 'pickupTime', 'never_alone', { why: 'a pickup time is only ever set by the person' });
  item.close('dc_2', 'expired');
  item.change('conversation', 'cv_1', 'answered', { was: 'waiting' });
  server.note('reconcile found nothing to fix', { checked: 2 });
  app.end(); server.end();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { fileSink } = await import('./node.js');
  const stamp = Date.now().toString(36), files = [];
  await runExample(name => { const f = `logs/example-${name}-${stamp}.jsonl`; files.push(f); return fileSink(f); });
  console.log(`wrote ${files.join(' ')}\ncheck them: node spec/log.mjs ${files.join(' ')} --sites ebay,depop`);
}
