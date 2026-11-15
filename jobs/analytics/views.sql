-- platform-analytics §3: site-native definitions stay in separate groups.
CREATE OR REPLACE VIEW listing_stat_metric AS
SELECT user_id, listing_id, site, day, stages, terms, flags
FROM listing_stat;

-- Physical sales, rather than cross-listed copies or replayed orders.
CREATE OR REPLACE VIEW analytics_sale AS
SELECT * FROM (
  SELECT *, row_number() OVER (PARTITION BY user_id, item_id ORDER BY id) AS item_sale_row
  FROM orders WHERE kind = 'sale' AND state NOT IN ('cancelled', 'refunded')
) WHERE item_sale_row = 1;

CREATE OR REPLACE VIEW analytics_kept AS
SELECT user_id, site, count(*) AS sales, count(payout_cents) AS reported_payouts,
       sum(payout_cents - coalesce(outside_cost_cents, 0)) AS kept_cents,
       count(*) - count(payout_cents) AS kept_unknown,
       array_compact(array(
         CASE WHEN count(payout_cents) < count(*) THEN 'not_reported' END,
         CASE WHEN max(estimated) = 1 THEN 'estimated' END
       )) AS flags
FROM (
  SELECT o.user_id, o.id, o.site, o.payout_cents,
         sum(CASE WHEN l.kind IN ('label', 'promotion_spend') THEN l.amount_cents ELSE 0 END) AS outside_cost_cents,
         max(CASE WHEN l.source = 'estimated' THEN 1 ELSE 0 END) AS estimated
  FROM analytics_sale o
  LATERAL VIEW OUTER explode(o.lines) lines AS l
  GROUP BY o.user_id, o.id, o.site, o.payout_cents
) GROUP BY user_id, site;
