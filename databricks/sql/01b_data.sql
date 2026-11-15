-- Existing rows were written by the example loader (workspace measurement, 2026-11-15).
-- Run through the setup SQL file task: SQL scripting guards make ADD COLUMNS repeatable.
-- Do not use run-sql.mjs: its line-based splitter does not preserve compound statements.

BEGIN
  IF NOT EXISTS (SELECT 1 FROM secondhand.information_schema.columns
                 WHERE table_catalog = 'secondhand' AND table_schema = 'core'
                   AND table_name = 'observation' AND column_name = 'data') THEN
    ALTER TABLE secondhand.core.observation ADD COLUMNS (data STRING COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).');
  END IF;
END;
ALTER TABLE secondhand.core.observation SET TBLPROPERTIES ('delta.appendOnly' = 'false');
UPDATE secondhand.core.observation SET data = 'example' WHERE data IS NULL;
ALTER TABLE secondhand.core.observation SET TBLPROPERTIES ('delta.appendOnly' = 'true');
ALTER TABLE secondhand.core.observation ALTER COLUMN data SET NOT NULL;

BEGIN
  IF NOT EXISTS (SELECT 1 FROM secondhand.information_schema.columns
                 WHERE table_catalog = 'secondhand' AND table_schema = 'core'
                   AND table_name = 'evidence' AND column_name = 'data') THEN
    ALTER TABLE secondhand.core.evidence ADD COLUMNS (data STRING COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).');
  END IF;
END;
UPDATE secondhand.core.evidence SET data = 'example' WHERE data IS NULL;
ALTER TABLE secondhand.core.evidence ALTER COLUMN data SET NOT NULL;

BEGIN
  IF NOT EXISTS (SELECT 1 FROM secondhand.information_schema.columns
                 WHERE table_catalog = 'secondhand' AND table_schema = 'core'
                   AND table_name = 'citation' AND column_name = 'data') THEN
    ALTER TABLE secondhand.core.citation ADD COLUMNS (data STRING COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).');
  END IF;
END;
UPDATE secondhand.core.citation SET data = 'example' WHERE data IS NULL;
ALTER TABLE secondhand.core.citation ALTER COLUMN data SET NOT NULL;

BEGIN
  IF NOT EXISTS (SELECT 1 FROM secondhand.information_schema.columns
                 WHERE table_catalog = 'secondhand' AND table_schema = 'core'
                   AND table_name = 'guarded_number' AND column_name = 'data') THEN
    ALTER TABLE secondhand.core.guarded_number ADD COLUMNS (data STRING COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).');
  END IF;
END;
UPDATE secondhand.core.guarded_number SET data = 'example' WHERE data IS NULL;
ALTER TABLE secondhand.core.guarded_number ALTER COLUMN data SET NOT NULL;

BEGIN
  IF NOT EXISTS (SELECT 1 FROM secondhand.information_schema.columns
                 WHERE table_catalog = 'secondhand' AND table_schema = 'core'
                   AND table_name = 'claim_check' AND column_name = 'data') THEN
    ALTER TABLE secondhand.core.claim_check ADD COLUMNS (data STRING COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).');
  END IF;
END;
UPDATE secondhand.core.claim_check SET data = 'example' WHERE data IS NULL;
ALTER TABLE secondhand.core.claim_check ALTER COLUMN data SET NOT NULL;

BEGIN
  IF NOT EXISTS (SELECT 1 FROM secondhand.information_schema.columns
                 WHERE table_catalog = 'secondhand' AND table_schema = 'core'
                   AND table_name = 'decision' AND column_name = 'data') THEN
    ALTER TABLE secondhand.core.decision ADD COLUMNS (data STRING COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).');
  END IF;
END;
UPDATE secondhand.core.decision SET data = 'example' WHERE data IS NULL;
ALTER TABLE secondhand.core.decision ALTER COLUMN data SET NOT NULL;

BEGIN
  IF NOT EXISTS (SELECT 1 FROM secondhand.information_schema.columns
                 WHERE table_catalog = 'secondhand' AND table_schema = 'core'
                   AND table_name = 'event' AND column_name = 'data') THEN
    ALTER TABLE secondhand.core.event ADD COLUMNS (data STRING COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).');
  END IF;
END;
UPDATE secondhand.core.event SET data = 'example' WHERE data IS NULL;
ALTER TABLE secondhand.core.event ALTER COLUMN data SET NOT NULL;

BEGIN
  IF NOT EXISTS (SELECT 1 FROM secondhand.information_schema.columns
                 WHERE table_catalog = 'secondhand' AND table_schema = 'core'
                   AND table_name = 'job' AND column_name = 'data') THEN
    ALTER TABLE secondhand.core.job ADD COLUMNS (data STRING COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).');
  END IF;
END;
UPDATE secondhand.core.job SET data = 'example' WHERE data IS NULL;
ALTER TABLE secondhand.core.job ALTER COLUMN data SET NOT NULL;

BEGIN
  IF NOT EXISTS (SELECT 1 FROM secondhand.information_schema.columns
                 WHERE table_catalog = 'secondhand' AND table_schema = 'core'
                   AND table_name = 'storefront_snapshot' AND column_name = 'data') THEN
    ALTER TABLE secondhand.core.storefront_snapshot ADD COLUMNS (data STRING COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).');
  END IF;
END;
UPDATE secondhand.core.storefront_snapshot SET data = 'example' WHERE data IS NULL;
ALTER TABLE secondhand.core.storefront_snapshot ALTER COLUMN data SET NOT NULL;

BEGIN
  IF NOT EXISTS (SELECT 1 FROM secondhand.information_schema.columns
                 WHERE table_catalog = 'secondhand' AND table_schema = 'core'
                   AND table_name = 'log_event' AND column_name = 'data') THEN
    ALTER TABLE secondhand.core.log_event ADD COLUMNS (data STRING COMMENT 'Writer provenance: synthetic, example, dataset:<name> or live:<site>; immutable (spec/product.md section 3).');
  END IF;
END;
UPDATE secondhand.core.log_event SET data = 'example' WHERE data IS NULL;
ALTER TABLE secondhand.core.log_event ALTER COLUMN data SET NOT NULL;
