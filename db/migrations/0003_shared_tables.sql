-- Shared tables: no row security.

create table product (
  id text primary key check (id like 'pr_%'),
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  brand text,
  model text,
  variant text,
  gtin text,
  mpn text,
  category text,
  spec jsonb,
  embedding_ref text,
  predecessor_id text,
  family_id text,
  merged_into text
);
create trigger product_bump before update on product for each row execute function bump_row();

create table experiment (
  id text primary key check (id like 'ex_%'),
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  site text,
  category text,
  factor text,
  arms jsonb not null default '[]',
  state text not null check (state in ('suggested', 'chosen', 'running', 'ended')),
  started_at timestamptz,
  ended_at timestamptz,
  budget jsonb
);
create trigger experiment_bump before update on experiment for each row execute function bump_row();

create table arm (
  id text primary key check (id like 'arm_%'),
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  experiment_id text not null,
  design text not null check (design in ('matched_pair', 'before_after')),
  variant jsonb,
  listing_ids jsonb not null default '[]',
  exposures integer,
  outcome jsonb,
  posterior jsonb
);
create trigger arm_bump before update on arm for each row execute function bump_row();

create table notice (
  id text primary key check (id like 'nt_%'),
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  kind text not null check (kind in ('ranker_changed', 'listing_stale', 'anomaly', 'value_moved', 'demand_rose')),
  site text,
  category text,
  opened_at timestamptz not null default now(),
  cleared_at timestamptz,
  signals jsonb not null default '[]',
  state text not null default 'open' check (state in ('open', 'cleared'))
);
create trigger notice_bump before update on notice for each row execute function bump_row();

create table visitor (
  id text primary key check (id like 'vi_%'),
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  session_ref text not null,
  first_seen_at timestamptz,
  rate_bucket text,
  referral_ref text
);
create trigger visitor_bump before update on visitor for each row execute function bump_row();

create table route_table (
  id text primary key,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  route_id text not null unique,
  layer text not null check (layer in ('site_protocol', 'engine')),
  site text,
  need text,
  returns jsonb,
  kind text not null check (kind in ('adapter', 'fetch', 'official_api', 'treg_direct', 'treg_routed', 'other_vendor')),
  recipe_ref text,
  fixture_ref text,
  unit_cost numeric,
  success jsonb,
  p50_ms integer,
  p95_ms integer,
  completeness numeric,
  account_risk text check (account_risk is null or account_risk in ('low', 'medium', 'high')),
  breaker text not null default 'closed' check (breaker in ('closed', 'open', 'half_open')),
  freshness jsonb,
  coverage jsonb
);
create trigger route_table_bump before update on route_table for each row execute function bump_row();

create table route_truth (
  id text primary key,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  route_id text not null,
  checked_at timestamptz not null,
  agreed boolean,
  basis jsonb
);
create trigger route_truth_bump before update on route_truth for each row execute function bump_row();

create table adapter_release (
  id text primary key,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  site text not null,
  verb text not null,
  status text not null check (status in ('candidate', 'live', 'retired', 'rolled_back')),
  gate jsonb,
  canary_calls integer,
  released_at timestamptz
);
create trigger adapter_release_bump before update on adapter_release for each row execute function bump_row();

create table family_band (
  id text primary key,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  family_or_category text not null,
  condition text,
  p10 numeric,
  p90 numeric,
  count integer,
  as_of timestamptz
);
create trigger family_band_bump before update on family_band for each row execute function bump_row();

create table script_print (
  id text primary key,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  print text not null unique,
  distinct_sellers integer,
  distinct_buyers integer
);
create trigger script_print_bump before update on script_print for each row execute function bump_row();

create table extractor_schema (
  id text primary key,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  template_key text not null,
  schema jsonb not null,
  missing_field_rate numeric,
  unique (template_key, version)
);
create trigger extractor_schema_bump before update on extractor_schema for each row execute function bump_row();

create table offer_outcome (
  id text primary key,
  user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  conversation_id text,
  item_id text,
  site text,
  round integer,
  side text,
  offer jsonb,
  ask jsonb,
  counter jsonb,
  response text not null check (response in ('accepted', 'countered', 'declined', 'expired', 'walked')),
  final_price jsonb,
  ms_to_response integer
);
create trigger offer_outcome_bump before update on offer_outcome for each row execute function bump_row();

