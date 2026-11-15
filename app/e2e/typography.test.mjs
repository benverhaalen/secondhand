import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { start } from './behavior.mjs';
import { signatures, typeAcross } from '../../scripts/standards.mjs';

let app;
const measured = {};
const approved = {
  13: ['PP Neue Montreal', '500', '18px', '0px'],
  15: ['PP Neue Montreal', '500', '20px', '0px'],
  18: ['PP Neue Montreal', '500', '24px', '0px'],
  21: ['Clofie', '600', '23px', '-0.21px'],
  36: ['Clofie', '600', '41px', '-0.54px'],
  50: ['PP Neue Montreal', '500', '57px', '-1px'],
};
const item = { id: 'type_item', version: 1, title: 'Carhartt jacket', state: 'review', quantity: 1, location: { label: 'Madison' }, photos: [], listings: [], attributes: [], description: 'Brown canvas jacket.', price_cents: { amount_cents: 4500, currency: 'USD' } };
const api = {
  '/v1/auth/refresh': { access_token: 'typography-test', refresh_token: 'typography-refresh', expires_at: '2099-01-01T00:00:00Z' },
  '/v1/me': { id: 'typography-test', tutorial_seen: true, auth_methods: [{ provider: 'email' }] },
  ...Object.fromEntries(['accounts', 'orders', 'wants', 'conversations', 'events', 'lookups'].map(name => [`/v1/${name}`, { data: [], next_cursor: null }])),
  '/v1/today': { decisions: [] },
  '/v1/items': { data: [item], next_cursor: null },
  '/v1/items/type_item': item,
  '/v1/accounts/type_account/import-preview': { needs_username: true, listings: [] },
};

before(async () => { app = await start(); });
after(async () => {
  if (process.env.TYPOGRAPHY_REPORT) writeFileSync(process.env.TYPOGRAPHY_REPORT, JSON.stringify(measured, null, 2) + '\n');
  await app?.stop();
});

function renderedType() {
  const shown = el => {
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0.05 || node.getAttribute('aria-hidden') === 'true') return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  return [...document.querySelectorAll('body *')].filter(el =>
    !el.closest('svg, script, style') && shown(el) && (el.matches('input, textarea') || [...el.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()))
  ).map(el => {
    const style = getComputedStyle(el);
    return { s: el.value || el.getAttribute('placeholder') || el.textContent.trim(), id: el.getAttribute('data-testid'),
      input: el.matches('input, textarea'), size: parseFloat(style.fontSize), face: style.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      weight: style.fontWeight, lh: style.lineHeight, ls: style.letterSpacing === 'normal' ? '0px' : style.letterSpacing,
      italic: style.fontStyle, stroke: parseFloat(style.webkitTextStrokeWidth) || 0 };
  });
}

function violations(texts) {
  return texts.flatMap(text => {
    const expected = approved[text.size], actual = [text.face, text.weight, text.lh, text.ls];
    return !expected || JSON.stringify(actual) !== JSON.stringify(expected) || text.italic !== 'normal' || text.stroke !== 0
      ? [{ text: text.s, id: text.id, size: text.size, expected, actual, italic: text.italic, stroke: text.stroke }] : [];
  });
}

async function inspect(screen, key) {
  const page = screen.page;
  await page.locator('[data-screen]').filter({ visible: true }).first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.querySelector('[data-screen="account-loading"]'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(`(${renderedType.toString()})().length > 0`);
  const texts = await page.evaluate(renderedType);
  assert.ok(texts.length, `${key}: no rendered text was measured`);
  const fonts = await page.evaluate(() => [...document.fonts].filter(font => font.status === 'loaded').map(font => font.family.replace(/["']/g, '')));
  for (const face of new Set(texts.map(text => text.face))) assert.ok(fonts.includes(face), `${key}: ${face} was declared but not loaded`);
  measured[key] = { url: page.url(), texts, signatures: signatures({ texts }) };
  if (process.env.TYPOGRAPHY_REPORT) writeFileSync(process.env.TYPOGRAPHY_REPORT, JSON.stringify(measured, null, 2) + '\n');
  return texts;
}

const demoRoutes = [
  '/', '/sell', '/buy', '/you', '/new', '/camera', '/worth', '/want', '/search?q=dunks', '/shop', '/gone-by', '/messages',
  '/messages/cv_jd', '/item/it_jacket', '/item/it_switch/plan', '/item/it_switch/post', '/item/it_kindle/ship', '/item/it_chair/pickup',
  '/listing/mt_d1', '/product/pr_dunk',
  ...['payouts', 'insights', 'records', 'connections', 'rules', 'log', 'notifications', 'defaults', 'permissions', 'settings'].map(page => `/you/${page}`),
  '/you/connections/ebay',
];

for (const dark of [false, true]) {
  for (const route of demoRoutes) test(`${dark ? 'dark' : 'light'} demo typography ${route}`, async () => {
    const path = `${route}${route.includes('?') ? '&' : '?'}world=clearing`;
    const screen = await app.open(path, { api, dark });
    try {
      const texts = await inspect(screen, `${dark ? 'dark' : 'light'} ${path}`);
      assert.equal(new URL(screen.page.url()).pathname, new URL(path, app.url).pathname, 'a redirected page is not coverage');
      assert.deepEqual(violations(texts), []);
    } finally { await screen.page.close(); }
  });

  for (const route of ['/sell', '/item/type_item', '/item/type_item/edit', '/item/type_item/plan', '/item/type_item/post', '/item/type_item/ship', '/you/settings', '/import/type_account']) {
    test(`${dark ? 'dark' : 'light'} live typography ${route}`, async () => {
      const screen = await app.open(route, { api, dark });
      try {
        if (route.endsWith('/edit')) await screen.page.getByTestId('seller-title-input').waitFor();
        if (route.endsWith('/plan')) await screen.page.getByTestId('seller-price-input').waitFor();
        if (route.startsWith('/import/')) await screen.page.getByRole('textbox', { name: 'Depop username' }).waitFor();
        const texts = await inspect(screen, `${dark ? 'dark' : 'light'} live ${route}`);
        assert.equal(new URL(screen.page.url()).pathname, route, 'a redirected page is not coverage');
        if (route.endsWith('/edit') || route.endsWith('/plan')) assert.ok(texts.some(text => text.input), 'the form inputs must be measured');
        assert.deepEqual(violations(texts), []);
      } finally { await screen.page.close(); }
    });
  }

  test(`${dark ? 'dark' : 'light'} sign-in email and code typography`, async () => {
    const screen = await app.open('/onboarding', { api: { ...api,
      '/v1/auth/refresh': route => route.fulfill({ status: 401, json: { code: 'unauthorized' } }),
      '/v1/auth/email/start': { resend_after_s: 60 },
    }, dark });
    try {
      await screen.page.getByTestId('signin-email-address-input').waitFor();
      const email = await inspect(screen, `${dark ? 'dark' : 'light'} sign-in email`);
      await screen.page.getByTestId('signin-email-address-input').fill('typography@example.test');
      await screen.tap('signin-email-send');
      await screen.page.getByTestId('signin-email-code-input').waitFor();
      const code = await inspect(screen, `${dark ? 'dark' : 'light'} sign-in code`);
      assert.deepEqual(violations([...email, ...code]), []);
    } finally { await screen.page.close(); }
  });

  for (const [route, control, input] of [
    ['/want?world=clearing&q=dunks', 'want-what', 'want-what-input'],
    ['/item/it_jacket/plan?world=clearing', 'plan-price', 'plan-price-input'],
    ['/item/it_switch/post?world=clearing', 'when-other', 'when-other-input'],
  ]) test(`${dark ? 'dark' : 'light'} editable typography ${control}`, async () => {
    const screen = await app.open(route, { api, dark });
    try {
      await screen.tap(control);
      await screen.page.getByTestId(input).waitFor();
      const texts = await inspect(screen, `${dark ? 'dark' : 'light'} editing ${control}`);
      assert.ok(texts.some(text => text.id === input), `${input} must be measured`);
      assert.deepEqual(violations(texts), []);
    } finally { await screen.page.close(); }
  });
}

test('rendered typography rejects a changed weight, face, line height, tracking and input', async () => {
  const screen = await app.open('/item/type_item/edit', { api });
  try {
    await screen.page.getByTestId('seller-title-input').waitFor();
    assert.deepEqual(violations(await inspect(screen, 'mutation baseline')), []);
    for (const [selector, property, value] of [
      ['[data-role="body"]', 'fontWeight', '700'], ['[data-role="body"]', 'fontFamily', 'Arial'],
      ['[data-role="body"]', 'lineHeight', '30px'], ['[data-role="body"]', 'letterSpacing', '2px'],
      ['input', 'fontWeight', '400'],
    ]) {
      const element = screen.page.locator(selector).filter({ visible: true }).first();
      const original = await element.getAttribute('style');
      await element.evaluate((el, [property, value]) => { el.style[property] = value; }, [property, value]);
      assert.ok(violations(await screen.page.evaluate(renderedType)).length, `${selector} ${property} mutation escaped the check`);
      await element.evaluate((el, original) => { el.setAttribute('style', original ?? ''); }, original);
      assert.deepEqual(violations(await screen.page.evaluate(renderedType)), []);
    }
  } finally { await screen.page.close(); }
});

test('the development UI kit uses the same typography in light and dark', async () => {
  const port = await new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
  const child = spawn(process.execPath, ['node_modules/.bin/expo', 'start', '--web', '--localhost', '--port', String(port)], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  try {
    const ready = AbortSignal.timeout(30_000);
    while (true) {
      assert.equal(child.exitCode, null, output);
      ready.throwIfAborted();
      try { if ((await fetch(`http://localhost:${port}/status`, { signal: ready })).ok) break; } catch { ready.throwIfAborted(); }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    for (const scheme of ['light', 'dark']) {
      const screen = await app.open('/?world=clearing', { api });
      try {
        await screen.page.goto(`http://localhost:${port}/dev/parts?world=clearing&scheme=${scheme}`);
        await screen.page.locator('[data-screen="parts"]').waitFor();
        const texts = await inspect(screen, `${scheme} UI kit`);
        assert.ok(texts.some(text => text.input), 'the kit inputs must be measured');
        assert.deepEqual(violations(texts), []);
      } finally { await screen.page.close(); }
    }
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exited;
    }
  }
});

test('one type signature per size across every measured route, including navigation and inputs', () => {
  assert.deepEqual(typeAcross(Object.fromEntries(Object.entries(measured).map(([route, result]) => [route, result.signatures]))), []);
});
