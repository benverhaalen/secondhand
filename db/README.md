# db

Lakebase (Postgres 16) schema for `spec/product.md` section 3. Conventions (ids, money, row security) are at the top of `migrations/0001_base.sql`.

- Apply: `node db/migrate.mjs --url <postgres url>` (needs `pg`; the test uses PGlite). Pending files run in order, each in one transaction; `schema_migrations` holds filename and sha256, so a rerun changes nothing and an edited applied file is an error. Add changes as a new `NNNN_name.sql`, never edit an applied one.
- Test: `node --test db/migrate.test.mjs` (after `npm install` in `db/`).
- Only task db-1 writes this folder. Another stream that needs a table or column messages the orchestrator.
