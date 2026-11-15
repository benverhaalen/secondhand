CREATE OR REFRESH STREAMING TABLE sold_raw
COMMENT 'Frozen public market CSV rows, with source file and ingestion time; all source cells remain strings.'
AS SELECT *, _metadata.file_path AS source_file, current_timestamp() AS ingested_at
FROM STREAM read_files(
  '/Volumes/secondhand/raw/landing/sold/*/rows.csv.gz',
  format => 'csv',
  header => true,
  schema => 'row_id STRING, source STRING, licence STRING, site STRING, url STRING, kind STRING, product_id STRING, family_id STRING, cluster_id STRING, brand STRING, category STRING, condition STRING, size STRING, era STRING, title STRING, photo_count STRING, seller_feedback STRING, price_type STRING, price_cents STRING, buyer_shipping_cents STRING, listed_at STRING, at STRING, best_offer STRING, views STRING, watchers STRING, may_model STRING, at_ask STRING, priced_from_our_number STRING, description STRING, retail_cents STRING, released_at STRING, region STRING'
);
