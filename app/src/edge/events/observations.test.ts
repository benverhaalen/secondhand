import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { memoryStore, type Store } from './ports.ts';
import { sqliteStore } from './sqlite-store.ts';
import { PUBLIC, writeObservations, readObservations, type ObservationInput, type ObservationRow } from './observations.ts';

const at = Date.parse('2026-11-15T10:00:00Z');
const now = () => at;
const row: ObservationInput = {
  kind: 'listing', site: 'poshmark', subject_ref: 'listing_1', observed_at: '2026-11-15T10:00:00Z',
  payload: { price_cents: 1200, nested: { z: 1, a: 2 } }, source_url: 'https://poshmark.com/listing/listing_1',
  extractor_version: 'test.v1', rights: { may_store: true, may_model: true, may_show: true, may_share: false, ttl: null },
  may_store: true, may_model: true, use_scope: 'hackathon_demo', keep_until: null, channel: 'secondhand',
  source_route: 'poshmark.search.page', retention_class: 'history', rights_mode: 'public', data: 'live:poshmark',
};

function refuses(store: Store, bad: ObservationInput, field: string, user_id = 'usr_a') {
  const put = store.put;
  let puts = 0;
  store.put = (table, value) => { puts++; return put(table, value); };
  try {
    assert.throws(() => writeObservations(store, user_id, [row, bad], now), error => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes(field), `refusal must name ${field}: ${error.message}`);
      assert.ok(error.message.includes(bad.subject_ref), 'refusal must name subject_ref');
      assert.ok(!error.message.includes('synthetic_private_value'), 'refusal must never include payload values');
      return true;
    });
    assert.equal(puts, 0, 'all validation must finish before the first put');
    assert.deepEqual(store.rows('observation', { user_id }), []);
  } finally { store.put = put; }
}

const factories: Record<string, (t: TestContext) => Store> = {
  memory: () => memoryStore(),
  sqlite: t => {
    const db = new DatabaseSync(':memory:');
    t.after(() => db.close());
    return sqliteStore(db);
  },
};

for (const [name, make] of Object.entries(factories)) {
  const check = (cause: string, run: (store: Store, t: TestContext) => void) =>
    test(`${name}: ${cause}`, t => run(make(t), t));

  check('Dupe may_store false refuses the entire Poshmark and Dupe batch before a write', store => {
    refuses(store, { ...row, site: 'dupe', subject_ref: 'dupe_no_store', data: 'live:dupe', may_store: false,
      rights: { ...row.rights, may_store: false } }, 'may_store');
  });

  check('site dupe is refused even when may_store is true', store => {
    refuses(store, { ...row, site: 'dupe', subject_ref: 'dupe_second_guard', data: 'live:dupe' }, 'site');
  });

  check('top-level may_model disagreeing with rights.may_model is refused', store => {
    refuses(store, { ...row, subject_ref: 'model_disagrees', may_model: false }, 'may_model');
  });

  check('top-level may_store disagreeing with rights.may_store is refused', store => {
    refuses(store, { ...row, subject_ref: 'store_disagrees', rights: { ...row.rights, may_store: false } }, 'may_store');
  });

  for (const [field, value] of [
    ['may_store', undefined], ['may_store', 'true'], ['may_model', undefined], ['may_model', 'false'],
    ['use_scope', undefined], ['use_scope', '  '], ['keep_until', undefined], ['keep_until', 'not a date'],
    ['keep_until', '2026-11-16'], ['keep_until', '2026-11-16T10:00:00'], ['keep_until', '2027-02-29T10:00:00Z'],
    ['channel', undefined], ['channel', 'unknown'],
  ] as const) check(`invalid or missing ${field} (${String(value)}) is refused`, store => {
    refuses(store, { ...row, subject_ref: 'invalid_field', [field]: value } as ObservationInput, field);
  });

  check('Apify show-only rights preserve the whole row and never allow a model read', store => {
    const apify: ObservationInput = { ...row, via: 'apify', actor: 'apify/facebook-marketplace-scraper',
      may_model: false, rights: { ...row.rights, may_model: false },
      payload: { ...row.payload, via: 'apify', extra: ['whole', 'row'] } };
    assert.deepEqual(writeObservations(store, 'usr_a', [apify], now), { written: 1, skipped: 0 });
    const [shown] = readObservations(store, 'usr_a', { purpose: 'show' }, now);
    const { source_url, extractor_version, rights, ...fields } = apify;
    for (const [key, value] of Object.entries(fields)) assert.deepEqual(shown[key], value, key);
    assert.deepEqual(shown.evidence.rights, rights);
    assert.equal(shown.evidence.source_url, source_url);
    assert.equal(shown.evidence.extractor_version, extractor_version);
    assert.deepEqual(readObservations(store, 'usr_a', { purpose: 'model' }, now), []);
  });

  check('caller may_model is preserved for eBay and Apify without source inference', store => {
    const rows: ObservationInput[] = [
      { ...row, subject_ref: 'apify_model', via: 'apify' },
      { ...row, subject_ref: 'ebay_no_model', site: 'ebay', data: 'live:ebay', may_model: false, rights: { ...row.rights, may_model: false } },
      { ...row, subject_ref: 'ebay_caller_flag', site: 'ebay', data: 'live:ebay' },
    ];
    writeObservations(store, 'usr_a', rows, now);
    assert.deepEqual(readObservations(store, 'usr_a', { purpose: 'model' }, now).map(r => r.subject_ref).sort(), ['apify_model', 'ebay_caller_flag']);
  });

  check('expired keep_until refuses the whole batch, including at the exact deadline', store => {
    for (const time of [at - 1, at]) refuses(store, { ...row, subject_ref: 'expired', keep_until: new Date(time).toISOString() }, 'keep_until');
  });

  check('keep_until passing after writing hides rows from both show and model', store => {
    const deadline = at + 1000;
    writeObservations(store, 'usr_a', [{ ...row, keep_until: new Date(deadline).toISOString() }], now);
    for (const purpose of ['show', 'model'] as const) {
      assert.equal(readObservations(store, 'usr_a', { purpose }, () => deadline - 1).length, 1);
      assert.deepEqual(readObservations(store, 'usr_a', { purpose }, () => deadline), []);
      assert.deepEqual(readObservations(store, 'usr_a', { purpose }, () => deadline + 1), []);
    }
    assert.equal(store.rows('observation', { user_id: 'usr_a' }).length, 1, 'expiry must not mutate append-only evidence');
  });

  for (const key of ['seller', 'sellerHandle', 'HANDLE', 'username', 'address', 'street', 'zip', 'postal_code', 'lat', 'lng', 'longitude']) {
    check(`payload ${key} nested in an array is refused without exposing its value`, store => {
      refuses(store, { ...row, subject_ref: 'private_payload', payload: { details: [{ [key]: 'synthetic_private_value' }] } }, key);
    });
  }

  for (const key of ['user_id', 'person', 'visitor_id', 'session', 'asker']) {
    check(`PUBLIC payload ${key} is refused so it cannot name who asked`, store => {
      refuses(store, { ...row, subject_ref: 'public_private_payload', payload: { details: [{ [key]: 'synthetic_private_value' }] } }, key, PUBLIC);
    });
  }

  check('PUBLIC rows survive deleteUser while the person own rows are deleted', store => {
    assert.equal(PUBLIC, 'sys_public');
    writeObservations(store, PUBLIC, [row], now);
    writeObservations(store, 'usr_a', [row], now);
    const before = readObservations(store, PUBLIC, {}, now);
    assert.equal(store.deleteUser('usr_a').rows.observation, 1);
    assert.deepEqual(readObservations(store, 'usr_a', {}, now), []);
    assert.deepEqual(readObservations(store, PUBLIC, {}, now), before);
    assert.deepEqual(store.exportUser('usr_a').rows.observation, []);
  });

  check('canonical payload fingerprints make repeated writes idempotent and preserve history', store => {
    assert.deepEqual(writeObservations(store, 'usr_a', [row], now), { written: 1, skipped: 0 });
    const [first] = readObservations(store, 'usr_a', {}, now);
    const fingerprint = createHash('sha256').update('{"nested":{"a":2,"z":1},"price_cents":1200}').digest('hex');
    assert.equal(first.evidence.fingerprint, fingerprint);
    const identity = createHash('sha256').update(JSON.stringify(['usr_a', row.site, row.kind, row.subject_ref, fingerprint])).digest('hex').slice(0, 16);
    assert.equal(first.id, 'obs_' + identity);
    assert.deepEqual(first.evidence, { source_url: row.source_url, read_at: row.observed_at, snapshot_ref: null,
      fingerprint, extractor_version: row.extractor_version, rights: row.rights });
    assert.deepEqual(writeObservations(store, 'usr_a', [{ ...row, observed_at: '2026-11-15T11:00:00Z',
      payload: { nested: { a: 2, z: 1 }, price_cents: 1200 } }], now), { written: 0, skipped: 1 });
    assert.deepEqual(readObservations(store, 'usr_a', {}, now), [first]);
    assert.deepEqual(writeObservations(store, 'usr_a', [{ ...row, payload: { price_cents: 1500 } }], now), { written: 1, skipped: 0 });
    assert.equal(readObservations(store, 'usr_a', {}, now).length, 2);
  });

  check('reads stay scoped to the person and filters and return newest first', store => {
    store.systemRows = () => { throw new Error('person reads must not use systemRows'); };
    writeObservations(store, 'usr_a', [row, { ...row, kind: 'price', product_id: 'pr_a', query: 'camera',
      subject_ref: 'new', observed_at: '2026-11-15T12:00:00+01:00' }], now);
    writeObservations(store, 'usr_b', [row], now);
    assert.deepEqual(readObservations(store, 'usr_a', {}, now).map(r => r.subject_ref), ['new', 'listing_1']);
    assert.equal(readObservations(store, 'usr_a', { kind: 'price', site: 'poshmark', product_id: 'pr_a', subject_ref: 'new', query: 'camera' }, now).length, 1);
    assert.equal(readObservations(store, 'usr_a', { site: undefined }, now).length, 2);
    assert.deepEqual(readObservations(store, 'usr_b', { product_id: 'pr_a' }, now), []);
    assert.deepEqual(readObservations(store, PUBLIC, {}, now), []);
  });

  check('show and model rights are independent and use_scope does not filter either', store => {
    writeObservations(store, 'usr_a', [row,
      { ...row, subject_ref: 'show_only', may_model: false, rights: { ...row.rights, may_model: false } },
      { ...row, subject_ref: 'model_only', use_scope: 'other_scope', rights: { ...row.rights, may_show: false } },
    ], now);
    assert.deepEqual(readObservations(store, 'usr_a', { purpose: 'model' }, now).map(r => r.subject_ref).sort(), ['listing_1', 'model_only']);
    assert.deepEqual(readObservations(store, 'usr_a', {}, now).map(r => r.subject_ref).sort(), ['listing_1', 'show_only']);
    assert.equal(readObservations(store, 'usr_a', { subject_ref: 'model_only', purpose: 'model' }, now)[0].use_scope, 'other_scope');
  });

  check('model reads require literal true in both stored rights fields', store => {
    writeObservations(store, 'usr_a', [row], now);
    const [saved] = store.rows<ObservationRow>('observation', { user_id: 'usr_a' });
    for (const value of [undefined, false, 'true']) {
      for (const field of ['top', 'evidence']) {
        store.put('observation', { ...saved, id: 'legacy', version: undefined,
          ...(field === 'top' ? { may_model: value } : { evidence: { ...saved.evidence, rights: { ...saved.evidence.rights, may_model: value } } }) });
        assert.deepEqual(readObservations(store, 'usr_a', { purpose: 'model' }, now).map(r => r.id), [saved.id]);
      }
    }
  });

  check('a store failure on the second put rolls the whole batch back', store => {
    const put = store.put;
    let puts = 0;
    store.put = (table, value) => { if (++puts === 2) throw new Error('synthetic write failure'); return put(table, value); };
    assert.throws(() => writeObservations(store, 'usr_a', [row, { ...row, subject_ref: 'second' }], now), /synthetic write failure/);
    assert.deepEqual(readObservations(store, 'usr_a', {}, now), []);
  });

  check('invalid observed_at and mismatched provenance refuse the batch', store => {
    refuses(store, { ...row, subject_ref: 'invalid_time', observed_at: 'not a date' }, 'observed_at');
    for (const data of ['captured', 'live:mercari', 'dataset:', 'unmarked']) {
      refuses(store, { ...row, subject_ref: 'invalid_provenance', data: data as ObservationInput['data'] }, 'data');
    }
  });

  check('nonfinite and cyclic payloads refuse the batch and identify the subject', store => {
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    for (const payload of [{ price_cents: NaN }, { price_cents: Infinity }, { value: 1n }, cyclic]) {
      refuses(store, { ...row, subject_ref: 'invalid_json', payload }, 'payload');
    }
  });

  check('each query and product association is kept while repeats within the scope deduplicate', store => {
    const scopes = [{ query: 'camera' }, { query: 'camera body' }, { query: 'camera', product_id: 'pr_camera' },
      { query: 'camera', product_id: 'pr_other_camera' }];
    for (const scope of scopes) {
      const scoped = { ...row, ...scope };
      assert.deepEqual(writeObservations(store, 'usr_a', [scoped], now), { written: 1, skipped: 0 });
      assert.deepEqual(writeObservations(store, 'usr_a', [scoped], now), { written: 0, skipped: 1 });
    }
    assert.equal(readObservations(store, 'usr_a', { query: 'camera body', purpose: 'model' }, now).length, 1);
    assert.equal(readObservations(store, 'usr_a', { product_id: 'pr_camera', purpose: 'model' }, now).length, 1);
    assert.equal(readObservations(store, 'usr_a', { product_id: 'pr_other_camera', purpose: 'model' }, now).length, 1);
  });
}
