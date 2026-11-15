# App audit evidence (main, 2026-11-15). Labels: observed (path:line), inferred, not-found. Paths under app/src/app unless stated.

## A. Screens (28 files outside v1/)
Every screen draws a demo world via useScreen() (`@/demo/screen`; ?world= and ?state=). Real outward effects are only: Linking.openURL, expo-camera/image-picker, Linking.openSettings, localStorage (sell folds), and two /v1 fetches. Every other "send/approve/post/offer" is setTimeout plus local state.
| file (lines) | shows / data | wired for real | local-only or no-op |
|---|---|---|---|
| _layout.tsx (26) | root Stack; `new` transparentModal, `camera` fullScreenModal (:18-22); fonts, crash boundary (:15) | navigation | n/a |
| (tabs)/_layout.tsx (17) | Tabs index, sell, buy, you | navigation | n/a |
| (tabs)/index.tsx (297) Today | cards from demo world (useScreen, or stopsWorld/oneCardWorld/quietWorld) | open = navigate; site = Linking.openURL | act/amount/queue simulated with later() setTimeout JOB_MS; ?fail= forces a failure; Undo local. Notice 'log-all' pushes /you/automation (:283), not a key of PAGES (you/state.ts:59-70), inferred to hit "Not found" |
| (tabs)/sell.tsx (266) | shelves/pills from demo (feed, pill, sellItem) | folds persist to localStorage (:41,46); tile press to /item/:id; empty action to /camera | bulk keep/donated/sold_elsewhere/delete local; :243 pushes /you/pause, not in PAGES (inferred Not found) |
| (tabs)/buy.tsx (147) | demo world via @/buy/world | search field to /search; rows to /listing, /want, /item | send offer = setTimeout 600 then toast (:54); walk away/raise local |
| (tabs)/you.tsx (120) | demo insights, unread, useLinks | rows route to /you/<page>, /sell?filter= | all figures demo |
| camera.tsx (289) | see C | expo-camera, image-picker, openSettings | judging, facts, lidar chips local |
| new.tsx (89) | three jobs sell/worth/find, pencil sheet | router.replace to /camera?mode, /item/DRAFT_ID, /worth?product=, /search?q= | described() matches demo catalog (@/demo/capture-edges); no server call |
| onboarding.tsx (103) | SignIn then Sites (3 steps: sites, pickup spot, photo) | router.replace('/') and optional push('/camera') | all linking simulated (see D) |
| search.tsx (75) | demo product/SEARCH_DUNKS | router.setParams; visitor watch pushes /onboarding else /want?q= | results demo |
| want.tsx (219) | want sheet, look across sites | `fetch('/v1/stage')` at :55 only when ?live=1 (polled, wrapped in log.call('http','stage.read')); Linking.openURL :126 | look across sites = STEP timers; approve = setTimeout 600 then setStatus('done'); price/how/colour/size/condition/alert local edit(); ?live=sample uses fixed SAMPLE |
| worth.tsx (230) | demo product(), itemById, connectionState | Sell routes to /camera or sellTo | Keep (setKept), Look deeper, Get appraised (setDeep) local |
| gone-by.tsx (349) | demo rooms/handover | scan room to /camera; link a site to /onboarding; Linking.openURL (~:343) | setup and posting simulated by timers (~:104) |
| dev/health.tsx (25) | /v1/health | `fetch('/v1/health')` :9, relative URL | none |
| dev/crashes.tsx (29) | recorder.readCrashes() from @/log/boundary | local crash log | not a /v1 call |
| dev/parts.tsx (432) | parts gallery; `photo` from @/demo/photos | none | static gallery |
| item/[id]/_layout.tsx (17) | stack: page plus Plan and Post as transparentModal sheets; Ship and Pickup platform push (header comment) | nav | n/a |
| item/[id]/index.tsx (702) | one item, five moments; model in @/item/model; useScreen state | nav to plan/post/product/messages | pause, keep, donated, end-all, copy, delete, split via local did()/end()/online() (:256-267); no fetch |
| item/[id]/pickup.tsx (341) | pickup plan from demo world | Linking.openURL site (:117,:190,:225), Share (sharePlan), calendar links via Linking (:117) | later() = setTimeout 700 (:106); tell/cancel/late/suggest local |
| item/[id]/plan.tsx (276) | Plan sheet, prices from demo/engines | router nav to post (:272-275) | price edits local; "Nothing goes public from here" (:272) |
| item/[id]/post.tsx (216) | Post preview per site | openSite via expo-linking openURL (:76-80, "Post it myself") | Approve/post: setTimeout (:121); retry/skip/edit local |
| item/[id]/ship.tsx (285) | label batch from demo world | Linking.openURL site (:168,:255) and Apple Maps (:216) | later() setTimeout 700 (:113); print/retry/cancel local |
| listing/[id].tsx (141) | demo product/SEARCH_DUNKS | Linking.openURL(m.url) :65 | offer = setTimeout 600 (:55); watch, I bought it local; ask seller routes to /messages |
| messages/index.tsx (130) | demo inbox queue | nav to thread, /you/messages (:112) | send/send-all = setTimeout 700 (:54) |
| messages/[id].tsx (284) | demo conversation | Linking.openURL via openSite (:32) | later() setTimeout 900 (:99); block, take over, hand back, decline local |
| product/[id].tsx (88) | demo product() | visitor Follow pushes /onboarding (:40) | follow toggle local |
| you/[page].tsx (33) | maps 10 PAGES keys (payouts, insights, records, connections, rules, log, notifications, defaults, permissions, settings) to src/you components; else "Not found" | nav | demo data |
| you/connections/[site].tsx (3) | re-exports SitePage from '@/you/site' | | demo |
Other client dirs (observed by file listing): src/buy, src/item, src/today, src/you, src/sell/grid.ts (59 lines, order/filter helper, "No rendering here" :1), src/log/boundary.tsx, src/health.ts.

## B. Client data layer
- API client: not-found. No base URL, no Authorization/Bearer attach, no axios, no EXPO_PUBLIC_* var. Looked: git grep `fetch(|EXPO_PUBLIC|/v1/|Bearer|SecureStore|AsyncStorage` across app/src outside edge/, v1/, tests.
- Only client fetches: dev/health.tsx:9 `/v1/health`; want.tsx:55 `/v1/stage` (only ?live=1). Both relative (same-origin, so on web only; no base URL setting). No token header on either.
- engines/capture/plan.ts:82,121,207 name `/v1/captures/...` paths as data (`answer:{method:'PATCH',path}`), not calls.
- Storage: no expo-secure-store or async-storage in app/package.json. Only localStorage at (tabs)/sell.tsx:41,46 (guarded `globalThis.localStorage?`).
- src/ui/log.ts: in-memory lines; comment says stays in memory until a server sink is wired; on web pushes __events/__log for Playwright.
- app/src/demo contents: README.md, build.ts, capture-edges.ts(+test), capture-photos.ts, capture.ts, demo.test.ts, edges.ts, format.ts, handover.ts(+test), inbox.ts, index.ts, item-photos.ts, item-shots.ts, listing-forms.ts(+test), market.ts, photo-keys.ts, photos.ts, rooms.ts(+test), screen.ts, short-name.test.ts, sites.ts, types.ts, world.ts, worlds/{buyer,clearing,flipper,new,stage}.ts. README: "the world every screen renders".
- Demo importers (git grep): screens (tabs)/buy, index, sell, you, camera, dev/parts (photo only), gone-by, item/[id]/{index,pickup,plan,post,ship}, listing/[id], messages/{[id],index}, new, product/[id], search, want, worth; plus src/buy/{read,world,stage}.ts, src/item/{model,field-why}.ts, src/today/{cards,stops}.ts, src/you/*.
- Screens with no direct demo import: onboarding (via @/you/state which imports demo), you/[page], you/connections/[site] (via src/you), dev/health, dev/crashes, layouts.
- Count (inferred from the above): 2 screens call /v1 (dev/health always; want only with ?live=1). 0 other screens call /v1. 21 screens read demo data directly or through src/ modules (the 19 screen files listed as importers plus onboarding, you/[page], you/connections/[site] through src/you; exact count depends on whether layouts and dev/crashes are counted); dev/crashes reads only the local crash log; 2 layouts plus item layout and tabs layout hold no data.

## C. Capture
- camera.tsx: real expo-camera (useCameraPermissions, CameraView ref `lens`); `lens.current?.takePictureAsync({skipProcessing:true})` ~:135 on native, result not used or uploaded (observed in read; no upload call exists in file). "Judging" = setTimeout of step.judgeMs filling facts from demo table (`step.finds.filter(scannedBy(lidar))`, `@/demo/capture`); scannedBy at :51, SIZED facts only when lidar. `?lidar=0` simulates no LiDAR (:73). library() uses expo-image-picker then router.replace('/sell'), assets discarded. LiDAR, Clean up, Enhance with AI chips are local toggles (header :16 says AI redraw only after LiDAR measure). cam-done does router.replace(ENDS[mode].to). No fetch.
- new.tsx: see A; no server call.
- app/src/sell/: only grid.ts and grid.test.ts (no capture logic).
- app/src/edge/measure/: measure.ts (95) is goals/limits/experiments store (MeasureStore, measure.ts:1-23), not camera measurement; header says plan's measure.md link "describes a different feature" (:2).
- Server: edge/api/captures.ts (423 lines) handlers: POST /v1/captures (:304), GET :id (:325), POST :id/photos (:326), PATCH :id (:366), POST :id/finish (:392), POST :id/talk (:421, exampleHandler, only validates `voice` bool). Routes files in app/src/app/v1/captures/{index,[id]/index,[id]/photos,[id]/finish,[id]/talk}+api.ts are 5-6 line wrappers (e.g. index+api.ts imports `@/edge/auth` and route()).
- captures.ts:2 "Upload signing and realtime credentials remain contract examples." photos handler returns upload URL `https://uploads.example/v/<id>?sig=example` (:361). Row has `data:'example'|'captured'` (:102); initial rows use example fixtures (open = example('captures.open'), :103-127). Identify/studio_plan/photo_score results are accepted as job results (:208-285), validated, not produced here. A grep of captures.ts for model/LLM calls found none.
- Model call: only edge/assist/converse.ts (Anthropic SDK, model 'claude-sonnet-5-5', :1,:43-48), the assist conversation, not capture. grep for anthropic/openai in app/src hit only edge/assist/converse(.test).ts.
- Native/depth: git grep `requireNativeModule|expo-module|ARKit|RoomPlan|ObjectCapture|TrueDepth` in app found only test names in engines/capture/{fields,select}.test.ts (Object Capture/LiDAR as data flags) and a README mention of expo-modules-jsi. No app/modules dir (git ls-files app/modules empty). So no native depth/LiDAR code: not-found.
- app/app.json: ios bundleIdentifier com.bnvg.secondhand, supportsTablet false, usesNonExemptEncryption false; no infoPlist, no ARKit/camera usage keys beyond plugins. Plugins: expo-router, expo-splash-screen, expo-camera (cameraPermission text, recordAudioAndroid false), expo-image-picker (photosPermission text). experiments typedRoutes, reactCompiler. web.output "server"; extra.router.asyncRoutes.web true; eas.projectId present; owner ngarelik.
- app/eas.json profiles: development (developmentClient, internal), preview-sim (ios simulator, internal), production (autoIncrement); submit.production {}; cli ">= 16.0.1", appVersionSource remote. Read only; no EAS command run.

## D. Sign-in and onboarding
- Client sign-in is simulated: src/you/sign-in.tsx:2-3 "The app has no client for /v1/auth yet, so the demo drives it". Apple/Google/email buttons: run() is setTimeout 700 then done; email code accepts any 6 digits except '000000'; send() checks only '@'. changed('session',way,'signed_in') is log-only (src/you/state.ts). Token stored: not-found (no SecureStore/AsyncStorage; app/package.json lacks expo-secure-store, expo-apple-authentication).
- Server side exists: edge/auth.ts header (:1-7) describes bearer token verify, provider id token, email code, access 1 h plus refresh 30 d; store is memoryStore (:52), "Lakebase plus Better Auth replace memoryStore ... later" (:11). v1/auth routes: auth, auth/email, auth/link, me (route map).
- onboarding.tsx: local `in_` from ?signed=1 or ?state; renders SignIn or Sites; finish = router.replace('/') (+ optional '/camera'). Site linking: useLinks (src/you/state.ts:81-100) link() sets loading then setTimeout SIGN_IN_MS=1200 sets connected; Mercari errors on first try ("The code from your phone timed out"). No network. Caption "Your password goes to the site, never to secondhand."
- Marketplace connection: presented as demo rows (you/link-row, sites.tsx, site.tsx), state in local useLinks; no OAuth call (expo-web-browser/expo-linking are dependencies; no auth session use found in the screens grep).

## E. App tests
- app/e2e/: README.md, behavior.mjs, buy/camera/gone-by/item/listing/message/messages (*.test.mjs, more listed beyond 60-row cut), item-common.mjs, demos/{new,sell,today}.json, maestro/*.yaml (18 flows), native/{ScreensTests.swift,project.yml,routes.mjs,run.mjs per README}. app/behavior/: 24 JSON tables, one per screen (cover all 28 screens' main routes, incl. you/[page], you/connections/[site]).
- app/package.json scripts: prestart (fonts), start, android, ios, web (`expo start --web`), lint, test = `node --test "src/**/*.test.ts"`, check = `tsc --noEmit && node --test ...`, fonts. No e2e script in app/package.json. No root package.json.
- e2e commands (app/e2e/README.md): `node scripts/app-check.mjs [route]` and `node --test "app/e2e/*.test.mjs"`; maestro on a Mac; `node app/e2e/native/run.mjs` on a real iPhone.
- .agents/check.mjs: runs only tests matching `^(\.agents|scripts|spec)/.*\.test\.mjs$|^app/src/.*\.test\.ts$` (check.mjs:74). It does NOT run app/e2e/*.test.mjs or behavior. Behavior tables are read by checks (picks P5 per README). CI .github/workflows/check.yml:~64-69 does `npx expo export --platform web`, `node scripts/app-check.mjs --dark --sheet`, `node --test "app/e2e/*.test.mjs"`.

## F. Website
- Found: none of web/, site/ as directories. Looked: git ls-files for ^(web|site|deploy|docs)/, vercel, next.config, Dockerfile, fly.toml, product/graphics/*.html.
- deploy/ exists but is Databricks bundle (databricks.yml, deploy.mjs, resources/*.yml, tasks/*.py). Not a website.
- docs/how-it-works/*.md: 11 markdown files (README, capture-to-facts, ..., value-and-price-history). Markdown, not a site generator.
- product/graphics/benchmark-and-lakehouse.html: single HTML graphic.
- Expo web: app.json web.output "server" (so Expo Router serves web and /v1 +api routes); app/public/llms.txt exists; CI exports web. No next.config/vercel.json/Dockerfile/fly.toml. git grep for vercel|fly.io|expo export hit only text mentions (.agents/vendor, check.yml, app/e2e/web.mjs, features/app/breaks.md, features/buy/README.md, product/words.md).
- git branch -a: main, remotes origin/main, origin/claude/project-thread-* (many), origin/codex/*, mac/main, mac/w/* (~100). `git log --all --oneline -- web`: empty output.

## G. Interface checks
- scripts/copy-lint.mjs: copy lint for in-app words (rules O13 em/en dash, C1 hero verbs, C2 empty adjectives and more; usage `node scripts/copy-lint.mjs <files>`), :1-9.
- .agents/checks/ui.mjs: app code uses brand tokens and passes copy-lint scan (:1-4).
- screens.mjs: static rules S1 money words, S2 one id per screen, S3 wash, S4 states, S5 unlogged scrim tap.
- states.mjs: edge states list in .agents/ui-states.json; mocks naming a state must draw all.
- parts.mjs: screens built from fixed parts in app/src/ui, brand values from tokens.
- interactions.mjs: every control has a row in app/src/ui/interactions.json (I1 to I3...).
- waysout.mjs: every page in spec/pages.md §6 has ways-out in spec/ways-out.md.
- picks.mjs: Ben's brand picks, keyed by .agents/ui-rules.json (behavior table shape P5).
- brand.mjs: scales B13 weights, B17 spacing, B20 radius. motion.mjs: Emil Kowalski motion rules. logging.mjs, code.mjs (swallowed catch), vague.mjs, bundle.mjs, hermes.mjs, standards.mjs also run (check.mjs imports :3-25). There is no strings.mjs.

## H. Features (one line from README line 8; screens and routes are inferred from names/route map unless cited)
- app: README title "app: every screen as built" (features/app/README.md:1) renders/gallery. Screens: all.
- appraise: point app at an item, get worth by platform. Screens: worth.tsx (demo); routes /v1/valuations (POST), /v1/compare.
- assist: assistant in Sell, Buy search, market research. Routes: /v1/assist (POST), edge/assist/converse.ts. Client screen: not-found (no client call).
- buy: one search across five marketplaces plus retail. Screens: (tabs)/buy, search, listing/[id], want (demo). Routes: /v1/search, /v1/follows.
- capture: app walks seller through each shot. Screens: camera, new (demo). Routes: /v1/captures*. Client does not call them.
- connect: onboarding and linking each platform. Screens: onboarding, you/connections/[site] (simulated). Routes: /v1/accounts, /v1/auth*, /v1/sites/[site].
- data: Databricks backbone. Screens: not-found. Routes: /v1/index/[id], databricks/ and deploy/.
- identify: item identity from photos via OpenAI decision API. Screens: not-found. Server: captures.ts accepts identify results (:208).
- insights: You tab analytics, goal. Screens: (tabs)/you, you/[page] insights (demo). Routes: /v1/insights, /v1/goals/[month], /v1/records.
- item-card: one measured record per item. Screens: item/[id]/index (demo). Routes: /v1/items*, items/[id]/attributes/[name].
- list: post everywhere, delist when sold via Browser Use. Screens: item/[id]/plan, post (simulated). Routes: /v1/items/[id] POST, /v1/jobs/[id]; edge/browser.
- market: product pages, price history, trends, follows. Screens: product/[id] (demo). Routes: /v1/products/[id], /v1/trends, /v1/follows.
- measure: LiDAR and garment measurements. Screens: camera LiDAR chips are demo flags. Server: edge/measure/measure.ts is goals/limits/experiments, a different feature (:2). Native measure code: not-found.
- messages: answer buyers, offers, meetups. Screens: messages/index, messages/[id], item/[id]/pickup (demo). Routes: /v1/conversations*, /v1/appointments.
- price: where, what price, ship or local. Screens: item/[id]/plan (demo). Routes: /v1/limits, /v1/valuations.
- replay: Browser Use then replay without a browser. Screens: none. Server: edge/browser/.
- score: score item/listing on four axes. Screens: not-found. Routes: /v1/scores, /v1/scores/[id].
- sold: delist everywhere when sold, ship and pickup. Screens: item/[id]/ship, pickup (demo). Routes: /v1/orders*.
- studio: regenerate clean photos (Seedream 5.5). Screens: post.tsx toggles Clean up / Enhance (local). Routes: none from client; jobs/studio.
- today: home decision cards. Screens: (tabs)/index (demo). Routes: /v1/today, /v1/decisions*, /v1/events.
- watch: describe a want, get notified (Exa monitors). Screens: want.tsx (demo; ?live=1 polls /v1/stage). Routes: /v1/follows, /v1/stream.
Routes listed come from the route directory map (app/src/app/v1/*), not from calls in screens. Whether each route is implemented beyond examples was not checked except captures and auth.

## Not found
- A client API module, base URL setting, token attach, or token storage.
- Any client call to /v1/captures, /v1/auth or any /v1 route other than /v1/health and /v1/stage.
- Native depth/LiDAR/ARKit/RoomPlan/Object Capture module; app/modules directory.
- A website (web/, site/, vercel/next/Docker/fly config); no commits touching web/ on any branch.
- Whether check.mjs includes e2e (it does not); strings check file.
- Not verified: exact line numbers marked "~"; per-route implementation depth for routes other than captures and auth; counts of e2e test files beyond the first 60 listed; full list of screens/behavior/* contents.

## Sources fetched
Local only (git ls-files, git grep, Read, Grep): app/src/app/**, app/src/demo, app/src/you, app/src/edge/api/captures.ts, edge/auth.ts, edge/measure/measure.ts, edge/assist/converse.ts, app/app.json, app/eas.json, app/package.json, app/e2e/README.md, .agents/check.mjs, .agents/checks/*.mjs, scripts/copy-lint.mjs, .github/workflows/check.yml, features/*/README.md, git branch -a, git log --all -- web. Not opened: .agents/team/packets, spec/plans. No external requests.
