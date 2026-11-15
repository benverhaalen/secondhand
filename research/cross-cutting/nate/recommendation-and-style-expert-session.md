# What must the recommendation and style engine determine, by what method, and what will break it?
Researched 2026-11-14 by Nate (Claude Opus 5.5, expert-session agent). Feature: cross-cutting (spec/engines/recommendation-and-style.md).

Lens: a recommender-systems lead at a fashion resale marketplace paired with a personal stylist's view of size, fit and taste, checked against how a full-time reseller actually buys and sells. Source jobs: *implementation mechanism* (papers) and *evidence* (what the papers measured). Marks: *observed* = opened at the cited place; *asserted* = from memory, unopened; *inferred* = this note's reasoning.

What was opened: Joachims, Swaminathan and Schnabel, "Unbiased Learning-to-Rank with Biased Feedback" (arXiv 1608.04468, abstract); Sembium, Rastogi, Saroop and Merugu, "Recommending Product Sizes to Customers" (RecSys 2017, page 1); a search result page for Misra, Wan and McAuley 2018 (RecSys 2018, pp. 422-426, not the paper). Everything else below marked asserted was not opened in this session.

## (a) Everything to determine, item by item against §1

| # | Determination | Fixed or learned |
|---|---|---|
| S1 | Facets of the profile (brand, category, size, colour, era, price_band), each with value, weight, `from`, count and recipient | arithmetic over events, learned source weights |
| S2 | Which events are taste evidence at all (a purchase to resell, a gift, an item sold are not plainly taste) | rules, **missing** |
| S3 | Size per (category, recipient), and how a label size maps across brands | arithmetic, **brand mapping missing** |
| S4 | Edits, removals, returns and reset, and what each clears | rules |
| S5 | The For you shelf: candidate set, score, diversity caps, reasons | arithmetic, later a learned ranker |
| S6 | The order inside a delivered-total band | arithmetic |
| S7 | Alerts: the bar and how many | rules |
| S8 | Cheaper alternatives for this person | arithmetic over M17 |
| S9 | What to sell now among owned items | arithmetic over forecasts |
| S10 | What "passed over" means and how much it moves a facet | learned per person |
| S11 | Source weights and ranker: refit, promotion, rollback | learned, pooled |
| S12 | Cold start: what For you shows with no facets | **missing** |
| S13 | Isolation: which numbers are per person, which pooled, and that no referral reaches order or candidate set | fixed |

## (b) Best method for each, with sources

**S1 affinity.** Decayed weighted counts with shrinkage `a / (a + 2)` is a transparent stand-in for implicit-feedback confidence weighting (Hu, Koren and Volinsky 2008, confidence grows with interaction count) (*asserted*). Right choice here: every weight is a readable reason and a profile reruns from events (*inferred*). Arithmetic in the worked example rechecked: `0.25 + 0.96 + 1.6 = 2.81`, `2.81 / 4.81 = 0.584`; listing `1.64 x 0.9 x 1.1 = 1.62`; `sell_now = 0.12 x 1.2 = 0.144` (*observed*, recomputed).

**S2 which events are taste.** Sembium et al. name "multiple personas": accounts shop for spouses, children and gifts, and sizes must be separated per persona (*observed*, RecSys 2017 p. 243). The doc only splits by recipient when the "for whom" slot is filled. Reseller practice: a purchase made to resell is sourcing, not taste, and a person clearing their closet sells exactly what no longer suits them (*asserted*, reseller practice). Method, *inferred*: a purchase that is listed within 30 days counts as sourcing (taste 0, size 0); an item sold counts 0 for taste and 0 for current size (the doc gives 0.2 and 0.4); a purchase in a size more than one step from the person's mode without a recipient goes to an "unassigned" bucket until a second event confirms it.

**S3 size.** Sembium et al.: label sizes vary by brand (their example, Reebok 6 = 15 cm and Nike 6 = 16 cm), and they model latent "true sizes" for customer and product learned from purchase and return outcomes Small / Fit / Large (*observed*, p. 243). Misra et al. 2018 decompose fit semantics with metric learning and released two public fit datasets (ModCloth and RentTheRunway) (*asserted*; the search page names the venue and pages, the paper was not opened). Method for us, *inferred*: keep the doc's mode-share rule as the shown facet, and add a per-(brand, category) size offset pooled over opted-in people who own the same brand and another brand in the same category; a measured garment dimension from watch beats both (already in the doc). Resale has no return signal; "kept over 90 days" is the nearest Fit label and "sold within 60 days of buying" a weak not-fit label. Children's sizes move with age: for a child recipient, a size decays in months, not per year, and the facet steps up when new events do.

**S5 and S10 exposure and position bias.** Joachims et al.: "position bias in search rankings strongly influences how many clicks a result receives", corrected by propensity weighting with a click model as the propensity estimator (*observed*, arXiv 1608.04468 abstract). The doc's "shown 10 times without a tap" counts served impressions, so an item always at slot 30 of a 40-card shelf is "passed over" because it was never seen (*inferred*). Method: count an impression only when the card was on screen for at least about 1 s, and weight each by `1 / propensity(position)` estimated from position randomisation on a small share of shelves (swap adjacent pairs) (*inferred*, the Joachims method). Liang et al. 2016 model exposure separately from preference (*asserted*). Keep the doc's floor of 0.5 and "never removes": it stops the feedback loop where a down-weighted facet is shown less and can never recover (*inferred*); add an exploration slot (one card in 10 from a facet under 0.7) so passed-over facets can be re-tested.

**S11 evaluation.** Held-out last 20% of saves by time is the right split, and a popularity baseline is the right bar (Dacrema, Cremonesi and Jannach 2019 found many neural recommenders lost to tuned simple baselines; Krichene and Rendle 2020 showed sampled metrics can reverse rankings, so rank against all 600 listings, never a sample) (*asserted* both). Twenty histories is a small proof: a bootstrap over 20 people gives wide intervals; resample by person, not by save, or the interval is too narrow (*inferred*). The saves were made on shelves an earlier ranker chose, so the held-out set favours whatever ranked them; say so in the result (*inferred*).

**S12 cold start.** Marketplaces fall back to popular items at cold start (*asserted* in the doc §7). Stylist practice: ask three things first (sizes per category, two brands they like, a price band), as a style quiz does (*asserted*, Stitch Fix's onboarding quiz from memory). Method: with no facet passing the 3-events rule, For you shows wants and `you_said` slots only, then popular-in-their-size; never a shelf from one event (*inferred*).

**S4 and S13 user control and isolation.** Edit, remove, return-with-reason and reset match the transparent, scrutable-profile line of work (Kay's scrutable user models; Balog, Radlinski and Arakelyan 2019 on transparent, scrutable recommendations) (*asserted*). What a reset must clear is unstated: facets get `removed_at`, but the passed-over posteriors, the cached shelf and the alert bar are left (*observed* absence, doc §3 step 4 and §4). Isolation: the nightly fold is pooled over opted-in people, which is fine for source weights, but with 20 histories a "pooled" kind can be one person's numbers; a kind should read pooled weights only when it has at least 5 people (*inferred*). Per-person rows (facets, Beta posteriors, `for_you` cache, alert bar) are keyed by person and recipient; nothing per person is a feature of the ranker (*observed*, doc §3 step 10 lists features with no person id).

**Referral invariance.** The doc's byte-identical test covers order (*observed*, §9 test 1). Order can be identical while the candidate set differs: if referral-bearing sources (official retail) are crawled more often they are fresher, more often "live", and fill more slots; a referral badge on a card would raise taps, which then train the ranker (*inferred*). Test the candidate set and the training labels as well as the order.

## (c) What the doc misses or gets wrong, and what is most likely to break each task

Misses and errors (*inferred* unless marked):
1. No rule for sourcing purchases, gifts without a recipient, or items sold as taste; a reseller's profile becomes their inventory.
2. One size per category ignores brand sizing (*observed* in Sembium et al.) and children growing.
3. Passed over counts unseen cards; no position correction and no exploration.
4. No cold-start shelf.
5. Reset does not say it clears posteriors, cache and alert bar.
6. Alert bar at the shelf's 90th percentile is relative: a weak shelf makes weak matches alert. Add an absolute floor and a per-person daily cap.
7. Referral test checks order only, not candidates or training labels.
8. Twenty histories from the team's own accounts: the person is the bootstrap unit; and the team's own taste is a narrow sample.
9. The plan's breaks are the same two for all six tasks (*observed*, plan.json rs-1..rs-6); most are wrong for the task (rs-4's sell-now has no referral path; "reset clears facets" is rs-2's).

Planted-input tests:
- **Isolation:** two people; A saves 5 Arc'teryx items; B's facets, reasons, cache, alert bar and passed-over posteriors are unchanged byte for byte; a recipient's "size 10 shoes" never shows on the person's own facets; a pooled kind with under 5 people reads the start weights.
- **Referral:** order and the candidate set are identical with referral fields absent, zero, randomised; a listing gaining a referral at 03:00 keeps its slot; the training rows carry no referral or badge field.
- **Taste:** 10 purchases each listed within a week add nothing to taste; an item sold adds nothing to current size.
- **Size:** a person in M for Patagonia and L for a Japanese-sized brand gets both, not a failed 0.7 share; a child's size 8 from a year ago does not hold as the facet after three size-10 orders.
- **Passed over:** a card shown 10 times at slot 35 and never on screen does not lower its facet.
- **Reset:** after reset, the next For you open shows the cold-start shelf, not the cached one, and no alert fires on the old bar.
- **Alerts:** 50 new matching listings in an hour send one batch, capped.

## Diff list against spec/engines/recommendation-and-style.md

- *agent proposal* §2: a purchase listed within 30 days is sourcing (taste 0, size 0); an item sold is 0 for taste and current size.
- *agent proposal* §2 and §3 step 3: a purchase far from the person's size with no recipient waits in an unassigned bucket until confirmed.
- *agent proposal* §3 step 3: add a pooled per-(brand, category) size offset; a child recipient's size decays in months and steps up.
- *agent proposal* §4 passed over: count only on-screen impressions, weight by inverse position propensity, and keep one exploration card in 10.
- *agent proposal* §3: a cold-start shelf from wants, `you_said` slots and popular in their size; never a shelf from one event.
- *agent proposal* §3 step 4: reset also clears passed-over posteriors, the `for_you` cache and the alert bar.
- *agent proposal* §3 step 7: an absolute alert floor and a per-person daily cap beside the 90th-percentile bar.
- *agent proposal* §4: a kind reads pooled weights only with at least 5 opted-in people.
- *agent proposal* §8 and §9 test 1: referral invariance covers the candidate set and the training labels, not only the order.
- *agent proposal* §9 test 4: bootstrap by person; rank against all 600 listings, never a sample.

## Changes to tasks' accepts and breaks (spec/plans/backend/plan.json)

- **rs-1** accepts add: "not: one person's events change another person's facets", "not: a sourcing purchase becomes taste". Breaks replace with: {purchase listed in a week, test_facets.py, no taste}, {two brands two sizes, test_facets.py, both kept}, {child size step, test_facets.py, new size}, {person B after A's events, test_facets.py, unchanged}.
- **rs-2** breaks: keep {reset, facets cleared}; add {reset, test_edits.py, cache and posteriors and alert bar cleared}, {pinned weight after fold, test_edits.py, unchanged}; drop the referral break.
- **rs-3** keep {referral attached, order unchanged}; add {referral attached, test_rank.py, candidate set unchanged}, {no facets, test_rank.py, cold-start shelf}, {50 matches in an hour, test_rank.py, one capped batch}.
- **rs-4** breaks replace with: {hidden forecast, test_sell_now.py, left out and counted}, {alternative off size or removed facet, test_sell_now.py, filtered}; drop the referral and reset breaks.
- **rs-5** accepts add: "not: an unseen card counts as passed over", "not: a pooled kind with under 5 people". Breaks replace with: {slot 35 never on screen, test_learn.py, no change}, {challenger better on train only, test_learn.py, kept out}, {training rows, test_learn.py, no referral field}.
- **rs-6** keep both; add {isolation pair, test_proof.py, byte-identical}, {held-out bootstrap, test_proof.py, resampled by person}.
