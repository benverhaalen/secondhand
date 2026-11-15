// Writes requirement.json (the registry rows) and cases.json (inputs with the expected answers). Run: node make.mjs
import fs from 'node:fs';
const here = new URL('.', import.meta.url);
const W = { high: 3, medium: 2, low: 1 };
const route = { label: 'read_tag', measured: 'lidar_scan', seen: 'capture_judge', lookup: 'catalogue', asked: 'clarify' };
const row = (item_kind, field, o) => {
  const [match, value, rank] = o.imp;
  return {
    id: `req_${item_kind}_${field}`, item_kind, node: o.node ?? field, field, type: o.type ?? 'text', values_or_unit: o.unit ?? null, role: o.role ?? 'attribute',
    site_names: { ebay: { name: field, max_length: 65, required: !!o.req }, depop: { name: field, max_length: 40, required: !!o.req } },
    importance: { match, value, rank: { ebay: rank, depop: rank } }, fill_ladder: o.ladder.map((rung) => ({ rung, route: route[rung] })), views_needed: o.views ?? [],
    seconds: o.sec, effort: o.eff, priority: [match, value, rank].sort((a, b) => W[b] - W[a])[0], version: 1,
  };
};
const rows = [
  row('apparel', 'size_label', { imp: ['high', 'high', 'high'], ladder: ['label', 'asked'], views: ['tag'], sec: 8, eff: 2, req: true }),
  row('apparel', 'brand', { imp: ['high', 'medium', 'high'], ladder: ['label', 'lookup'], views: ['tag'], sec: 8, eff: 2, req: true }),
  row('apparel', 'fabric', { imp: ['medium', 'medium', 'medium'], ladder: ['label', 'asked'], views: ['care_label'], sec: 8, eff: 3 }),
  row('apparel', 'condition', { imp: ['high', 'high', 'high'], ladder: ['seen', 'asked'], views: ['flaw'], sec: 10, eff: 3, req: true, role: 'condition' }),
  row('apparel', 'sleeve_length', { imp: ['low', 'low', 'low'], ladder: ['seen', 'asked'], sec: 0, eff: 2 }),
  row('shoes', 'size_label', { imp: ['high', 'high', 'high'], ladder: ['label', 'asked'], views: ['size_label'], sec: 8, eff: 2, req: true }),
  row('shoes', 'brand', { imp: ['high', 'medium', 'high'], ladder: ['seen', 'label'], views: ['size_label'], sec: 8, eff: 2 }),
  row('shoes', 'condition', { imp: ['high', 'high', 'high'], ladder: ['seen', 'asked'], views: ['soles'], sec: 10, eff: 3, role: 'condition' }),
  row('furniture', 'dimensions', { type: 'measurement', unit: 'mm', imp: ['high', 'high', 'medium'], ladder: ['measured', 'lookup', 'asked'], views: ['scan'], sec: 25, eff: 3 }),
  row('furniture', 'material', { imp: ['medium', 'medium', 'medium'], ladder: ['seen', 'asked'], sec: 0, eff: 2 }),
  row('furniture', 'maker', { imp: ['medium', 'high', 'medium'], ladder: ['label', 'lookup'], views: ['maker_mark'], sec: 8, eff: 3 }),
  row('furniture', 'condition', { imp: ['high', 'high', 'high'], ladder: ['seen', 'asked'], views: ['flaw'], sec: 10, eff: 3, role: 'condition' }),
  row('electronics', 'model', { imp: ['high', 'high', 'high'], ladder: ['label', 'seen'], views: ['about_screenshot'], sec: 6, eff: 2, req: true }),
  row('electronics', 'storage', { imp: ['medium', 'high', 'medium'], ladder: ['label', 'asked'], views: ['about_screenshot'], sec: 6, eff: 2 }),
  row('electronics', 'function', { imp: ['high', 'high', 'high'], ladder: ['asked'], sec: 0, eff: 3, role: 'function' }),
  row('electronics', 'condition', { imp: ['high', 'high', 'high'], ladder: ['seen', 'asked'], views: ['flaw'], sec: 10, eff: 3, role: 'condition' }),
];
const e = (p, pre) => ({ state: 'empty', p_preselect_right: p, preselect: pre });
const cases = [
  { name: 'tee with only the front kept: the tag settles most', kind: 'apparel', kept_views: ['front'],
    unmet: ['size_label', 'brand', 'fabric', 'condition'],
    value_at_stake: { size_label: 0.35, brand: 0.25, fabric: 0.05, condition: 0.3 },
    p_view_fills: { tag: { size_label: 0.9, brand: 0.8 }, care_label: { fabric: 0.9 }, flaw: { condition: 0.4 } }, bar: 0.1,
    facts: { condition: e(0.55, 'good'), fabric: e(0.6, 'cotton'), size_label: e(0.1, null), brand: e(0.2, null), sleeve_length: e(0.9, 'short') } },
  { name: 'tee with front, back, tag kept: nothing worth a view, the tag settled the label facts', kind: 'apparel', kept_views: ['front', 'back', 'tag'],
    unmet: ['fabric', 'condition'], value_at_stake: { fabric: 0.02, condition: 0.04 },
    p_view_fills: { care_label: { fabric: 0.9 }, flaw: { condition: 0.2 } }, bar: 0.1,
    facts: { size_label: { state: 'settled' }, brand: { state: 'settled' }, condition: e(0.7, 'good'), fabric: e(0.3, 'cotton'), sleeve_length: e(0.95, 'short') } },
  { name: 'sofa after the scan: dimensions measured, the maker mark is the view', kind: 'furniture', kept_views: ['scan'],
    unmet: ['maker', 'condition'], value_at_stake: { maker: 0.5, condition: 0.2 },
    p_view_fills: { maker_mark: { maker: 0.6 }, flaw: { condition: 0.3 } }, bar: 0.1,
    facts: { dimensions: { state: 'settled' }, condition: e(0.5, 'good'), material: e(0.4, 'fabric'), maker: e(0.1, null) } },
  { name: 'phone: the About screenshot settles model and storage, function never preselected', kind: 'electronics', kept_views: ['front'],
    unmet: ['model', 'storage', 'condition'], value_at_stake: { model: 0.5, storage: 0.3, condition: 0.2 },
    p_view_fills: { about_screenshot: { model: 0.95, storage: 0.9 }, flaw: { condition: 0.3 } }, bar: 0.1,
    facts: { function: e(0.8, 'works'), condition: e(0.6, 'good'), model: e(0.1, null), storage: e(0.2, null) } },
  { name: 'shoes with every view kept: no view, and at most 3 follow-ups of the 4 wanted', kind: 'shoes', kept_views: ['scan', 'size_label', 'soles'],
    unmet: [], value_at_stake: {}, p_view_fills: {}, bar: 0.1,
    facts: { condition: e(0.5, 'good'), size_label: e(0.2, null), brand: e(0.3, null), extra: e(0.4, null) } },
];
// Expected answers, worked from the capture engine steps 4 and 6; the test works them again with its own code.
const expected = (c) => {
  const rs = rows.filter((r) => r.item_kind === c.kind);
  let best = null;
  for (const f of c.unmet) {
    const r = rs.find((x) => x.field === f);
    for (const v of r.views_needed) {
      if (c.kept_views.includes(v)) continue;
      const worth = Math.round(W[r.priority] * (c.p_view_fills[v]?.[f] ?? 0) * c.value_at_stake[f] * 1e6) / 1e6;
      if (worth >= c.bar && (!best || worth > best.worth)) best = { view: v, row_id: r.id, worth };
    }
  }
  const cand = rs.filter((r) => c.facts[r.field]?.state === 'empty' && r.fill_ladder.some((l) => l.rung === 'asked' || l.rung === 'lookup'));
  const score = (r) => W[r.priority] * (1 - c.facts[r.field].p_preselect_right);
  const order = [...cand].sort((a, b) => (b.role === 'condition') - (a.role === 'condition') || score(b) - score(a));
  return { next_view: best, follow_ups: order.slice(0, 3).map((r) => ({ field: r.field, preselect: r.role === 'function' ? null : c.facts[r.field].preselect })) };
};
fs.writeFileSync(new URL('requirement.json', here), JSON.stringify({ version: 1, importance_weight: W, importance_weight_note: 'high 3, medium 2, low 1 is a guess; no source gives numbers', rows }, null, 1) + '\n');
fs.writeFileSync(new URL('cases.json', here), JSON.stringify({ version: 1, cases: cases.map((c) => ({ ...c, expected: expected(c) })) }, null, 1) + '\n');
