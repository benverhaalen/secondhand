// eBay's Browse API as a reader for the alert trial and the stage watcher: the sanctioned newest-first search
// (sort=newlyListed, itemCreationDate on every row), then one getItem per new listing for its item specifics
// (Size, Department, Product), which is what decides whether a jersey fits. Keys: EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in
// the shell, never in the repo (Nate registers them; packet 65). 5,000 calls a day by default.
//
// Rests-on: app/src/edge/harness/sites/ebay/README.md (hosts, scopes, token), research/watch/ben/brewers-alert-trial.md §2.
const API = 'https://api.ebay.com';
const SCOPE = 'https://api.ebay.com/oauth/api_scope';

// Client-credentials token, cached in memory until a minute before it expires; never logged or returned.
export function appToken({ clientId, clientSecret, fetchFn = fetch, now = Date.now }) {
  let have = null;
  return async () => {
    if (have && have.until > now()) return have.token;
    const r = await fetchFn(`${API}/identity/v1/oauth2/token`, { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
      body: `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}` });
    const b = await r.json().catch(() => ({}));
    if (!r.ok || !b.access_token) throw new Error(`ebay token: status ${r.status}`);
    have = { token: b.access_token, until: now() + ((b.expires_in ?? 7200) - 60) * 1000 };
    return have.token;
  };
}

// eBay's Department values, in the trial's words: a kid's cut is Kids whatever the label, a unisex adult cut is Unisex.
const DEPT = { men: 'Men', women: 'Women', boys: 'Kids', girls: 'Kids', 'unisex kids': 'Kids', 'unisex adult': 'Unisex', unisex: 'Unisex' };
const aspect = (item, name) => (item.localizedAspects ?? []).find(a => a.name?.toLowerCase() === name.toLowerCase())?.value ?? null;

export function row(s) {
  const price = Number(s.price?.value), ship = Number(s.shippingOptions?.[0]?.shippingCost?.value);
  return { site: 'ebay', site_id: s.legacyItemId ?? s.itemId, item_id: s.itemId, url: s.itemWebUrl, title: s.title ?? null,
    price: Number.isFinite(price) ? price : null, shipping: Number.isFinite(ship) ? ship : null,
    size: null, department: null, category: null, sold: false, published_at: Date.parse(s.itemCreationDate ?? '') || null };
}

export function facts(item) {
  const price = Number(item.price?.value), dept = aspect(item, 'Department'), product = aspect(item, 'Product') ?? aspect(item, 'Type');
  const left = item.estimatedAvailabilities?.[0]?.estimatedAvailabilityStatus;
  return {
    jsonld_price: Number.isFinite(price) ? price : null, available: left ? left !== 'OUT_OF_STOCK' : true,
    title: item.title ?? null, description: (item.shortDescription ?? '').slice(0, 400), size: aspect(item, 'Size'),
    department: dept ? DEPT[dept.toLowerCase()] ?? dept : null, category: product && /jersey/i.test(product) ? 'Jerseys' : product,
    published_at: Date.parse(item.itemCreationDate ?? '') || null,
  };
}

export function ebayReader({ token, fetchFn = fetch }) {
  const get = async url => {
    const r = await fetchFn(url, { headers: { Authorization: `Bearer ${await token()}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' } });
    if (r.status === 429) throw new Error('ebay: rate limited');
    if (!r.ok) throw new Error(`ebay: status ${r.status}`);
    return r.json();
  };
  return {
    site: 'ebay',
    search: async s => ((await get(`${API}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(s.q)}&sort=newlyListed&limit=200${s.category_ids ? `&category_ids=${s.category_ids}` : ''}`)).itemSummaries ?? []).map(row),
    listing: async r => facts(await get(`${API}/buy/browse/v1/item/${encodeURIComponent(r.item_id)}`)),
  };
}
