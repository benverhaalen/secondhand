# Research coverage
Status: audit, *agent proposal*. Written 2026-11-14.

This audit asks one thing per feature: did the research consider every serious way to build it, and does the evidence back the way the spec picked? It serves Nate's ask to "validate to ensure our reach of research is broad enough to have covered all possibilities, and then intelligently weighed to determine the best design for every feature". Nothing here changes a spec, a decision or a note. Ben and Nate decide; anyone may add an approach or overturn a mark with a better source.

## How to read it

- One section per feature in [spec/features/](features/). Each row is one design question.
- **Approaches that exist** lists every distinct way to answer it that a seller tool, a vendor or a paper uses, whether or not we researched it.
- **Researched in** links the note that covers the approach. "not researched" means no note opens it.
- **What the spec does now** quotes or shortens the spec's current choice.
- **Evidence supports it** is one of four marks:
  - yes: an opened source or our own test backs the choice.
  - weak: the backing is inferred, asserted, from one source, or from a handful of items.
  - no: an opened source contradicts the choice.
  - untested: the choice depends on a number nobody has measured.
- **What would change it** names the fact or test that would flip the mark.
- Eight notes were written today to fill gaps. Two of them sit in folders that differ from their feature, because research folders must match a `features/` slug and there is no buy or insights folder: the buy note is in `research/watch/nate/`, the insights note in `research/today/nate/`. Each says so on its second line.
- The last three parts rank the gaps, list spec claims that rest only on sources nobody opened, and list tests on real items or a real workspace that would settle more than more reading.

Coverage in one word per feature:

| Feature | Coverage | Why |
|---|---|---|
| [appraise](features/appraise.md) | adequate | formula and tools researched; probabilities and speed unmeasured |
| [buy](features/buy.md) | thin, now adequate | site terms on buying agents and buyer APIs were missing until today |
| [capture](features/capture.md) | broad | four capture styles researched; spec has not caught up with the newest |
| [connect](features/connect.md) | broad | every site's access route opened; where sessions live is open |
| [data](features/data.md) | adequate | platform limits opened; nothing run in a workspace |
| [identify](features/identify.md) | broad | stack, alternatives and gates all researched |
| [insights](features/insights.md) | thin, now adequate | seller metrics and alert cadence were missing until today |
| [item-card](features/item-card.md) | adequate | schema researched; sharing not |
| [list](features/list.md) | broad | per-site posting, fields, ranking and bans researched |
| [measure](features/measure.md) | thin, now adequate | accuracy figures were one asserted number until today |
| [messages](features/messages.md) | adequate | autonomy and safety researched; inbox routes for three sites thin |
| [price](features/price.md) | broad on sources, adequate on ranges | range calibration was missing until today |
| [replay](features/replay.md) | thin, now adequate | the recording route was unknown until today |
| [sold](features/sold.md) | adequate | push routes researched; email route was missing until today |
| [studio](features/studio.md) | adequate | one editor researched until today; still no test on real items |
| [today](features/today.md) | adequate | structure researched; alert cadence filled today |
| [watch](features/watch.md) | adequate | many monitors compared; per-site lag measured only for a few |

## Notes this audit read

| Note | Question it asks | Feature |
|---|---|---|
| [appraisal-run](../research/appraise/ben/appraisal-run.md) | How one appraisal runs and how we know it is right | appraise |
| [existing-tools](../research/appraise/ben/existing-tools.md) | Who already appraises or searches across markets, and what they leave open | appraise |
| [garage-sale](../research/appraise/ben/garage-sale.md) | What on-the-spot appraisal at a garage sale needs | appraise |
| [capture build-plan](../research/capture/ben/build-plan.md) | Guided capture that serves listing and identification at once | capture |
| [decision-tree-capture](../research/capture/ben/decision-tree-capture.md) | Talk mode as a code-owned decision tree with set spoken lines | capture |
| [guided-shot-list](../research/capture/ben/guided-shot-list.md) | Guiding capture so the user never decides what to shoot | capture |
| [live-video-capture](../research/capture/ben/live-video-capture.md) | Live video where a model watches, talks and remembers | capture |
| [adaptive-capture](../research/capture/nate/adaptive-capture.md) | One adaptive session against a fixed shot list, with and without LiDAR | capture |
| [scan-to-images](../research/capture/nate/scan-to-images.md) | Turning a LiDAR or Object Capture scan into listing images | capture |
| [platform-access](../research/connect/nate/platform-access.md) | Linking accounts on each site, and what can then be read and done | connect |
| [cross-cutting README](../research/cross-cutting/ben/README.md) | Index of Ben's cross-cutting notes | cross-cutting |
| [adjacent-references](../research/cross-cutting/ben/adjacent-references.md) | Products next to ours worth learning from | cross-cutting |
| [ai-harness-from-repos](../research/cross-cutting/ben/ai-harness-from-repos.md) | Harness patterns from open repos, image and text decisions | cross-cutting |
| [build-plan-posting-messages-ui](../research/cross-cutting/ben/build-plan-posting-messages-ui.md) | Posting, messages and UI build plan | cross-cutting |
| [business-pieces-and-repos](../research/cross-cutting/ben/business-pieces-and-repos.md) | Business pieces and repos to reuse | cross-cutting |
| [depop-plus-lessons](../research/cross-cutting/ben/depop-plus-lessons.md) | Lessons from Depop's own seller tools | cross-cutting |
| [direct-references](../research/cross-cutting/ben/direct-references.md) | Direct competitors | cross-cutting |
| [frontend-references](../research/cross-cutting/ben/frontend-references.md) | Front-end references | cross-cutting |
| [missing-features](../research/cross-cutting/ben/missing-features.md) | Features sellers want that tools lack | cross-cutting |
| [pitch-evidence](../research/cross-cutting/ben/pitch-evidence.md) | Evidence for the pitch | cross-cutting |
| [pitch-sources](../research/cross-cutting/ben/pitch-sources.md) | Sources for the pitch | cross-cutting |
| [poteto-mode-review](../research/cross-cutting/ben/poteto-mode-review.md) | How to write and review rule docs | cross-cutting |
| [primitives-engineering](../research/cross-cutting/ben/primitives-engineering.md) | Shared engineering primitives | cross-cutting |
| [problem-and-pitch](../research/cross-cutting/ben/problem-and-pitch.md) | The problem and the pitch | cross-cutting |
| [psychology](../research/cross-cutting/ben/psychology.md) | Seller and buyer psychology | cross-cutting |
| [seeing-the-item-pipeline](../research/cross-cutting/ben/seeing-the-item-pipeline.md) | How the item is seen from capture to card | cross-cutting |
| [tech-stack-overview](../research/cross-cutting/ben/tech-stack-overview.md) | The stack | cross-cutting |
| [user-wants](../research/cross-cutting/ben/user-wants.md) | What users say they want | cross-cutting |
| [autonomous-features](../research/cross-cutting/nate/autonomous-features.md) | What the app could do on its own | cross-cutting |
| [crosslister-teardown](../research/cross-cutting/nate/crosslister-teardown.md) | How crosslisters work and fail | cross-cutting |
| [privacy-and-data](../research/cross-cutting/nate/privacy-and-data.md) | Privacy, security and store-policy limits | cross-cutting |
| [research-session-digest](../research/cross-cutting/nate/research-session-digest.md) | Findings of 2026-11-14 by feature | cross-cutting |
| [databricks](../research/data/ben/databricks.md) | Using Databricks well | data |
| [analytics-and-recommendations](../research/data/nate/analytics-and-recommendations.md) | Demand and performance signals and honest claims | data |
| [databricks-dev-tooling](../research/data/nate/databricks-dev-tooling.md) | Tools for building and testing on Databricks | data |
| [databricks-platform](../research/data/nate/databricks-platform.md) | Lakebase, Apps, AI Search, MLflow 3, Gateway, Genie, Lakeflow limits | data |
| [what-databricks-rewards](../research/data/nate/what-databricks-rewards.md) | What Databricks holds up as excellent | data |
| [identify build-plan](../research/identify/ben/build-plan.md) | Photos in, exact identity and condition, one-tap confirm | identify |
| [openai-decisions-api](../research/identify/ben/openai-decisions-api.md) | Image judgements with a human in the loop | identify |
| [clarifying-inputs](../research/identify/nate/clarifying-inputs.md) | How to ask the few things still needed | identify |
| [identification-stack](../research/identify/nate/identification-stack.md) | Technologies and data to identify any used product | identify |
| [identification-technologies](../research/identify/nate/identification-technologies.md) | Identification with Google's product search closed | identify |
| [identity-schema-by-kind](../research/item-card/nate/identity-schema-by-kind.md) | What identifies each kind of item and drives its value | item-card |
| [crosspost-and-delist](../research/list/ben/crosspost-and-delist.md) | Posting and delisting per site, surviving a failed delist | list |
| [platform-fit](../research/list/ben/platform-fit.md) | Which sites each item goes to | list |
| [depop](../research/list/ben/platforms/depop.md) | How to post on Depop so it sells | list |
| [ebay](../research/list/ben/platforms/ebay.md) | How to post on eBay so it sells | list |
| [facebook-marketplace](../research/list/ben/platforms/facebook-marketplace.md) | How to post on Facebook so it sells | list |
| [grailed](../research/list/ben/platforms/grailed.md) | Posting and reading prices on Grailed | list |
| [mercari](../research/list/ben/platforms/mercari.md) | How to post on Mercari so it sells | list |
| [offerup](../research/list/ben/platforms/offerup.md) | Posting and reading prices on OfferUp | list |
| [poshmark](../research/list/ben/platforms/poshmark.md) | How to post on Poshmark so it sells | list |
| [posting-browser-use-ebay](../research/list/ben/posting-browser-use-ebay.md) | eBay API against Browser Use for posting | list |
| [listing-fields-by-platform](../research/list/nate/listing-fields-by-platform.md) | Required fields per site and kind | list |
| [observing-rank-and-performance](../research/list/nate/observing-rank-and-performance.md) | Measuring from outside what ranks and why | list |
| [platform-levers](../research/list/nate/platform-levers.md) | Seller and buyer levers software could pull | list |
| [ranking-algorithms](../research/list/nate/ranking-algorithms.md) | How 9 sites rank search and feeds | list |
| [measure build-plan](../research/measure/ben/build-plan.md) | Flat-lay garments, rigid items in 3D, human approves | measure |
| [measuring-garments](../research/measure/ben/measuring-garments.md) | Accurate clothing measurement by phone | measure |
| [object-capture](../research/measure/ben/object-capture.md) | Where Object Capture fits | measure |
| [garment-measurement-accuracy](../research/measure/nate/garment-measurement-accuracy.md) | Accuracy with and without LiDAR, and commercial tools (today) | measure |
| [messages-and-offers](../research/messages/ben/messages-and-offers.md) | Messages and offers under learning tiers | messages |
| [messages-home](../research/messages/ben/messages-home.md) | Where messages live | messages |
| [handled-by-default](../research/messages/nate/handled-by-default.md) | Learning tiers against handled by default inside limits | messages |
| [adjacent-valuation](../research/price/ben/adjacent-valuation.md) | Lessons from cars, real estate, cards and price guides | price |
| [price build-plan](../research/price/ben/build-plan.md) | Pricing, cross-market search and watch alerts | price |
| [comps-sources-live](../research/price/ben/comps-sources-live.md) | Where sold comps and active listings come from, per site | price |
| [openrouter-and-treg](../research/price/ben/openrouter-and-treg.md) | One key in place of many | price |
| [pricing-in-context](../research/price/ben/pricing-in-context.md) | Lessons from financial markets | price |
| [sold-price-data](../research/price/ben/sold-price-data.md) | Price sources and what each allows | price |
| [valuation-engine](../research/price/ben/valuation-engine.md) | Architecture for a market-value search | price |
| [what-market-value-is](../research/price/ben/what-market-value-is.md) | What market value is and depends on | price |
| [fees-and-taxes](../research/price/nate/fees-and-taxes.md) | What a US casual seller keeps and owes | price |
| [quality-and-value-classifiers](../research/price/nate/quality-and-value-classifiers.md) | Published or leaked ranking and quality models | price |
| [range-calibration](../research/price/nate/range-calibration.md) | Calibrating and backtesting price ranges and days to sell (today) | price |
| [cloud-browsers-and-detection](../research/replay/nate/cloud-browsers-and-detection.md) | Hosted browsers that expose network calls, and how sites detect automation (today) | replay |
| [email-and-notification-detection](../research/sold/nate/email-and-notification-detection.md) | Detecting sales and messages from notification emails (today) | sold |
| [shipping-and-pickup](../research/sold/nate/shipping-and-pickup.md) | How items get from seller to buyer | sold |
| [trust-returns-disputes](../research/sold/nate/trust-returns-disputes.md) | Returns, disputes, cancellations and fraud | sold |
| [studio build-plan](../research/studio/ben/build-plan.md) | Relighting, true colour, a fidelity gate, human approval | studio |
| [photo-score](../research/studio/ben/photo-score.md) | Scoring a photo and tweaking it with no model | studio |
| [prototype README](../research/studio/ben/prototype/README.md) | Fidelity gate and colour-correction prototype | studio |
| [renders README](../research/studio/ben/renders/README.md) | Touch-up test renders | studio |
| [seedream-relighting](../research/studio/ben/seedream-relighting.md) | Relight and restage without misrepresenting | studio |
| [editing-alternatives](../research/studio/nate/editing-alternatives.md) | Editors that leave the item's pixels unchanged (today) | studio |
| [generative-ui](../research/today/ben/generative-ui.md) | UI composed from a fixed component set, with approval cards | today |
| [structure-references](../research/today/ben/structure-references.md) | How apps split home, inbox, selling and buying | today |
| [today-rework README](../research/today/ben/today-rework/README.md) | What Today shows a seller | today |
| [seller-metrics-and-notifications](../research/today/nate/seller-metrics-and-notifications.md) | Earnings, profit, goals, and batched against immediate alerts (today) | insights |
| [exa-alerts](../research/watch/ben/exa-alerts.md) | Alerts with Exa | watch |
| [exa-empirical](../research/watch/ben/exa-empirical.md) | Whether Exa finds fresh listings | watch |
| [fanout-and-watch-loop](../research/watch/ben/fanout-and-watch-loop.md) | How search and watch run per site | watch |
| [monitor-alternatives](../research/watch/ben/monitor-alternatives.md) | Monitors better than Exa's | watch |
| [one-search-box](../research/watch/ben/one-search-box.md) | One search box sharing the pricing engine | watch |
| [buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md) | Buyer APIs, site terms on buying agents, affiliate programmes (today) | buy |
| [new-listing-detection](../research/watch/nate/new-listing-detection.md) | Fastest reliable new-listing detection, freshness and cost (today) | watch |

## appraise

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How is the most to pay set? | probability-weighted resale net; a fixed share of the sold median (reseller rule of thumb); median minus fees only; a model trained on bought-then-resold outcomes | [appraisal-run](../research/appraise/ben/appraisal-run.md), [garage-sale](../research/appraise/ben/garage-sale.md); the outcome model: not researched | `max_pay = P(identity) x P(condition) x P(authentic) x net(best site, p25) - hassle - risk_margin - target_profit` | weak: the P terms are uncalibrated, and the p25 rests on a range nobody has backtested ([range-calibration](../research/price/nate/range-calibration.md)) | resale outcomes on items appraised then bought |
| Which one check to ask? | value of information; a fixed checklist per category; none | [appraisal-run](../research/appraise/ben/appraisal-run.md), [clarifying-inputs](../research/identify/nate/clarifying-inputs.md) | the question that would move `max_pay` most, at most 3 in a row | weak: *inferred* | time to a verdict at a real sale, with and without the check |
| How fast is the first answer? | embedding lookup; on-device model; cloud model; visual search (Lens, eBay image search) | [identification-stack](../research/identify/nate/identification-stack.md), [identification-technologies](../research/identify/nate/identification-technologies.md) | Glance from AI Search by image embedding, Haiku; Check on Sonnet; Deep on Opus | untested: no latency measured on mobile data | p95 seconds per tier at a sale |
| Casual buyer or reseller? | one setting; inferred from use; two modes | [user-wants](../research/cross-cutting/ben/user-wants.md), [garage-sale](../research/appraise/ben/garage-sale.md) | a setting, default casual | weak: no source picks a default | Ben or Nate's say |
| Does the agent send offers to sellers? | draft only; send under a ceiling; send through an official offer API | [buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md) (today) | draft the offer; sending is `ask` | yes: eBay's terms from 2026-06-28 and Depop's terms bar buy-for-me agents; Grailed bars AI purchasing without human review; eBay PlaceOffer is closed | written permission from a site |
| May referral fees steer the ranking? | rank by total cost to the door; rank with affiliate weight; no links out | [buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md) (today) | note only: fees must not rank | yes: a principle, and eBay Partner Network rates of 1.5 to 4% are *asserted* | a business-model decision |
| Where does price history come from? | our comps; PriceCharting, StockX, Discogs; WorthPoint | [comps-sources-live](../research/price/ben/comps-sources-live.md), [sold-price-data](../research/price/ben/sold-price-data.md) | median sold by month from comps and category sources, PriceCharting named ([appraise.md](features/appraise.md)) | weak: [price.md](features/price.md) marks PriceCharting "internal use only", so showing its history on the card may break its terms | PriceCharting's licence for display |

## buy

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How does one search reach every site? | own index then per-site fan-out within a deadline; one aggregator search (Exa); site APIs only | [one-search-box](../research/watch/ben/one-search-box.md), [fanout-and-watch-loop](../research/watch/ben/fanout-and-watch-loop.md), [exa-empirical](../research/watch/ben/exa-empirical.md) | own index at once, then each site within a deadline, streamed with a status chip per site | yes for routes; untested for speed | p95 to first and last batch |
| Does the agent offer under a ceiling on its own? | `auto` under a ceiling; draft and `ask`; official Best Offer API; cloud browser | [buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md) (today), [messages-and-offers](../research/messages/ben/messages-and-offers.md) | offers `auto` under a per-listing ceiling | no: eBay (from 2026-06-28) and Depop bar buy-for-me agents; eBay PlaceOffer is closed; Grailed needs human review | a site's written allowance, or the offer moving to `ask` |
| Does Save also like, watch or cart on the site? | official watch API; cloud browser on the person's login; in-app only | [buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md) (today) | opt in per site through a cloud browser, risk stated | weak: eBay's AddToWatchList is open to user OAuth, which the spec does not name; other sites untested for ban risk | using AddToWatchList on eBay |
| How are past purchases imported? | eBay GetMyeBayBuying; purchase receipts in email; cloud-browser read; CSV export | [buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md) (today), [email-and-notification-detection](../research/sold/nate/email-and-notification-detection.md) (sale emails only); purchase receipts: not researched | a cloud-browser read, opt in, because "no API found" | no for eBay: GetMyeBayBuying returns 60 days of purchases | the eBay route, plus receipt parsing for the rest |
| May eBay matches rank with other sites? | one list; a separate group; Buy APIs under eBay Partner Network | [comps-sources-live](../research/price/ben/comps-sources-live.md), [buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md) (today) | a separate eBay group | yes: the licence bars mixing; Buy APIs are Limited Release and need EPN approval | eBay's written answer |
| How would buying earn? | affiliate links (EPN); sub-affiliate networks (Skimlinks, Sovrn); subscription | [buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md) (today); Skimlinks and Sovrn: not researched | not picked | weak: EPN rates *asserted*; Poshmark and Mercari programmes do not apply | the EPN rate for used items |
| What fills "For you"? | embeddings of the person's items; collaborative filtering; the site's own feeds | [analytics-and-recommendations](../research/data/nate/analytics-and-recommendations.md); collaborative filtering: not researched | a fourth shelf, opt in, after a first sale or import | untested | click and save rate on a real shelf |

## capture

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How is the seller told what to shoot? | fixed shot list per category; one adaptive session; live video model; code-owned decision tree with set spoken lines | [guided-shot-list](../research/capture/ben/guided-shot-list.md), [adaptive-capture](../research/capture/nate/adaptive-capture.md), [live-video-capture](../research/capture/ben/live-video-capture.md), [decision-tree-capture](../research/capture/ben/decision-tree-capture.md) | guided list first; talk mode is a live model ([capture.md](features/capture.md) line 24) | weak: Ben's newer [decision-tree-capture](../research/capture/ben/decision-tree-capture.md) replaces the live model, and the spec still describes the live model | the spec taking Ben's rework, or Ben keeping the live model |
| How many extra views may it ask for? | a fixed cap; ask until a band is crossed; none | [adaptive-capture](../research/capture/nate/adaptive-capture.md) | "One more view" at most 2 per item | weak: the cap of 2 has no source | views needed per item on 30 real items |
| How is scale known? | LiDAR depth; ARKit plane scale; a card, A4 sheet or ArUco marker in frame; monocular depth; the product's published size | [adaptive-capture](../research/capture/nate/adaptive-capture.md), [garment-measurement-accuracy](../research/measure/nate/garment-measurement-accuracy.md) (today) | no 1 cm scale without LiDAR; depth 256x192, 20 cm to 2 m | yes | non-LiDAR ARKit scale error, still not found |
| Does a 3D scan feed the photos? | Object Capture; cloud photogrammetry (Polycam, Luma); Gaussian splats | [scan-to-images](../research/capture/nate/scan-to-images.md), [object-capture](../research/measure/ben/object-capture.md); splats and cloud photogrammetry: not researched | Object Capture where LiDAR and iOS 17+ | yes | none expected |
| Which gates run on the phone? | on-device Vision checks (blur, exposure, framing); cloud judge; a scored photo | [capture build-plan](../research/capture/ben/build-plan.md), [seeing-the-item-pipeline](../research/cross-cutting/ben/seeing-the-item-pipeline.md), [photo-score](../research/studio/ben/photo-score.md) | gates on device, `capture_judge` in the cloud | weak: thresholds untested on real items | pass and fail counts against a person's judgement |
| What leaves the phone? | strip EXIF and depth; redact faces, mail, house numbers; trust the site to strip | [privacy-and-data](../research/cross-cutting/nate/privacy-and-data.md) | strip GPS and embedded depth, blur faces and addresses before upload | yes: marketplace EXIF stripping is undocumented | none expected |

## connect

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How does each account link? | official OAuth (eBay, Depop); cloud browser with a persisted login; session on the device; a browser extension in the person's own browser | [platform-access](../research/connect/nate/platform-access.md), [posting-browser-use-ebay](../research/list/ben/posting-browser-use-ebay.md), [crosslister-teardown](../research/cross-cutting/nate/crosslister-teardown.md) | OAuth where it exists, a Browser Use login elsewhere | yes: eBay OAuth 2 h and 18 months; Depop PKCE 1 h and 1 year; Facebook has no OAuth for US sellers; Poshmark no API | a partner grant on Mercari or Facebook |
| Where do sessions live? | cloud browser vault; device keychain; both | [privacy-and-data](../research/cross-cutting/nate/privacy-and-data.md), [posting-browser-use-ebay](../research/list/ben/posting-browser-use-ebay.md) | open between Ben's device view and Nate's cloud view | untested: how App Store guideline 5.1.1(v) treats a server-held session is not found | App Review precedent from a shipped crosslister app |
| How does a login avoid a ban? | residential proxies; a stable fingerprint per account; pacing; the person's own IP | [cloud-browsers-and-detection](../research/replay/nate/cloud-browsers-and-detection.md) (today) | the same pacing as posting, stated at Connect | weak: Poshmark flags server IPs; vendors named (Akamai on eBay, Cloudflare on Mercari and Depop, Cequence and TransUnion on Poshmark); none tested | a login run per site on a test account |
| Is Mercari in? | in; out | [platform-access](../research/connect/nate/platform-access.md), [mercari](../research/list/ben/platforms/mercari.md) | keep it in | yes on feasibility; Mercari's terms bar robots | Ben and Nate's say |
| Apply for Depop partner access now? | apply now; browser only | [platform-access](../research/connect/nate/platform-access.md) | yes, browser route until granted | yes | none |

## data

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| What runs the backend? | all Databricks; hybrid with a thin public edge; a general cloud | [databricks](../research/data/ben/databricks.md), [databricks-platform](../research/data/nate/databricks-platform.md), [what-databricks-rewards](../research/data/nate/what-databricks-rewards.md), [tech-stack-overview](../research/cross-cutting/ben/tech-stack-overview.md) | all Databricks with a thin edge, two-hour hybrid fallback (decided) | yes: Apps has no public mode and no presigned URLs, which the thin edge covers | none |
| How do changes reach the app? | Postgres LISTEN/NOTIFY; SSE with polling; a hosted pub-sub | [databricks-platform](../research/data/nate/databricks-platform.md) | SSE plus polling | yes: Lakebase scale to zero loses LISTEN/NOTIFY; latency untested | wake time and SSE lag in a workspace |
| How is one user's data kept from another? | app-level `user_id` scoping; Postgres row security on a session variable; Databricks identity per user | [databricks-platform](../research/data/nate/databricks-platform.md) | Apps scopes every query and sets `app.user_id` for row security | weak: *inferred*, since Databricks row security keys on a Databricks identity | a row-security test in a workspace |
| How big can Lakebase grow? | autoscaling; fixed size | [databricks-platform](../research/data/nate/databricks-platform.md) | autoscaling; ceiling unresolved at 112 or 64 CU | untested | the workspace's own limit page |
| What do traces keep? | MLflow experiment traces; Unity Catalog traces; our own Delta log | [databricks-platform](../research/data/nate/databricks-platform.md), [privacy-and-data](../research/cross-cutting/nate/privacy-and-data.md) | experiment-backed traces; the gateway span stores ids, not buyer text | weak: no per-trace delete, 25 MB read limit, 100k traces; whether MLflow stores prompt text by default is "not found" ([data.md](features/data.md) line 119) | a gateway call inspected in a workspace |
| Which plan pays? | Free Edition; paid workspace | [databricks-platform](../research/data/nate/databricks-platform.md) | a paid workspace | yes: Free Edition is non-commercial | none |

## identify

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How is the product found? | barcode and OCR; visual search (Lens through a search API, eBay image search); embedding retrieval; a vision model; specialist apps | [identification-stack](../research/identify/nate/identification-stack.md), [identification-technologies](../research/identify/nate/identification-technologies.md), [identify build-plan](../research/identify/ben/build-plan.md) | OCR and barcode on the phone, image search and page parse in a job, AI Search retrieval | yes | none expected |
| Confirm or correct? | auto-accept above a gate; always confirm; ask only when it changes a decision | [clarifying-inputs](../research/identify/nate/clarifying-inputs.md), [identify build-plan](../research/identify/ben/build-plan.md) | auto-accept above the gate, "Looks right" shown | weak: gate precision unmeasured on our items | precision at the threshold on a labelled set |
| Who answers a typed judgement? | OpenAI Decisions API; Jev; log-probs from a chat model | [openai-decisions-api](../research/identify/ben/openai-decisions-api.md), [ai-harness-from-repos](../research/cross-cutting/ben/ai-harness-from-repos.md) | both side by side, our labels pick | untested: no label set yet; Decisions API rate limits not found | a run on 100 labelled items |
| May eBay data train anything? | display only; candidates only; train with consent | [comps-sources-live](../research/price/ben/comps-sources-live.md) | display and candidates only until written consent | yes | eBay's consent |
| Which items go to a specialist? | by category (sneakers, bags, watches); by value; by a fake-risk score | [identification-stack](../research/identify/nate/identification-stack.md), [trust-returns-disputes](../research/sold/nate/trust-returns-disputes.md) | sneakers, bags and watches first | yes | fraud data by category |

## insights

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How is profit known? | cost typed by the seller; receipt import; an estimate from the buy price on Appraise | [seller-metrics-and-notifications](../research/today/nate/seller-metrics-and-notifications.md) (today), [fees-and-taxes](../research/price/nate/fees-and-taxes.md) | cost hidden until entered, then profit after fees | yes: every seller tool found does the same, with zero until entered | none |
| Where do fees and payouts come from? | site finance APIs; CSV and report imports; our own fee table | [fees-and-taxes](../research/price/nate/fees-and-taxes.md), [platform-access](../research/connect/nate/platform-access.md) | eBay Sell Finances, Depop partner API or CSV, Mercari Gross Sales Report, Poshmark CSV, Facebook none | yes: Depop shows Earnings and Potential revenue a day late | a Facebook route |
| Are there goals? | a monthly money goal; item-count goals; none | [seller-metrics-and-notifications](../research/today/nate/seller-metrics-and-notifications.md) (today) | goals from Nate's words | weak: only OneShop and Vendoo show goals; no outcome data | goal use in a test group |
| May You compare sites? | a by-site table; per-site pages only | [comps-sources-live](../research/price/ben/comps-sources-live.md) | You leads with numbers and a by-site comparison | weak: the eBay licence limits comparing eBay with others; whether the seller's own sales count is not settled | eBay's reading of own-sales data |
| How are free questions answered? | Genie over rollups; fixed charts; an agent over SQL | [databricks-platform](../research/data/nate/databricks-platform.md) | Genie over rollup views | untested: Apps has no public mode, so Genie's route to the person is not shown | a Genie call through the App |
| How often does it notify? | at once; batched about 3 a day; a daily digest | [seller-metrics-and-notifications](../research/today/nate/seller-metrics-and-notifications.md) (today), [psychology](../research/cross-cutting/ben/psychology.md) | about 3 batches a day ([insights.md](features/insights.md) line 94) | yes for non-urgent: Fitz 2019 found 3 a day beat hourly and none; Airship's top opt-out reason is "too frequently" | none for summaries |

## item-card

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| What does a card hold? | per-kind identity fields with provenance; a free-text description; a site's own schema | [identity-schema-by-kind](../research/item-card/nate/identity-schema-by-kind.md), [listing-fields-by-platform](../research/list/nate/listing-fields-by-platform.md) | per-kind attributes with provenance | yes | none |
| Which fields are required before listing? | union of all sites; only each target site's; a fixed set | [listing-fields-by-platform](../research/list/nate/listing-fields-by-platform.md) | only what each target site requires, a dot per logo | yes | none |
| Who owns a household item? | one owner; shared ownership; a shared view by invite | not researched | one owner, a shared view by invite | untested | how shared accounts work in family apps |
| Who sees cost and profit? | everyone; resellers only; hidden until entered | [seller-metrics-and-notifications](../research/today/nate/seller-metrics-and-notifications.md) (today) | hidden until a cost is entered | yes | none |
| Where is history kept? | events in Delta; a version column; traces | [databricks-platform](../research/data/nate/databricks-platform.md) | live card in Lakebase, edits as Delta events, "why?" from MLflow | yes | none |

## list

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How does a listing reach each site? | official API (eBay Inventory, Depop partner); cloud browser harness; an extension in the person's browser (the crosslister norm); bulk upload files; copy and paste by the person | [posting-browser-use-ebay](../research/list/ben/posting-browser-use-ebay.md), [crosspost-and-delist](../research/list/ben/crosspost-and-delist.md), [crosslister-teardown](../research/cross-cutting/nate/crosslister-teardown.md), [platform-access](../research/connect/nate/platform-access.md); bulk upload files: not researched | one Browser Use harness per site (decided); API first on eBay, harness as fallback | yes on eBay; weak elsewhere: eBay bars LLM bots, Poshmark bars automation, Mercari bars robots | a site's written allowance, or a ban on a test account |
| When does eBay's bot ban start? | 2026-02-20; 2026-06-28 | [ebay](../research/list/ben/platforms/ebay.md), [buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md) | not settled | weak: Ben's and Nate's notes give different dates | eBay's user agreement page opened once more |
| Is one tap at first post enough? | one tap per post; one tap first then paced auto; every action tapped | [platform-levers](../research/list/nate/platform-levers.md), [cloud-browsers-and-detection](../research/replay/nate/cloud-browsers-and-detection.md) (today) | first post one tap, then paced auto | weak: pacing untested against each site's detector | relists on test accounts over weeks |
| Which sites get each item? | rules by category; a fit score; the person picks | [platform-fit](../research/list/ben/platform-fit.md), the seven [platform notes](../research/list/ben/platforms/ebay.md) | fit per item, the person confirms | yes | sell-through by site on real items |
| Does relisting help rank? | relist; refresh; markdown; share (Poshmark) | [ranking-algorithms](../research/list/nate/ranking-algorithms.md), [observing-rank-and-performance](../research/list/nate/observing-rank-and-performance.md) | relist and markdown inside limits | weak: relisting is unproven on every site | rank before and after on test listings |
| What does each site accept? | per-site fields and photo limits | [listing-fields-by-platform](../research/list/nate/listing-fields-by-platform.md), [platform-access](../research/connect/nate/platform-access.md) | per-site field table; Depop 1 to 8 pictures, 200 calls per 10 s | yes | none |

## measure

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How are garments measured? | LiDAR scale on a flat lay; a card, A4 sheet or ArUco marker; monocular depth; a keypoint model; a tape read from a photo | [measuring-garments](../research/measure/ben/measuring-garments.md), [measure build-plan](../research/measure/ben/build-plan.md), [garment-measurement-accuracy](../research/measure/nate/garment-measurement-accuracy.md) (today) | LiDAR about ±1 cm; without LiDAR "12% off at best" | yes with LiDAR: Kim 2022 measured 1.59% and 2.08% relative error, 8 to 10 mm. Weak without: ArUco measured 4.1 to 6.4% and monocular depth 6.8% at best, both better than the spec's 12% | a printed marker or card as the non-LiDAR path, once its error on our garments is known |
| How are rigid items measured? | LiDAR box; Object Capture; published dimensions | [object-capture](../research/measure/ben/object-capture.md), [adaptive-capture](../research/capture/nate/adaptive-capture.md) | LiDAR box or Object Capture, cross-checked with published size | yes | none |
| How are points placed? | a geometric pass; a pointing model; the person drags | [measure build-plan](../research/measure/ben/build-plan.md) | a geometric pass plus a pointing model run 3 times, then one drag | untested | point error on 30 garments |
| Build or buy? | build our own; 3DLOOK; Size AI | [garment-measurement-accuracy](../research/measure/nate/garment-measurement-accuracy.md) (today) | build | weak: 3DLOOK reports 1.5 to 2.0 cm; Size AI's 5 mm and 9 mm are *asserted* | a vendor trial on the same garments |
| Is the parcel size right? | measured box plus padding; the site's size tiers | [shipping-and-pickup](../research/sold/nate/shipping-and-pickup.md) | billed size with padding against carrier and site limits | yes | none |

## messages

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How much does the agent do alone? | learning tiers; handled by default inside limits | [messages-and-offers](../research/messages/ben/messages-and-offers.md), [handled-by-default](../research/messages/nate/handled-by-default.md) | Auto, Ask, Never alone (decided) | yes | none |
| How is each inbox read? | eBay Message API and `GetBestOffers`; Depop partner offers; cloud browser; notification emails | [platform-access](../research/connect/nate/platform-access.md), [email-and-notification-detection](../research/sold/nate/email-and-notification-detection.md) (today) | `inbox_poll` every few minutes, cloud browser for the rest | weak: Depop has no message API; the email route is not used for messages; what Mercari, Depop and Facebook message emails contain is not found | a real message email from each site |
| How is a reply written? | seller's voice from sent messages; templates; the site's quick replies | [messages-and-offers](../research/messages/ben/messages-and-offers.md) | drafts from the card and the last 6 turns in the seller's voice | untested | seller edit rate on drafts |
| How is buyer text kept from steering the agent? | text as data; typed intent; a send guard in code | [messages-and-offers](../research/messages/ben/messages-and-offers.md), [ai-harness-from-repos](../research/cross-cutting/ben/ai-harness-from-repos.md) | buyer text wrapped as data, a send guard checks every facet | yes on design; untested against attacks | a red-team set of buyer messages |
| Must the agent say it is a bot? | disclose always; disclose on ask; never | [handled-by-default](../research/messages/nate/handled-by-default.md), [privacy-and-data](../research/cross-cutting/nate/privacy-and-data.md) | messages sent in the seller's name under the tiers | weak: the California bot rule and EU AI Act 50(1) are *asserted* | the statutes opened |
| How are pickups booked? | Google Calendar; in-app windows; the site's own scheduling | [shipping-and-pickup](../research/sold/nate/shipping-and-pickup.md) | your windows and a saved meetup spot, booked to Google Calendar (decided) | untested: which Calendar scopes, and whether they need verification, is not found | Google's scope list opened |

## price

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| Where do comps come from? | site APIs; paid scrapers; Algolia and GraphQL routes; category sources | [comps-sources-live](../research/price/ben/comps-sources-live.md), [sold-price-data](../research/price/ben/sold-price-data.md) | per-site source table with rights limits | yes: Marketplace Insights is Limited Release, Mercari scraper about 45%, Depop has no sold route | none |
| How is a range made and checked? | comp quantiles; hedonic regression; gradient boosting with quantile loss; conformal intervals, per category (Mondrian) or adaptive (ACI) | [range-calibration](../research/price/nate/range-calibration.md) (today), [valuation-engine](../research/price/ben/valuation-engine.md), [what-market-value-is](../research/price/ben/what-market-value-is.md), [adjacent-valuation](../research/price/ben/adjacent-valuation.md) | one range per site with what it rests on | weak: the one public tool measured hit 48.3% of 236 sales, then 75.3% of 81, against 80% stated, and 20 to 70% by category; plain conformal coverage is marginal only | a time-split backtest with a gap, scored per category (crepes 0.9.1 has a Mondrian class; MAPIE 1.6.0 does not) |
| Do asking prices bias the comps? | sold only; asks capped; asks discounted | [range-calibration](../research/price/nate/range-calibration.md) (today) | not addressed | untested | the backtest above, with and without asks |
| How long will it take to sell? | survival model; a cure model for items that never sell; median days on market | [range-calibration](../research/price/nate/range-calibration.md) (today) | days to sell shown on each plan | untested: a cure model (arXiv 2605.07087) fits items that never sell | days-to-sell backtest |
| May eBay sales feed the model? | model from other sites; apply to eBay; show eBay apart | [comps-sources-live](../research/price/ben/comps-sources-live.md) | eBay shown apart; the model trains on other sites and our outcomes; apply | yes | eBay's permission |
| Which plans are offered? | three named plans; Nate's wider list (repair, bundle, consign, keep) | [pricing-in-context](../research/price/ben/pricing-in-context.md), [adjacent-valuation](../research/price/ben/adjacent-valuation.md) | three cards plus a wider row | weak: no outcome data | plan choice and sale outcomes |
| What does the seller keep? | per-site fee table; the site's own calculator | [fees-and-taxes](../research/price/nate/fees-and-taxes.md) | per-site fee and tax rows, Mercari included | yes | a fee change |

## replay

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| Where does a recording come from? | the Browser Use V4 run; a CDP attach to the same browser; Browserbase Session Logs; Kernel telemetry and `/curl`; a Playwright HAR; a proxy | [cloud-browsers-and-detection](../research/replay/nate/cloud-browsers-and-detection.md) (today), [crosspost-and-delist](../research/list/ben/crosspost-and-delist.md) | from the Browser Use run; whether V4 exposes its network log "was not found" ([replay.md](features/replay.md) line 57) | no: V4 has no network log or HAR; only a CDP attach captures traffic, and only from the moment it attaches | a CDP attach at session start, or Browserbase or Kernel |
| May replay leave the browser? | calls from inside the page; server-side HTTP with copied cookies | [cloud-browsers-and-detection](../research/replay/nate/cloud-browsers-and-detection.md) (today), [privacy-and-data](../research/cross-cutting/nate/privacy-and-data.md) | inside the same Browser Use session | yes: Depop needs in-page calls; Poshmark flags server IPs | none |
| Does replay change ban risk? | same as the browser; lower; higher | [cloud-browsers-and-detection](../research/replay/nate/cloud-browsers-and-detection.md) (today) | treated as the same automation under the same pacing | weak: vendors are named per site, Facebook's is not found; Facebook warns before it restricts | replays on test accounts |
| How fast is a replay? | measured; asserted | not researched | 1 to 3 s | untested: *asserted* | timed replays |
| Do recordings carry secrets? | scrub at record; store raw | [cloud-browsers-and-detection](../research/replay/nate/cloud-browsers-and-detection.md) (today) | the recorder strips cookies and personal values; `node spec/log.mjs` checks recipes | yes: Kernel's records include cookies, which the scrub must catch | none |
| Build or use Ben's tool? | build; Ben's private tool | not researched | Ben decides | untested | Ben's say |

## sold

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How is a sale seen? | site push (eBay notification, Depop webhooks); polling orders; sale emails by Gmail push; a forwarding filter; the person says so | [crosspost-and-delist](../research/list/ben/crosspost-and-delist.md), [email-and-notification-detection](../research/sold/nate/email-and-notification-detection.md) (today), [platform-access](../research/connect/nate/platform-access.md) | push where it exists; Poshmark and Mercari by sale email plus a sold-list poll every 1 to 2 min | weak: Gmail push has no published latency, 1 event per second per user, renewal every 7 days; reading mail needs a restricted scope and a yearly security assessment ($540 to $1,800, *asserted*); a forwarding filter needs no OAuth but can be spoofed | measured email lag per site; Vendoo polls every 10 min, so 1 to 2 min would beat it |
| When is a delist too slow? | 3 min; 6 min | [crosspost-and-delist](../research/list/ben/crosspost-and-delist.md), [build-plan-posting-messages-ui](../research/cross-cutting/ben/build-plan-posting-messages-ui.md) | red at a threshold | weak: Ben's two notes give 3 and 6 min | Ben's say |
| How does the item ship? | own label through carrier APIs; the site's label; pickup | [shipping-and-pickup](../research/sold/nate/shipping-and-pickup.md) | per-site capability table | yes; Depop's "Other" shipping closed on 2026-10-28, which is past | none |
| What happens on a return or dispute? | per-site rules; our own clock | [trust-returns-disputes](../research/sold/nate/trust-returns-disputes.md) | per-site clocks as decisions on Today | yes | a rule change |

## studio

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How is a photo touched up? | generative relight (Seedream, Nano Banana); masked inpaint (Flux Fill, $0.05 per MP); instruction edit (Kontext, $0.04 and $0.08); gpt-image (mask is a guide only); IC-Light v2 ($0.1 per MP); cut-out plus paste-back (BiRefNet, InSPyReNet under MIT; RMBG-2.0 non-commercial); Photoroom API ($0.02 and $0.10); classic tweaks with no model | [seedream-relighting](../research/studio/ben/seedream-relighting.md), [studio build-plan](../research/studio/ben/build-plan.md), [editing-alternatives](../research/studio/nate/editing-alternatives.md) (today), [photo-score](../research/studio/ben/photo-score.md) | Seedream 5.5 with Nano Banana as challenger, a fidelity gate, real pixels blended back into flagged boxes | weak: Seedream has not been run; no host offers a mask; only cut-out plus paste-back keeps the item's pixels by construction; the spec does not name Ben's built no-model tweaks | the bake-off below |
| How is "unchanged" checked? | colour difference (CIEDE2000) per box; structure per box; a vision model comparing crops | [prototype README](../research/studio/ben/prototype/README.md), [renders README](../research/studio/ben/renders/README.md) | thresholds from the prototype | weak: set on 3 items; no published detail-preservation test exists | the gate scored against people on 20 items |
| What does each site allow? | per-site photo rules | [ebay](../research/list/ben/platforms/ebay.md), [depop](../research/list/ben/platforms/depop.md), [mercari](../research/list/ben/platforms/mercari.md), [poshmark](../research/list/ben/platforms/poshmark.md), [facebook-marketplace](../research/list/ben/platforms/facebook-marketplace.md), [offerup](../research/list/ben/platforms/offerup.md), [grailed](../research/list/ben/platforms/grailed.md) | Depop, Poshmark, Mercari and Facebook "not researched here" ([studio.md](features/studio.md) line 88) | no: Ben's platform notes cover each site's photo rules | the spec linking them |
| Is an edit marked? | invisible watermark (SynthID on Gemini); C2PA; none | [editing-alternatives](../research/studio/nate/editing-alternatives.md) (today); C2PA: not researched | Seedream `watermark` sent false | weak: a Gemini challenger adds SynthID, which the spec does not mention; Etsy's rule is *asserted*, page unopened | the site rules on edited photos |
| Is the photo good enough? | a rule score; a decision-model judge; sale outcomes | [photo-score](../research/studio/ben/photo-score.md) | not in the spec | untested: the score is not checked against sales | score against sell-through |

## today

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| What is the home screen? | one ranked decision list; an inbox; a feed; a dashboard | [structure-references](../research/today/ben/structure-references.md), [today-rework README](../research/today/ben/today-rework/README.md) | one list of decisions | yes | none |
| How are cards built? | a fixed component set filled by the agent; free generated UI; fixed screens | [generative-ui](../research/today/ben/generative-ui.md) | fixed components with approval cards | yes | none |
| What goes first? | money or sale lost soonest; newest; the agent's pick | [generative-ui](../research/today/ben/generative-ui.md) | rank in code: money or sale lost soonest, then locked kinds, then ask, then age | weak: *inferred* | taps and missed deadlines on real use |
| When does it push? | at once for must-decide; batched about 3 a day; a daily digest; Apple's Time Sensitive level | [seller-metrics-and-notifications](../research/today/nate/seller-metrics-and-notifications.md) (today), [psychology](../research/cross-cutting/ben/psychology.md), [research-session-digest](../research/cross-cutting/nate/research-session-digest.md) | at once for an offer at or above the floor or a near deadline; the rest batched; "batched notifications for sellers are untested" ([today.md](features/today.md) line 140) | yes for batching non-urgent (Fitz 2019; Airship); Apple reserves Time Sensitive for "within an hour"; untested for transactional seller alerts | opt-out and response time in a test group |
| How do cards arrive? | SSE; polling; push only | [databricks-platform](../research/data/nate/databricks-platform.md) | SSE plus polling | yes | none |

## watch

| Design question | Approaches that exist | Researched in | What the spec does now | Evidence supports it | What would change it |
|---|---|---|---|---|---|
| How are new listings found? | the sites' saved-search alerts (Depop weekly, eBay daily digest); eBay Browse `sort=newlyListed`; eBay Notification API (no new-listing topic); Firecrawl (5 min minimum); ScrapeCreators ($1.88 per 1,000 calls); Apify ($1 to $12 per 1,000 results); changedetection.io ($8.99 for 5,000 URLs); Exa; Visualping; Browse AI; own scrapers | [new-listing-detection](../research/watch/nate/new-listing-detection.md) (today), [monitor-alternatives](../research/watch/ben/monitor-alternatives.md), [exa-empirical](../research/watch/ben/exa-empirical.md), [fanout-and-watch-loop](../research/watch/ben/fanout-and-watch-loop.md); Visualping and Browse AI: not researched | Firecrawl monitors, eBay Browse, ScrapeCreators for Facebook, Exa for the long tail, own scrapers and Apify as fallback (decided) | yes: the sites' own alerts are too slow and Exa has nothing under 7 days; changedetection.io is a cheaper monitor the spec does not weigh | cost and lag per site against Firecrawl |
| Is "within the hour" true? | promise it; show "checked N min ago"; per-site promise | [new-listing-detection](../research/watch/nate/new-listing-detection.md) (today) | "within the hour" only where measured p95 meets it | yes: Facebook's lag is about 6 to 7 min; other sites' p95 is unmeasured | p95 per site with a seeded listing |
| How are cross-posted duplicates merged? | product cluster plus price band; perceptual photo hash; text match | [fanout-and-watch-loop](../research/watch/ben/fanout-and-watch-loop.md) | cluster and price band, then photo hash | untested | precision on real cross-posted items |
| When is a match a deal? | under the fair range by its spread; under the person's maximum | [fanout-and-watch-loop](../research/watch/ben/fanout-and-watch-loop.md), [appraisal-run](../research/appraise/ben/appraisal-run.md) | `total <= max_total AND match >= 0.8 AND fits AND live`, score from the fair range | weak: rests on an uncalibrated range | the price backtest |
| Is Mercari watched? | yes; no | [platform-access](../research/connect/nate/platform-access.md) | watched, search is read only | yes | Ben and Nate's say |

## Gaps, ranked

### Filled today

| Rank | Gap | Note | What it found that changes a design |
|---|---|---|---|
| 1 | Where replay's recording comes from | [cloud-browsers-and-detection](../research/replay/nate/cloud-browsers-and-detection.md) | V4 has no network log; a CDP attach from session start, Browserbase or Kernel are the routes. Poshmark flags server IPs and Depop needs in-page calls, so replay stays in the page |
| 2 | Site terms on buying agents and buyer APIs | [buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md) | eBay and Depop bar buy-for-me agents, so `auto` offers in Buy conflict with them; GetMyeBayBuying and AddToWatchList give eBay import and watch without a browser |
| 3 | Whether price ranges hold their stated coverage | [range-calibration](../research/price/nate/range-calibration.md) | The one public figure misses its stated 80%; ranges need a per-category conformal layer and a time-split backtest; a cure model fits days to sell |
| 4 | Editors that keep the item's pixels | [editing-alternatives](../research/studio/nate/editing-alternatives.md) | Only cut-out plus paste-back keeps pixels by construction; Flux Fill has a true mask; Gemini adds SynthID |
| 5 | Sale emails for Poshmark and Mercari | [email-and-notification-detection](../research/sold/nate/email-and-notification-detection.md) | Gmail push has no latency promise and needs a restricted scope with a yearly assessment; a forwarding filter avoids OAuth but can be spoofed |
| 6 | Garment accuracy with and without LiDAR | [garment-measurement-accuracy](../research/measure/nate/garment-measurement-accuracy.md) | LiDAR backed by a measured study; a marker or card beats the spec's 12% without LiDAR |
| 7 | Fastest new-listing detection | [new-listing-detection](../research/watch/nate/new-listing-detection.md) | Sites' own alerts are daily or weekly; changedetection.io is a cheaper monitor; Facebook lag is about 6 to 7 min |
| 8 | Seller metrics and alert cadence | [seller-metrics-and-notifications](../research/today/nate/seller-metrics-and-notifications.md) | About 3 batches a day is backed for non-urgent alerts; profit from typed cost is the norm; only two tools show goals |

### Still open

| Rank | Gap | Feature | Why it ranks here |
|---|---|---|---|
| 1 | How App Store guideline 5.1.1(v) treats a session held on our servers | connect, replay | decides where every login lives |
| 2 | Studio editors on real items | studio | the editor choice rests on 3 items and an unrun model |
| 3 | Lakebase and MLflow behaviour in a workspace (ceiling, row security, prompt storage) | data | three spec rows wait on it |
| 4 | What Mercari, Depop and Facebook notification emails contain | sold, messages | decides whether email can be a detection route there |
| 5 | Decisions API rate limits | identify, capture | the decision-tree talk mode calls it about once a second |
| 6 | Error of a card or A4 sheet, and of ARKit scale without LiDAR | measure, capture | decides the non-LiDAR measuring path |
| 7 | A detail-preservation test for edited photos | studio | none is published |
| 8 | Batched against immediate for transactional seller alerts | today | only non-urgent batching is backed |
| 9 | Facebook's anti-bot vendor | replay, list | the one site with no vendor named |
| 10 | Google Calendar scopes | messages | pickups are decided to use it |
| 11 | eBay Browse call limits | watch, buy | sets how many wants one key can watch |
| 12 | The official price of Google's security assessment | sold | the $540 to $1,800 figure is *asserted* |
| 13 | The eBay Partner Network rate for used items | buy, appraise | the 1.5 to 4% figure is *asserted* |
| 14 | Visualping and Browse AI as monitors | watch | not compared |
| 15 | Ben's private replay tool | replay | Ben decides |
| 16 | Household sharing patterns | item-card | no note opens it |

## Spec claims resting only on unopened sources

| Spec line | Claim | Mark it carries | What is needed |
|---|---|---|---|
| [studio.md](features/studio.md) line 87 | Etsy wants one unaltered photo of the real item | *asserted*, page unopened | Etsy's photo policy opened |
| [studio.md](features/studio.md) line 88 | Depop, Poshmark, Mercari and Facebook photo rules "not researched here" | unknown | not unopened: Ben's [platform notes](../research/list/ben/platforms/depop.md) cover them, so the line understates the research |
| [measure.md](features/measure.md) | Size AI reaches 5 mm with LiDAR and 9 mm without | *asserted* | Size AI's own test or a third-party one |
| [measure.md](features/measure.md) | Without LiDAR, 12% off at best | Ben's plan, no study | [garment-measurement-accuracy](../research/measure/nate/garment-measurement-accuracy.md) gives measured lower figures |
| [replay.md](features/replay.md) | A replay takes 1 to 3 s | *asserted* | a timed run |
| [connect.md](features/connect.md) line 144 | Mercari's API is partner only | *asserted* | Mercari's developer page opened |
| [messages.md](features/messages.md) | California's bot-disclosure rule and EU AI Act article 50(1) apply | *asserted* | both texts opened |
| [capture.md](features/capture.md) | Depth quality differs by item class | *inferred* | a per-class depth test |
| [buy.md](features/buy.md) | Purchase import has "no API found" | not found | GetMyeBayBuying exists ([buyer-side-actions-and-affiliate](../research/watch/nate/buyer-side-actions-and-affiliate.md)) |
| [list.md](features/list.md) and [connect.md](features/connect.md) | eBay's LLM-bot ban date | two dates in two notes | the user agreement opened once more |

## Tests that would settle more than reading

| Test | On what | Settles |
|---|---|---|
| Studio bake-off: Seedream, Nano Banana, Flux Fill, Kontext, cut-out plus paste-back and Ben's no-model tweaks on the same 20 items, scored by the fidelity gate and by people who do not know which is which | real items | the editor, the gate thresholds, whether a detail test is needed |
| Price backtest: a time split with a gap, coverage per category, with and without asking prices, plus days to sell | our stored comps | whether ranges hold 80%, which method, the cure model |
| Measuring: 30 garments with a tape, LiDAR, a card, an A4 sheet and an ArUco marker, on a LiDAR and a non-LiDAR iPhone | real garments | the non-LiDAR path and the point-placement error |
| Replay: a CDP attach to a Browser Use session on a test account, recording one post and one delist, then timed replays | test accounts | the recording route, the 1 to 3 s claim, the scrub |
| Sale emails: sell a test item on Poshmark and Mercari to a second account and log email arrival against the sale time | test accounts | email lag, contents, the 1 to 2 min target |
| Workspace run: Lakebase wake time, SSE lag, the autoscaling ceiling, row security on `app.user_id`, what a gateway call stores in MLflow | a real workspace | four data rows at once |
| Seeded listings: post on each watched site from a second account and time the first alert | test accounts | p95 per site and the "within the hour" card copy |
| Labelled identify set: 100 items through the Decisions API and Jev at the gate threshold | real items | the gate, the judge, the rate limits under load |
| A real garage sale on mobile data | real items | appraise latency per tier and the value of the one check |
| Views needed: count extra views on 30 items in the adaptive session | real items | the cap of 2 |
