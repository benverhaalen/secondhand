// Proves the three channels on a local page that plays a sale: a badge flips to Sold, the site's socket pushes an order, the page reads its listing JSON.
// Run: node --test research/sold/ben/dom-watch/watch.test.mjs  (needs Playwright's Chromium; no network)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { watch } from './watch.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');

const PAGE = n => `<!doctype html><title>listing ${n}</title><span id="status">Available</span>
<script>
  setTimeout(() => { document.querySelector('#status').textContent = 'Sold'; }, 200);
  const ws = new WebSocket('ws://' + location.host + '/live');
  ws.onopen = () => fetch('/api/listing/${n}');
</script>`;

// The smallest WebSocket server that can push one text frame (RFC 6455 handshake, unmasked server frame).
function frame(text) { const b = Buffer.from(text); return Buffer.concat([Buffer.from([0x81, b.length]), b]); }
function site() {
  const server = createServer((req, res) => {
    if (req.url.startsWith('/api/listing/')) { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ id: req.url.split('/').at(-1), status: 'sold' })); }
    res.setHeader('content-type', 'text/html'); res.end(PAGE(req.url.slice(1) || '1'));
  });
  server.on('upgrade', (req, socket) => {
    const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    setTimeout(() => socket.write(frame('{"type":"order.new","listing":"1"}')), 100);
    socket.on('error', () => socket.destroy());
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

const until = (events, pred, ms = 5000) => new Promise((resolve, reject) => {
  const t0 = Date.now();
  const tick = () => { const hit = events.find(pred); if (hit) return resolve(hit); if (Date.now() - t0 > ms) return reject(new Error('timed out; saw ' + JSON.stringify(events))); setTimeout(tick, 20); };
  tick();
});

async function play(page, base) {
  const events = [];
  await page.goto(base + '/1');
  await watch(page, { selector: '#status', frames: /order\.new/, responses: /\/api\/listing\//, onChange: e => events.push({ ...e, at: Date.now() }) });
  await page.reload(); // the socket and fetch run again with the listeners attached
  const sold = await until(events, e => e.channel === 'dom' && e.text === 'Sold');
  const ws = await until(events, e => e.channel === 'ws');
  const http = await until(events, e => e.channel === 'http');
  assert.match(ws.text, /order\.new/);
  assert.equal(http.body.status, 'sold');
  // The observer survives navigation to another listing.
  await page.goto(base + '/2');
  const second = await until(events, e => e.channel === 'dom' && e.text === 'Sold' && e.url.endsWith('/2'));
  return { sold, second, events };
}

test('a page launched by Playwright reports DOM, socket and JSON changes', async () => {
  const server = await site(); const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try { await play(await browser.newPage(), base); } finally { await browser.close(); server.close(); }
});

test('the same works over CDP, the way a cloud browser is attached', async () => {
  const server = await site(); const base = `http://127.0.0.1:${server.address().port}`;
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(chromium.executablePath(), ['--headless=new', '--no-sandbox', `--remote-debugging-port=${port}`, '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'cdp-')), 'about:blank'], { stdio: 'ignore' });
  try {
    let browser;
    for (let i = 0; i < 50 && !browser; i++) browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => new Promise(r => setTimeout(r, 100)));
    assert.ok(browser, 'could not attach over CDP');
    const page = await browser.contexts()[0].newPage();
    const { events } = await play(page, base);
    assert.ok(events.filter(e => e.channel === 'dom').length >= 2);
    await browser.close();
  } finally { chrome.kill(); server.close(); }
});
