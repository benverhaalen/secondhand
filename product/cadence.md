# How often to check for a sale

**Proposed starting schedule: Depop 15 minutes hot, 120 minutes live; Poshmark 5 minutes hot, 23 minutes live; 240 minutes when quiet. eBay uses paid-order push, with a 15/120/240-minute missed-push backstop. Facebook local pickup uses completion events.** These are *inferred proposals*, computed on 2026-11-15 from the [marked evidence and assumptions](../research/sold/ben/check-interval-evidence.md). They have not changed production. The Mercari public-read model gives 5/23/240 minutes, but Nate's recorded no-timer ruling means **keep its timer off**. Facebook email gives 2/15/240 only in a hypothetical with working sale mail; keep it off until coverage exists. Neither conditional result is a deployed detection route.

**Hourly instead of every 15 minutes:** in the ordinary-state hypothetical, each action saves 2,160 checks/user-month and adds 22.5 minutes of mean delay. Depop saves **$2.6136 cash** but adds **$0.0768 seller delay harm**, or **4.6527 extra duplicate-sale events per 1,000 user-months**; including the assumed access reserve, modeled total falls $2.6243. Poshmark saves $0.0432 cash but adds $0.0615 harm; Mercari saves $0.0432 but adds $0.0607; hypothetical Facebook email saves $0.0216 but adds $0.0509. eBay's missed-push backstop saves $0.0216 and adds $0.0007 harm; successful pushes are unaffected. Reconcile saves $3.2400 and adds $0.3750 stale-state harm; session probes save $3.2400 and add $0.1500; comps save $0.2160 and add $0.0375. Rollups save $0.0216/add $0.00375, thresholds $0.0432/$0.0375, fits $2.1600/$0.0004, and retention scans $0.0216/$0.0004. These are *inferred arithmetic on assumptions*, not observed losses. The full per-action differences, reserves and refund amounts are below.

| Action | Proposed interval | What the curve actually supports |
|---|---|---|
| Depop signed-in sale sweep | hot 15 min; live 120 min; quiet 240 min | hot minimum 23, acceptable band 15 to 30; live band 120 to 240. Choose the faster end of each band. Four-hour quiet is the slowest tested value, not an unconstrained optimum. |
| Poshmark public listing checks | hot 5; live 23; quiet 240 min | ordinary flat band 23 to 30; hot 5. Public-page coverage and permitted access still need validation. |
| Mercari public listing checks | timer off; conditional economics 5/23/240 | Same cheap-read assumption as Poshmark. Access ruling and bot-wall coverage take precedence over the hypothetical. |
| Facebook local sale | completion event, no sale timer | Appointment reaches done; buyer interest/dibs alone is not a paid sale. |
| Facebook email | off; conditional economics 2/15/240 | No verified item-sale email coverage. A delivery lag or missing email does not disappear with faster polling. |
| eBay paid sale | signed push; no primary poll interval | Design assumes API approval/subscription; it is not a claim the connection is running. |
| eBay missed-push orders backstop | hot 15; live 120; quiet 240 min | 1% missed-push share is assumed. A failed notification channel needs an explicit degraded mode, not confidence in this prior. |
| Inventory reconcile | 60 min, plus immediately after uncertain writes/relink | Flat acceptable band 60 to 120; minimum tested at 120. The five-minute spec clock and nightly connect clock disagree. |
| Session health probe | 120 min, plus before an action; refresh by actual expiry | Model minimum 120. A probe notices expiry; periodic probing cannot make a revoked login work. |
| Seller comps | 60 min, plus a fresh read before a consequential price action | Flat minimum 60 under the assumed material-change cost. This does not schedule buyer wants. |
| Seller rollups | 60 min | Flat minimum 60 in an assumed seller-staleness scenario. |
| Threshold evaluation | 23 min | Flat band 23 to 30, minimum 30. No measured precision gain from doing this more often. |
| Parameter fits | keep nightly 02:00 America/Chicago | Four hours is the best point on this short grid; it is a boundary. It cannot establish that retraining more often than the existing daily fold is better. |
| Retention | keep daily scan and applicable deletion deadlines | Four hours is a grid boundary, not a privacy recommendation. A delayed-deletion request is event work, not a polling tradeoff. |

*Observed locally, read 2026-11-15:* [scheduler](../app/src/edge/events/schedule.ts) reads numeric `watch_cadence_s` rows by site and state; its [tests](../app/src/edge/events/schedule.test.ts) use 90/900/3600 seconds. [Watcher state selection](../app/src/edge/events/watcher.ts) is hot for open offers, awaiting replies or the hour after posting, live while any listing is live, quiet when none is live. Likes/watchers alone and listing age do not change that state today. The proposed **intervals** fit existing rows. Extending the classifier to likes/watchers is a separate unbuilt change owned with Nate's watcher work. See [evidence S11](../research/sold/ben/check-interval-evidence.md#s11-what-the-code-can-express-today).

## What is being minimized

*Assumption, dated 2026-11-15:* the modeled user has one linked account per site, ten public listing pages/site, and two first sales/site/month. The month has 30 days. This is an active seller hypothetical, **not the average monthly app user**. Each public check covers ten pages; a signed-in Depop sweep covers the account once. Scale account count, active days, inventory and sales before using these dollars for another person. The 43 exact input records and their ranges are in [the evidence manifest](../research/sold/ben/check-interval-evidence.md#complete-input-manifest); every input has `value`, `unit`, `mark`, `source`.

*Inferred, dated 2026-11-15:* for interval I in minutes, runs = 30 × 1,440 / I. Check cash = runs × per-run cost. Depop is $0.00121/run, public ten-page checks $0.00002/run, mail/API polls $0.00001/run, with separate maintenance allocations. The [current supplier price](https://browser-use.com/pricing), read 2026-11-15, is *observed*: $0.06/browser-hour plus traffic. The sweep duration, payload and job allocation are *assumptions*. Model calls are unnecessary for a normal deterministic sale-state read; their possible repair cost is unpriced.

*Inferred, dated 2026-11-15:* for a first sale on s, let H = sum(1/Tj) for the other four sites, k=4 and harmonic T=k/H. The script imports ROI's `doubleSaleRate` and computes **P = 1 − exp(−k × w / (T × 1,440))**, with mean window w = I/2 + two minutes for confirmation and parallel delisting. The two minutes are an *assumed design budget*, not measured p95. Multiply P by first sales on s and by the hazard-weighted cancellation loss on the competing sites. Facebook mail adds an assumed two-minute delivery lag. eBay backstop harm affects only the assumed missed-push fraction. There is no interval on an eBay event received by our endpoint.

*Inferred, dated 2026-11-15:* for Depop at 15 minutes, H = 1/90 + 1/30 + 1/30 + 1/14 = 0.14920635/day; w=9.5 minutes. P=0.0009838679, or 0.9839 duplicate events per 1,000 first sales. At two first sales/month, the expected duplicate count is 0.0019677. Cash is 2,880 × $0.00121 = $3.4848. The access reserve is $100 × (1 − exp(−0.001)) = $0.1000. Delay harm is $0.0325. Total is $3.6172. Change an input in [the script](../scripts/bench/cadence.mjs) to recompute every row.

*Observed policy facts, read 2026-11-15:* [eBay cancellations](https://www.ebay.com/help/policies/member-behavior-policies/order-cancellation-policy?id=5298) can create defects; [Poshmark's current Seller Policy](https://poshmark.com/terms) has a 3% cancelled/unshipped threshold over 90 days; [Depop](https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges) reverses transaction fees on a refunded Depop Payments sale; [Mercari](https://www.mercari.com/us/help_center/article/251/) can charge 5%, capped at $25. The model separately assumes seller time, goodwill and expected standing damage. A buyer's refund reverses duplicate proceeds, so **item-price refunds are reported separately from economic harm**. Shipping/tax refunds, buyer money tied up and account thresholds can make the real experience worse. [Evidence S1 to S5](../research/sold/ben/check-interval-evidence.md#s1-what-an-ebay-cancellation-does) gives the policies, ranges and dollar construction.

*Assumption, dated 2026-11-15:* access-loss hazard grows as b × (15/I)^1.5, with b=0.001 for Depop and 0.0001 for public Poshmark/Mercari, and incident loss $100. The reserve is not cash paid to a supplier and **is not measured ban risk**. It includes possible seller restriction, support or source access loss. Poshmark's [robots.txt](https://poshmark.com/robots.txt), directly fetched 2026-11-15, disallows `/search`; its [terms](https://poshmark.com/terms) bar broad automated collection. Public listing reads avoid search, but a logged-out read does not establish permission. [Evidence S8](../research/sold/ben/check-interval-evidence.md#s8-automated-access-and-observed-enforcement) records the routes, terms and access failures.

*Inferred, dated 2026-11-15:* maintenance drift harm is material changes/user-month × loss/stale-hour × I/120. The base rates and values are assumptions. Slower reconcile leaves inventory discrepancies unresolved longer; slower session probes leave outages hidden longer; slower comps leave a valuation behind the market. Offers/messages already arriving in a sweep can also be delayed. **The total below is the partial cadence objective: check cash + access reserve + modeled delay harm.** Interval-independent first-sale confirmation/delist cost, platform fixed cost, reply/offer conversion losses, other maintenance-read restrictions, outages and support remain outside that total. Adding a constant handling cost changes the absolute monthly total and relative 10% band, but not the minimizing interval or the hourly differences. We cannot honestly price an all-in seller outcome without those inputs.

## Recomputed tables

All tables in this section are *inferred*, run 2026-11-15 from [cadence.mjs](../scripts/bench/cadence.mjs) and its [43 marked inputs](../research/sold/ben/check-interval-evidence.md#complete-input-manifest). Commands: `node --test scripts/bench/cadence.test.mjs` and `node scripts/bench/cadence.mjs`. Use Node with native TypeScript support because the existing ROI module imports `keep.ts`; this run uses installed Node 24.21.0. No new dependency is needed.

The first summary and per-action tables use ordinary demand with no hot-state mixture. The later adaptive table compares identical state exposure on both sides. “Within 10%” lists every tested interval whose objective is at most 1.10 times the tested minimum; intermediate minutes were not tested. Treat the listed points as a choice range. A boundary minimum is not proof of a global optimum. For fits/retention, the daily policy clock lies outside this minute grid. Each action's row is a component, not an independent whole product: see the timer inventory below before adding them.

<!-- model-output -->

All dollar rows are per hypothetical linked user per 30-day month. Partial cadence cost: check cash + access reserve + delay harm. Interval-independent sale handling is excluded. Conditional model, not measured outcomes.

| Action | Grid minimum min | Within 10% min | Total $ | Grid boundary? |
|---|---:|---|---:|---|
| Depop signed-in sweep | 240 | 120, 240 | 0.6338 | yes |
| Poshmark public pages | 30 | 23, 30 | 0.0789 | no |
| Mercari public pages (conditional) | 30 | 23, 30 | 0.0782 | no |
| Facebook email (hypothetical) | 23 | 15, 23, 30 | 0.0539 | no |
| eBay missed-push backstop | 120 | 120, 240 | 0.0056 | no |
| Reconcile non-sale inventory drift | 120 | 60, 120 | 1.5400 | no |
| Session health probe | 120 | 120 | 0.9400 | no |
| Seller comps refresh | 60 | 60 | 0.1220 | no |
| Seller analytics rollups | 60 | 60 | 0.0122 | no |
| Threshold evaluation | 30 | 23, 30 | 0.0538 | no |
| Nightly parameter fits | 240 | 240 | 0.1820 | yes |
| Daily retention scan | 240 | 240 | 0.0038 | yes |

### Depop signed-in sweep

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 52.2720 | 5.6439 | 0.0085 | 57.9245 | 0.2590 |
| 2 | 21600.0 | 26.1360 | 2.0330 | 0.0103 | 28.1793 | 0.3108 |
| 5 | 8640.0 | 10.4544 | 0.5183 | 0.0154 | 10.9880 | 0.4662 |
| 10 | 4320.0 | 5.2272 | 0.1835 | 0.0239 | 5.4347 | 0.7250 |
| 15 | 2880.0 | 3.4848 | 0.1000 | 0.0325 | 3.6172 | 0.9839 |
| 23 | 1878.3 | 2.2727 | 0.0527 | 0.0461 | 2.3715 | 1.3978 |
| 30 | 1440.0 | 1.7424 | 0.0353 | 0.0581 | 1.8358 | 1.7599 |
| 60 | 720.0 | 0.8712 | 0.0125 | 0.1092 | 0.9929 | 3.3102 |
| 120 | 360.0 | 0.4356 | 0.0044 | 0.2113 | 0.6513 | 6.4036 |
| 240 | 180.0 | 0.2178 | 0.0016 | 0.4144 | 0.6338 | 12.5615 |

### Poshmark public pages

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 0.8640 | 0.5793 | 0.0068 | 1.4501 | 0.2149 |
| 2 | 21600.0 | 0.4320 | 0.2052 | 0.0082 | 0.6454 | 0.2579 |
| 5 | 8640.0 | 0.1728 | 0.0519 | 0.0123 | 0.2371 | 0.3868 |
| 10 | 4320.0 | 0.0864 | 0.0184 | 0.0192 | 0.1239 | 0.6017 |
| 15 | 2880.0 | 0.0576 | 0.0100 | 0.0260 | 0.0936 | 0.8165 |
| 23 | 1878.3 | 0.0376 | 0.0053 | 0.0370 | 0.0798 | 1.1600 |
| 30 | 1440.0 | 0.0288 | 0.0035 | 0.0465 | 0.0789 | 1.4606 |
| 60 | 720.0 | 0.0144 | 0.0012 | 0.0875 | 0.1032 | 2.7475 |
| 120 | 360.0 | 0.0072 | 0.0004 | 0.1694 | 0.1770 | 5.3165 |
| 240 | 180.0 | 0.0036 | 0.0002 | 0.3324 | 0.3361 | 10.4346 |

### Mercari public pages (conditional)

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 0.8640 | 0.5793 | 0.0068 | 1.4500 | 0.2149 |
| 2 | 21600.0 | 0.4320 | 0.2052 | 0.0081 | 0.6453 | 0.2579 |
| 5 | 8640.0 | 0.1728 | 0.0519 | 0.0122 | 0.2369 | 0.3868 |
| 10 | 4320.0 | 0.0864 | 0.0184 | 0.0189 | 0.1237 | 0.6017 |
| 15 | 2880.0 | 0.0576 | 0.0100 | 0.0256 | 0.0932 | 0.8165 |
| 23 | 1878.3 | 0.0376 | 0.0053 | 0.0364 | 0.0793 | 1.1600 |
| 30 | 1440.0 | 0.0288 | 0.0035 | 0.0459 | 0.0782 | 1.4606 |
| 60 | 720.0 | 0.0144 | 0.0012 | 0.0863 | 0.1020 | 2.7475 |
| 120 | 360.0 | 0.0072 | 0.0004 | 0.1670 | 0.1746 | 5.3165 |
| 240 | 180.0 | 0.0036 | 0.0002 | 0.3278 | 0.3315 | 10.4346 |

### Facebook email (hypothetical)

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 0.4320 | 0.0000 | 0.0102 | 0.4422 | 0.2678 |
| 2 | 21600.0 | 0.2160 | 0.0000 | 0.0113 | 0.2273 | 0.2976 |
| 5 | 8640.0 | 0.0864 | 0.0000 | 0.0147 | 0.1011 | 0.3868 |
| 10 | 4320.0 | 0.0432 | 0.0000 | 0.0204 | 0.0636 | 0.5356 |
| 15 | 2880.0 | 0.0288 | 0.0000 | 0.0260 | 0.0548 | 0.6843 |
| 23 | 1878.3 | 0.0188 | 0.0000 | 0.0351 | 0.0539 | 0.9222 |
| 30 | 1440.0 | 0.0144 | 0.0000 | 0.0430 | 0.0574 | 1.1303 |
| 60 | 720.0 | 0.0072 | 0.0000 | 0.0769 | 0.0841 | 2.0218 |
| 120 | 360.0 | 0.0036 | 0.0000 | 0.1447 | 0.1483 | 3.8023 |
| 240 | 180.0 | 0.0018 | 0.0000 | 0.2798 | 0.2816 | 7.3538 |

### eBay missed-push backstop

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 0.4320 | 0.0000 | 0.0001 | 0.4321 | 0.0025 |
| 2 | 21600.0 | 0.2160 | 0.0000 | 0.0001 | 0.2161 | 0.0030 |
| 5 | 8640.0 | 0.0864 | 0.0000 | 0.0001 | 0.0865 | 0.0046 |
| 10 | 4320.0 | 0.0432 | 0.0000 | 0.0002 | 0.0434 | 0.0071 |
| 15 | 2880.0 | 0.0288 | 0.0000 | 0.0003 | 0.0291 | 0.0096 |
| 23 | 1878.3 | 0.0188 | 0.0000 | 0.0004 | 0.0192 | 0.0137 |
| 30 | 1440.0 | 0.0144 | 0.0000 | 0.0005 | 0.0149 | 0.0172 |
| 60 | 720.0 | 0.0072 | 0.0000 | 0.0010 | 0.0082 | 0.0324 |
| 120 | 360.0 | 0.0036 | 0.0000 | 0.0020 | 0.0056 | 0.0627 |
| 240 | 180.0 | 0.0018 | 0.0000 | 0.0039 | 0.0057 | 0.1230 |

### Reconcile non-sale inventory drift

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 64.8000 | 0.0000 | 0.0083 | 64.8083 | n/a |
| 2 | 21600.0 | 32.4000 | 0.0000 | 0.0167 | 32.4167 | n/a |
| 5 | 8640.0 | 12.9600 | 0.0000 | 0.0417 | 13.0017 | n/a |
| 10 | 4320.0 | 6.4800 | 0.0000 | 0.0833 | 6.5633 | n/a |
| 15 | 2880.0 | 4.3200 | 0.0000 | 0.1250 | 4.4450 | n/a |
| 23 | 1878.3 | 2.8174 | 0.0000 | 0.1917 | 3.0091 | n/a |
| 30 | 1440.0 | 2.1600 | 0.0000 | 0.2500 | 2.4100 | n/a |
| 60 | 720.0 | 1.0800 | 0.0000 | 0.5000 | 1.5800 | n/a |
| 120 | 360.0 | 0.5400 | 0.0000 | 1.0000 | 1.5400 | n/a |
| 240 | 180.0 | 0.2700 | 0.0000 | 2.0000 | 2.2700 | n/a |

### Session health probe

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 64.8000 | 0.0000 | 0.0033 | 64.8033 | n/a |
| 2 | 21600.0 | 32.4000 | 0.0000 | 0.0067 | 32.4067 | n/a |
| 5 | 8640.0 | 12.9600 | 0.0000 | 0.0167 | 12.9767 | n/a |
| 10 | 4320.0 | 6.4800 | 0.0000 | 0.0333 | 6.5133 | n/a |
| 15 | 2880.0 | 4.3200 | 0.0000 | 0.0500 | 4.3700 | n/a |
| 23 | 1878.3 | 2.8174 | 0.0000 | 0.0767 | 2.8941 | n/a |
| 30 | 1440.0 | 2.1600 | 0.0000 | 0.1000 | 2.2600 | n/a |
| 60 | 720.0 | 1.0800 | 0.0000 | 0.2000 | 1.2800 | n/a |
| 120 | 360.0 | 0.5400 | 0.0000 | 0.4000 | 0.9400 | n/a |
| 240 | 180.0 | 0.2700 | 0.0000 | 0.8000 | 1.0700 | n/a |

### Seller comps refresh

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 4.3200 | 0.0000 | 0.0008 | 4.3208 | n/a |
| 2 | 21600.0 | 2.1600 | 0.0000 | 0.0017 | 2.1617 | n/a |
| 5 | 8640.0 | 0.8640 | 0.0000 | 0.0042 | 0.8682 | n/a |
| 10 | 4320.0 | 0.4320 | 0.0000 | 0.0083 | 0.4403 | n/a |
| 15 | 2880.0 | 0.2880 | 0.0000 | 0.0125 | 0.3005 | n/a |
| 23 | 1878.3 | 0.1878 | 0.0000 | 0.0192 | 0.2070 | n/a |
| 30 | 1440.0 | 0.1440 | 0.0000 | 0.0250 | 0.1690 | n/a |
| 60 | 720.0 | 0.0720 | 0.0000 | 0.0500 | 0.1220 | n/a |
| 120 | 360.0 | 0.0360 | 0.0000 | 0.1000 | 0.1360 | n/a |
| 240 | 180.0 | 0.0180 | 0.0000 | 0.2000 | 0.2180 | n/a |

### Seller analytics rollups

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 0.4320 | 0.0000 | 0.0001 | 0.4321 | n/a |
| 2 | 21600.0 | 0.2160 | 0.0000 | 0.0002 | 0.2162 | n/a |
| 5 | 8640.0 | 0.0864 | 0.0000 | 0.0004 | 0.0868 | n/a |
| 10 | 4320.0 | 0.0432 | 0.0000 | 0.0008 | 0.0440 | n/a |
| 15 | 2880.0 | 0.0288 | 0.0000 | 0.0013 | 0.0301 | n/a |
| 23 | 1878.3 | 0.0188 | 0.0000 | 0.0019 | 0.0207 | n/a |
| 30 | 1440.0 | 0.0144 | 0.0000 | 0.0025 | 0.0169 | n/a |
| 60 | 720.0 | 0.0072 | 0.0000 | 0.0050 | 0.0122 | n/a |
| 120 | 360.0 | 0.0036 | 0.0000 | 0.0100 | 0.0136 | n/a |
| 240 | 180.0 | 0.0018 | 0.0000 | 0.0200 | 0.0218 | n/a |

### Threshold evaluation

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 0.8640 | 0.0000 | 0.0008 | 0.8648 | n/a |
| 2 | 21600.0 | 0.4320 | 0.0000 | 0.0017 | 0.4337 | n/a |
| 5 | 8640.0 | 0.1728 | 0.0000 | 0.0042 | 0.1770 | n/a |
| 10 | 4320.0 | 0.0864 | 0.0000 | 0.0083 | 0.0947 | n/a |
| 15 | 2880.0 | 0.0576 | 0.0000 | 0.0125 | 0.0701 | n/a |
| 23 | 1878.3 | 0.0376 | 0.0000 | 0.0192 | 0.0567 | n/a |
| 30 | 1440.0 | 0.0288 | 0.0000 | 0.0250 | 0.0538 | n/a |
| 60 | 720.0 | 0.0144 | 0.0000 | 0.0500 | 0.0644 | n/a |
| 120 | 360.0 | 0.0072 | 0.0000 | 0.1000 | 0.1072 | n/a |
| 240 | 180.0 | 0.0036 | 0.0000 | 0.2000 | 0.2036 | n/a |

### Nightly parameter fits

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 43.2000 | 0.0000 | 0.0000 | 43.2000 | n/a |
| 2 | 21600.0 | 21.6000 | 0.0000 | 0.0000 | 21.6000 | n/a |
| 5 | 8640.0 | 8.6400 | 0.0000 | 0.0000 | 8.6400 | n/a |
| 10 | 4320.0 | 4.3200 | 0.0000 | 0.0001 | 4.3201 | n/a |
| 15 | 2880.0 | 2.8800 | 0.0000 | 0.0001 | 2.8801 | n/a |
| 23 | 1878.3 | 1.8783 | 0.0000 | 0.0002 | 1.8785 | n/a |
| 30 | 1440.0 | 1.4400 | 0.0000 | 0.0003 | 1.4403 | n/a |
| 60 | 720.0 | 0.7200 | 0.0000 | 0.0005 | 0.7205 | n/a |
| 120 | 360.0 | 0.3600 | 0.0000 | 0.0010 | 0.3610 | n/a |
| 240 | 180.0 | 0.1800 | 0.0000 | 0.0020 | 0.1820 | n/a |

### Daily retention scan

| Interval min | Runs | Cash $ | Access reserve $ | Delay harm $ | Total $ | Double sales / 1,000 first sales |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 43200.0 | 0.4320 | 0.0000 | 0.0000 | 0.4320 | n/a |
| 2 | 21600.0 | 0.2160 | 0.0000 | 0.0000 | 0.2160 | n/a |
| 5 | 8640.0 | 0.0864 | 0.0000 | 0.0000 | 0.0864 | n/a |
| 10 | 4320.0 | 0.0432 | 0.0000 | 0.0001 | 0.0433 | n/a |
| 15 | 2880.0 | 0.0288 | 0.0000 | 0.0001 | 0.0289 | n/a |
| 23 | 1878.3 | 0.0188 | 0.0000 | 0.0002 | 0.0190 | n/a |
| 30 | 1440.0 | 0.0144 | 0.0000 | 0.0003 | 0.0147 | n/a |
| 60 | 720.0 | 0.0072 | 0.0000 | 0.0005 | 0.0077 | n/a |
| 120 | 360.0 | 0.0036 | 0.0000 | 0.0010 | 0.0046 | n/a |
| 240 | 180.0 | 0.0018 | 0.0000 | 0.0020 | 0.0038 | n/a |

### Hourly instead of 15 minutes

| Action | Cash saved $ | Access reserve saved $ | Extra harm $ | Net total change $ | Extra double sales / 1,000 user-months | Extra item refunds $ |
|---|---:|---:|---:|---:|---:|---:|
| Depop signed-in sweep | 2.6136 | 0.0875 | 0.0768 | -2.6243 | 4.6527 | 0.1535 |
| Poshmark public pages | 0.0432 | 0.0087 | 0.0615 | 0.0096 | 3.8622 | 0.1275 |
| Mercari public pages (conditional) | 0.0432 | 0.0087 | 0.0607 | 0.0087 | 3.8622 | 0.1275 |
| Facebook email (hypothetical) | 0.0216 | 0.0000 | 0.0509 | 0.0293 | 2.6749 | 0.0883 |
| eBay missed-push backstop | 0.0216 | 0.0000 | 0.0007 | -0.0209 | 0.0455 | 0.0015 |
| Reconcile non-sale inventory drift | 3.2400 | 0.0000 | 0.3750 | -2.8650 | 0.0000 | 0.0000 |
| Session health probe | 3.2400 | 0.0000 | 0.1500 | -3.0900 | 0.0000 | 0.0000 |
| Seller comps refresh | 0.2160 | 0.0000 | 0.0375 | -0.1785 | 0.0000 | 0.0000 |
| Seller analytics rollups | 0.0216 | 0.0000 | 0.0037 | -0.0179 | 0.0000 | 0.0000 |
| Threshold evaluation | 0.0432 | 0.0000 | 0.0375 | -0.0057 | 0.0000 | 0.0000 |
| Nightly parameter fits | 2.1600 | 0.0000 | 0.0004 | -2.1596 | 0.0000 | 0.0000 |
| Daily retention scan | 0.0216 | 0.0000 | 0.0004 | -0.0212 | 0.0000 | 0.0000 |

### Adaptive against flat intervals on the same state mixture

| Action | hot/live/quiet min | Adaptive cash $ | Adaptive reserve $ | Adaptive harm $ | Adaptive total $ | Global adaptive minimum $ | Above minimum % | Best flat min | Best flat total $ | Flat 15 $ | Flat 60 $ |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Depop signed-in sweep | 15/120/240 | 0.5445 | 0.0086 | 0.2504 | 0.8036 | 0.7545 | 6.51 | 120 | 1.2958 | 3.7190 | 1.3313 |
| Poshmark public pages | 5/23/240 | 0.0372 | 0.0065 | 0.0671 | 0.1108 | 0.1091 | 1.51 | 15 | 0.1674 | 0.1674 | 0.3734 |
| Mercari public pages (conditional) | 5/23/240 | 0.0372 | 0.0065 | 0.0661 | 0.1099 | 0.1081 | 1.61 | 15 | 0.1659 | 0.1659 | 0.3684 |
| Facebook email (hypothetical) | 2/15/240 | 0.0328 | 0.0000 | 0.0565 | 0.0893 | 0.0876 | 1.86 | 10 | 0.1276 | 0.1366 | 0.3240 |
| eBay missed-push backstop | 15/120/240 | 0.0045 | 0.0000 | 0.0024 | 0.0069 | 0.0067 | 2.34 | 60 | 0.0114 | 0.0301 | 0.0114 |

### State optima and within-10% intervals

| Action | State | Minimum min | Within 10% min | Proposed min |
|---|---|---:|---|---:|
| Depop signed-in sweep | hot | 23 | 15, 23, 30 | 15 |
| Depop signed-in sweep | live | 240 | 120, 240 | 120 |
| Depop signed-in sweep | quiet | 240 | 240 | 240 |
| Poshmark public pages | hot | 5 | 5 | 5 |
| Poshmark public pages | live | 30 | 23, 30 | 23 |
| Poshmark public pages | quiet | 240 | 240 | 240 |
| Mercari public pages (conditional) | hot | 5 | 5 | 5 |
| Mercari public pages (conditional) | live | 30 | 23, 30 | 23 |
| Mercari public pages (conditional) | quiet | 240 | 240 | 240 |
| Facebook email (hypothetical) | hot | 2 | 2 | 2 |
| Facebook email (hypothetical) | live | 23 | 15, 23, 30 | 15 |
| Facebook email (hypothetical) | quiet | 240 | 240 | 240 |
| eBay missed-push backstop | hot | 23 | 15, 23, 30 | 15 |
| eBay missed-push backstop | live | 240 | 120, 240 | 120 |
| eBay missed-push backstop | quiet | 240 | 240 | 240 |

### Sale sensitivity: optimal flat minutes / monthly total $

| Scenario | Depop | Poshmark | Mercari | Facebook email | eBay backstop |
|---|---|---|---|---|---|
| base | 240 / 0.6338 | 30 / 0.0789 | 30 / 0.0782 | 23 / 0.0539 | 120 / 0.0056 |
| no access incidents | 240 / 0.6322 | 23 / 0.0745 | 23 / 0.0740 | 23 / 0.0539 | 120 / 0.0056 |
| all sites 7-day mean | 120 / 1.3412 | 15 / 0.2015 | 15 / 0.1999 | 10 / 0.1790 | 60 / 0.0114 |
| no competing Facebook checkout | 240 / 0.4742 | 30 / 0.0564 | 30 / 0.0558 | 23 / 0.0539 | 240 / 0.0041 |
| 10x clustered hazard | 60 / 1.9597 | 10 / 0.2959 | 10 / 0.2932 | 5 / 0.2333 | 60 / 0.0174 |
| 10 first sales/site/month | 60 / 1.4298 | 15 / 0.1976 | 15 / 0.1958 | 10 / 0.1451 | 60 / 0.0124 |
| one public page | 240 / 0.6338 | 23 / 0.0629 | 23 / 0.0624 | 23 / 0.0539 | 120 / 0.0056 |
| public requests cost zero | 240 / 0.6338 | 23 / 0.0610 | 23 / 0.0605 | 23 / 0.0539 | 120 / 0.0056 |
| Mercari all reads browser | 240 / 0.6338 | 30 / 0.0789 | 240 / 2.4915 | 23 / 0.0539 | 120 / 0.0056 |
| residential Depop traffic | 240 / 1.4978 | 30 / 0.0789 | 30 / 0.0782 | 23 / 0.0539 | 120 / 0.0056 |
| no trust or standing shadow cost | 240 / 0.3077 | 60 / 0.0352 | 60 / 0.0340 | 60 / 0.0220 | 240 / 0.0027 |
| 10-minute confirmation/delist | 240 / 0.6608 | 30 / 0.1007 | 30 / 0.0998 | 23 / 0.0720 | 120 / 0.0059 |

### Numeric param proposal (production profile)

```json
{
  "watch_cadence_s@depop/hot": 900,
  "watch_cadence_s@depop/live": 7200,
  "watch_cadence_s@depop/quiet": 14400,
  "watch_cadence_s@poshmark/hot": 300,
  "watch_cadence_s@poshmark/live": 1380,
  "watch_cadence_s@poshmark/quiet": 14400,
  "watch_cadence_s@mercari/hot": 300,
  "watch_cadence_s@mercari/live": 1380,
  "watch_cadence_s@mercari/quiet": 14400,
  "watch_cadence_s@facebook/hot": 120,
  "watch_cadence_s@facebook/live": 900,
  "watch_cadence_s@facebook/quiet": 14400,
  "watch_cadence_s@ebay/hot": 900,
  "watch_cadence_s@ebay/live": 7200,
  "watch_cadence_s@ebay/quiet": 14400
}
```

ROI legacy Depop anchor: $0.1/account-day. This model at 15 min: $0.1162/day; traffic and allocated job cost included.

<!-- model-output-end -->

## Adaptive state and the param rows

*Assumption, dated 2026-11-15:* hot occupies 5% of the account-month, live 75%, quiet 20%; hot contains 35% of first sales and has 10x the competing-site hazard. The blend uses **time shares for checks and access hazard, sale shares for duplicate-sale harm**. It sums incident hazards before converting to a monthly probability. Quiet has no live listing, so it checks no public listing pages and creates no double-sale harm; the residual empty-job allocation is retained. These priors are replaceable inputs, not observed usage.

*Inferred, dated 2026-11-15:* the script chooses the fastest tested interval within each state's 10% band, then checks the complete profile against the minimum over all 1,000 combinations. That is a preference for less delay within a nearly flat curve. The adaptive comparison holds occupancy, sale shares, clustering, listing count and costs fixed; changing them just for the flattering column would make the comparison invalid. The all-ordinary table is not the baseline for the enriched hot mixture.

*Asserted timing evidence, read 2026-11-15:* [FLUF's eBay Apparel & Accessories sample](https://fluf.io/resale-data/ebay/) reports 68% within seven days; [its Depop jackets sample](https://fluf.io/resale-data/depop/) reports 49%. Other categories are much slower. This supports checking early demand explicitly, but it does not prove how many sales occur in the first hour, how long a like stays predictive, or that one new item makes a large account hot. [Evidence S7](../research/sold/ben/check-interval-evidence.md#s7-time-to-sale-evidence-does-not-identify-the-hazard-we-need) distinguishes sold samples, means, medians and hazard assumptions.

*Agent proposal, inferred 2026-11-15:* keep the implemented state definitions for a param-only trial: hot for the recorded first hour, open offers and conversations awaiting a reply; live after that while inventory is live; quiet only after the last live listing is gone. An offer can keep hot active until it closes/expires; it has no fixed one-day lifetime in this model. A future classifier could also make a like/watcher hot for the next hour, reset by each new signal, but **one hour is an assumption**, with a proposed sensitivity range from one hour through seven days. It is not implemented by an interval row. Do not call an old live listing quiet just to save money: that changes sale exposure as well as cadence.

*Observed implementation limit, read 2026-11-15:* the JSON above has the exact existing `watch_cadence_s@<site>/<state>` shape from [ports.ts](../app/src/edge/events/ports.ts). Numeric changes need no scheduler rewrite. **Those rows affect the current account sweep, not a separately priced public-reader service or mailbox that does not exist.** For Poshmark/Mercari the cost curve assumes the ladder's cheap public trigger; the current [watcher](../app/src/edge/events/watcher.ts) can read four signed-in sections and storefront stats. Applying the numbers to that full sweep would buy a different workload. Nate must route each existing job to the intended ladder step before its cheap-route bill can be claimed. No harness or route was edited here. The eBay rows are backstop settings, and the Facebook rows describe the hypothetical email comparison only; neither overrides its normal event route.

*Inferred, dated 2026-11-15:* at 15 minutes, a ten-page public check makes 960 page requests/account/day; hourly makes 240. For 100 pages it is 9,600 versus 2,400. Signed-in Depop sweeps are 96 versus 24, with multiple requests possible inside each. These counts can drive source limits even when dollars look small. eBay's [observed default quotas](https://developer.ebay.com/develop/api/sell/api_call_limits), read 2026-11-15, are shared capacity constraints, not a measured safe frequency for other sites. No site published a generally safe automation interval in the sources read.

## Stage mode, design only

*Agent proposal, inferred 2026-11-15:* use a **server-selected stage param profile on a dedicated demo backend/account set**. Copy the production keys above and set the numeric values to ten seconds. The pure model's `stageRows()` does exactly that; its test checks equal keys, numeric values and unchanged production rows. Deploying that profile is Nate's integration work. Leave paused-account handling, leases, idempotency, policy checks, authoritative order reads and the delist/read-back path the same. No on-screen label is added.

*Observed code constraint, read 2026-11-15:* adding `watch_cadence_s@depop/stage` alone would do nothing: [stateOf](../app/src/edge/events/watcher.ts) returns only hot/live/quiet, and their more-specific rows win over site defaults in [memoryParams](../app/src/edge/events/ports.ts). So the design uses an isolated profile with the **existing** keys, rather than claiming a fourth runtime tier already works. Select the profile before the scheduler starts, since a param edit changes the next due time after the scheduled sweep; it does not pull an old due time forward. A timer runner must actually tick at least that frequently. Ten-second params on a once-per-minute runner cannot make ten-second checks.

*Inferred, dated 2026-11-15:* production and stage run the same sale path: cheap hint or due sweep, authoritative paid-order confirmation, one sale claim, delist jobs, read-back. Real eBay notifications remain event-driven. A backstage “check now” trigger may enqueue the same leased sweep, but it must never manufacture a paid order or bypass read-back. Where no real site can be touched, follow the [demo constitution](constitutions/demo.md) and distinguish demo data/recordings when asked. The stage clock compresses detection, not a buyer payment or a successful delist that did not occur.

If a judge asks, we say the stage rate is faster than production, and give the production rate.

*Assumption/inferred, dated 2026-11-15:* at one billed browser-minute/sweep, Depop every ten seconds would consume six billed minutes per wall-clock minute, about $0.00726 cash/minute under this model. Billed time does not establish elapsed duration. If a sweep actually takes one minute, six cannot finish per minute on one leased account. A persistent, already-open browser/event hint may be needed; measure duration and coverage before promising that speed. A numeric setting cannot prove the stage rate is achievable. Keep this as a design until the same end-to-end path has three clean rehearsals under [D2](constitutions/demo.md#rules). Do not touch Nate's harness to simulate success.

## Timer inventory and what may be added together

*Observed repository inventory, read 2026-11-15:* this table covers recurring sell-side work in the requested files and the deployment bundle, not every timeout in the codebase. Source: [evidence S11](../research/sold/ben/check-interval-evidence.md#s11-what-the-code-can-express-today).

| Existing or planned timer | Model treatment |
|---|---|
| Per-site sale checks | Separate five site curves; eBay's main route is push and Facebook's local route is completion. Conditional mailbox/public routes are marked. |
| `poll_orders` every 60 seconds in databricks §4.16 | The one-minute point in each site's sale/backstop curve. It is an alternative to that sale sweep, not an additional independent sale-protection benefit. |
| Inbox, offers, notifications and storefront reads in watcher.ts | Already share the account sweep's duration assumption. Do not charge four extra independent timers. Reply/offer delay harm is unpriced and may rule out a slow sweep. |
| Reconcile every five minutes in databricks §4.8, nightly in connect | One reconcile curve, with explicit non-sale drift prior. Run after unknown writes/relink regardless of the periodic backstop. Do not count order detection twice. |
| Session health every 30 minutes | Session curve for periodic detection. Token refresh by expiry and relink remain event-driven requirements. |
| Hourly comps and rollups | Separate seller valuation and presentation-staleness curves. Shared global refresh costs must be amortised across served users, not charged anew to everyone. |
| Hourly threshold evaluation | Separate assumed threshold-staleness curve; no measured benefit is claimed. |
| Nightly fits at 02:00 | Bundle schedule, kept daily. Grid points are counterfactuals, not authority to change training folds. |
| Daily retention | Counterfactual scan curve, subject to actual retention/deletion rules; user purge in bundle is on demand. |
| Buyer want refresh, alert re-read and stage buyer search | Excluded, owned by the other run. Read watch.ts only to confirm this boundary. |
| Leases, retries, receipt response budget, approval expiry, UI polling and job stream heartbeats | Protocol or interaction deadlines rather than independent marketplace sale checks; not optimized as seller polling. |

*Inferred, dated 2026-11-15:* cash for distinct jobs can be added if they really run separately and allocated costs do not overlap. Do not add a full account watcher and a hypothetical independent sale sweep when they are the same job. Account restriction probabilities are also not additive across independent activity tables: combine incident hazards at the actual per-account request intensity, then apply the incident-loss model once. Maintenance read exposure is not measured or included here. The per-action differences are consequently more defensible than an all-product cash-plus-harm sum.

## What flatters us and what cuts against us

*Inferred, dated 2026-11-15:* the favorable case has a real anchor: cheap public-page triggers and paid-order push avoid a browser held open solely to watch. With the assumed state mix, Depop's proposed 15/120/240 profile costs about $0.54 cash/month, compared with $3.48 for flat 15-minute cash; its partial cost including modeled harm is about $0.80 versus $3.72 for flat 15 on the same enriched state mixture. [The supplier price](https://browser-use.com/pricing) is observed; one-minute sweeps, traffic, hot occupancy and the expected losses are assumptions. This is an inspectable saving hypothetical, not a customer result.

*Inferred, dated 2026-11-15:* the strongest countercase is that a first sale signals several buyers arriving together. Ten times the baseline competing hazard shifts the ordinary Depop minimum from 240 to 60 minutes. Its **hot** band's faster end is 15 minutes because the model combines a high share of sales with ten times competing hazard in little account time. A one-minute hot interval is far more expensive under the assumed billing, and the model does not prove it earns the difference. Delayed offers/replies, high-value inventory or an account near its cancellation threshold could reverse that result; these need measurements or explicit shadow costs.

*Inferred, dated 2026-11-15:* the unfavorable access case is also large: if Mercari's ten public pages each need a browser run, the ordinary minimum reaches the 240-minute grid boundary at about $2.49/month, versus about $0.08 in the cheap-route model. A public-page response time or a sold flag in one fixture proves neither full coverage nor safe automated access. A failed read left as unknown extends the real exposure beyond I/2. Facebook local pickup has no duplicate online checkout in the ordinary case; including its assumed competing hazard in all-five shipped-sale curves is a stress assumption. The script also prints a no-competing-Facebook-checkout sensitivity.

*Asserted vendor claims, read 2026-11-15:* current first-party pages say [Vendoo ten minutes](https://help.vendoo.co/en/articles/8047348-sale-detection-auto-delist), [Nifty within 15](https://docs.nifty.ai/auto-delisting/auto-delisting), [Treecat 30](https://wiki.treecat.io/how-fast-does-auto-delist-work), and [Flyp about hourly](https://resellertools.zendesk.com/hc/en-us/articles/41078916741517-Auto-Delist-Auto-mark-as-Sold-and-Delist). These are not measured comparisons. Compare a mean wait of I/2 plus delist on both sides. The older Flyp 15-minute claim and public-read zero-risk language are stale or unsupported, as detailed in the evidence note.

*Agent proposal, inferred 2026-11-15:* before adopting the numeric rows, collect successful/failed read coverage, billed duration and bytes per sweep, sale timestamp through last confirmed delist, per-state account hours and first sales, and cancellation reason/destination. Keep unsold listings in timing cohorts and censor them correctly; otherwise a fast sold-only sample makes the assumed hazard look too large. Record warning incidents and policy constraints without inventing a measured ban curve. Use those observations to rerun the model. Until then the stage claim is a working mechanism only when demonstrated, and the production schedule remains a conditional economic proposal under [proof-without-sales](proof-without-sales.md).
