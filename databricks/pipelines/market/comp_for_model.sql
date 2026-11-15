CREATE VIEW comp_for_model
COMMENT 'the only table a fit may read (spec/databricks-build.md §7)'
AS SELECT * FROM comp WHERE may_model = true;
