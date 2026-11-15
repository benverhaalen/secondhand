-- param (spec section 3; row shape app/src/engines/param/row.json). user_id is set exactly when scope.person is set.
create table param (
  id bigint generated always as identity primary key,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  scope jsonb not null default '{}' check (jsonb_typeof(scope) = 'object' and scope - 'kind' - 'site' - 'segment' - 'state' - 'person' = '{}'),
  family text not null check (family in ('scalar', 'beta', 'normal', 'gamma', 'model_ref')),
  value_or_hyperparams jsonb not null,
  prior jsonb,
  version integer not null default 1,
  fitted_on_ids_hash text,
  n_eff numeric not null default 0,
  metric text,
  held_out_score numeric,
  guard_lo numeric,
  guard_hi numeric,
  status text not null check (status in ('champion', 'challenger', 'retired')),
  frozen boolean not null default false,
  promoted_at timestamptz,
  unique (name, scope, version),
  check (status <> 'challenger' or held_out_score is not null),
  check ((scope ? 'person') = (user_id is not null))
);
create unique index param_one_champion on param (name, scope) where status = 'champion';
alter table param enable row level security;
alter table param force row level security;
create policy param_owner on param
  using (user_id is null or user_id = current_setting('app.user_id', true))
  with check (user_id is null or user_id = current_setting('app.user_id', true));
