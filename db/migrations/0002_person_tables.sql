-- Person tables: row security on user_id.

create table "user" (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  email_ref text,
  locale text,
  currency text,
  timezone text,
  disclosure_pref text,
  target_profit_cents jsonb,
  notification_pref jsonb not null default '[]',
  experiments_consent boolean not null default false,
  tutorial_seen boolean not null default false,
  check (user_id = id)
);
create trigger user_bump before update on "user" for each row execute function bump_row();
create index user_user_idx on "user" (user_id);
alter table "user" enable row level security;
alter table "user" force row level security;
create policy user_owner on "user" using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table account (
  id text primary key check (id like 'acc_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  site text not null check (site in ('ebay', 'facebook', 'depop', 'poshmark', 'mercari', 'offerup', 'grailed', 'email')),
  route text not null check (route in ('harness', 'search_only', 'email')),
  health text not null default 'ok' check (health in ('ok', 'expiring', 'broken', 'paused')),
  capabilities jsonb,
  linked_at timestamptz,
  token_ref text,
  export_mark text not null default 'none' check (export_mark in ('none', 'site_required', 'retouched'))
);
create trigger account_bump before update on account for each row execute function bump_row();
create index account_user_idx on account (user_id);
alter table account enable row level security;
alter table account force row level security;
create policy account_owner on account using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table item (
  id text primary key check (id like 'it_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  state text not null check (state in ('capturing', 'researching', 'review', 'live', 'stale', 'sold', 'handed_over', 'done', 'unsold', 'kept', 'returned', 'disputed', 'failed', 'owned')),
  product_id text,
  title text,
  category text,
  cost jsonb,
  origin text not null check (origin in ('capture', 'purchase', 'import', 'folder')),
  kept_reason text,
  location jsonb,
  quantity integer not null default 1 check (quantity >= 1),
  group_id text,
  seller_sku text,
  note text
);
create trigger item_bump before update on item for each row execute function bump_row();
create index item_user_idx on item (user_id);
alter table item enable row level security;
alter table item force row level security;
create policy item_owner on item using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table capture (
  id text primary key check (id like 'cap_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  item_id text,
  state text not null check (state in ('framing', 'shooting', 'uploading', 'judging', 'judged')),
  mode text not null check (mode in ('shots', 'scan', 'talk')),
  coverage jsonb,
  depth_ref text,
  pose_ref text,
  masks_ref text,
  read_text_ref text,
  kept_raw boolean not null default false,
  type text,
  suggested_type text,
  process jsonb not null default '[]'
);
create trigger capture_bump before update on capture for each row execute function bump_row();
create index capture_user_idx on capture (user_id);
alter table capture enable row level security;
alter table capture force row level security;
create policy capture_owner on capture using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table photo (
  id text primary key check (id like 'ph_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  capture_id text,
  role text not null check (role in ('front', 'back', 'tag', 'care_label', 'fabric', 'detail', 'side', 'inside', 'sole', 'flaw', 'spin', 'screenshot', 'studio')),
  file_ref text,
  parent_photo_ids jsonb not null default '[]',
  exif_stripped boolean not null default false,
  use text not null check (use in ('real', 'improved')),
  ai_marked boolean not null default false,
  step text,
  quality jsonb
);
create trigger photo_bump before update on photo for each row execute function bump_row();
create index photo_user_idx on photo (user_id);
alter table photo enable row level security;
alter table photo force row level security;
create policy photo_owner on photo using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table attribute (
  id text primary key check (id like 'att_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  item_id text not null,
  name text not null,
  value jsonb,
  unit text,
  source text,
  confidence numeric check (confidence between 0 and 1),
  evidence jsonb not null default '[]',
  method text,
  at timestamptz,
  confirmed boolean not null default false,
  unknown_reason text
);
create trigger attribute_bump before update on attribute for each row execute function bump_row();
create index attribute_user_idx on attribute (user_id);
alter table attribute enable row level security;
alter table attribute force row level security;
create policy attribute_owner on attribute using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table job (
  id text primary key check (id like 'job_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  kind text not null,
  item_id text,
  stages jsonb not null default '[]',
  state text not null check (state in ('queued', 'running', 'done', 'failed')),
  result jsonb,
  error jsonb,
  trace_id text,
  account_id text,
  event_id text,
  idempotency_key text not null,
  paused text check (paused is null or paused = 'account_stale'),
  unique (user_id, idempotency_key)
);
create trigger job_bump before update on job for each row execute function bump_row();
create index job_user_idx on job (user_id);
alter table job enable row level security;
alter table job force row level security;
create policy job_owner on job using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table valuation (
  id text primary key check (id like 'val_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  item_id text,
  match_id text,
  capture_id text,
  url_ref text,
  per_site jsonb not null default '[]',
  level integer check (level in (1, 2, 3)),
  drivers jsonb not null default '[]',
  max_pay_cents jsonb,
  max_pay_citation_id text,
  verdict text,
  "check" text,
  job_id text,
  check (num_nonnulls(item_id, match_id, capture_id, url_ref) = 1)
);
create trigger valuation_bump before update on valuation for each row execute function bump_row();
create index valuation_user_idx on valuation (user_id);
alter table valuation enable row level security;
alter table valuation force row level security;
create policy valuation_owner on valuation using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table strategy (
  id text primary key check (id like 'st_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  item_id text not null,
  site text not null,
  state text not null check (state in ('suggested', 'chosen', 'running', 'ended')),
  verdict text check (verdict is null or verdict in ('list', 'skip')),
  skip_reason text check (skip_reason is null or skip_reason in ('site_bars_category', 'recall_or_legal_flag', 'not_connected', 'fit_avoid', 'negative_value')),
  objective text check (objective is null or objective in ('quick', 'balanced', 'max_return')),
  price_path jsonb not null default '[]',
  floor_cents jsonb,
  horizon_days integer check (horizon_days in (7, 30, 90)),
  offers_on boolean,
  list_at timestamptz,
  title_form text,
  photo_order jsonb,
  attributes_to_fill jsonb not null default '[]',
  category_id text,
  shipping jsonb
);
create trigger strategy_bump before update on strategy for each row execute function bump_row();
create index strategy_user_idx on strategy (user_id);
alter table strategy enable row level security;
alter table strategy force row level security;
create policy strategy_owner on strategy using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table listing (
  id text primary key check (id like 'ls_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  item_id text not null,
  site text not null,
  state text not null check (state in ('none', 'posting', 'live', 'postFailed', 'delisting', 'delisted', 'delistFailed')),
  price_cents jsonb,
  url text,
  external_ids jsonb not null default '[]',
  sku text,
  draft jsonb,
  posture numeric check (posture between 0 and 1),
  overrides jsonb,
  interest jsonb,
  posted_at timestamptz,
  last_read_back_at timestamptz,
  next_check_at timestamptz
);
create trigger listing_bump before update on listing for each row execute function bump_row();
create index listing_user_idx on listing (user_id);
alter table listing enable row level security;
alter table listing force row level security;
create policy listing_owner on listing using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table conversation (
  id text primary key check (id like 'cv_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  site text not null,
  site_thread_id text not null,
  item_id text,
  listing_id text,
  match_id text,
  buyer_ref_hash text,
  role text not null check (role in ('sell', 'buy')),
  intent_last text,
  state text not null check (state in ('open', 'closed', 'blocked')),
  last_read_at timestamptz,
  next_check_at timestamptz
);
create trigger conversation_bump before update on conversation for each row execute function bump_row();
create index conversation_user_idx on conversation (user_id);
alter table conversation enable row level security;
alter table conversation force row level security;
create policy conversation_owner on conversation using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table message (
  id text primary key check (id like 'msg_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  conversation_id text not null,
  actor text not null check (actor in ('user', 'auto', 'counterpart')),
  sent_at timestamptz,
  site_message_id text,
  intent text,
  facets jsonb not null default '[]',
  text_ref text
);
create trigger message_bump before update on message for each row execute function bump_row();
create index message_user_idx on message (user_id);
alter table message enable row level security;
alter table message force row level security;
create policy message_owner on message using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table offer (
  id text primary key check (id like 'of_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  conversation_id text,
  listing_id text,
  direction text not null check (direction in ('in', 'out')),
  amount_cents jsonb,
  you_keep_cents jsonb,
  state text not null check (state in ('open', 'countered', 'accepted', 'declined', 'expired', 'withdrawn')),
  expires_at timestamptz
);
create trigger offer_bump before update on offer for each row execute function bump_row();
create index offer_user_idx on offer (user_id);
alter table offer enable row level security;
alter table offer force row level security;
create policy offer_owner on offer using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table "order" (
  id text primary key check (id like 'ord_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  kind text not null check (kind in ('sale', 'purchase')),
  item_id text,
  listing_id text,
  match_id text,
  site text not null,
  state text not null check (state in ('paid', 'pickup_booked', 'to_ship', 'shipped', 'delivered', 'handed_over', 'claim_window', 'released', 'cancelled', 'return_open', 'dispute_open', 'refunded')),
  price_cents jsonb,
  fees_cents jsonb,
  shipping_cents jsonb,
  payout_cents jsonb,
  money_lines jsonb not null default '[]',
  label jsonb,
  clocks jsonb,
  external_order_id text,
  unique (site, external_order_id)
);
create trigger order_bump before update on "order" for each row execute function bump_row();
create index order_user_idx on "order" (user_id);
alter table "order" enable row level security;
alter table "order" force row level security;
create policy order_owner on "order" using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table sale_receipt (
  id text primary key check (id like 'sr_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  site text not null,
  external_order_id text not null,
  source text not null check (source in ('email', 'poll', 'api')),
  received_at timestamptz,
  raw_ref text,
  unique (site, external_order_id)
);
create trigger sale_receipt_bump before update on sale_receipt for each row execute function bump_row();
create index sale_receipt_user_idx on sale_receipt (user_id);
alter table sale_receipt enable row level security;
alter table sale_receipt force row level security;
create policy sale_receipt_owner on sale_receipt using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table decision (
  id text primary key check (id like 'dec_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  kind text not null,
  item_id text,
  options jsonb not null default '[]',
  suggested text,
  allow_other boolean,
  wait boolean,
  span jsonb,
  widget text,
  widget_props jsonb,
  deadline timestamptz,
  why text,
  state text not null check (state in ('open', 'acting', 'answered', 'failed', 'expired', 'superseded')),
  answered jsonb
);
create trigger decision_bump before update on decision for each row execute function bump_row();
create index decision_user_idx on decision (user_id);
alter table decision enable row level security;
alter table decision force row level security;
create policy decision_owner on decision using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table rule (
  id text primary key check (id like 'ru_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  kind text not null,
  scope text not null,
  state text not null check (state in ('ask', 'eligible', 'auto', 'expired', 'demoted')),
  unedited_approvals integer not null default 0,
  promoted_at timestamptz,
  last_used_at timestamptz
);
create trigger rule_bump before update on rule for each row execute function bump_row();
create index rule_user_idx on rule (user_id);
alter table rule enable row level security;
alter table rule force row level security;
create policy rule_owner on rule using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table limits (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  item_id text,
  floor_cents jsonb,
  always_accept_cents jsonb,
  handover text,
  pickup_windows jsonb not null default '[]',
  saved_spot_ref text,
  ask_every_time boolean not null default false
);
create trigger limits_bump before update on limits for each row execute function bump_row();
create index limits_user_idx on limits (user_id);
alter table limits enable row level security;
alter table limits force row level security;
create policy limits_owner on limits using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table want (
  id text primary key check (id like 'want_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  state text not null check (state in ('active', 'paused', 'ended')),
  text text,
  product_id text,
  intent_id text,
  fit jsonb,
  max_total_cents jsonb,
  sites jsonb not null default '[]',
  schedule jsonb,
  next_check_at timestamptz,
  alert text check (alert is null or alert in ('available', 'under'))
);
create trigger want_bump before update on want for each row execute function bump_row();
create index want_user_idx on want (user_id);
alter table want enable row level security;
alter table want force row level security;
create policy want_owner on want using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table match (
  id text primary key check (id like 'mt_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  state text not null check (state in ('found', 'alerted', 'saved', 'asked', 'offered', 'bought', 'dismissed', 'gone')),
  want_id text,
  source text not null check (source in ('want', 'search', 'for_you')),
  label jsonb,
  site text,
  url text,
  price_cents jsonb,
  seen_at timestamptz,
  valuation_id text
);
create trigger match_bump before update on match for each row execute function bump_row();
create index match_user_idx on match (user_id);
alter table match enable row level security;
alter table match force row level security;
create policy match_owner on match using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table appointment (
  id text primary key check (id like 'ap_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  order_id text,
  kind text not null check (kind in ('pickup', 'ship_by')),
  "window" jsonb,
  place_ref text,
  calendar_ref text,
  state text not null check (state in ('proposed', 'booked', 'done', 'no_show', 'cancelled'))
);
create trigger appointment_bump before update on appointment for each row execute function bump_row();
create index appointment_user_idx on appointment (user_id);
alter table appointment enable row level security;
alter table appointment force row level security;
create policy appointment_owner on appointment using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table goal (
  id text primary key check (id like 'gl_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  month text not null,
  target_cents jsonb,
  target_sales integer,
  unique (user_id, month)
);
create trigger goal_bump before update on goal for each row execute function bump_row();
create index goal_user_idx on goal (user_id);
alter table goal enable row level security;
alter table goal force row level security;
create policy goal_owner on goal using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table label (
  id text primary key check (id like 'lb_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  subject text not null,
  kind text not null check (kind in ('owner_statement', 'observed', 'verified_correction', 'specialist')),
  value jsonb,
  state text not null check (state in ('proposed', 'in_use', 'retired'))
);
create trigger label_bump before update on label for each row execute function bump_row();
create index label_user_idx on label (user_id);
alter table label enable row level security;
alter table label force row level security;
create policy label_owner on label using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table recording (
  id text primary key check (id like 'rec_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  site text not null,
  task text not null,
  steps_ref text,
  recorded_at timestamptz,
  last_ok_at timestamptz,
  fail_count integer not null default 0
);
create trigger recording_bump before update on recording for each row execute function bump_row();
create index recording_user_idx on recording (user_id);
alter table recording enable row level security;
alter table recording force row level security;
create policy recording_owner on recording using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table score (
  id text primary key check (id like 'sc_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  subject_type text not null check (subject_type in ('item', 'listing', 'product', 'match')),
  subject_id text not null,
  axis text not null check (axis in ('financial', 'quality', 'visibility', 'trend')),
  site text,
  value numeric,
  range jsonb,
  citation_id text,
  state text not null check (state in ('shown', 'hidden')),
  hide_reason text,
  model_version text,
  check (state <> 'hidden' or hide_reason is not null)
);
create trigger score_bump before update on score for each row execute function bump_row();
create index score_user_idx on score (user_id);
alter table score enable row level security;
alter table score force row level security;
create policy score_owner on score using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table claim_check (
  id text primary key check (id like 'cc_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  subject text not null,
  claims jsonb not null default '[]',
  verdict text not null check (verdict in ('pass', 'hold', 'abstain')),
  checker_version text
);
create trigger claim_check_bump before update on claim_check for each row execute function bump_row();
create index claim_check_user_idx on claim_check (user_id);
alter table claim_check enable row level security;
alter table claim_check force row level security;
create policy claim_check_owner on claim_check using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table follow (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  target text not null,
  variant text,
  channel text,
  opt_in_at timestamptz,
  first_seen_price_cents jsonb,
  first_seen_at timestamptz,
  last_notified_at timestamptz,
  muted_at timestamptz,
  state text not null check (state in ('active', 'muted', 'ended'))
);
create trigger follow_bump before update on follow for each row execute function bump_row();
create index follow_user_idx on follow (user_id);
alter table follow enable row level security;
alter table follow force row level security;
create policy follow_owner on follow using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table style_profile (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  facets jsonb not null default '[]',
  edited_at timestamptz
);
create trigger style_profile_bump before update on style_profile for each row execute function bump_row();
create index style_profile_user_idx on style_profile (user_id);
alter table style_profile enable row level security;
alter table style_profile force row level security;
create policy style_profile_owner on style_profile using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table intent (
  id text primary key check (id like 'in_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  owner_ref text,
  surface text,
  job_id text,
  want_id text,
  slots jsonb
);
create trigger intent_bump before update on intent for each row execute function bump_row();
create index intent_user_idx on intent (user_id);
alter table intent enable row level security;
alter table intent force row level security;
create policy intent_owner on intent using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table session_lease (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  account_id text not null,
  job_id text,
  taken_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create trigger session_lease_bump before update on session_lease for each row execute function bump_row();
create index session_lease_user_idx on session_lease (user_id);
alter table session_lease enable row level security;
alter table session_lease force row level security;
create policy session_lease_owner on session_lease using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table for_you_cache (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  recipient text,
  shelf jsonb not null default '[]',
  built_at timestamptz
);
create trigger for_you_cache_bump before update on for_you_cache for each row execute function bump_row();
create index for_you_cache_user_idx on for_you_cache (user_id);
alter table for_you_cache enable row level security;
alter table for_you_cache force row level security;
create policy for_you_cache_owner on for_you_cache using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table answer (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  kind text not null,
  slots jsonb,
  protocol_version text,
  facts jsonb not null default '[]',
  found jsonb,
  searched jsonb not null default '[]',
  stage text not null check (stage in ('first', 'late', 'settled', 'gathering')),
  ms jsonb,
  gather jsonb
);
create trigger answer_bump before update on answer for each row execute function bump_row();
create index answer_user_idx on answer (user_id);
alter table answer enable row level security;
alter table answer force row level security;
create policy answer_owner on answer using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table gather_request (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  product text,
  claim text,
  deadline timestamptz
);
create trigger gather_request_bump before update on gather_request for each row execute function bump_row();
create index gather_request_user_idx on gather_request (user_id);
alter table gather_request enable row level security;
alter table gather_request force row level security;
create policy gather_request_owner on gather_request using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table swarm_result (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  product_id text,
  identity jsonb,
  comps jsonb,
  demand jsonb,
  risk jsonb,
  per_site jsonb
);
create trigger swarm_result_bump before update on swarm_result for each row execute function bump_row();
create index swarm_result_user_idx on swarm_result (user_id);
alter table swarm_result enable row level security;
alter table swarm_result force row level security;
create policy swarm_result_owner on swarm_result using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table event (
  id text primary key check (id like 'ev_%'),
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  item_id text,
  actor text not null check (actor in ('user', 'auto', 'site')),
  action text not null,
  why text,
  observed_at timestamptz,
  effective_at timestamptz,
  operation_id text,
  trace_id text,
  undo jsonb,
  undo_of text,
  route text check (route is null or route in ('api', 'replay', 'browser')),
  fell_back boolean,
  ms integer,
  source text,
  site text,
  account_id text,
  payload_ref text,
  dedupe_key text,
  unique (user_id, dedupe_key)
);
create trigger event_bump before update on event for each row execute function bump_row();
create index event_user_idx on event (user_id);
alter table event enable row level security;
alter table event force row level security;
create policy event_owner on event using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

create table outbox (
  id text primary key,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  kind text not null,
  payload jsonb not null default '{}',
  state text not null default 'pending' check (state in ('pending', 'sent', 'failed')),
  event_id text,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  operation_id text,
  unique (user_id, operation_id)
);
create trigger outbox_bump before update on outbox for each row execute function bump_row();
create index outbox_user_idx on outbox (user_id);
alter table outbox enable row level security;
alter table outbox force row level security;
create policy outbox_owner on outbox using (user_id = current_setting('app.user_id', true)) with check (user_id = current_setting('app.user_id', true));

