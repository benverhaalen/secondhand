-- Lakebase (Postgres 16) schema, spec/product.md section 3. Only db-1 writes this folder.
-- Conventions, all tables:
--  * id text, prefixed per section 7 where it names a prefix; user_id; created_at; updated_at; version (bumped by trigger on every update).
--  * MONEY: a field spec'd as {amount_cents, currency} is ONE jsonb column carrying the spec's own name (floor_cents, price_cents, ...).
--    Never a bare number. Arithmetic on money is plain code in the app, never in SQL.
--  * Times are timestamptz (UTC). Spec fields that are json are jsonb.
--  * Person tables: user_id not null, row security forced, policy user_id = current_setting('app.user_id', true).
--    The API is one service principal and runs SET LOCAL app.user_id in each transaction (spec section 6, Tenant isolation).
--    An unset setting reads and writes nothing.
--  * Shared tables (no person, or pooled with no buyer identity): user_id nullable, no row security.
--  * Delta-only entities (comp, citation, observation, ...) and D entities only "read into L" are not here.
create function bump_row() returns trigger language plpgsql as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
