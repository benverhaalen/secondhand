# Platform analytics engine: what it must determine, the best method for each, and what will break it
Researched 2026-11-14 by Nate (Claude Opus 5.5, expert session ex-pa). Feature: cross-cutting (insights, list, price).

Professional view taken: a marketplace analytics lead who has run seller stats on eBay, Poshmark, Mercari, Depop and Facebook Marketplace, checked against how a full-time reseller who cross-lists on all five reads them. Reviewed against [spec/engines/platform-analytics.md](../../../spec/engines/platform-analytics.md) §1, §3, §9, §10, Ben's [levers.json](../../list/ben/levers/levers.json) with its reading in [levers-and-signals.md](../../list/ben/levers-and-signals.md) (there is no README beside `levers.json`; that note is its explanation), and pa-1..pa-7 in [spec/plans/backend/plan.json](../../../spec/plans/backend/plan.json). Every change below is *agent proposal*; nothing is Decided.

Marks: *observed* = opened the source and it says so; *asserted* = memory or an unshown claim; *inferred* = my reasoning. "*observed* (levers.json)" means Ben's row says observed with its URL, and I read the row, not the page.

## Sources opened, and the job each does

| Source | Job | What we take |
|---|---|---|
| eBay, Traffic report details (developer.ebay.com/api-docs/sell/static/performance/traffic-report.html) | signal definition, mechanism | `getTrafficReport` by `DAY` or `LISTING` with `listing_ids`, `date_range` and named metrics; the sample day key reads "GMT-07:00", the response carries `startDate`, `endDate`, `lastUpdatedDate` (*observed*). |
| Mercari Help, "What do views and clicks mean?" (mercari.com/us/help_center/article/5001) | signal definition | Views are "the number of times your item was shown across search and buyer feeds"; Clicks are opens; "Views update once a day"; "A blank number means the data has not been processed yet, not that nobody saw your item" (*observed*). |
| lifelines AalenJohansenFitter docs | mechanism | "Treating competing risks as censoring can result in over-estimated cumulative density functions"; Kaplan-Meier with competing risks censored estimates the risk "if all competing risks had been prevented" (*observed*). |
| Ben's levers.json, sites.*.signals (as of 2026-11-15) | signal inventory per site | eBay traffic API: 200 listings and 90 days per call, 730 days back, search impressions "may not have been in view", CTR doc wording inverted; Depop partner API insights: likes_count, bag_count, pending offers, organic and boosted clicks and impressions, up to 60 min late; Poshmark impressions and clicks "not defined by Poshmark", harness only; Facebook Seller app Performance insights: views, clicks, message threads (*observed* (levers.json)). |

Not opened: Poshmark's and Depop's help pages directly, Facebook's Seller app post, eBay's Finances API, any fee page. Those claims carry Ben's marks or *asserted*.

## (a) and (b): what to determine, item by item against §1, and the best method

### 1. Stats of each listing per day (`listing_stat`)

What must be determined: a daily, typed, per-stage row per listing that keeps the site's own word and definition and says how sure it is.

Best method: the spec's normalise rules plus a data-quality flag set on every row, not only where a figure sits beside the site's.
- Definitions the spec has wrong or stale: §2 says Mercari "views and likes from the listing page" (*asserted*); Mercari's own page says views are impressions in search and feeds, and there are clicks too (*observed*). §2 says Facebook gives "nothing"; Ben's row has views, clicks and message threads in the Seller app's Performance insights (*observed* (levers.json)). §2 says Depop shows clicks and impressions only while boosted; the partner API returns organic and boosted (*observed* (levers.json), field names not seen). Map Mercari "views" to the exposure stage and Mercari "clicks" to attention, never "views" to "views" (*inferred*).
- Flags each row carries (a closed list, each a code): `not_reported` (null, never 0); `not_yet_processed` (Mercari blank before the daily update, *observed*; Depop up to 60 min); `counter_reset` (day dropped); `boosted` (Depop and Facebook boost days); `definition_undocumented` (Poshmark impressions and clicks); `not_in_view_possible` (eBay search impressions); `timezone` (eBay days are Pacific in the sample, *observed*, so an eBay "day" and a Poshmark "day" do not align; store the site's day and a UTC window); `late` (`lastUpdatedDate` older than the read); `adapter_frozen`; `harness_read` versus `api_read` (a scraped number fails silently when the page changes) (*inferred* each code; sources as marked).
- Backfill limits: eBay goes 730 days back at 90 days per call (*observed* (levers.json)); harness-read sites have no history, so a listing's stats start the day we first read them. A listing posted before linking has left-truncated stats; its funnel to date must say "since you linked" (the spec says this for offers only) (*inferred*).
- A relist or "sell similar" makes a new listing id on eBay and Mercari, so counters restart at zero; that is not a counter reset on the old listing. Join relists to one item through `item_id`, and keep each listing's stats apart (*inferred*).
- Deleted listings: on harness sites the stats page is gone once a listing is deleted, so the last read is the final value; record `final_read_at` (*inferred*).

### 2. Funnel per listing and per site

What must be determined: stage totals and rates that are honest about different definitions.
Best method: within-site rates only (clicks over impressions on the same site), and a cross-site comparison only through the stages ours to define (offers, messages, sales) and through outcome per exposure-day. The spec has this right (§3 step 3). Add: Ben's five-stage frame (exposure, attention, interest, intent, outcome; *observed* (levers.json) `stages`) as the shared stage names, so pa-1 and the UI use one vocabulary (*inferred*). A Poshmark like is also the audience for Offer to Likers, so like counts on Poshmark measure "waiting for a deal" as much as interest (*inferred*, Ben's reading).

### 3. Kept per sold item, days to sell, sell-through, share of asking

What must be determined: the raw per-site numbers a reseller would compute by hand.
- Days to sell from sold items only is biased short: slow items are still live or were ended (*inferred*). Show the Kaplan-Meier median time to sale with live listings censored, and say "half sell within N days"; the spec's "Sold in 6 to 14 days" must name which it is (*inferred*).
- Cross-listed items: the sale on site A is a competing risk for the listing on B. Treating it as censoring estimates B's time to sale "if all competing risks had been prevented" and over-states the chance of sale (*observed* lifelines). For the per-site cause-specific hazard and the O/E effect that is fine; for any "chance of sale within 30 days" shown to the person on a set of sites, use cumulative incidence (Aalen-Johansen) (*inferred*).
- Kept: eBay pays out in batches, so payout per order needs the per-transaction finance lines, and eBay's ad fee for promoted listings is charged at sale when the buyer clicked an ad within the attribution window (*asserted*). Poshmark keeps a flat fee under $15 and 20% at or above (*asserted*). Facebook local has no fee and no money line at all: sale and price come from the person's tap or our appointment, flag `self_reported` (*inferred*).
- Facebook sold date: local sellers often never mark sold, or mark it days later (*asserted* reseller practice). Days to sell on Facebook must come from our appointment or the person's "sold" tap, never from the listing state alone (*inferred*).
- Sell-through counts an item once (D23's rule, kept); state the window and that it is the reseller's form, sold over sold plus active, for the comparison to Terapeak (*asserted* Terapeak's definition).

### 4. The fair comparison: site effect on sale and price

What must be determined: how much better or worse this person does on site s, for the items they actually put there, with intervals.

Best method: the spec's observed-over-expected Gamma shrinkage is a standardised incidence ratio, equivalent to a Poisson model with D10's cumulative hazard as offset (*inferred*). It is the right first model. What it misses:
- Selection on what D10 cannot see. A reseller puts their best brands and best photos on Poshmark and their bulk on eBay (*asserted* practice). O/E controls only for what D10 knows; the rest lands in `r_s` (*inferred*). The cleanest within-person evidence is the cross-listed item: the same item on two sites at once has item fixed by construction. Make the cross-listed estimate a first-class estimator (a stratified Cox model or a matched-pair conditional likelihood on items live on both sites), not only a sign test for anomalies (*inferred*).
- Cross-listed pairs are not perfectly matched: the reseller prices each site to net the same after fees (the same item at $50 on Poshmark and $40 on Facebook), and posts on different days. Compare at net-of-fee price against fair per site, and count exposure from each listing's own post date (*inferred*).
- D10 leakage: if D10 was fitted with this person's own listings, E_s already holds some of the person's effect and `r_s` shrinks toward 1. Fit E_s from a D10 that leaves the person out, or accept and name the bias (*inferred*).
- Informative ending. A listing the person ended because it was stale is not independent censoring: its hazard was low (*inferred*). Record the end reason (`sold_elsewhere`, `ended_by_person`, `expired`, `removed_by_site`) and test sensitivity: treat `ended_by_person` once as censored and once as a failure-to-sell at that day; show the verdict only when both agree (*inferred*).
- Price effect: `u = log(sold / fair p50)` on sold items only conditions on selling; a site that sells only discounted items looks worse on price and better on sale. Model price and sale jointly in `V`, which the spec does in step 8; keep that, and say in the tap that both come from the same items (*inferred*).
- Multiplicity: a person with 6 categories and 5 sites gets 6 verdicts; at P(best) 0.9 each, a "best" that is chance will appear (*inferred*). Show the count of categories with a verdict and do not let a verdict move D12 unless it holds two nightly folds in a row.

### 5. Verdict per category

The rule (P(best) at least 0.9 and 5 ended listings) is fine as a start. Add the minimum detectable effect: with 5 to 10 ended listings per site, only an effect of about 2x is detectable (*inferred* from Poisson counts of that size). Say "too close to call" plainly most of the time; that is the honest answer for one person.

### 6. Adjusted P_j and keep_j for D12, and add-only exploration

Thompson sampling add-only is right. Costs to name: eBay charges insertion fees beyond the free monthly allotment, and every extra listing is one more to delist on sale, raising the double-sale risk (*asserted* fees; *inferred* risk). The exploration share cap of 0.2 should count those costs per site (*inferred*).

### 7. Site-set holdout

What must be determined: whether picking sites beats listing everywhere.
Best method: randomise at the item level within person (some items get the pick, some get every eligible site), with consent; pool the effect across consenting people in a hierarchical model, since one person rarely has the power (*inferred*). Pre-register the metric (kept per listed item within 30 days, items that never sold counted as $0) and the sample size (*inferred*). Contamination: a buyer who finds the item on a site where it was not listed cannot happen, but a person who re-lists a holdout item by hand on another site breaks the arm; record and analyse as assigned (intention to treat) (*inferred*).

### 8. The site's own figure beside ours

The 10-point gap rule is right for rates. Definitions must match before the gap counts: Posh Stats ship time is over 90 days (*observed* (levers.json)) and from sale to the first carrier scan (*asserted*); ours must use the same window and the same clock, or the flag fires on definition, not on data (*inferred*).

### 9. Promotion return per site (D33)

Boosted exposure is bought exposure. Promotion return needs the boosted days' outcomes against the same listing's unboosted days, or against matched unboosted listings, never the boosted share of total sales (*inferred*). Depop and Facebook report boost results separately (*observed* (levers.json) for Depop; *asserted* for Facebook's Ads Insights).

## (c) What the doc misses or gets wrong, and what will break each task

1. §2's Mercari, Depop and Facebook rows are stale against Ben's observed rows and Mercari's own help page (*observed*).
2. Data-quality flags exist only where our figure sits beside the site's; every row needs them (*inferred*).
3. Day boundaries differ by site; eBay's sample is Pacific (*observed*).
4. Days to sell from sold items only is biased short (*inferred*).
5. Competing risks: censoring at a sale elsewhere is right for hazards, wrong for any shown cumulative chance (*observed* lifelines).
6. O/E cannot remove selection on what D10 does not see; cross-listed items should be an estimator, not only a check (*inferred*).
7. Informative endings by the person are treated as independent censoring (*inferred*).
8. Facebook sales and dates are self-reported (*inferred*).
9. Every pa task in plan.json carries the same two generic accepts and breaks ("site payload missing a field", "cross-listed item"), so most tasks have no break that tests what the task owns (*observed* in plan.json).

Planted-input test ideas:
- Mercari payload with "views" 400 and "clicks" 20: maps to exposure 400 and attention 20, never to views.
- Mercari listing posted today with blank views: `not_yet_processed`, not 0.
- eBay day key at GMT-07:00 next to a Poshmark day: both kept, UTC windows stored, no off-by-one in daily rates.
- Cumulative counter goes 120, 118: day dropped, `counter_reset`.
- eBay relist with a new id: new listing stats from 0, one item.
- Depop boosted day: flagged, outside organic rates.
- Facebook sale with no money line: `self_reported`, kept from the person's tap.
- A jacket live on Poshmark and eBay, sold on Poshmark day 9: eBay listing censored at day 9, absent from unsold and from O_eBay; cumulative incidence used on any shown chance.
- Person ends 5 stale eBay listings: sensitivity run; verdict hidden if it flips.
- Seeded mix: the person sends only premium brands to Poshmark (an unobserved quality term): O/E alone credits Poshmark; the cross-listed estimator does not.
- 6 categories with no true effect: at most the stated number of "best" verdicts over 100 seeds, and none moves D12 on a single fold.
- Exploration on a person at the 0.2 cap: no extra site added.
- Holdout item re-listed by hand on another site: analysed as assigned.
- Posh Stats ship time 1.8 days over 90 days against ours over 30 days: no flag until windows match.

## Diff list against spec/engines/platform-analytics.md

- §2 Signals: Mercari "views" are impressions and clicks are opens; Facebook reports views, clicks and message threads; Depop insights are organic and boosted; cite levers.json for each row. *agent proposal*
- §3 step 1: a closed list of data-quality flags on every `listing_stat` row (not_reported, not_yet_processed, counter_reset, boosted, definition_undocumented, not_in_view_possible, late, adapter_frozen, harness_read, self_reported). *agent proposal*
- §3 step 1: store the site's day and its UTC window; stats on pre-link listings are left-truncated and say "since you linked". *agent proposal*
- §3 step 3: use Ben's five stage names (exposure, attention, interest, intent, outcome). *agent proposal*
- §3 step 4: days to sell is the Kaplan-Meier median with live listings censored; Facebook dates from our appointment or the person's tap. *agent proposal*
- §3 step 5: record end reason; run the `ended_by_person` sensitivity and show the verdict only when both readings agree. *agent proposal*
- §3 step 6: any shown chance of sale across a site set is cumulative incidence (Aalen-Johansen), not `1 - exp(-H)` per site. *agent proposal*
- §3 step 10: cross-listed items become an estimator (stratified or matched-pair) at net-of-fee price, beside O/E. *agent proposal*
- §3 step 9: a verdict moves D12 only after two consecutive folds; show the count of verdicts per person. *agent proposal*
- §3 step 12: item-level randomisation within person, pooled across people, metric and size pre-registered, analysed as assigned. *agent proposal*
- §3 step 13: definitions and windows match before the 10-point flag can fire. *agent proposal*
- §1 D33: promotion return compares boosted days to unboosted days of the same or matched listings. *agent proposal*

## Changes to tasks' accepts and breaks (spec/plans/backend/plan.json)

All seven tasks share one generic pair today; each gets its own.

- **pa-1** accepts: "each site's terms map to the five stages with its definition; every row carries its flags". breaks: {what: "Mercari views and clicks", code: "exposure and attention"}, {what: "blank before daily update", code: "not_yet_processed"}, {what: "counter decreases", code: "counter_reset, day dropped"}, {what: "eBay Pacific day", code: "UTC window stored"}, {what: "relist new id", code: "new listing, same item"}. *agent proposal*
- **pa-2** accepts: "views and likes never summed across sites; days to sell is a censored median". breaks: {what: "sum of views across sites", code: "refused"}, {what: "slow items still live", code: "median not from sold only"}, {what: "Facebook sale without money line", code: "self_reported"}. *agent proposal*
- **pa-3** accepts: "O/E effect and cross-listed estimator both reported; ended_by_person sensitivity". breaks: {what: "sold elsewhere", code: "censored, not unsold"}, {what: "unobserved quality sent to one site", code: "cross-listed estimator not fooled"}, {what: "stale listings ended by person", code: "verdict hidden if it flips"}, {what: "6 null categories", code: "false best within the stated rate"}. *agent proposal*
- **pa-4** accepts: "exploration adds only, under cap; holdout by item, analysed as assigned". breaks: {what: "at cap", code: "no site added"}, {what: "mean-pick site", code: "never removed"}, {what: "holdout item re-listed by hand", code: "kept in its arm"}, {what: "single-fold verdict", code: "D12 unchanged"}. *agent proposal*
- **pa-5** accepts: "flag fires only when definitions and windows match". breaks: {what: "Posh Stats 90 days against our 30", code: "no flag, windows aligned first"}, {what: "true gap over 10 points", code: "data-quality flag"}, {what: "ranker_changed", code: "view stages hidden, sales kept"}. *agent proposal*
- **pa-6** accepts: "promote only on held-out log loss beyond bootstrap noise with 300 ended listings". breaks: {what: "worse challenger", code: "rollback"}, {what: "r_s pushed past 3", code: "clamped, anomaly"}, {what: "adapter bump", code: "rows frozen"}. *agent proposal*
- **pa-7** accepts: "§9 numbers, plus the planted unobserved-quality mix and the null-category run". breaks: {what: "training listings in the held-out 30 days", code: "fail"}, {what: "planted effect not covered in 85 of 100", code: "fail"}. *agent proposal*

## Limits

Opened: eBay's traffic report doc, Mercari's views and clicks help page, lifelines' Aalen-Johansen docs, and Ben's levers.json rows (which cite their own pages). Not opened: Poshmark, Depop and Facebook help pages directly, eBay Finances, any fee page, any crosslister's analytics. Fee and reseller-practice claims are from memory and need a check before they set `param` values.
