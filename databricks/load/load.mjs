// Loads the proof story into secondhand.core through the product code: proof.ts answer()/guard() for every number,
// policy.ts check() for every decision, param.ts memoryStore() for every weight move. Sources are spec/fixtures/ and
// the walk logs. Rows go in for usr_nate (mapped to the workspace principal) and a mirror for usr_ben (mapped to nobody),
// so the isolation query has someone else's rows to hide.
// node databricks/load/load.mjs
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { answer, guard, PROOF_PARAMS } from '../../app/src/engines/proof/proof.ts'
import { memoryStore, scopeKey } from '../../app/src/engines/param/param.ts'
import { check } from '../../app/src/edge/events/policy.ts'
import { weightedQuantile } from '../../app/src/engines/valuation/comps.ts'
import { query } from '../run-sql.mjs'

const root = new URL('../../', import.meta.url)
const json = p => JSON.parse(readFileSync(new URL(p, root), 'utf8'))
const NOW = '2026-11-15T12:00:00.000Z'
const CODE = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const PRINCIPAL = query('SELECT current_user() AS u')[0].u
const T = 'secondhand.core'
const h = s => createHash('sha256').update(s).digest('hex').slice(0, 12)

// --- SQL literals typed from information_schema, so a null or an array lands in the column's own type
const types = {}
for (const r of query(`SELECT table_name, column_name, full_data_type FROM secondhand.information_schema.columns WHERE table_schema = 'core'`))
  (types[r.table_name] ??= {})[r.column_name] = r.full_data_type
const str = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
function lit(v, type) {
  if (v === null || v === undefined) return `CAST(NULL AS ${type})`
  if (type.startsWith('array')) return `array(${v.map(str).join(', ')})`
  if (type === 'string') return str(typeof v === 'string' ? v : JSON.stringify(v))
  if (type === 'boolean') return v ? 'true' : 'false'
  if (type === 'timestamp') return `CAST(${str(v)} AS TIMESTAMP)`
  return `CAST(${Number(v)} AS ${type})`
}
// MERGE on the key so a rerun inserts nothing twice (observation is append-only: insert-only merge is allowed).
function merge(table, rows, key = ['id'], update = []) {
  const cols = Object.keys(types[table])
  const batches = [[]]
  let size = 0
  for (const r of rows) {
    const values = `(${cols.map(c => lit(r[c], types[table][c])).join(', ')})`
    if (size + values.length > 20000) { batches.push([]); size = 0 } // Windows caps a command line near 32k characters
    batches.at(-1).push(values); size += values.length
  }
  for (const b of batches.filter(b => b.length)) query(
    `MERGE INTO ${T}.${table} t USING (SELECT * FROM VALUES ${b.join(', ')} AS s(${cols.join(', ')})) s ON ${key.map(k => `t.${k} <=> s.${k}`).join(' AND ')}` +
    (update.length ? ` WHEN MATCHED THEN UPDATE SET ${update.map(c => `t.${c} = s.${c}`).join(', ')}` : '') +
    ` WHEN NOT MATCHED THEN INSERT *`)
  console.log(`merged ${rows.length} rows into ${table}`)
}
const canon = (user, id, at = NOW) => ({ id, user_id: user, created_at: at, updated_at: at, version: 1 })

// --- params: the registry code path, one promote on a held-out win, one loss, one rollback
// Held-out scores here are the fixture's (the nightly job in databricks/tasks writes computed ones).
const store = memoryStore()
for (const d of PROOF_PARAMS) store.declare(d)
store.declare({ name: 'w_type_best_offer', family: 'scalar', prior: 0.6, metric: 'held_out_coverage' })
const paramRows = new Map()
function snap(name, scope, moved_by, at) {
  for (const p of store.rows(name, scope)) {
    const id = `prm_${h(`${name}|${scopeKey(scope)}|${p.version}`)}`
    const prev = paramRows.get(id)
    const moved = !prev || prev.status !== p.status
    paramRows.set(id, {
      ...p, id, user_id: scope.person ?? null, created_at: prev?.created_at ?? at, updated_at: moved ? at : prev.updated_at,
      scope: scopeKey(scope), moved_by: moved ? moved_by : prev.moved_by,
    })
  }
  merge('param', [...paramRows.values()], ['id'], ['status', 'promoted_at', 'updated_at', 'moved_by', 'frozen'])
}
const fit = (name, scope, value, held_out_score, expect) => store.propose({
  name, scope, family: 'scalar', value_or_hyperparams: value, prior: store.read(name, scope).value, fitted_on_ids_hash: h(`${name}${value}`),
  n_eff: 24, metric: 'held_out_coverage', held_out_score, guard_lo: null, guard_hi: null,
}, expect)
const G = {}, W = { kind: 'apparel', site: 'depop', person: 'usr_nate' }
const moves = []
fit('proof_min_n_eff', G, 8, 0.66, 0); moves.push(['proof_min_n_eff', G, 'propose v1', '2026-11-12T03:00:00Z'])
moves.push(['proof_min_n_eff', G, `promote v1: ${store.promote('proof_min_n_eff', G, 1, 0.01, '2026-11-12T03:00:01Z').reason}`, '2026-11-12T03:00:01Z'])
snap(...moves.at(-1))
fit('proof_min_n_eff', G, 6, 0.74, 1)
snap('proof_min_n_eff', G, 'propose v2', '2026-11-13T03:00:00Z')
snap('proof_min_n_eff', G, `promote v2: ${store.promote('proof_min_n_eff', G, 2, 0.01, '2026-11-13T03:00:01Z').reason} on held-out`, '2026-11-13T03:00:01Z')
fit('w_type_best_offer', W, 0.6, 0.70, 0)
snap('w_type_best_offer', W, `promote v1: ${store.promote('w_type_best_offer', W, 1, 0.01, '2026-11-12T03:00:02Z').reason}`, '2026-11-12T03:00:02Z')
fit('w_type_best_offer', W, 0.5, 0.74, 1)
snap('w_type_best_offer', W, `promote v2: ${store.promote('w_type_best_offer', W, 2, 0.01, '2026-11-13T03:00:02Z').reason} on held-out`, '2026-11-13T03:00:02Z')
fit('w_type_best_offer', W, 0.55, 0.745, 2)
snap('w_type_best_offer', W, `refused v3: ${store.promote('w_type_best_offer', W, 3, 0.01, '2026-11-14T03:00:00Z').reason}`, '2026-11-14T03:00:00Z')
store.rollback('w_type_best_offer', W, '2026-11-14T09:30:00Z')
snap('w_type_best_offer', W, 'rollback to v1: v2 widened live intervals', '2026-11-14T09:30:00Z')

// --- evidence and observations from the fixture pages (recorded and synthetic, marked) and the order fixtures
const manifest = json('spec/fixtures/pages/manifest.json').files
const orders = json('spec/fixtures/orders/orders.json'), listings = json('spec/fixtures/orders/listings.json')

function build(user) {
  const u = user === 'usr_nate' ? '' : '_b'
  const ev = [], obs = []
  for (const f of manifest) {
    const eid = `evd_${f.site}_page${u}`
    ev.push({
      ...canon(user, eid), shape: 'comp', source_url: f.source_url, read_at: f.fetched_at, snapshot_ref: `spec/fixtures/pages/${f.page}`,
      fingerprint: f.sha256[f.page], extractor_version: `pages-v2:${f.mode}`, may_store: true, may_model: f.mode === 'recorded', may_show: true,
      may_share: false, ttl_days: 30,
    })
    for (const it of json(`spec/fixtures/pages/${f.expected}`).items) obs.push({
      ...canon(user, `obs_${h(f.site + it.id)}${u}`), kind: 'listing', site: f.site, subject_ref: it.id, observed_at: f.fetched_at ?? NOW,
      price_cents: it.price_cents, currency: 'USD', price_type: 'asking', seller_handle: it.id.split('-')[0],
      payload: { title: it.title, url: it.url, mode: f.mode }, evidence_id: eid, source_route: 'public_page', retention_class: 'source_ttl',
      rights_mode: 'own_scope', mode: f.mode, title: it.title,
    })
  }
  ev.push({ ...canon(user, `evd_orders${u}`), shape: 'comp', source_url: 'spec/fixtures/orders/orders.json', read_at: NOW,
    snapshot_ref: 'spec/fixtures/orders/orders.json', fingerprint: h(JSON.stringify(orders)), extractor_version: 'orders-v1', may_store: true,
    may_model: true, may_show: true, may_share: false, ttl_days: null })
  for (const o of orders.filter(o => o.kind === 'sale' && ['delivered', 'handed_over'].includes(o.state))) { // a completed sale has an ended listing to date it
    const l = listings.find(l => l.id === o.listing_id)
    obs.push({ ...canon(user, `obs_${h(o.id)}${u}`), kind: 'price', site: o.site, subject_ref: o.id, observed_at: l.ended_at, price_cents: o.price_cents,
      currency: 'USD', price_type: 'sold', seller_handle: null, payload: { order: o.id, state: o.state }, evidence_id: `evd_orders${u}`,
      source_route: 'own_order', retention_class: 'item_audit', rights_mode: 'own_scope', mode: 'fixture', title: o.item_id })
  }
  return { ev, obs }
}

// --- numbers: every one through answer() and guard(), with the rules read from the param store
const min = store.read('proof_min_n_eff', {}), age = store.read('proof_max_age_days', {})
function numbers(user, obs, obsVersion) {
  const u = user === 'usr_nate' ? '' : '_b'
  const asks = [
    ['item_levi501_depop', 'asking_p50_cents', { site: 'depop', price_type: 'asking' }, o => o.price_type === 'asking' && o.site === 'depop'],
    ['item_levi501', 'asking_p50_cents', { sites: ['depop', 'poshmark'], mode: 'recorded', price_type: 'asking' }, o => o.price_type === 'asking' && ['depop', 'poshmark'].includes(o.site)],
    ['item_levi501_ebay', 'asking_p50_cents', { site: 'ebay', mode: 'synthetic', price_type: 'asking' }, o => o.price_type === 'asking' && o.site === 'ebay'],
    ['item_carhartt_j97', 'asking_p50_cents', { site: 'mercari', price_type: 'asking' }, o => o.price_type === 'asking' && o.site === 'mercari'],
    ['item_levi501_vintage', 'asking_p50_cents', { title_contains: 'vintage', price_type: 'asking' }, o => o.price_type === 'asking' && o.kind === 'listing' && /vintage/i.test(o.title)],
    ['item_my_sales', 'sold_p50_cents', { price_type: 'sold', source: 'own_order' }, o => o.price_type === 'sold'],
    ['item_levi501_grailed', 'asking_p50_cents', { site: 'grailed', price_type: 'asking' }, o => o.price_type === 'asking' && o.site === 'grailed'],
  ]
  const gn = [], cit = []
  for (const [item, metric, filters, pick] of asks) {
    const rows = obs.filter(pick)
    const prices = rows.map(r => r.price_cents), w = rows.map(() => 1)
    const q = p => rows.length ? weightedQuantile(prices, w, p) : null
    const a = answer({ lo: q(0.25), hi: q(0.75) }, rows.map(r => ({ id: r.id, source: r.site, at: r.observed_at, price_cents: r.price_cents })), {
      metric, filters, table_versions: [{ table: `${T}.observation`, version: obsVersion }], definition_version: 'p25-p50-p75 weighted v1',
      code_version: CODE, param_versions: { proof_min_n_eff: min.version, proof_max_age_days: age.version }, model_version: null,
    }, NOW)
    const g = guard(a, { min_n_eff: Number(min.value), max_age_days: Number(age.value) })
    if (a.ok) cit.push({ ...canon(user, a.citation.id), ...a.citation })
    gn.push({ ...canon(user, `gn_${item}${u}`), item_id: item + u, metric, value_cents: q(0.5), lo_cents: q(0.25), hi_cents: q(0.75), currency: 'USD',
      basis_count: g.basis_count, n_eff: a.ok ? a.basis.n_eff : 0, as_of: g.as_of ?? NOW, citation_id: g.citation_id ?? null, state: g.state,
      hide_reason: g.hide_reason ?? null })
  }
  return { gn, cit }
}

// --- decisions: every outward verb through check(); the mode is what the code answered
function decisions(user) {
  const u = user === 'usr_nate' ? '' : '_b'
  const cases = [
    ['accept_offer', 'accept_offer', 'auto', 4500, 2500, 4000, 'depop', 'af1371b827c0', 'offer at or above always_accept'],
    ['accept_offer', 'accept_offer', 'auto', 3000, 2500, 4000, 'depop', 'b71c09d2e4aa', 'offer under always_accept'],
    ['counter_offer', 'counter_offer', 'auto', 2000, 2500, undefined, 'poshmark', 'c93e1f00ab21', 'counter below the floor'],
    ['markdown', 'markdown', 'auto', 3200, 2500, undefined, 'ebay', null, 'scheduled markdown inside limits'],
    ['relist', 'relist', 'auto', 3500, 2500, undefined, 'poshmark', null, 'relist, promoted but poshmark is never lifted'],
    ['share_address', 'share_address', 'auto', undefined, undefined, undefined, 'facebook', 'd1aa20c7f3b9', 'buyer asked for the pickup address'],
    ['move_off_site', 'move_off_site', 'auto', undefined, undefined, undefined, 'facebook', 'e5f0c2a91d37', 'buyer asked to pay off the site'],
    ['refund', 'refund', 'auto', 2500, undefined, undefined, 'mercari', 'f2b7d4c16e08', 'return claim asks for a refund'],
    ['complete_purchase', 'complete_purchase', 'auto', 900, undefined, undefined, 'ebay', null, 'saved match is buyable'],
    ['unbacked_claim', 'send_message', 'auto', undefined, undefined, undefined, 'depop', 'af1371b827c0', 'claim check held a draft reply'],
  ]
  return cases.map(([kind, action, actor, price, floor, always, site, buyer, why], i) => {
    const r = check({ action, decision_kind: kind, actor, price_cents: price, floor_cents: floor, always_accept_cents: always,
      promoted: new Set(['relist']), site })
    return { ...canon(user, `dec_${i + 1}${u}`), kind: r.allow ? kind : r.decision_kind, item_id: `item_levi501${u}`, action, actor,
      price_cents: price ?? null, floor_cents: floor ?? null, site, policy_mode: r.allow ? 'auto' : r.mode, policy_result: r,
      policy_version: `policy.ts@${CODE}`, why, state: r.allow ? 'done' : 'open', buyer_handle: buyer }
  })
}

const claimChecks = (user) => {
  const u = user === 'usr_nate' ? '' : '_b'
  return [
    { ...canon(user, `cc_listing_levi501${u}`), subject: `listing_draft:item_levi501${u}`, checker_version: CODE, verdict: 'pass',
      claims: [{ text: "Levi's 501, button fly", state: 'backed', evidence_ref: 'label_text' }, { text: 'Size W32 L30', state: 'backed', evidence_ref: 'label_text' }] },
    { ...canon(user, `cc_reply_levi501${u}`), subject: `message_draft:item_levi501${u}`, checker_version: CODE, verdict: 'hold',
      claims: [{ text: 'Never worn', state: 'unbacked' }, { text: 'Ships tomorrow', state: 'backed', evidence_ref: 'ship_by' }] },
  ]
}

function storefronts(user) {
  const u = user === 'usr_nate' ? '' : '_b'
  return ['depop', 'ebay', 'facebook', 'mercari', 'poshmark'].map(site => {
    const b = json(`spec/fixtures/snapshot/${site}/base.json`)
    const sum = k => b.listings.reduce((a, l) => a + (l[k] ?? 0), 0)
    return { ...canon(user, `sfs_${site}${u}`), account_id: b.account_id, site, as_of: b.taken_at,
      shop: { active_count: b.listings.filter(l => l.state === 'live').length, sold_count: b.listings.filter(l => l.state === 'sold').length },
      totals: { views: sum('views'), likes: sum('likes'), watchers: sum('watchers'), offers_open: b.offers.filter(o => o.state === 'open').length },
      window_days: null, fields_missing: ['followers', 'rating', 'gross_cents'], source: `fixture:spec/fixtures/snapshot/${site}/base.json`, citation_id: null }
  })
}

// --- the walk logs: every line to log_event; event.received to event; job.state to job
function walks(user) {
  const log = [], events = [], jobs = new Map()
  for (const f of ['walk-35548', 'walk-37636', 'walk-5388']) {
    const lines = readFileSync(new URL(`logs/${f}.jsonl`, root), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    for (const { ts, session, seq, src, level, event, item, job, call, trace, ...body } of lines) {
      log.push({ user_id: user, ts, session, seq, src, level, event, item, job, call, trace, body })
      const sid = session.slice(-6)
      if (event === 'event.received') events.push({ ...canon(user, `evt_${sid}_${seq}`, ts), item_id: item ?? null, actor: body.source === 'app' ? 'user' : 'site',
        action: body.kind, why: null, observed_at: ts, effective_at: ts, operation_id: body.dedupe_key, trace_id: trace ?? null, site: body.site ?? null,
        source: body.source, dedupe_key: body.dedupe_key, job_ref: job ? `${sid}_${job}` : null })
      if (event === 'job.state') {
        const id = `job_${sid}_${job.replace(/^job_/, '')}`
        const prev = jobs.get(id)
        jobs.set(id, { ...canon(user, id, prev?.created_at ?? ts), updated_at: ts, version: (prev?.version ?? 0) + 1, kind: body.kind ?? prev?.kind ?? 'walk',
          item_id: item ?? null, stages: null, state: body.state, result: null, error: body.error ?? null, trace_id: trace ?? null,
          event_id: events.find(e => e.job_ref === `${sid}_${job}`)?.id ?? null, idempotency_key: `${session}:${job}` })
      }
    }
  }
  return { log, events, jobs: [...jobs.values()] }
}

// --- load
merge('param', [...paramRows.values()], ['id'], ['status', 'promoted_at', 'updated_at', 'moved_by', 'frozen'])
query(`MERGE INTO secondhand.governance.principal_map t USING (SELECT ${str(PRINCIPAL)} AS principal, 'usr_nate' AS user_id) s
  ON t.principal = s.principal AND t.user_id = s.user_id WHEN NOT MATCHED THEN INSERT *`)
// The row filter hides usr_ben's rows from this principal too, so the load maps it to usr_ben for its own run and unmaps after.
const BEN = `${T.replace('core', 'governance')}.principal_map`
try {
  query(`MERGE INTO ${BEN} t USING (SELECT ${str(PRINCIPAL)} AS principal, 'usr_ben' AS user_id) s
    ON t.principal = s.principal AND t.user_id = s.user_id WHEN NOT MATCHED THEN INSERT *`)
  const all = ['usr_nate', 'usr_ben'].map(user => ({ user, ...build(user) }))
  merge('evidence', all.flatMap(a => a.ev))
  merge('observation', all.flatMap(a => a.obs))
  const obsVersion = Number(query(`DESCRIBE HISTORY ${T}.observation LIMIT 1`)[0].version)
  const gnCols = Object.keys(types.guarded_number).filter(c => c !== 'id')
  const citationCandidates = new Set()
  for (const { user, obs } of all) {
    const { gn, cit } = numbers(user, obs, obsVersion)
    for (const row of query(`SELECT citation_id FROM ${T}.guarded_number WHERE user_id = ${str(user)}
      AND id IN (${gn.map(n => str(n.id)).join(', ')}) AND citation_id IS NOT NULL`)) citationCandidates.add(row.citation_id)
    for (const c of cit) citationCandidates.add(c.id)
    merge('citation', cit); merge('guarded_number', gn, ['id'], gnCols)
    merge('decision', decisions(user)); merge('claim_check', claimChecks(user)); merge('storefront_snapshot', storefronts(user))
    const w = walks(user)
    merge('event', w.events); merge('job', w.jobs)
    if (user === 'usr_nate') merge('log_event', w.log, ['session', 'seq'])
    for (const n of gn) console.log(user, n.item_id, n.state, n.hide_reason ?? '', n.basis_count, n.value_cents, n.citation_id ?? '')
  }
  // a rerun that changed a basis leaves its old citation unreferenced: drop those
  if (citationCandidates.size) query(`DELETE FROM ${T}.citation WHERE user_id IN ('usr_nate', 'usr_ben')
    AND id IN (${[...citationCandidates].map(str).join(', ')})
    AND id NOT IN (SELECT citation_id FROM ${T}.guarded_number WHERE citation_id IS NOT NULL)
    AND id NOT IN (SELECT citation_id FROM ${T}.storefront_snapshot WHERE citation_id IS NOT NULL)`)
  console.log('observation version', obsVersion)
} finally {
  query(`DELETE FROM ${BEN} WHERE principal = ${str(PRINCIPAL)} AND user_id = 'usr_ben'`)
}
