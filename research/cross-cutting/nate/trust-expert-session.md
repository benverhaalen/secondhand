# What must the trust engine determine, by what method, and what will break it?
Researched 2026-11-14 by Nate (Claude Opus 5.5, expert-session agent). Feature: cross-cutting (spec/engines/trust.md).

Lens: a trust-and-safety and fraud analyst at a peer-to-peer resale marketplace, checked against how a full-time reseller actually works. Source jobs: *evidence* (official scam and recall pages), *implementation mechanism* (API docs, papers). Marks: *observed* = opened at the cited place; *asserted* = from memory or a source that states without showing, unopened; *inferred* = this note's reasoning.

What was opened: the FTC "How to avoid a scam" page, the CPSC API information page, the CPSC Recall Retrieval Web Services Programmer's Guide v1.4 (2018-09-17, pages 1-5), Poshmark's Posh Protect page, eBay's avoiding-scams help page, and search snippets of Facebook Help Center pages. Not reachable: Elkan 2001 (certificate rejected), a Facebook help page id that returned "This Page Isn't Available". Papers below that are not marked observed were not opened in this session.

## (a) Everything to determine, item by item against §1

§1 decides one action (block, ask, warn, none) per risk for every buyer thread, appointment, listing, weighed purchase and account. Itemised:

| # | Determination | Subject | Fixed or learned |
|---|---|---|---|
| T1 | Is this message a hard-rule scam pattern (code request, overpayment, buyer's label, fake payment link, off-site on checkout, address ask) | message | fixed |
| T2 | The scam score `s` and, after the gate, a calibrated `p` | thread | learned |
| T3 | The loss `L` and friction `F_ask`, hence the action line | thread x listing | arithmetic, learned `delta` |
| T4 | Whether a print is a cross-seller script | message | arithmetic on counts |
| T5 | Whether a percentage may be shown (the gate) | site group | arithmetic |
| T6 | No-show risk `q`, the confirm and ask lines, and when silence means `no_show` | appointment | learned |
| T7 | Account risk per metric against each site's published limit, and the pace limit | account x site | learned `flag_m`, pace |
| T8 | Whether an item matches a recall (exact, name-only, none) at post, daily delta, and buy | listing, draft, weighed purchase | fixed |
| T9 | Counterfeit-prone listing signals (proof photo, price under 0.6 q50, stock image, programme floors) | listing, weighed purchase | fixed plus `param` brand list |
| T10 | Dispute odds per (site, reason, bundle complete) | case | learned |
| T11 | Which labels count, at what weight, and how far one seller can move them | label | fixed rules |
| T12 | Champion vs challenger and rollback | model | learned with guards |
| T13 (missing from §1) | How long buyer data in `trust_signal.evidence_span`, `trust_label.subject_id` and blocks is kept | rows | fixed retention |

## (b) Best method for each, with sources

**T1 hard rules.** The doc's list matches the official lists. FTC: scammers insist on crypto, wire, payment apps or gift cards, and "never deposit a check and send money back to someone" (*observed*, consumer.ftc.gov/articles/how-avoid-scam). Facebook Help: purchase protection does not cover person-to-person or off-site deals, and commerce scammers push to move the conversation to other channels (*observed* in search snippets of facebook.com/help/1674717642789671 and /228307904608701, not the full pages). Poshmark: Posh Protect "does not cover trades or transactions completed off of the Poshmark platform" (*observed*, poshmark.com/posh_protect). Consumer-safety pages describe the code-to-your-phone (Google Voice) scam, buyer-supplied prepaid labels whose destination is changed afterwards, and overpayment-plus-label combinations (*asserted*: secondary sources, Norton, Aura, Vendoo, used only as pointers). **Gap:** the FTC's "pay only by gift card, crypto or wire" is not a hard rule in the doc; on a buyer it shows up as "I'll pay with a gift card / crypto" and should be a hard `off_platform` variant (*inferred*). Method: keep model predicates with evidence spans plus code on URLs; the predicate thresholds tuned for recall on a seeded set (doc §4) is right.

**T2 score.** Per-signal Beta-Binomial likelihood ratios are the Jøsang and Ismail beta reputation system applied to signals instead of agents (*asserted*, Jøsang & Ismail 2002, "The Beta Reputation System", not opened). The 30-day half-life is their forgetting factor. The doc rightly names the weakness: naive likelihood ratios add correlated signals twice, so the nightly L2 logistic with a Gaussian prior centred on card 5 is the right challenger (*inferred*). Calibration: isotonic regression needs on the order of a thousand-plus examples to beat Platt scaling, and overfits small sets (*asserted*, Niculescu-Mizil & Caruana 2005, not opened). With a 300-thread / 30-positive gate per group, isotonic will be step-shaped and unstable; use Platt (one slope, one intercept) until a group has about 1,000 resolved threads, then isotonic (*inferred*).

**T3 cost-sensitive gate.** The ask line `p · L · (1 - m) >= (1 - p) · F` is Elkan's optimal threshold `p* = c10 / (c10 + c01)` with the item's loss in the cost matrix (*asserted*, Elkan 2001, "The Foundations of Cost-Sensitive Learning"; the PDF was not reachable). That threshold is only optimal on calibrated `p`; before the gate the doc treats `p` as a score, which is honest as long as no claim of optimality is made before the gate (*inferred*). Check of the doc's arithmetic: `F_ask(300) = 1.00 + 0.0538 · 300 = 17.14`, `ln(17.14 / 270) = -2.757`, line `s = 1.24` (*observed*, recomputed here).

**T4 script fingerprinting.** 64-bit SimHash with Hamming-distance near-duplicate lookup is Charikar 2002 and Manku, Jain and Das Sarma 2007 (k = 3 at 64 bits for web pages) (*asserted*, not opened). Normalisation is the whole method: lowercase, strip URLs, numbers, prices, emails, item titles and the person's name, so a template with the item substituted collides (*inferred*). Two faults in the doc, both *inferred*: (1) Facebook's prefilled "Is this still available?" (*asserted*, from memory of the product) and other one-line openers will hit "3 buyers to 3 sellers in 7 days" within minutes; exclude prints of messages under about 8 normalised tokens and a stop-list of site prefills. (2) The salt rotates monthly but the window is 7 days, so on rotation day every count resets; keep the old salt's counts for 7 days and look up under both.

**T6 no-show.** Logistic with card 6 priors and a `Beta(1,4)` base is fine. Reseller practice (*asserted*, from how full-time resellers run local sales): a confirm message the morning of, not only 2 h before; never hold an item without a deposit or a firm time; meet in a public safe-exchange spot. The doc's 15-minute silence rule should read the person's own "on my way" or "here" taps first, so a late buyer who messaged is not labelled (*inferred*).

**T7 account health.** Ratio-to-published-threshold with a learned `flag_m` is right. Poshmark's 3% / 90 days is in the doc. eBay's seller standards (transaction defect rate, late shipment rate, cases closed without seller resolution) have published thresholds per level (*asserted*, eBay seller performance standards, not opened this session). eBay's own help says avoiding eBay fees "can invite fraud and risk" and may lead to limits on buying and selling (*observed*, ebay.com/help/account/protecting-account/avoiding-scams?id=4214). Pace: `Beta(1,99)` per bucket with a 95% upper bound under 1% is a sound conservative bound (*inferred*).

**T8 recall.** The CPSC API (*observed*, Programmer's Guide v1.4 pp. 1-5):
- Root `https://www.saferproducts.gov/RestWebServices/Recall`, XML default, `format=json`.
- Search fields include `RecallDateStart`, `RecallDateEnd`, `LastPublishDateStart`, `LastPublishDateEnd`, `ProductName`, `UPC`, `Manufacturer`; search is case-insensitive wildcard.
- "Any attempt to use made-up search parameters ... will retrieve ALL existing recall records", over 8,000 as of 2018. A plain GET without parameters returned a body over 10 MB in this session (*observed*).
- Each record has `Products` (Name, Description, Model, Type, CategoryID, NumberOfUnits) and `ProductUPCs`. In the guide's own example record, `Model` is empty and `ProductUPCs` is empty, while the model numbers and date codes sit only in the free-text `Description` ("Model Number ... 10AW1G-AQU2U ... date of manufacture ... March 25, 2015 through March 9, 2016").
- Method, *inferred* from the above: (1) pull the delta by `LastPublishDateStart` (updated and republished recalls), not by `RecallDate`; (2) extract model tokens and date-code ranges from `Title` and `Description` with a regex plus the card 1 model, and keep `Products.Model` and `ProductUPCs` as bonus fields; (3) normalise GTINs to GTIN-14 (UPC-A 12, EAN-13 and a stripped leading zero must match); (4) reject any response whose row count is far above the expected delta (the wrong-parameter-returns-everything trap); (5) CPSC is not the only regulator: car seats and tyres are NHTSA, food and cosmetics FDA (*asserted*); name that the feed covers CPSC only. Selling a recalled consumer product is unlawful under the CPSA, and CPSC applies that to resale (*asserted*, 15 U.S.C. 2068(a)(2)(B) and CPSC's resale guidance, not opened).

**T9 counterfeit.** The doc's "describe the listing, never the item" stance is right. Method fine.

**T10 disputes.** `Beta(1,1)` per (site, reason, bundle complete) is fine; report counts beside rates (*inferred*).

**T11 poison cap.** Per-seller share caps are the standard Sybil-limiting move in reputation systems (*asserted*). The doc caps "positive weight" only (*observed*, trust.md §4 Labels). **Fault (inferred):** the Ignore label (scam 0, weight 0.3) and "local pickup marked done" (scam 0, 0.7) are negatives a single seller can stack; 500 Ignores lower a signal's weight for everyone. Cap both sides. Also cap per buyer subject: many sellers can be one person with several accounts; cap by the person's device or payout identity where the adapter has it.

**T13 retention.** The doc stores `evidence_span` (buyer text) with no retention, and `trust_label.subject_id` with no statement of what it is (*observed*, trust.md §1 schema). Method, *inferred*: `subject_id` for a buyer is a salted hash of (site, buyer handle), salted per person, so one person's block never names a buyer to anyone else; `evidence_span` is kept until the thread is resolved plus the claim window, then replaced by the predicate name; any phone, email or address inside a span is masked before storage. Only prints, signal booleans and labels feed shared learning.

## (c) What the doc misses or gets wrong, and what is most likely to break each task

Misses and errors (*inferred* unless marked):
1. Recall matching on `Model` or `ProductUPCs` alone misses records like the guide's example, where both are empty (*observed* in the example record). The daily delta keyed on recall date misses republished updates.
2. A name-only recall match "holds and asks", and ask can be overridden by a tap, so the agent can still list a recalled product after one tap. For "a recalled product is never listed", a name-only match needs the person to confirm the identifier (model or date code shown from the recall) does not match, and that confirmation is stored as the reason.
3. No retention for buyer text and no definition of `subject_id` (T13).
4. Poison cap on positives only (T11).
5. Isotonic at 300 / 30 is too few (T2).
6. Script prints collide on site prefills; salt rotation breaks the 7-day window (T4).
7. Gift card, crypto and wire asks are not hard rules (T1).
8. Reseller check: an ask on every $300+ phone message from a new account would be noise for a full-time reseller (*inferred*); the "1 in 3 asked threads end in a normal sale" rollback trigger covers this, keep it.

Planted-input tests, most likely to break first:
- **tr-1:** "Is this still available?" from 50 buyers to 50 sellers must not raise a print signal. A payment link wrapped in a URL shortener or an `xn--` lookalike domain is flagged and never fetched. A link spelled with spaces ("paypal . com / verify") is caught. "I'll pay with an Apple gift card" blocks.
- **tr-2:** 500 Ignore labels from one seller move no weight past 5% (negatives capped). One person's Block on a buyer never appears as a label row readable by another person (subject hashed per person). A second label from the same person on the same thread replaces, not adds. A print counted under last month's salt still counts on the first day of the new month.
- **tr-3:** the worked example as a fixture (s = 4.2, line 1.24, ask; then overpayment blocks). A good buyer with 10+ purchases and an in-app checkout gets none and no friction. No percentage at 299 threads.
- **tr-4:** a recall whose model number appears only in `Description` takes the matching listing down. A UPC with and without its leading zero matches. A recall with an old `RecallDate` and today's `LastPublishDate` is picked up. A response of 8,000+ rows on a daily delta is rejected as a bad query. A name-only match cannot be posted by one tap without the identifier check. A buyer who sent "here" at minute 14 is not a no-show.
- **tr-5:** a challenger better on train and worse on held-out is kept out. Isotonic is not used under the calibration-size floor.
- **tr-6:** the bench runs on simulated threads only; the poison stream includes negatives.

## Diff list against spec/engines/trust.md

- *agent proposal* §2 hard rules: add "insists on gift card, crypto or wire" as a hard `off_platform` variant (FTC).
- *agent proposal* §2 recall: match model tokens and date codes extracted from `Title` and `Description`, not only `Products.Model` and `ProductUPCs`; normalise GTINs to GTIN-14.
- *agent proposal* §2 recall: pull the delta by `LastPublishDateStart`; reject a response whose row count is far above the expected delta.
- *agent proposal* §3 step 11: a name-only match needs the person to confirm the recall's identifier does not match before post; never a plain tap-through.
- *agent proposal* §1 schema: `subject_id` for a buyer is a per-person salted hash; `evidence_span` masked for phone, email and address, and dropped after resolution plus the claim window.
- *agent proposal* §4 labels: the 5% cap applies to negative weight as well as positive.
- *agent proposal* §4 cadence: Platt scaling until a group has about 1,000 resolved threads, then isotonic.
- *agent proposal* §2 and §8 prints: skip messages under about 8 normalised tokens and site prefills; keep the previous salt's counts 7 days after rotation.
- *agent proposal* §2 recall: state that the feed is CPSC only and name NHTSA and FDA as not covered.
- *agent proposal* §2 no-show: read the person's and buyer's "here" or "on my way" before the 15-minute rule.

## Changes to tasks' accepts and breaks (spec/plans/backend/plan.json)

- **tr-1** accepts add: "not: a site prefill or one-line opener scores as a script". Breaks add: {gift card ask, signals.test.ts, blocked}, {prefill from 50 buyers, signals.test.ts, no print signal}, {shortened or punycode link, signals.test.ts, flagged, zero fetches}.
- **tr-2** accepts add: "not: one seller's negatives lower a weight past the cap", "not: one person's label visible to another". Breaks add: {500 Ignores from one seller, labels.test.ts, capped}, {salt rotation day, labels.test.ts, count kept}, {second label same thread same person, labels.test.ts, replaced}.
- **tr-3** keep; breaks add: {299 resolved threads, decide.test.ts, no percentage}.
- **tr-4** accepts add: "not: a recalled item listed by one tap", "not: buyer text kept past the claim window". Breaks add: {model only in Description, rest.test.ts, blocked}, {UPC leading zero, rest.test.ts, blocked}, {republished recall, rest.test.ts, picked up}, {8,000-row delta, rest.test.ts, rejected}, {buyer said here at 14 min, rest.test.ts, not no_show}.
- **tr-5** breaks add: {small group, test_fit.py, Platt not isotonic}.
- **tr-6** breaks change: {poison stream, test_sim.py, capped} covers negative as well as positive labels.
