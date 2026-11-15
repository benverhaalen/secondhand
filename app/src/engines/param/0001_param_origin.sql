-- Old observations copied the fitted score, and fits could omit their ids hash.
-- Those rows cannot be classified from the existing schema without the job/event ledger.
do $$
begin
  if exists (select 1 from param where status <> 'challenger' and fitted_on_ids_hash is null and held_out_score is not null) then
    raise exception 'ambiguous param history: classify hashless promoted rows using the fit/event ledger before migrating';
  end if;
end $$;

alter table param add column origin text not null default 'fit' check (origin in ('event', 'fit'));
alter table param add column previous_version integer;
alter table param add column keep double precision check (keep >= 0 and keep <= 1);
update param set origin = 'event' where status <> 'challenger' and fitted_on_ids_hash is null and held_out_score is null;

with history as (
  select name, scope, version, lag(version) over (partition by name, scope order by version) as previous_version
  from param where promoted_at is not null
)
update param p set previous_version = h.previous_version from history h
where p.name = h.name and p.scope = h.scope and p.version = h.version;
-- Historical events have no recorded decay override. keep_evidence explicitly refuses them.
