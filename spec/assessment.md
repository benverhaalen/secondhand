# Assessment before build plans (a fresh reviewer, 2026-11-14)

Status: *agent proposal* for Ben and Nate. A fresh reader's assessment of the whole spec: what is settled, what one check would settle, what only the built product can measure, what only Ben or Nate can answer; failed tests; builder confusions; a simpler architecture; real-time weights; a readiness scorecard; speed. Line numbers were taken before later edits and may have drifted.

# Assessment of the secondhand design, 2026-11-14 (fresh reader)

Read-only pass over `C:\dev\secondhand`. Every bin call is mine. Evidence sweeps are in this folder: `ab.txt`, `as-feat-a.md`, `as-feat-b.md`, `as-det-1.md`, `as-det-2.md`, `as-research.md`, `as-dbx-docs.md`. Anything marked *my proposal* is an agent proposal. None of it is decided.

## Bin counts

| Source | settled | check | measure | owner | total |
|---|---|---|---|---|---|
| Feature Open items (21 pages) | 9 | 2 | 6 | 39 | 56 |
| open-questions.md rows | 12 | 3 | 1 | 21 | 37 |
| open-questions corrections (63–66) | 4 | 0 | 0 | 0 | 4 |
| Determinations, "cannot be made credibly" | 32 | 4 | 15 | 1 | 52 |
| Determinations, "Check later" | 0 | 0 | 172 | 0 | 172 |
| databricks.md §9 and the unverified lines | 1 | 18 | 1 | 3 | 23 |
| how-it-works "not settled / cannot be known" | 14 | 3 | 9 | 6 | 32 |
| Research gap lines (binned by class, §1.7) | most | 14 named | 9 named | 0 | ~820 lines |
| **Totals (excluding research lines)** | **72** | **30** | **204** | **70** | **376** |

What the counts say: the doubt is not where the research went quiet. Most of it is owner calls (70), and those are taste and scope, not facts. The measures (204) can only be answered by the built product, so building is the next research step. Only 30 items need a short check, and 18 of those are workspace probes that take about one afternoon.

---

## Part 1. The ledger

Format: `file:line` | doubt | **bin** | the line that settles it or names it.

### 1.1 Feature Open items

**appraise**
- appraise.md:174 | hand-off to a recall return | **owner** | Recommend yes: it is a link, not an action.
- appraise.md:175 | donation tax value | **owner** | Recommend showing the FMV range as "for your records" only, since Nate said no tax service.

**assist**
- assist.md:262 | B9 highlighted spans | **owner (Ben)** | He accepts or rejects catalog entries.
- assist.md:263 | one mechanism or several | **settled (inferred)** | Nate: "the assistant asks through inputs, not questions". One mechanism.
- assist.md:264 | catalog vs A2UI | **owner (Ben)** | Recommend his catalog, with A2UI as the wire format only.
- assist.md:265–267 | slot list, cap, fallbacks | **settled (inferred)** | Each follows from 263 plus card 21.

**buy**
- buy.md:184 | For you shelf | **owner** | Recommend yes, fed from Watch.
- buy.md:185 | EPN revenue | **measure** | Qualifying purchases per 100 link-outs. Below about 1 would change how it earns (J6).

**capture**
- capture.md:180 | talk mode | **owner** | Recommend one tap away (B4).
- capture.md:181 | B4 | **owner (Ben)**.
- capture.md:182 | B8 3D for clothes | **owner (Ben)** | Recommend in, labelled as a model.
- capture.md:183 | business users | **owner**.

**data**
- data.md:218 | message text in traces | **settled (inferred)** | Traces cannot be deleted by API, so text is redacted before it is logged.

**identify**
- identify.md:150 | paid specialists | **measure** | Top-1 on the labelled set against our stack. Buy only if it is ≥5 points better at the same cost per item.
- identify.md:151 | Confirmed vs auto-accept | **owner** | Recommend auto-accept at conformal set size 1, with "Confirmed" kept for the person's tap.
- identify.md:152 | time to identity at a cap of 3 | **measure** | The cap-1/2/3 arms. Lower the cap if 3 adds under 2 points of accuracy.

**insights**
- insights.md:203 | goal use | **measure** | Test group. Fold goals into Today if under about 10% of people use them.
- insights.md:204 | how it earns | **owner** (J6).

**item-card**
- item-card.md:184 | household sharing | **owner** | Recommend a shared card with per-person ownership.

**list**
- list.md:214 | title words | **owner (Ben)** | D4 against his proposal (how-we-market:97).
- list.md:215 | J11 photo tag | **owner** (J11).

**market**
- market.md:217 | B5 placement | **owner (Ben)** | Recommend inside Buy.
- market.md:218 | visitor surface | **owner**.
- market.md:219 | release alerts | **owner**.
- market.md:220 | index method | **settled (inferred)** | Card Ladder's repeat-sales method is documented, and our own rebuild test (databricks:467) proves it.

**measure**
- measure.md:181 | B8 | **owner**.
- measure.md:182 | "Fits like" width | **owner**.
- measure.md:183 | who sees the ± | **owner** | Recommend the seller always, and buyers when the ± is over 1 cm.
- measure.md:184 | business | **owner**.

**messages**
- messages.md:177 | J3 disclosure | **owner** (J3).
- messages.md:178 | thread matching | **settled (inferred)** | Site thread id plus the item card.
- messages.md:179 | forwarded mail | **check** | Pass one forwarded sale email through the filter and confirm the sale is detected and the forward header is stripped.

**price**
- price.md:178, 179 | J10 and the stale ladder | **owner** | Recommend the fee formula (J10).

**replay**
- replay.md:129 | own spec or folded in | **settled (inferred)** | Keep it a page: it has its own bar (105).
- replay.md:130 | Ben's view | **owner (Ben)**.

**score**
- score.md:215 (J7), 216, 217 | opt-in, visibility, disclosure | **owner** | Recommend opt-in per test.

**sold**
- sold.md:180 | N7 mail scope | **owner** | Recommend a narrow Gmail label scope.
- sold.md:181 | clock | **settled (inferred)** | The shorter clock wins, since a late delist is the costly error.
- sold.md:182 | Poshmark and Mercari email body | **check** | Read one real sale email from each and confirm item id and price are present.
- sold.md:183 | **owner**.

**studio**
- studio.md:166 (B7), 167 (B6), 169, 170 (J11), 171 (J12) | **owner**.
- studio.md:168 | J17 returns on pressed photos | **measure** | Return rate, level 2 against level 0, on the first real items. Default to level 1 if the gap is over 1 point.

**today**
- today.md:173, 175 | **owner**.
- today.md:174 | batch times | **measure** | card_ms p50 under 5 s (today:138).

**watch**
- watch.md:146 | B2 "within the hour" | **owner (Ben)** | Recommend tightening it to the measured p95.
- watch.md:147 | **owner**.

### 1.2 open-questions.md (37 rows)

- N2 judging criteria | **check** | Open the track's page and read the criteria section.
- N4 skills install | **owner (Nate)** | Recommend yes, Claude Code only.
- N5 docs folder | **owner** | Keep it.
- N7 mail | **owner** | Yes, narrow scope.
- N8 at-risk accounts | **owner** | Show risk per site. No live automation on a real account unless one is named.
- N9 app teardown | **settled (inferred)** | Ranking runs on the servers.
- N10 certainty line | **owner** | Keep it.
- N12 service identity | **check** | Run `databricks service-principals list --profile <chosen>`. If it errors on permission, try `create`.
- B1 (packet 40) | **owner (Ben)**.
- B2 | **owner (Ben)**.
- B3 studio method | **owner (Ben)** | Recommend both: his redraw at levels 1 and 2, with the pixel block on tag, label, serial and flaw photos.
- B6 | **owner (Ben)**.
- B7 | **owner (Ben)**.
- B8 | **owner (Ben)**.
- B9 | **owner (Ben)**.
- B4 | **owner (Ben)**.
- B5 | **owner (Ben)**.
- B10 | **settled (inferred)** | Nate's "least extra input" means the care label is shot only when a fact is unsettled.
- J1 front door | **settled (observed)** | Apps sign-in is Databricks-only, so a thin edge is needed.
- J2 runtime | **check** | A one-hour trial each of DBOS, Flue and the agent server, all on the same "kill mid-step, resume once" script.
- J3 | **owner (both)**.
- J4 | **owner (both)**.
- J5 | **settled (inferred)** | The later decision governs, and it covers every channel because it is about the action, not the route.
- J6 | **owner (both)**.
- J7 | **owner (both)**.
- J8 | **settled** | Claim only what was verified.
- J11 | **owner (both)**.
- J12 | **owner (both)**.
- J17 | **measure** | See studio:168.
- J18 | **owner (both)**.
- J19–J23 | **settled (inferred)** | Each recommendation follows from the canon.
- J10 | **settled (inferred)** | The multipliers are the formula evaluated at typical prices. A fixed multiplier is wrong at the minimums.
- J9 | **settled (inferred)** | One AGENTS.md line pointing to `spec/features/`.
- Corrections 63–66 | **settled** | Already corrected.

### 1.3 Determinations, "cannot be made credibly" (52 rows)

- **money.md:871–877**
  - 871–876 **settled**:
    - 871: D4 translates the asks.
    - 872: only our own listings give days to sell.
    - 873: the learned discount.
    - 874: the Wilson bound.
    - 875: no tax service.
    - 876: vintage retail.
  - 877 authenticity | **measure** | P(authentic) on a labelled set. If calibration error is over 0.1, D17 must not use it in `max_pay`.
- **market-insight.md:746–754**: all 9 **settled** (structural facts and observed terms).
- **managing-and-buyers.md:703–708**
  - 703 scam probability | **measure** | Base rate on our own labelled threads, then isotonic calibration.
  - 704 no-show | **measure**.
  - 705 ban | **settled**.
  - 706 dispute | **settled**.
  - 707 disclosure | **owner** (J3).
  - 708 injection | **settled**.
- **listing-and-marketing.md:785–791**
  - 785 ranking weights | **settled** | They run on the sites' servers.
  - 786 promoted slots | **check** | One signed-out results page per site, saved as HTML, then grep for a sponsored or promoted marker.
  - 787 personalisation | **settled**.
  - 788 effects of sharing, relisting and timing | **measure** | D14, D21, D22.
  - 789 per-person verdict | **settled (arithmetic)** | It needs about 1,500 listings per arm.
  - 790 promotion lift | **measure** (D33).
  - 791 Facebook title limit | **check** | Paste 151 characters into the create-listing title field and count what is kept.
- **asking-and-intent.md:722–729**
  - Why, for whom, colour as seen, and whether a highlight was read: **settled** (never claimed).
  - Inline marks vs chips | **measure** | Other rate and time to answer. Switch to chips if inline marks are slower by over 20%.
  - Preselection bias | **measure** (card 21's no-preselection arm).
- **seeing-the-item.md:741–754**
  - Authenticity, function, hidden condition, weight, material: **settled** (they show as "Not checked").
  - ARKit plane-only | **measure** | Tape against plane on 30 items. Drop the path if the error is over 1 cm.
  - LiDAR on dark or glossy surfaces | **measure**.
  - OCR | **measure** | Two-engine agreement on 200 labels.
  - Question cap | **measure**.
  - Site photo rules | **check** | Open the Poshmark, Depop and Mercari photo help pages in the cloud browser, which has no 403 wall.
- **capture-shots.md:444–449**: all 4 **measure** (seconds per shot; guided vs adaptive; requirement_reorder; depth on black shoes).
- **fields-by-kind.md:420–424**
  - Era: **settled**.
  - Shopify-to-eBay map: **settled** (a suggestion plus a person's check).
  - Rank importance on Facebook and Depop: **measure** (observe_rank).

### 1.4 Determinations, "Check later" (172 items)

All are **measure**: post-launch metrics, each with a stated bar. The class-by-class list with line pointers is in `as-det-2.md:117–283`.

| File | Items |
|---|---|
| asking-and-intent | 25 |
| capture-shots | 9 |
| fields-by-kind | 5 |
| listing-and-marketing | 26 |
| managing-and-buyers | 23 |
| market-insight | 30 |
| money | 32 |
| seeing-the-item | 22 |

The design gap is that none of them names where its metric is computed. The param registry in the real-time weights section fixes that by giving each one a `metric` and a `guard` row.

### 1.5 spec/databricks.md

**§9 test-first list, 587–598**

| Line | Doubt | Bin | Exact check |
|---|---|---|---|
| 587 | an anonymous call to the edge is refused | **check** | curl the App with no token and expect 401 or 302. |
| 588 | the Lakebase token across an hour and a suspend | **check** | A 70-minute loop doing `SELECT 1` every 60 s, with one suspend forced. |
| 589 | RLS with two users | **check** | Two `SET app.user_id` sessions on one pool, each reading the other's row. Any row returned fails. |
| 590 | exactly-once with two workers | **check** | Two `SELECT … FOR UPDATE SKIP LOCKED` workers over 1,000 rows, then count duplicates. |
| 591 | upload to job start | **check** | Time 20 uploads under the trigger against `jobs run-now`. |
| 592 | egress (Free Edition wording) | **check** | From a serverless notebook on the **full workspace**, curl Firecrawl, api.ebay.com and api.anthropic.com. |
| 593 | which features exist | **check** | `databricks <feature> list` per feature on the full workspace. |
| 594 | SSE across a long job and the App timeout | **check** | A 10-minute SSE stream with a heartbeat every 15 s through the App proxy. |
| 595 | which image models are served | **check** | `databricks serving-endpoints list` and grep for claude. |
| 596 | recompute 20 numbers after a week | **measure** | Any difference fails. |
| 597 | whether Gateway fronts the image models | **check** | Register one endpoint and call it. |
| 598 | teardown and a fresh deploy | **check** | Run `databricks bundle destroy`, then `bundle deploy`, from the README. |

**Owner, 601–603:** the webhook receiver, selling data and permissions for a public launch. Recommend keeping the receiver at the edge, keeping selling data neutral until J6, and asking for permissions after the demonstration.

**Recompute, 604:** **settled**. `basis_ids[]` removes the time-travel dependency.

**Unverified claims, 605 (four), all check:**
- whether a Gateway Python policy can read a UC table (write a 10-line policy that runs `SELECT` on one table);
- whether api.anthropic.com is a trusted domain (the same curl as 592);
- whether `system.ai.sandbox` runs a browser (`import playwright` in a sandbox call);
- unauthenticated behaviour (the same check as 587).

**Lines 269 and 294**, Gateway and Sonnet: **check**, the same as 597.

**Kill tests with no sample or no pass number** are listed in Part 2b.

### 1.6 docs/how-it-works (lists in `as-dbx-docs.md:213–327`)

- **Settled (14).**
  - "Cannot be known" items: buyer meaning, true views, full sold counts on four sites, authenticity, hidden condition, real ranking weights, the per-buyer order, and what no source can tell.
  - Old "one question at a time" text: delete it, since assist:263 settles one mechanism.
  - The coat illustration: label it as an illustration.
  - The free-tier line at capture-to-facts.md:77 is stale, because the event gives a full workspace (open-questions:7).
- **Check (3).**
  - Facebook title limit: the same check as 791.
  - The 2-minute lag for Poshmark and Mercari: time 5 test sales from email arrival to detection.
  - The Facebook fee of 10% with a $0.80 minimum: read Facebook's seller fee help page in full.
- **Measure (9):**
  - the question cap;
  - specialists;
  - relisting lift;
  - promotion return;
  - referrals per 100 link-outs;
  - condition priors;
  - the 7% tax default;
  - shipping weights;
  - the title weights and the three price paths.
- **Owner (6):** Ben's titles against D4 and D6; Ben's multipliers against D13; D15's ladder against the three plans; disclosure; whether replay keeps its own spec; Klarna (whether to compare it at all).
- **Confusions** (two scores, the order written two ways, slot names, two weightings, two launch prices, cadence drift) are in Part 3.

### 1.7 Research gap lines (today's notes; `as-research.md`, 1–2156, by note)

The retriever's class labels are noisy (counts: value-not-found 311, page-not-opened 307, blocked-by-wall 202). My bins are by kind:

- **Page not opened, or opened only as a snippet: settled where the design does not rest on the number.** Vendor traction, funding and pricing (how-we-compare:46, 78, 104) are background. Nothing in the build reads them, so the snippet is enough and they need no more research.
- **Blocked by a wall** (a 403, a script-rendered page, a browser check): **check, one route.** The cloud browser the harness already needs (Browser Use) opens these pages as a person would. Named:
  - Poshmark, Depop and Mercari photo and edited-image rules (open-facts-seeing-the-item rows 8–9);
  - Nike style-code help (row 10);
  - the IKEA article number (row 11);
  - remove.bg and fal prices (rows 6–7), from the account page or the invoice of one paid call.
- **Value not published by anyone: measure.** LiDAR on fabric and fur, Object Capture time, Gaussian splat accuracy, OCR on labels, render-vs-photo identification, and adaptive vs listed prompts (adaptive-capture:103–109). Each is a timed or taped run on our own phone, which is the measure rows in 1.3.
- **Value deducible: settled (inferred).**
  - Whether a vendor's search tool takes an image as the query (open-facts-seeing-the-item:24) is not needed. Our image path is the eBay `search_by_image` POST (observed in its OpenAPI at row 1) plus our own SigLIP and AI Search, so no general web-search tool has to take an image.
  - 3D upload to the marketplaces: none exposes a 3D media type in its listing API (eBay's OpenAPI has none). Renders go up as stills, so the design is unchanged either way.
  - `search_by_image` size cap: send at most the 12 MP JPEG the phone already makes, and on a 413 downscale to 1600 px. This is handled in code, not by research.
- **Two remaining checks** from the research notes, both short:
  - `search_by_image` price or contract gating: one call on the production keyset.
  - The Facebook seller fee: as in 1.6.

---

## Part 2. Failed tests and unrunnable bars

### 2a. Tests that fail

1. **`node .agents/check.mjs` exits 1. The test is at fault.**
   - The error: `ERROR spec/features/capture.md:187 link to ../determinations/capture-shots.md#electronics-phones-and-laptops: no heading`.
   - The heading at capture-shots.md:76 is "### `electronics`: phones and laptops". `.agents/checks/links.mjs:11` runs `stripCode(text)` before matching headings, so the inline code `electronics` is removed and the slug becomes `-phones-and-laptops`. GitHub keeps inline-code text in anchors, so the link is right.
   - Fix: strip fenced blocks only, not inline code, when collecting anchors. It is one line in `anchors()`, plus a test case with a backticked heading.
   - Warnings, which do not fail the run:
     - Tier 1 changes in 14 spec files.
     - A personal-data flag on a service-account email. It is a false positive: a service identity, not a person.
     - `app/src/app/index.tsx` makes an outside call without `log.call`. This is a real code gap against the AGENTS.md rule "Log through log/ … every outside call".
   - Log: `assess-check.log`.
2. **`.agents/skills/image-gen/run.test.mjs`: 7 failures, from line 47. The machine is at fault; the test is not portable.**
   - The failures are thrown at `run.mjs:124`. With the default `os.tmpdir()` under the home directory, the run's working directory sits under a tree whose AGENTS.md Codex would read, and the guard refuses that.
   - It passes with TEMP pointed outside the home directory.
   - Fix: the test creates its own temp root outside any AGENTS.md tree, or the guard checks for the nearest AGENTS.md rather than the home path.
   - Log: `assess-check-notemp.log`.
3. **`app` `npm run check`: exit 0, 8 of 8 pass** (`assess-appcheck.log`).

### 2b. Bars that cannot be run as written

| Bar | Missing |
|---|---|
| databricks.md:440, the visibility stand-in | No panel size and no number: "above the noise" with noise undefined. Fix: 20 control pairs, and pass means the stand-in's rank correlation is over the 95th percentile of the control-pair correlation. |
| databricks.md:464, photo quality predicts a sale | No sample, no effect size. Fix: about 400 sold-or-not items per kind; pass is a coefficient p<0.05 with price in the model. |
| databricks.md:476, a branch per action | No millisecond threshold. Fix: a branch is created and readable at p95 under 2 s. |
| databricks.md:485, "why this price?" | Not numeric. Fix: 5 people, 10 items, at least 8 of 10 correct paraphrases. |
| databricks.md:467, rebuild one week | Runnable. The 5/10/30 thresholds are unattributed: the source is unnamed, but the bar itself runs. |
| Coverage bar, borrowed 75.3% | A vendor number used as our pass line (see confusion 4). Replace it with our own held-out coverage at a nominal 80%, with ±5 points allowed. |
| how-it-works/how-we-compare.md:30 and how-we-market.md:71, Vendoo's "33% more sales" | A vendor claim. It is not used as a bar and must not become one. D14 measures sharing on our listings. |
| identify.md:121, p50 time to identity of 9 s or less | No device or network named. Fix: an iPhone 15 Pro on LTE, warm. |
| appraise.md:144, p95 "measured on mobile data" | No carrier, no sample. Fix: 50 runs on LTE plus 50 on 5G. |
| assist.md:237, 1.5 s to the first highlight | Marked "a starting value", with no source. It is runnable once a sample is named: 100 prompts from the labelled set. |
| How-it-works "starting value" weights (clarifying-questions:90, how-we-prove-it:45, selling-runs-itself:19) | Runnable as priors, but no update rule is named. See the real-time weights section. |

### 2c. Research recorded as failed where the answer can be deduced

- **"Image as query on a general search tool: not found"** (open-facts-seeing-the-item:24). The deduction: the design does not need it. Image identity goes through eBay `search_by_image` (OpenAPI observed) and our own embedding index, then text search on the identified product, which every search tool takes.
- **"Object Capture time not published"** (adaptive-capture:104). Apple's own wording is "a few minutes". That is enough to know it cannot sit inside a first-value budget of 2 to 10 s. The deduction: it runs after first value, in the background, which is what capture already says.
- **"LiDAR error on dark or glossy surfaces not found"** (adaptive-capture:103). Apple's text says depth confidence drops on those surfaces, and ARKit exposes a per-pixel `confidenceMap`. The deduction: gate on the confidence map (show ± or ask for a tape) instead of on a published number. Only the threshold is a measure.
- **"Photo rules on Poshmark, Depop and Mercari not read"** (rows 8–9). The deduction for the design: eBay's policy (read) requires the real item and truthful images. Every site's terms forbid misrepresentation. The design already keeps one unaltered photo per listing (studio:87) and blocks pixel changes on tag, label and flaw photos. That satisfies the strictest plausible rule, so the read is only a check, not a blocker.
- **"3D upload on any marketplace: no sign found"** (scan-to-images:168). The deduction: none of the listing APIs we integrate has a 3D media field (eBay OpenAPI read). Renders go up as stills either way.
- **"Market intelligence needs a vendor"** (treg-tool-routing). The deduction from Nate's build summary and the repo: every comp the harness reads is already an `observation` with a citation. Aggregating those observations is the market product (market-insight D1–M17). A vendor fills only cold-start gaps.
- **"Crawling Facebook, Poshmark and Mercari will fail"** (the lead's earlier doubt). Nate: "We've seen how information is crawled and found on other sites". The repo has working evidence:
  - watch.md:135: ScrapeCreators returned 24 listings in 1.32 s.
  - research/watch/ben/page-monitor: `extractListings` over saved pages.
  - The Exa empirical runs.
  - The deduction: read-side crawling of public result pages works today. The risk is only on write actions on logged-in accounts (N8).

---

## Part 3. Builder confusions (quoted)

Ranked by how likely they are to make two builders write different things.

1. **Four mechanisms for asking the person one thing.**
   - Card 21's inline marks ("unclear words in a prompt are highlighted, and a tap opens the right control", open-questions:33).
   - The requirement fill on capture.
   - Assist's blanks.
   - The fields ladder in fields-by-kind.
   - Plus the stale "one question at a time" (clarifying-questions.md:128: "assist.md still lists "one question at a time" among the options. It predates this design").
   - A builder cannot tell which component the capture screen calls.
2. **Two rules ordering one list.** search-and-shopping.md:100: "`market.md` says listings are ordered by the `score` only, and `buy.md` says by the delivered total's place in the fair range, then match label, then the score's quality axis." J23 recommends "The same rule", but market.md was not changed.
3. **Two weightings of the same sales, and two launch prices.**
   - value-and-price-history.md:110: "D1 weighs Mercari and Depop sales 1.0 with a 90-day half-life … M3 …".
   - :111: "D7 takes the median of list prices in the first 90 days. M2 takes the highest regular price in the first 30."
   - Two files own one value.
4. **Two coverage bars and a borrowed number.**
   - The sold range is hidden under 5 sales in data.md and "by …" in money D1 (how-we-prove-it.md:116).
   - money:88 and market-insight:112 both own n_eff≥6.
   - A vendor's 75.3% sits as a bar.
5. **Two router rules.** A Beta(1,1) posterior over 30 days (managing-and-buyers:472, 485) and 7-day counters with a Lakeflow fold (data:37, 103, 111). Meanwhile data:196–197 relies on "router demotion" while the router is still a proposal.
6. **Three delist bars and drifting cadences.**
   - Delist: replay:105 "<3 s p95", list:182 "<2 min p95", sold:151 "faster than 10 min". The red threshold at sold:27 is 5 min.
   - selling-runs-itself.md:121: "Reconcile runs nightly in connect and every 5 minutes in sold. Check cadences differ between connect and messages."
7. **J10 has two owners:** Ben's fixed multipliers in packet 31 and the fee formula in money.md (how-we-price.md:87: "two routes to a list price, and the spec does not say which wins"). The recommendation exists, but packet 31 still carries the multipliers as the rule.
8. **Two scores for one job.** identify-and-similar-items.md:119: "The conformal set in card 9 picks a product for one captured item. The M1 score links many listings into one product page. The two use different thresholds, and the spec does not say how a disagreement is resolved." An item can be "this product" on capture and "not this product" on its own product page.
9. **Slot names drift from the canon.** search-and-shopping.md:101: "The comparison cards read `use`, `keep_for`, `needed_by`, `budget`, `size` and `must_have[]`. The assistant's own list names use, for whom, budget, size, compatibility, deadline and condition…"
10. **A design built around a removed constraint.**
    - The Free Edition framing at databricks.md:232, 286, 476, 592, 593 and 595, and in capture-to-facts.md:77 ("runs on a free tier with no graphics processors, so some steps are slower and use simpler tools").
    - open-questions:7 says "the event provides a full workspace, so Free Edition limits are temporary".
    - The GPU-free choices (simpler masking, no on-workspace model) are therefore justified by a constraint that no longer holds.
11. **Steps nobody owns.**
    - how-we-market.md:98: "The spec has no decision kind for promotion spend, and the sharing lever needs a job kind that does not exist yet."
    - how-we-price.md:90: "D15 ends an unsold item with a decision kind the product spec lacks."
    - The legal and recall flag has no field in the canon's `requirement` row.
    - Runtime next-check intervals have no tuner.
12. **A value in two files with different numbers.** The Poshmark minimum is $15 at platform-fit:148 and $3 at poshmark.md:93 and 280.
13. **Demo-shaped design.**
    - studio.md:170, "for demo purposes".
    - watch.md:127 runs a monitor bake-off, so a production path is chosen by a demo.
    - The proof-layer names drift (citation, evidence, proof) across data.md, databricks.md and how-we-prove-it.md.

---

## Part 4. Better architecture (judged against Nate's build summary)

Nate: "we basically create a harness api, powered by jev ultrafast or firecrawl, to efficiently grab from our prestablished and optimally wired sites. every app event, databricks action, etc. Has a pipeline attached to an agent driving the platform. Then for the aggregated market intelligence, we utilize the systems we build, or ... we should just utilzie treg or something".

**P1. One harness API, `harness.call(site, verb, args) → observation[] + citation`** *(my proposal)*
- **Replaces** the per-feature fetch paths: watch's monitor bake-off, comps-sources-live, page-monitor, ScrapeCreators, Exa alerts, and the per-site Browser Use calls.
- **How it routes.** The 14 verbs stay. Each (site, verb) has an ordered route list in `route_table`:
  - the official API (eBay Browse and Sell, Depop);
  - then Jev ultrafast or Firecrawl for public read pages;
  - then the cloud browser (Browser Use) for logged-in writes;
  - then treg as the last fallback.
- **Saves** one auth, logging, citation and rate-limit layer instead of six. Every read lands as an `observation` with a `route_call` row, so the comp store and the market product fill themselves.
- **Risks**:
  - one choke point, mitigated by per-route circuit breakers;
  - vendor terms on crawling;
  - write actions still need the logged-in browser (N8 account risk).
- **Files:** spec/features/connect.md, watch.md, data.md (the router section), spec/databricks.md §4, research/watch/ben/page-monitor (kept as one route), product.md (`route_table`).

**P2. Every event is a job, and every job has an agent step** *(my proposal)*
- **Replaces** the mixed triggers (file-arrival trigger, webhooks into Apps, polling sweeps, the Lakeflow fold, scheduled reconcile at two cadences) with one `job` table:
  - each app event, webhook, email detection and Databricks action inserts a row with an idempotency key (`delist:{item}:{site}` already exists);
  - workers pull with `SKIP LOCKED`;
  - each kind runs a durable agent step with tools equal to the harness verbs plus the guarded DB writes.
- Settle J2 with the one-hour trials. DBOS on Lakebase is the likely winner because exactly-once comes from Postgres.
- **Saves** one runtime, one place to read why a thing happened (the job row links to the MLflow trace), and the cadence drift, which becomes one `next_check_at` column with one tuner.
- **Risks**:
  - Lakebase becomes the hot path, so the token refresh and suspend checks (§9.2) matter more;
  - an agent on every event costs model calls, mitigated by deterministic steps for deterministic kinds (delist, reconcile) with the agent only on judgement kinds.
- **Files:** spec/databricks.md §3 and §4, data.md, sold.md, connect.md, messages.md, replay.md, product.md (job kinds, adding promotion spend, sharing and the unsold end).

**P3. Market intelligence as a fold over our own streams, with treg and vendors only for cold start** *(my proposal)*
- **Replaces** a separate market-data acquisition path.
- **How it works:**
  - `observation`, `route_call` and `product_snapshot` are already written by P1;
  - Lakeflow folds them into the market-insight cards (sell-through, launch price, index);
  - a product page is the snapshot plus the live delta;
  - treg or a vendor is called only when a product's n_eff is under 6.
- **Saves** buying data the harness already reads. One definition per number, which ends confusion 3 because M2 and M3 read D1's output.
- **Risks** thin coverage early, which is why the fallback exists, and terms on reusing observed data (J6).
- **Files:** determinations/market-insight.md (M2 and M3 point at D1 and D7), market.md, insights.md, data.md.

**P4. One parameter registry** *(my proposal)*. See the real-time weights section below.

**P5. One `clarify` component** *(my proposal)*
- **Replaces** the four question mechanisms (confusion 1).
- **How it works.** It takes `(slot, candidates[], value_of_information)` and renders as inline marks in a text input, or as a control in capture. Requirement fill, assist blanks and the fields ladder all emit `clarify` requests, and one ranker orders them by expected value of information under the cap.
- **Saves** three implementations and three tuners.
- **Risks** that Ben's catalog decides the visuals (B9), which is fine, because the contract stays fixed.
- **Files:** assist.md, capture.md, determinations/asking-and-intent.md, fields-by-kind.md, how-it-works/clarifying-questions.md.

**P6. One owner file per value, with a check** *(my proposal)*
- **Replaces** the duplicate definitions listed in confusions 2–8 and 12.
- **How it works:**
  - a value is defined once in its determinations card, and others link to it;
  - a new `.agents/checks/one-owner.mjs` greps a list of canon names (n_eff floor, Poshmark minimum, delist bar, coverage, launch price) and fails when two files state different numbers.
- **Saves** the drift that this assessment found by hand.
- **Risks** none beyond writing the list.
- **Files:** `.agents/checks/`, plus the files named in Part 3.

**P7. Drop the free-tier design choices** *(my proposal)*
- **Replaces** the GPU-free workarounds (capture-to-facts:77, databricks Free Edition lines) with a model on the full workspace's serving endpoints where it is faster, for example a segmentation model on GPU serving instead of a Replicate call.
- **Saves** latency and an outside call.
- **Risks** cost, which is the operator's call per endpoint.
- **Files:** spec/databricks.md, docs/how-it-works/capture-to-facts.md, studio.md.

---

## Real-time weights

Nate: "The engine should be built to weigh things in real time, not hardcode in methodologies, we need realtime collected data to then empower extremely accurate results".

### (a) Which numbers should be learned and which are rightly fixed

**Hardcoded today and should be learned** (each with its card's number as the prior):
- D1 comp weights (site weight 1.0 for Mercari and Depop, the 90-day and 30-day half-lives, variant 0.5, family 0.25: value-and-price-history:32, 110) should become a fitted weight per site and kind.
- n_eff≥6 and the 5-sale hide (money:88, data.md) should become the n_eff at which held-out coverage reaches nominal, per kind.
- The D6 conformal width and the D10 isotonic map are already fit offline. They should refit on each new sale.
- D13's learned discount, the D16 counter at the midpoint ("asserted, no data yet", how-we-price:59) and the price-path multiples (how-we-price:43) should be learned per site from accepted offers.
- The D4 title weights (how-we-market:41: "0.2 for appearing in all comparable listings (starting values)") should become fit_ranker output.
- The identification rung factors and the M1 and M17 thresholds (identify-and-similar-items:26, 89, 117) should be refit on the labelled set and on person confirmations.
- The clarifying-question source weights and the 0.5 for a slow confirmation (clarifying-questions:90, 119), and the cap of 3, should be learned from answer value.
- The router: the Beta posterior per route.
- Next-check intervals (selling-runs-itself:78: "a pending offer, minutes; a waiting buyer, 15 to 60 minutes; a quiet listing, 6 to 24 hours") should become a hazard model on event arrival per listing.
- Pace limits for sharing (how-we-market:61) should be learned downward only, from warnings.
- Condition priors, shipping weights and the 7% tax default (value-and-price-history:105, 112) should be learned from sold labels and actual postage.

**Rightly fixed** (rules, terms or safety, not estimates):
- locked actions (managing-and-buyers:84);
- the scam score as a sum of signals, where the signals stay fixed and the threshold is calibrated;
- site fees and minimums (terms; read, not learned);
- recall and legal flags;
- definitions (sell-through = sold/(sold+active));
- the evidence gate's precision floor of 0.98 (a promise to people, not an estimate);
- the three-approvals rule for promotion (databricks:479);
- "never infer condition, size or authenticity" (J20);
- Today's order (609).

### (b) One mechanism, not eleven *(my proposal)*

Today there are eleven separate update paths: the `thresholds` table, the weekly assist refit, fit_ranker, requirement_reorder, two router rules, the D1 starting values, D6 and D10, Thompson sampling, the static D11 table, the weekly messages sample, and untuned next-check intervals.

**Where parameters live.** One Lakebase table, `param`, extending `thresholds` (product.md:103):
- `(name, scope{kind, site, segment}, family{scalar|beta|normal|gamma|model_ref}, value_or_hyperparams, prior, version, fitted_on_ids_hash, n_eff, metric, guard_lo, guard_hi, status{champion|challenger|retired}, updated_at)`;
- the card's number is `prior`, and a newly created scope starts at the prior with n_eff 0;
- reads go through one cached lookup with a 60 s TTL;
- model-type parameters (ranker, identification heads) are `model_ref` to UC registry aliases.

**What updates them, and how often.** Two update speeds through one writer:
- **On the event (conjugate, milliseconds).** Router Beta counts, bandit arms, offer-accept rates, the clarifying-question answer value and the hazard of the next buyer event. Each new outcome row updates the posterior in the same transaction that writes the outcome. Partial pooling shrinks the scope toward its parent (kind toward all) by n_eff, so a thin scope stays near the card's prior.
- **On a fold (Lakeflow, nightly or weekly).** Comp weights, conformal, isotonic, ranker, identification thresholds and condition priors. Each refit writes a **challenger** version.

**How a challenger is promoted.**
- A challenger is promoted only when its held-out backtest on the last N outcomes beats the champion on the parameter's `metric` (coverage error, log loss, NDCG, accept rate) by more than the bootstrap noise.
- This is the MLflow Champion/Challenger pattern already in the spec, applied to every parameter rather than only the ranker.
- Promotion moves the alias: one row's `status`.

**Each result explains itself.**
- `citation` (product.md:86) gains `param_versions{name: version}` and `model_version`.
- The screen's "why this price?" (databricks:485) reads the weights in force from it: "Mercari sales weighted 1.0 (fitted on 214 sales, v37)".
- Recompute (§9.10) then re-reads the same versions, so a learned weight never breaks reproducibility.

**How a bad update is caught and rolled back:**
- `guard_lo` and `guard_hi` per parameter (a hard band around the prior, for example ±50% for comp weights, or Beta means in [0.02, 0.98]); any write outside the band is refused and logged;
- a drift monitor on each parameter's live metric, using the lakehouse monitoring already named, alerts when the champion's live metric falls below its backtest by more than 2 standard errors;
- rollback is setting the previous version back to champion (one UPDATE, no redeploy);
- on-event posteriors carry a forgetting factor (an effective 30-day window), so a burst of bad outcomes decays;
- a site change flag (databricks:335) freezes that site's parameters until it clears.

**What it removes:** the second router rule (keep the per-event Beta and drop the 7-day counters and fold), the static D11 table, and the weekly person-approved requirement_reorder. The approval stays as the guard for a promotion, not as the update path.

### (c) Where real time means something and where it does not

| Signal | Outcome latency | Real time? |
|---|---|---|
| Route success and latency (router) | seconds | **Yes.** Update per call. |
| Offer accept, counter or decline | minutes to hours | **Yes.** Update per offer. |
| Buyer message arrival (next-check hazard) | minutes | **Yes.** |
| Live comps for an item (new sold or active listings) | minutes (harness reads) | **Yes.** The comp set is recomputed per new observation, though the D1 weights are not refit. |
| Person corrections (identity, measurements, clarify answers) | seconds | **Yes.** |
| Identification thresholds | per confirmation, but noisy | **Nightly** fold. A single confirmation is too little to move a threshold safely. |
| Sell-through, time to sell, relisting lift | 7–90 days | **No.** Weekly fold. Real time would only add noise. |
| Range calibration (conformal coverage) | at sale, 7–90 days | **Nightly** on new sales. Hold-out needs at least 30 per kind. |
| Ranker weights (Plackett-Luce) | rank observations daily, sales weekly | **Daily** fold of observe_rank. Weekly on sales. |
| Return rate (studio level, J17) | 30+ days | **No.** Monthly. |
| Promotion lift (D33) | weeks, pooled | **No.** Pooled weekly, and hidden until it is distinguishable from noise. |

---

## Readiness scorecard

Confidence runs 1–5: 5 means others ship it and our pieces are observed or documented; 3 means it is sound by logic but unproven here; 1 means it depends on something nobody has shown. Each test runs in under a day.

### Expect to work: build and test now (4–5)

| Part | Conf. | Reason | First thing to build | One-day test, and the result that counts | Unblocks |
|---|---|---|---|---|---|
| Harness on official APIs (eBay Browse and Sell, Depop) | 5 | Documented APIs, with the eBay OpenAPI read | `harness.call('ebay','search_sold'\|'search_active')` writing `observation` + `route_call` | 50 queries; each returns rows with a citation id; p95 under 2 s | comps, price, market, watch |
| Identify by code or barcode (UPC, ISBN, style code via OCR) | 5 | Apple Vision barcode and text are shipped APIs; code-to-product lookup is a documented API | Vision barcode → UPC lookup → product row | 30 items with codes; ≥28 resolved to the right product | identity for media, electronics, boxed goods |
| Capture: flat-lay photos with the guided list | 5 | Every resale app ships it; capture-shots defines the lists | Expo camera screen with the per-kind shot list | 10 items of 3 kinds; a tee in under 70 s (capture:150); all required shots present | identify, price, list |
| Evidence store (Delta/Lakebase + `citation` with `basis_ids[]`) | 5 | Append-only tables plus ids; no time travel needed (databricks:604) | `observation`, `citation` tables; recompute function | Publish 20 numbers, re-run recompute the next day; zero differences (the week-long run follows) | proof, "why this price?", the param registry |
| Money D1 comps and fee arithmetic | 4 | Pure arithmetic over observed fees; the method is fully specified | D1 weighting + D6 range + the fee formula per site | 30 held-out recent eBay sales; coverage of the 80% range between 70 and 90% | price, list price per site (J10) |
| Lakebase + job table with `SKIP LOCKED` | 4 | Postgres semantics are documented; the token refresh is unproven here | `job` table, two workers | §9.2 + §9.4: 1,000 rows, 0 duplicates; 70 min without an auth error | every background action (P2) |
| Expo shell + edge routes | 5 | Already passes its check (8 of 8) | Add `log.call` to index.tsx's outside call; health → edge → App | Signed-in call reaches the App; anonymous call refused (§9.1) | every screen |
| Gmail push sale detection (Poshmark, Mercari) | 4 | Gmail watch is documented; the email bodies are unread | Gmail watch on a label → parser | 5 test sales; all detected; p95 under 2 min (connect:165) | delist on the slow sites, sold |
| Public search API over our own index | 4 | Our index plus AI Search; the rate limit is ours to set | `GET /v1/search` over `observation` + product | 100 visitor queries; p95 under 3 s; no identifying field in the event (databricks:330) | buy, the "search engine is an API" decision |
| Read-side crawling of public result pages (Firecrawl or Jev) | 4 | Observed working in the repo (ScrapeCreators 24 listings in 1.32 s, watch:135; page-monitor `extractListings`) | `harness.call(site,'search_active')` on Depop, Poshmark, Mercari via the crawl route | 20 queries per site; ≥18 return parsed listings with price and URL | watch, market, comps on the non-API sites |
| Delist through the official API or a kept browser session | 4 | eBay `EndItem` and Depop are documented; the browser path is replayed | `delist` job kind with an idempotency key | Kill mid-run; reconcile records it exactly once (databricks:276); API path p95 under 3 s | sold, cross-listing safety |

### Might work: needs direction (1–3)

| Part | Conf. | What is uncertain | First thing to build | One-day test, and the result that counts | Unblocks | Ways to make it work (Nate picks) |
|---|---|---|---|---|---|---|
| LiDAR / ARKit garment measuring | 2 | Error on fabric, on dark surfaces and on plane-only devices; no published number (adaptive-capture:103) | Measure screen: plane + two taps, reading the depth confidence map | Tape against app on 30 garments; median error ≤1 cm | measure, size facts, "Fits like" | (1) Keep LiDAR, gate on the confidence map and show ± or ask for one tape read when it is low. (2) Flat-lay plus a reference object (a card or a sheet of A4) for scale, from the photo only, so no LiDAR is needed. (3) Read size from the tag, and measure only pit-to-pit and length. |
| Identify by image search (no code on the item) | 3 | Top-5 accuracy of eBay `search_by_image` against SigLIP 2 + AI Search on used items; nobody published it | Both routes behind `harness.call('identify_image')` | 50 confirmed items; top-5 ≥ 80% for at least one route, and the two routes separated by more than run-to-run noise (databricks:461) | identify on clothes and furniture | (1) eBay image search first, with our index as the tiebreak. (2) Our own embeddings over the observations P1 collects (improves with every crawl). (3) A vision LLM reads brand and model text from the photos, then text search. Cheapest, and it fails on unbranded items. |
| Harness on the cloud browser for logged-in writes (Poshmark, Mercari, Facebook) | 2 | Bot detection and account bans (N8); replay-to-API speed asserted (selling-runs-itself:59) | Browser Use posting on one test account per site | 10 posts and 10 delists per site on throwaway accounts; ≥9 succeed; no warning | cross-listing to the non-API sites | (1) Browser Use with a persistent profile on the person's own device or IP (lowest detection). (2) Hand-off: the app prepares and the person taps "post" in the site's own app (zero ban risk, one tap). (3) Record the site's own private API calls once from the browser and call them directly (fastest; terms risk). |
| Assistant inline marks (card 21) | 3 | No shipped product marks words inline (clarifying-questions:125); Ben's catalog pending (B9) | `clarify` component on the search input | 20 people, 20 prompts each; Other rate and time to answer against chips; inline is no worse than chips by over 20% | assist, search, capture questions | (1) Inline marks as designed. (2) Chips under the input (Google retail pattern). (3) Inline marks on a long press, chips by default. Ship both behind the measure. |
| Evidence gate at precision ≥0.98 (messages) | 3 | Whether a guard can hit 0.98 on real buyer threads; whether the Gateway policy can read UC (databricks:605) | Gateway policy or in-job guard with a sample of 200 threads | 200 labelled threads; precision ≥0.98 at recall ≥0.6 | automatic replies | (1) A Gateway policy if it can read UC. (2) An in-job guard step in DBOS before send (no Gateway dependency). (3) Template-only replies for low-recall classes, with free text only above the bar. |
| Ranker inference (fit_ranker, visibility axis) | 2 | Whether a logged-out stand-in tracks real rank; no panel size (databricks:440) | observe_rank collection for one site | 20 control pairs; the stand-in's rank correlation above the 95th percentile of control noise | the score's visibility axis, title advice | (1) Plackett-Luce on observed logged-out rank, as designed. (2) eBay only at first, with the axis hidden elsewhere (databricks:335 already allows hiding). (3) Our own A/B on the person's listings (J7 opt-in) as ground truth. |
| SSE through the Databricks App proxy | 3 | The App's request timeout is unknown (§9.8) | `GET /v1/stream` with a 15 s heartbeat | Stream holds for 10 min across a Lakebase suspend | streamed first value, search batches | (1) SSE with a heartbeat. (2) SSE from the thin edge, which reads Lakebase notifications, so no long request hits the App. (3) Polling every 2 s during an active job (the 30 s fallback is too slow for first value). |
| Studio redraw faithfulness | 2 | Whether a redraw changes item pixels (B3); returns at level 2 (J17) | Cut-out + paste-back with a pixel-diff block on tag, label and flaw photos | 50 photos; zero item-pixel changes above threshold on blocked classes; a blind reviewer ranks redraws ≥ originals on 70% | studio, list photos | (1) Cut-out and paste-back only (safe). (2) Ben's ranked redraw with the block on protected classes. (3) Relight only (Seedream relighting note), with no geometry change. |
| Router learned demotion | 3 | Two rules (confusion 5); needs volume to learn | One Beta posterior per (site, verb, route) in `param` | Inject 30% failures on one route for an hour; it is demoted within 20 calls and recovers within 1 h of fixing | P1 reliability, cost | (1) Per-event Beta with forgetting (my proposal). (2) Circuit breaker only (open after N fails), with no learning. (3) Both: a breaker for outages, Beta for preference. |
| Delist speed across all sites | 2 | Three bars (confusion 6); Facebook has no event source | One bar: sale known → delisted elsewhere, p95 under 2 min | 5 sales on each site pair; time from the sale event to the last delist | cross-listing without double sales | (1) Official APIs and email push as designed, with Facebook marked "check by hand". (2) Mark as "pending sale" across sites on the first buyer message (pre-emptive hold). (3) List quantity 1 through one inventory owner, so the other sites read stock from us where they allow it (eBay does). |
| Object Capture / 3D for rigid items | 2 | Time is "a few minutes" (Apple); its use for identification is unproven (scan-to-images:88) | Background Object Capture after first value | 10 rigid items; model ready in under 5 min on device; renders identify as well as photos on top-5 | 3D, measure of rigid items | (1) Background only, never in first value. (2) LiDAR depth for dimensions, with no mesh. (3) Skip the mesh and use a short orbit video as the 3D view. |
| Market index (Card Ladder method on our observations) | 3 | Coverage of our own observations early | Weekly index from `observation` for 3 kinds | Rebuild one week from citations; zero differences (databricks:467); n_eff ≥6 for ≥60% of products in those kinds | market, insights, the data product | (1) Our own fold only. (2) Our fold, with treg or a vendor for products under n_eff 6. (3) eBay sold data only at first, with other sites as they fill. |

---

## Speed without losing real-time accuracy

Every row below is *my proposal*. Budgets are quoted from the spec. "Today" is where the design spends the time now.

### 1. First value after capture

- **Budget:**
  - "Glance, within 2 s, from the on-phone comp index", labelled rough (appraise:11);
  - Check within 10 s (appraise:13);
  - p50 time to identity of 9 s or less (identify:121);
  - a tee in under 70 s (capture:150).
- **Today:** capture finishes, then upload, then identify, then comps, then the range. The on-phone index already gives a rough glance.
- **Better:**
  - **Start identification on the first photo.** Run Vision barcode, OCR and an on-device embedding on frame 1 while the person takes shots 2 to N. Upload each shot as it is taken, and start a server identify job with the first.
    - *Saves* most of the 9 s, because identification overlaps capture.
    - *Risks* wasted calls when the first shot is poor, so cancel on a better candidate.
  - **A cached prior that the live calculation corrects.** Show the on-phone comp range labelled "rough" at once. Stream the D1 range when it lands, animate the bar to the new range, and change the label to "checked on N sales". If the live range moves outside the rough one, say "updated from 23 recent sales".
    - *Saves* the wait for the first number.
    - *Risks* anchoring on a wrong rough number, so show no midpoint, only the band, until it is checked.
  - **An approximate answer with a stated range beats waiting.** When identity is still between 2–3 candidates, show the union range labelled "one of these"; it does not wait for confirmation.
    - *Risks* a wide band; it narrows when the person taps a candidate (the clarify component).

### 2. Search results (buy)

- **Budget:**
  - p95 under 3 s to the product and the first batch, and under 10 s to the last site (buy:164);
  - 1.5 s to the first highlight (assist:237).
- **Today:** fan-out to the sites, with batches as they arrive, and the score per listing.
- **Better:**
  - **Precomputed and kept warm.** Our own index (P1 observations) answers first, under 1 s. Live site batches merge in as they arrive, and each row shows its age ("seen 4 min ago" or "live").
    - *Saves* the cold fan-out for the first batch.
    - *Risks* stale rows, so a row older than its next-check interval is marked and re-checked first.
  - **Stream partial results with the guarded number filling in.** Listing cards render with price and photo at once. The fair-range position and score fill in when D1 for that product is ready, and are greyed until then.
  - **Highlights from a local model.** Run the slot tagging for clarify marks on-device or on Haiku, separately from search, so 1.5 s does not wait for results.

### 3. A listing draft

- **Budget:**
  - `GET /v1/scores` p95 under 1 s on a warm store, with no fit or outside fetch on the path (score:46);
  - `POST /v1/valuations` returns 202 and streams stage events (price:113).
- **Today:** warm per kind and site already. That is the right design.
- **Better:**
  - **Incremental updates on each new observation.** When the harness writes a new comp for a product, recompute that product's D1 and range in the same job, and keep `score_state` current. The draft then reads it and never computes it.
    - *Saves* recompute at draft time.
    - *Risks* write amplification on popular products, so debounce to once per minute per product.
  - **Draft before the person asks.** When identity is confirmed, enqueue the draft per connected site (title per D4, fields, price per J10). Opening the List tab shows the finished draft.
    - *Risks* model cost on items never listed, so draft only the person's default sites.

### 4. A reply to a buyer

- **Budget:**
  - within 60 s of the site event (messages:134);
  - event to message row, p50 under 60 s (messages:135);
  - event to job start, under 1 min p95 (connect:166);
  - edge 2xx in under 1 s (sold:82).
- **Today:** webhook or email, then a job, then an agent draft, then the evidence gate, then send.
- **Better:**
  - **Precomputed offer rules.** V (value), the floor and the counter rule per listing are kept in `param` and the listing row. An offer within limits is answered deterministically in under 1 s after the event lands, with no model call. The agent writes only free-text replies.
    - *Saves* the model call on the commonest message.
    - *Risks* a tone mismatch, so templates are in the seller's style, learned from their sent messages.
  - **Classify first, then generate.** A Haiku classifier labels the message: offer, availability, question about a fact, or other. Availability and fact answers come from the item card with a citation. Only "other" goes to Sonnet.
    - *Risks* misclassification, which the evidence gate catches.
  - **Event sources:** eBay and Depop webhooks, and Gmail push for the rest. Polling remains only as reconcile.

### 5. A product page

- **Budget:** none stated. It builds on `product_snapshot`, daily (market:94). *My proposal:* p95 under 1.5 s to the page, with live listings within 5 s.
- **Today:** the daily snapshot.
- **Better:**
  - **Snapshot plus a live delta.** Render from the snapshot at once. A delta query adds observations since it was taken, and the chart's last point says "today, from N new sales".
    - *Saves* the fold at view time.
    - *Risks* a delta that disagrees with the fold's method, so the delta uses the same D1 code on fewer rows.
  - **Kept warm by demand.** Products viewed or watched in the last 7 days get their snapshot refreshed hourly instead of daily.

### 6. Delist after a sale (the costliest error)

- **Budget:** three bars today (confusion 6). *My proposal:* one bar, sale known → delisted elsewhere, p95 under 2 min, with sold:27's 5 min as the red line.
- **Better:**
  - Put a pre-emptive hold on the other sites at the first committed signal (an accepted offer, or a paid notice).
  - Make the delist job the first job a sale event creates, with no agent step.
  - *Risks* a hold on a sale that falls through, so the hold is reversed automatically when the order is cancelled.

### Where an approximate answer with a stated range beats waiting

- **Beats waiting:**
  - first value (a rough band, labelled);
  - search ordering before D1 is ready (price only, greyed position);
  - time to sell shown as a range from kind-level priors until the product's n_eff is 6 or more;
  - measurements with ± when depth confidence is low.
- **Does not beat waiting:**
  - an automatic counter or accept (it must use the guarded V and floor);
  - condition, size or authenticity (J20: never inferred);
  - the delist decision (exact).
