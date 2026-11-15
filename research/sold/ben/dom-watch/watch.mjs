// Hear a page change the moment it happens, inside a browser we already hold open: no polling, no model.
// Two channels: the page's own data (WebSocket frames and JSON responses the site's server pushes) and the DOM itself (a MutationObserver that calls back to us).
// Works on any Playwright page, including one attached to a cloud browser over CDP (tested in watch.test.mjs).

// What the page shows for one selector, normalised so a re-render with the same text is not a change.
const OBSERVER = ({ selector, binding }) => {
  let last;
  const report = () => {
    const el = document.querySelector(selector);
    const text = el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
    if (text === last) return;
    last = text;
    window[binding]({ selector, text, url: location.href });
  };
  new MutationObserver(report).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  document.addEventListener('DOMContentLoaded', report);
};

/**
 * @param page a Playwright Page
 * @param opts.selector CSS selector whose text means the state (for example a listing's status badge)
 * @param opts.frames RegExp tested against WebSocket frames the page receives
 * @param opts.responses RegExp tested against response URLs; a match passes the JSON body on
 * @param opts.onChange called with {channel: 'dom' | 'ws' | 'http', ...}
 */
export async function watch(page, { selector, frames, responses, onChange, binding = '__secondhandChanged' }) {
  if (selector) {
    await page.exposeBinding(binding, (_source, payload) => onChange({ channel: 'dom', ...payload }));
    await page.addInitScript(OBSERVER, { selector, binding });
    await page.evaluate(OBSERVER, { selector, binding }); // the page already loaded misses the init script
  }
  if (frames) page.on('websocket', ws => ws.on('framereceived', f => {
    const text = typeof f.payload === 'string' ? f.payload : f.payload.toString('utf8');
    if (frames.test(text)) onChange({ channel: 'ws', url: ws.url(), text });
  }));
  if (responses) page.on('response', async res => {
    if (!responses.test(res.url())) return;
    const body = await res.json().catch(e => ({ unreadable: e.message }));
    onChange({ channel: 'http', url: res.url(), status: res.status(), body });
  });
}
