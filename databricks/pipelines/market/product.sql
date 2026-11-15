CREATE OR REFRESH MATERIALIZED VIEW product
COMMENT 'Product attributes and coverage from public comps; spec holds valuation size and era.'
AS SELECT product_id, any_value(brand) AS brand, any_value(category) AS category,
          any_value(kind) AS kind,
          to_json(named_struct('size', any_value(size), 'era', any_value(era))) AS spec,
          count(*) AS n_rows, count_if(price_type = 'sold') AS n_sold,
          min(at) AS first_at, max(at) AS last_at, collect_set(source) AS sources
FROM comp
GROUP BY product_id;
