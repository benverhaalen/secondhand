-- Run: node databricks/run-sql.mjs databricks/sql/11_sources.sql
-- Rights decisions follow the frozen manifests, sold-datasets.md and Ben's 09:09 call.
-- SQL file tasks split at every statement separator, even inside strings: chr(59) preserves licence punctuation.
CREATE TABLE IF NOT EXISTS secondhand.governance.source_rights (
  source STRING NOT NULL COMMENT 'Frozen dataset or request source name, one rights row per source.',
  may_store BOOLEAN NOT NULL COMMENT 'Whether this build may retain source rows, within ttl_hours.',
  may_model BOOLEAN NOT NULL COMMENT 'Whether this build may fit on the source, within may_model_scope.',
  may_model_scope STRING NOT NULL COMMENT 'none, hackathon_demo, product. A demo decision never clears a shipped model.',
  may_show BOOLEAN NOT NULL COMMENT 'Whether this build may show source data subject to the clause.',
  may_share BOOLEAN NOT NULL COMMENT 'Whether source rows may be redistributed.',
  ttl_hours INT COMMENT 'Retention cap in hours. Zero is request-only. Null records no source-specific cap.',
  clause STRING NOT NULL COMMENT 'Frozen licence and applicable use restriction, including qualifications.',
  clause_url STRING COMMENT 'Original release or licence URL. Null when no licence is recorded.',
  decided_by STRING NOT NULL COMMENT 'Human decision locator, or agent proposal with its evidence.',
  decided_at TIMESTAMP NOT NULL COMMENT 'Recorded decision time. Date-only evidence uses midnight UTC.',
  note STRING COMMENT 'Unresolved permissions and limits on the decision.'
) COMMENT 'Source use rights as data. Demo permissions are separate from clearance for a shipped model (spec/databricks-build.md section 7).';

MERGE INTO secondhand.governance.source_rights AS target
USING (
  SELECT * FROM VALUES
    ('stockx_2019', true, true, 'hackathon_demo', true, false, NULL, concat('StockX Data Contest 2019, released by StockX for public analysis', chr(59), ' no licence stated'), 'https://github.com/sealuwee/stockx-eda-2019/blob/4be02ae9e4bdc8ebc34d90724aec859e5aef3843/StockX-Data-Contest-2019.xlsx', 'Agent proposal, spec/databricks-build.md section 7', '2026-11-15T00:00:00Z', 'No licence is stated. Released for public analysis does not state that a served model may be fitted on it. Demo only.'),
    ('mercari_kaggle', true, true, 'hackathon_demo', true, false, NULL, concat('Kaggle Mercari Price Suggestion Challenge, Specific Rules A: competition use only (public search index, read 2026-11-15)', chr(59), ' used for the hackathon demo on Ben''s call, 2026-11-15 09:09. Specific Rules A: "After your acceptance of these Rules, you may access and use the Competition Data only for the purposes of the Competition."'), 'https://www.kaggle.com/c/mercari-price-suggestion-challenge/rules', 'Ben, product/words.md 2026-11-15 09:09 UTC', '2026-11-15T09:09:00Z', concat('Specific Rules A is indexed primary-source text, read 2026-11-15. Ben allowed this hackathon demo', chr(59), ' this is not clearance for a shipped model.')),
    ('grailed_2021', true, false, 'none', true, false, NULL, concat('third-party scrape, no licence', chr(59), ' Grailed''s terms bar scraping and ML extraction'), 'https://www.grailed.com/about/terms', 'Agent proposal, research/price/ben/sold-datasets.md', '2026-11-15T00:00:00Z', concat('Third-party scrape. No model clearance. Store/show follow the demo pipeline', chr(59), ' not a grant for product use.')),
    ('ebay_comps_cc0', true, false, 'none', true, false, NULL, concat('CC0 1.0 (silentdirectivellc-hub/ebay-sold-comps)', chr(59), ' collected from eBay by a scraping actor'), 'https://github.com/silentdirectivellc-hub/ebay-sold-comps', 'Agent proposal, research/price/ben/sold-datasets.md', '2026-11-15T00:00:00Z', concat('The publisher CC0 claim does not establish marketplace permission. Store/show follow the demo pipeline', chr(59), ' no model clearance.')),
    ('goodwill_cc0', true, false, 'none', true, false, NULL, concat('CC0 1.0 (silentdirectivellc-hub/ebay-sold-comps)', chr(59), ' ShopGoodwill buyer API', chr(59), ' terms (Ownership, License, Acceptable Use) restrict reuse and automated extraction (read 2026-11-15)'), 'https://shopgoodwill.com/about/terms-of-use', 'Agent proposal, research/price/ben/sold-datasets.md', '2026-11-15T00:00:00Z', concat('CC0 publisher claim does not remove ShopGoodwill restrictions. Store/show follow the demo pipeline', chr(59), ' no model clearance.')),
    ('mercari_apify_ccby', true, false, 'none', true, false, NULL, concat('CC BY 4.0, attribution malekoweis/resale-market-data', chr(59), ' collected from Mercari by a scraping actor'), 'https://github.com/malekoweis/resale-market-data', 'Agent proposal, research/price/ben/sold-datasets.md', '2026-11-15T00:00:00Z', concat('Attribution: malekoweis/resale-market-data, CC BY 4.0. Publisher licence does not establish Mercari permission. Store/show follow the demo pipeline', chr(59), ' no model clearance.')),
    ('nber_ebay_bo', true, true, 'hackathon_demo', true, false, NULL, concat('Available for research purposes', chr(59), ' public release cleared by eBay. Cite Backus, Blake, Larsen and Tadelis (2020), QJE. Research use only.'), 'https://back.nber.org/appendix/w24306/bargaining/README.pdf', 'Agent proposal, research/price/ben/sold-datasets.md', '2026-11-15T00:00:00Z', concat('Research backtest only', chr(59), ' no clearance to fit a shipped model.')),
    ('ebay_api', true, false, 'none', true, false, 6, 'Restricted Activities: "Use eBay Content, either alone or in combination with third-party information, to suggest or model prices for items listed on eBay Site."', 'https://developer.ebay.com/develop/apis/api-license-agreement', 'Agent proposal, research/data/nate/data-services-on-marketplace-apis.md', '2026-11-15T00:00:00Z', concat('Six-hour TTL is our expiry policy', chr(59), ' the licence states a display freshness limit. Display separately from non-eBay content. Pricing consent is not recorded. Licence copy URL also recorded in research/cross-cutting/nate/privacy-and-data.md.')),
    ('dupe', false, false, 'none', true, false, 0, concat('Request-only lookup', chr(59), ' no storage or model rights recorded.'), NULL, 'Agent proposal, request-only source policy', '2026-11-15T00:00:00Z', 'not stored past the request')
  AS rights(source, may_store, may_model, may_model_scope, may_show, may_share, ttl_hours, clause, clause_url, decided_by, decided_at, note)
) AS s
ON target.source = s.source
WHEN MATCHED THEN UPDATE SET
  target.may_store = s.may_store,
  target.may_model = s.may_model,
  target.may_model_scope = s.may_model_scope,
  target.may_show = s.may_show,
  target.may_share = s.may_share,
  target.ttl_hours = s.ttl_hours,
  target.clause = s.clause,
  target.clause_url = s.clause_url,
  target.decided_by = s.decided_by,
  target.decided_at = CAST(s.decided_at AS TIMESTAMP),
  target.note = s.note
WHEN NOT MATCHED THEN INSERT (source, may_store, may_model, may_model_scope, may_show, may_share, ttl_hours, clause, clause_url, decided_by, decided_at, note)
VALUES (s.source, s.may_store, s.may_model, s.may_model_scope, s.may_show, s.may_share, s.ttl_hours, s.clause, s.clause_url, s.decided_by, CAST(s.decided_at AS TIMESTAMP), s.note);

CREATE OR REPLACE VIEW secondhand.market.comp_for_product
COMMENT 'Rows cleared by both row and source rights for a shipped model. Today no source is cleared for product use.'
AS
SELECT c.*
FROM secondhand.market.comp c
JOIN secondhand.governance.source_rights r ON c.source = r.source
WHERE c.may_model = true AND r.may_model AND r.may_model_scope = 'product';

CREATE OR REPLACE VIEW secondhand.measures.model_clearance
COMMENT 'Per-source row counts and separate clearance for the demo backtest and a shipped model, with the clause to inspect.'
AS
SELECT r.source, count(c.row_id) AS rows,
       r.may_model AND r.may_model_scope IN ('hackathon_demo', 'product') AS cleared_for_demo_backtest,
       r.may_model AND r.may_model_scope = 'product' AS cleared_for_shipped_model,
       r.clause, r.clause_url
FROM secondhand.governance.source_rights r
LEFT JOIN secondhand.market.comp c ON c.source = r.source
GROUP BY r.source, r.may_model, r.may_model_scope, r.clause, r.clause_url;

-- Genie cannot read a view over system information schema, so it reads this snapshot,
-- refreshed on every governance run from the live view.
CREATE OR REPLACE TABLE secondhand.measures.locks_in_force
COMMENT 'Snapshot of measures.policies_in_force taken at each governance run: core tables, owner tag, masked columns, retention.'
AS SELECT *, current_timestamp() AS read_at FROM secondhand.measures.policies_in_force;
