CREATE OR REFRESH MATERIALIZED VIEW comp_daily
COMMENT 'Daily price summaries by source, site, kind and price type; undated rows have a null day.'
AS SELECT source, site, kind, price_type, date(at) AS day,
          count(*) AS n, percentile_approx(price_cents, 0.5) AS median_cents,
          min(price_cents) AS min_cents, max(price_cents) AS max_cents
FROM comp
GROUP BY source, site, kind, price_type, date(at);
