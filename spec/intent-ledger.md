# The intent ledger

Every product detail Ben has asked for, and where it stands. Asked for at [08:16](../product/words.md#2026-11-15-every-plan-written-up-the-chain-and-how-close-the-ui-is): "ensuring all these little details i say actually end up being done or planned". The rules each area follows are in [product/constitutions/](../product/constitutions/README.md); this file only says whether each ask has landed.

**Read from:** every message Ben wrote in the project chat up to 08:18 on 2026-11-15, every entry in [words.md](../product/words.md) up to the same time, and the latest messages of the threads that are waiting on him. Messages Ben wrote only inside a thread and that never reached words.md may be missing; add them as rows when found. Nate's asks are tracked in `spec/` and are not repeated here.

**Statuses.** **Done**: in the repo and checked against the file named. **Built (demo data)**: the screen or engine exists but runs on sample data. **Planned**: written into a spec or plan, nobody building it now. **Assigned**: a working thread is building it now. **Ben**: waiting on his call. **Dropped** or **Superseded**: replaced by a later call, named. **Gap**: nobody has it. Times are UTC; a time without a link is a project-chat message not yet in words.md.

**Keeping it true.** A thread that finishes, drops or takes over a row updates that row in the same commit. A new ask from Ben gets a row when it is quoted in words.md.

## The gaps, first

Nobody owns these. The first three need Ben; the rest can be assigned.

| # | Ask | Why it's a gap | Proposed |
|---|---|---|---|
| G1 | Seedream 5.5 for photos, not Nano Banana ([18:32](../product/words.md#2026-11-14-tools-and-capture), [08:09](../product/words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams)) | `jobs/studio/openrouter.py` prefers Nano Banana; Seedream 5.5 was not on OpenRouter's list | Ben: reach Seedream through BytePlus directly (a new key), or accept Nano Banana for the demo |
| G2 | "We applied to the App Store" as a table claim ([05:41](../product/words.md#2026-11-15-a-demo-that-stuns-science-fair-judging-and-claims-that-change-how-judges-see-it)) | Not submitted ([pitch.md](../product/pitch.md)); the website isn't deployed either (Devpost still says "Live on the web at URL") | Ben: submit a TestFlight build tonight, or say "App Store coming soon" |
| G3 | A spoken voice in capture: friendly sentences on screen and aloud, a male voice from a new OpenRouter model ([23:01](../product/words.md#2026-11-14-capture-voice-frame-quality-measuring-skipping-and-video-storage), [03:17](../product/words.md#2026-11-15-new-takes-the-screen-a-live-point-cloud-stage-bubbles-and-the-found-pop-up-item-details-per-site-the-person-takes-the-photo-a-male-voice)) | Researched, never built or assigned; the camera shows text only | Ben: build it now, or cut it from the demo |
| G4 | Sign in with Apple, Google or email as the first onboarding step ([02:46](../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready)) | Specced in [pages §6.1](pages.md#61-first-launch-onboarding); `onboarding.tsx` starts at connecting sites | UI thread |
| G5 | shadcn and the Vercel AI SDK "in here somehow" ([22:23](../product/words.md#2026-11-14-the-ui-loop)) | Named in docs only; the Expo app uses neither and no one decided where they fit | Website thread, for the web build |
| G6 | "is there any downside to doing it on the dev acct?" (07:51) | No recorded answer | Pitch thread |
| G7 | "i think stagehand is better than playwright right?" (04:11) | No recorded answer | UI thread, one line |
| G8 | Gradients whose intensity rises as a deadline nears ([03:41](../product/words.md#2026-11-15-hot-is-red-like-fire-no-glow-state-gradients-with-the-multicolor-intensity-as-deadlines-arise-a-brand-motion-constitution)) | The state colors are built; nothing found that ramps with time | UI thread |

## Product and scope

| Time | Ask | Status | Evidence |
|---|---|---|---|
| 18:07 | Build all the features, don't trim scope | Done | [decisions](../product/decisions.md#2026-11-14-keep-every-feature-in-scope) |
| 18:23 | Better than the pseudo-solutions, nothing to learn, transparent, human in the loop | Done | [words](../product/words.md#2026-11-14-better-than-the-pseudo-solutions-nothing-to-learn-transparent); [UI constitution](../product/ui-constitution.md) |
| 18:50 | The platform list, set in stone | Done | [decisions](../product/decisions.md#2026-11-14-the-platform-list-is-set); `spec/sites.mjs` |
| 22:09 | Grailed and OfferUp posting planned, not built | Planned | [ideas/post-to-grailed-and-offerup.md](../ideas/post-to-grailed-and-offerup.md) |
| 18:36 | Appraise something at a garage sale | Built (demo data) | `app/src/app/worth.tsx` |
| 18:37 | One search box across every secondhand market | Built (demo data) | `app/src/app/search.tsx` |
| 18:47 | Price things in context | Done | [pricing-in-context.md](../research/price/ben/pricing-in-context.md) |
| 19:08 | Active, past, earned, potential, count, interest, time to sell, by site | Built (demo data) | You is a dashboard (commit d3dd329) |
| 19:08 | Drop a huge folder of photos and it lists item by item | Planned | [spec/features/capture.md](features/capture.md); web adds folder drops ([web W12](../product/constitutions/web.md)) |
| 19:15 | Sell, buy, appraise in both; Today; messages only when chosen | Done | [decisions](../product/decisions.md#2026-11-14-the-bottom-bar-is-today--sell----buy--you), [messages](../product/decisions.md#2026-11-14-all-messages-live-behind-a-chat-icon-with-a-count) |
| 19:31 | Keep an option for pickup B's function | Superseded | by no fixed pickup windows, 05:18 to 05:24 |
| 19:33 | Sell as a photo grid with state pills; numbers on the profile | Done | [decisions](../product/decisions.md#2026-11-14-the-sell-tab-is-a-photo-grid-with-state-pills-numbers-live-in-you) |
| 19:38 | Appraise from the buy side | Built (demo data) | New's "What's it worth"; `worth.tsx` |
| 00:12 | Know when something is hot; each site's levers; auto-accept defaults; each site's analytics | Planned | [levers-and-signals.md](../research/list/ben/levers-and-signals.md); [showcase §5](../product/showcase.md#5-the-ai-running-the-storefront-levers-signals-and-hot) |
| 01:11 | The code understands each app's rules | Done | `spec/sites.mjs`, `spec/sites.test.mjs` |
| 01:11 | Work runs server-side and is safe to decompile | Done | the edge routes in `app/src/edge/` |
| 01:11 | Know when things sell, cheaply | Done | thread "Detect sales cheaply on the server"; 0.44 s in [pitch constitution](../product/pitch-constitution.md) |
| 02:46 | Seller intents: my minimum, a fire sale, keep it unless I get my price | Planned | [spec/features/price.md](features/price.md); [ways-out](ways-out.md) |
| 05:05 | Edge cases: two sales at once, different payouts and fees, typos, not knowing what the item is | Done | [edge-cases.md](edge-cases.md); the double-sale model in `spec/lifecycle.mjs` |
| 05:05 | Each site's audience and what sells there | Done | [edge-cases.md](edge-cases.md); [levers-and-signals.md](../research/list/ben/levers-and-signals.md) |
| 05:18 | Approve exact messages, escalate, audit | Done | [decisions](../product/decisions.md#2026-11-15-replies-to-buyers-start-as-drafts-the-person-approves); `messages/[id].tsx` (demo data) |
| 05:18 | No fixed pickup schedule | Done | [decisions](../product/decisions.md#2026-11-15-no-fixed-pickup-windows-tap-the-days-and-times-that-work-and-approve-the-buyers-pick) |
| 05:24 | No calendar in the app; pick days and times; see who's coming; add to Google or Apple after | Built (demo data) | `item/[id]/pickup.tsx` |
| 05:18 | Safe meetup places and times | Built (demo data) | `app/src/demo/handover.ts`; [edge-cases.md](edge-cases.md) |
| 05:18 | Taking posts down | Built (engine) | `app/src/edge/orders/orders.ts`, `app/src/edge/events/sale.test.ts` |
| 05:18 | An approved action becomes each site's approved offer | Planned | [crosslist X6](../product/constitutions/crosslist.md) |
| 05:18 | Audit any site from one app | Built | SiteLink and SiteCopy (commit 7725051) |
| 05:18 | Suggest sites not to list on; the person can still | Assigned | Plan page, UI thread; [crosslist X4](../product/constitutions/crosslist.md) |
| 05:23 | Notifications reasoned from business, UX and personas | Done | [notifications.md](notifications.md) |
| 06:40 | A sale and a match ping at once; replies start as drafts | Done | [decisions](../product/decisions.md#2026-11-15-a-sale-and-a-watched-item-under-your-price-notify-at-once) |
| 06:44 | You send it; if a buyer asks, it says so | Done | [features/messages.md](features/messages.md) |
| 05:47 | Settings with app and permission defaults | Built (demo data) | `app/src/you/defaults.tsx`, `permissions.tsx` |
| 05:47 | Import existing Depop listings and cross-list them | Built (engine) | `app/src/edge/connect/depop-import.ts` and its test |
| 05:54 | Stop using Ben's personal Depop | Done | project rule; [showcase §6](../product/showcase.md#6-bringing-existing-depop-listings-over) |
| 08:15 | No applications to marketplaces yet | Done | [listing-help-apis.md](../research/list/ben/listing-help-apis.md) |

## Listing and cross-listing

| Time | Ask | Status | Evidence |
|---|---|---|---|
| 21:28 | Each site researched to Depop-plus depth; products per site; a couch isn't for Depop | Done | `research/list/ben/levers/`; [edge-cases.md](edge-cases.md) |
| 23:17, 00:11 | Search wording per site, with strategize-deeply | Done | [listing-seo-strategy.md](../research/list/ben/listing-seo-strategy.md) |
| 03:17 | Each site's categories, fields and limits | Done | [item-attributes-by-site.md](../research/capture/ben/item-attributes-by-site.md) |
| 03:17 | Drive Ben's accounts to explore listing flows | Dropped | by 05:54, never his personal Depop |
| 06:51 to 07:00 | Cross-site price is a choice; presets; words first; new sellers start on same take-home | Built | `SPREADS` in `app/src/engines/listing/crosslist.ts`; account rule in Settings; per-item switch Assigned to the UI thread |
| 07:41 | eBay's listing-help APIs and other sites' equivalents | Done | [listing-help-apis.md](../research/list/ben/listing-help-apis.md), `app/src/engines/listing/aspects.ts` |
| 08:09 | Ranked guesses at what the item is; pick one and it fills in | Assigned | UI thread; [identity engine](engines/identity.md) |
| 08:09 | Suggest sites by type of item | Assigned | Plan page, UI thread |
| 08:12 | One draft posted to five sites live, with both photo fixes toggled | Assigned | UI thread; [demo D4](../product/constitutions/demo.md) |
| 08:12 | AI-filled fields in their own color | Assigned | UI thread; [crosslist X10](../product/constitutions/crosslist.md) |

## Capture and photos

| Time | Ask | Status | Evidence |
|---|---|---|---|
| 18:32 | Guided shots so the person does no thinking | Built (demo data) | `app/src/app/camera.tsx` |
| 18:32 | Light it in a studio, a garage or a house | Dropped | scene presets dropped ([studio spec](features/studio.md)) |
| 18:32, 08:09 | Seedream 5.5, not Nano Banana | Gap | G1 |
| 18:48 | One shot list for the listing and the model | Done | [decisions](../product/decisions.md#2026-11-14-capture-is-one-session-and-the-item-picks-the-mode) |
| 21:22, 22:24 | Capture as a decision tree that asks for the tag, the graphic, better light | Planned | [decision-tree-capture.md](../research/capture/ben/decision-tree-capture.md); talk mode one tap away ([decisions](../product/decisions.md#2026-11-14-capture-opens-on-the-guided-shot-list-talk-mode-is-one-tap-away)) |
| 23:01, 03:17 | Sentences said aloud, a male voice | Gap | G3 |
| 23:01 | The person can skip parts; the cost of storing video | Planned | [live-video-capture.md](../research/capture/ben/live-video-capture.md) |
| 03:17 | Stage bubbles to checkmarks, a centered instruction, "Carhartt ✓" from above, a live point cloud; the person takes the photo | Built (demo data) | `app/src/ui/parts/camera.tsx` |
| 06:19 | The frame is the listing photo's shape; a review screen after | Built (demo data) | 3:4 frame (commits a14a7d9, 9999163) |
| 21:28 | Touch up, never change the scene | Done | [studio spec](features/studio.md); [photo F1](../product/constitutions/photo.md) |
| 22:23 | Fixes without generation, and a photo score | Planned | level 0 in [studio spec](features/studio.md); [photo-score.md](../research/studio/ben/photo-score.md) |
| 23:01 | Templates for any shirt, pants or sweatshirt; read C2PA | Planned | [research/studio/ben/templates/](../research/studio/ben/templates/); [studio spec](features/studio.md) |
| 23:18 | No AI label on exported photos; track it ourselves | Done | [studio spec](features/studio.md) |
| 23:31 | Measure the generated photo against the item, with an error band | Done | `jobs/studio/check.py` |
| 05:05 | Both AI and plain enhancement | Planned | levels 0 to 2 in [studio spec](features/studio.md); the toggles are Assigned (08:12) |
| 06:01 | Slide order per garment, the defect photo, working on the backend | Assigned | thread "Perfect every listing photo automatically" |
| 07:51, 08:09 | Prove photos with the tape; only pass when accurate | Assigned | photo thread; site wording updated in the website thread |

## Buying

| Time | Ask | Status | Evidence |
|---|---|---|---|
| 18:32, 20:41 | Exa alerts when something is available or under a price | Superseded | watch runs on Firecrawl, the eBay API and a Facebook search ([decisions](../product/decisions.md#2026-11-14-watch-alerts-run-on-firecrawl-the-ebay-api-and-a-facebook-search-api)) |
| 21:25, 23:03 | Better monitors; our own page monitor | Done | [monitor-alternatives.md](../research/watch/ben/monitor-alternatives.md), [own-page-monitor.md](../research/watch/ben/own-page-monitor.md) |
| 05:20 | A want built by touch that runs while you're away | Built | `app/src/app/want.tsx` |
| 07:46 | Nate posts, Ben's phone pings, live | Built, not yet tested on a real listing | [live-buy-demo.md](../product/live-buy-demo.md), `scripts/demo/stage-watch.mjs` |
| 08:09 | Prove the Brewers alert actually fires; why Poshmark is polled | Assigned | thread "Prove the Brewers jersey buy alert" |
| 05:18 | Buyer-side failures, refunds, what we don't control | Done | [qa.md](../product/qa.md); [buy B5](../product/constitutions/buy.md) |

## Pricing and the backtest

| Time | Ask | Status | Evidence |
|---|---|---|---|
| 18:36 | Market value is many-sided and differs by site | Done | [valuation-engine.md](../research/price/ben/valuation-engine.md), [price spec](features/price.md) |
| 06:10 to 06:54 | Brand value, rarity, competitors, insurance and quant logic applied | Done | [pitch/market.md](../product/pitch/market.md), [risk-and-reconciliation.md](../research/price/ben/risk-and-reconciliation.md), [money](determinations/money.md) |
| 05:47 | Price anything with quant techniques at scale | Done (proposal) | [showcase §4](../product/showcase.md#4-pricing-anything-and-how-it-scales) |
| 07:18 to 07:38 | A backtest that proves and tunes, flatters truthfully, says which side it misses on, with a paper | Done (design) | [plan](plans/backtest/plan.md), [paper](plans/backtest/paper.md) |
| 07:19, 07:28 | Research trends first, including outside resale and donation cycles | Done | [what-predicts-price-and-speed.md](../research/price/ben/what-predicts-price-and-speed.md), [seasons](../research/price/ben/seasons-events-and-a-fair-backtest.md) |
| 07:39, 07:40 | The easiest sold data; engineer around limits | Done | [sold-datasets.md](../research/price/ben/sold-datasets.md); NBER eBay set waits on Nate (packet 64) |
| 07:27 | Backtest results | Assigned | thread "Design a credible price backtest"; the first run is not finished |
| 08:12 | Scraped sold sets in the backtest | Ben | card in "Get sold-item data for the backtest" |
| 08:12 | Kaggle's data rules | Ben | needs his login |

## The app's look and feel

| Time | Ask | Status | Evidence |
|---|---|---|---|
| 19:45 to 20:20 | Show, don't say; anti-claudish; familiar; extreme intention; a UI constitution | Done | [ui-constitution.md](../product/ui-constitution.md), `scripts/copy-lint.mjs` |
| 18:56 | Flower yellow and center red palette; Marist type | Superseded | the sky-lime set and Clofie with Neue Montreal, rounds 6 to 8 |
| 19:59 | Platform logos square and rounded; no mono | Done | check U6 in `.agents/checks/render.mjs` |
| 20:33 | UI as audited images, image to code | Superseded | by 03:24 and 04:01: image models only sketch, screens are built from the kit |
| 23:17 | Fresh context per image; rate limits | Done | the `image-gen` skill |
| 00:50 | The UI system learns, with checks | Done | `.agents/ui-rules.json`, `.agents/checks/` |
| 01:16 | Standard sizes, darker dark colors, ban emojis | Done | the size system; emoji check in `.agents/checks/render.test.mjs` |
| 02:18 | Dark mode, money shown, countdowns, clickability, separation, gradient fade | Done | thread "Roll the UI system out everywhere" |
| 02:46 | New is a bigger circle that takes the screen into the camera | Built | `new.tsx`, the takeover part (commit a14a7d9) |
| 02:46 | Gradients carry state; hot is red, no glow | Done | [state-color-meaning.md](../research/cross-cutting/ben/state-color-meaning.md), `app/src/ui/paint.ts` |
| 02:46, 07:12 | A queue that piles and fans out; a flattering number on top, never $0.00 | Built | `pile.tsx`, the top ladder (commit e646a58) |
| 02:46 | Button sizing and tap areas | Done | [buttons-taps-corners-new-camera.md](../research/cross-cutting/ben/buttons-taps-corners-new-camera.md) |
| 03:22, 03:45 | A pill behind the current tab; text at 500 | Done | [words](../product/words.md#2026-11-15-text-at-500-and-a-pill-behind-the-current-tab) |
| 03:55 | No missing functions: a way out for each persona | Done | [ways-out.md](ways-out.md), `.agents/checks/waysout.mjs` |
| 04:00 to 04:12 | Emil's skills vet pages; human in the loop as a hand-off decision | Done | [.agents/ui-build/README.md](../.agents/ui-build/README.md) |
| 06:19 | Gallery notes: Today explains itself, no "Keep the lot", Sell folds, You is a dashboard, sign back in, the way back to the site | Built | `app/src/today/cards.ts`, `app/src/you/sign-in-row.tsx`, commits d3dd329 and 7725051 |
| 07:10 | Deep teal lead card in dark | Done | [brand constitution](../brand/constitution.md) |
| Round 10 | A hand mark and a snap sound | Planned | [snap-sounds.md](../research/cross-cutting/ben/snap-sounds.md); hands built on the website hero only |
| 08:09 | The UI implements a flow for each feature worth showing | Assigned | UI thread: Item, Plan and Post are unfinished |

## The website

| Time | Ask | Status | Evidence |
|---|---|---|---|
| 04:32 | Ideate the site from the references; story, photography direction, signed-in web | Assigned | thread "Design the secondhand website with me" |
| 05:49 to 07:51 | The hero: the line, the blurred wall, the dap open, the hands, every screen size | Done | PRs #7 and #12; `brand/explore/web-home/` |
| 07:28 to 07:51 | Pick the hand | Ben | recommendation C in sky and mint |
| 05:05, 05:28 | Cleo's layout, shorter; the small pages; one section at a time | Planned | the proposal's round 2; not built past the hero |
| 05:18 | An FAQ | Done (words) | [faq.md](../product/faq.md); the page isn't built |
| 05:32 | The first scroll, demos of the real app, impressive over housekeeping | Planned | [web W2 to W4](../product/constitutions/web.md) |
| 05:41 | Mobile done properly; "App Store coming soon" | Planned | [web W10](../product/constitutions/web.md) |
| 04:32 | Where the buy/sell toggle lives; people in scene photos | Ben | cards in the website thread |

## The pitch and the demo

| Time | Ask | Status | Evidence |
|---|---|---|---|
| 19:15 | Pitch from data about the problem | Done | [pitch.md](../product/pitch.md) |
| 05:36 | Every point a judge could dock is answered | Done | [qa.md](../product/qa.md#where-judges-dock-points) |
| 05:41 | A ranked list of demo beats | Done | [features-proof, what to show](../product/features-proof.md#what-to-show-ranked) |
| 05:41 | Claims: App Store, deployed site, video, Devpost | Gap | G2; Devpost draft Done ([devpost.md](../product/devpost.md)) |
| 05:18 | A pitch video | Planned | [pitch-video.md](../product/pitch-video.md); not recorded |
| 05:43 | Both sides; free; honest business | Done | [business.md](../product/business.md) |
| 05:47 | What each audience wants; Databricks depth | Done | [showcase §1 and §2](../product/showcase.md) |
| 06:01 | Let the magic talk: clips, basement demos, faster loops | Done (plan) | [demo-reel.md](../product/demo-reel.md); clips in `features/app/demos/` |
| 06:35 | The theme, "Let's dig in" | Done | [theme.md](../product/theme.md) |
| 06:40 | It's always you; security; open source | Done | [pitch.md](../product/pitch.md#its-always-you-ai-that-helps-you-not-ai-that-is-you) |
| 06:44 | What nobody else has done | Done | [unique.md](../product/unique.md) |
| 06:59 | A pitch constitution; the ambiguous problems | Done | [pitch-constitution.md](../product/pitch-constitution.md), [hard-calls.md](hard-calls.md) |
| 06:59 | Ben's calls on J46 to J52 | Ben | [open-questions.md](open-questions.md) |
| 07:15 | Proof without sales | Done | [proof-without-sales.md](../product/proof-without-sales.md) |
| 07:53 | Every AI feature, how we did it, how to prove it | Done | [features-proof.md](../product/features-proof.md) |
| 08:09 | Quantify every feature; a why for each rule; costs, ROI, referral revenue; Databricks explained | Assigned | thread "Quantify every feature with why and ROI"; rules and why: [constitutions](../product/constitutions/README.md) |
| 08:16 | Every plan written up the chain; this ledger; how close the UI is | Done | this file and [constitutions](../product/constitutions/README.md) |

## How the work runs

| Time | Ask | Status | Evidence |
|---|---|---|---|
| 21:20, 04:36, 05:05 | Log everything; hill-climb what's slow | Done | [log/](../log/README.md), `log/climb.mjs` |
| 23:01, 01:19 | Code rules from the harness; agents use the research | Done | the `build` skill; `scripts/evidence.mjs`; `Rests-on:` trailers |
| 23:06 | An ideas board | Done | [ideas/](../ideas/README.md) |
| 04:33 | Font files in the repo | Superseded | the standing rule keeps licensed fonts out of git; renders load them from the `BRAND_FONTS` secret |
| 05:37 | Fetch a skill Ben names | Done | [AGENTS.md](../AGENTS.md#how-to-work-here) |
| 07:14, 07:47 | Everything in the repo; packets for Nate | Done (standing) | [AGENTS.md](../AGENTS.md#how-to-work-here) |
| 07:18 | Every decision to the project chat; merge to main | Done (standing) | project instructions |
| 08:18 | Save Opus: fewer steps and tokens in the build | Ben | the coordinator's four cuts are waiting on his yes |
