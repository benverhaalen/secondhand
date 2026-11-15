# 47: What the pages need from the backend, and how both sides build at once

Updated: November 15, 2026. Owner: Ben. For: Nate. Agent: Claude Code, project thread "Map every feature and page so the build can start". Branch: `main`. Status: *agent proposal*; nothing here is decided. Source: Ben, 02:46 and 02:52 ([words](../../../../product/words.md#2026-11-15-the-new-button-gradients-that-carry-state-seller-intents-onboarding-and-build-ready), [words](../../../../product/words.md#2026-11-15-packets-to-nate-for-the-backend-and-building-in-parallel)): "ensure you are sending packets to nate for anything his backend work might need".

## What is new, and where

| What | Where |
|---|---|
| Every page, what it shows, what it calls, and when a feature gets its own page | [spec/pages.md](../../../../spec/pages.md) |
| App sign-in (Apple, Google, email code) and the onboarding order | [connect § Signing in](../../../../spec/features/connect.md#signing-in-to-secondhand) |
| Seller intents (Sell it, Gone fast, Best price, Only at my price, Just checking) and what they set underneath | [price § Selling intents](../../../../spec/features/price.md#selling-intents) |
| Standing against the market, judged against the intent | [score § Standing](../../../../spec/features/score.md#standing-against-the-market) |
| How the app, the website and your backend build in parallel against one contract | [plans/parallel-build.md](../../../../spec/plans/parallel-build.md) |

## What the pages need that the canon lacks

Each is asked as a contract row. Until it lands in [product.md](../../../../spec/product.md) §3 or §7, the app mocks it from the example here. If you change a shape, change the example in `spec/examples/` (your `T0-2`) and say so in this packet.

**1. App sign-in on the edge** ([connect](../../../../spec/features/connect.md#signing-in-to-secondhand)). Recommended: Better Auth in the Expo Router API routes, users in Lakebase next to `user`; Clerk if Lakebase is not reachable from the edge in the first hour. Your call: you own the edge.

```json
POST /v1/auth/apple   {"identity_token": "…", "nonce": "…", "name": "Sam"}
200 {"access_token": "…", "refresh_token": "…", "created": true,
     "user": {"id": "usr_8f2k", "auth_methods": [{"provider": "apple", "linked_at": "2026-11-15T03:10:00Z"}],
              "onboarding": {"done_steps": [], "finished_at": null}}}
```
Also `POST /v1/auth/google {id_token}`, `POST /v1/auth/email/start {email}` (202), `POST /v1/auth/email/verify {email, code}`, `POST /v1/auth/refresh`, `POST /v1/auth/signout`.

**2. Onboarding progress and push.** `GET /v1/me` is a new route: `user` plus `onboarding {done_steps[], finished_at?}` and `auth_methods[]`. `PATCH /v1/me {onboarding_step?, notification_pref?, push_token?, tutorial_seen?}`; steps are `signed_in, sites_picked, sites_linked, imported, email, pickups, notifications`. `notification_pref[]` already exists on `user`; only the write is new. Also `POST /v1/auth/link/{apple,google,email}` to add a second method, and a push payload `{kind, decision_id?, item_id?, path}` so a tap opens the right page.

**3. The top slot** on `GET /v1/today` ([pages §4](../../../../spec/pages.md#4-the-top-slot)), now **decided** by Ben at 03:17 ([decision](../../../../product/decisions.md#2026-11-15-the-top-of-today-shows-money-kept-since-you-last-looked-only-when-there-is-some)): money kept since the person last opened the app, or the next setup step for someone new, or no headline at all. Never a zero. Needs `user.last_open_at`, set when Today opens.

```json
"headline": {"kind": "kept_since_last_open", "value": {"amount_cents": 9620, "currency": "USD"},
             "label": "Since yesterday", "sub": "2 sold, after fees", "citation_id": "ci_41x"}
```
`kind` is `kept_since_last_open` or `next_setup_step`; with nothing new, `headline` is absent.

**4. Today's tiers and stacks** ([pages §5](../../../../spec/pages.md#5-today-one-feed-ordered-by-what-ignoring-a-card-costs), *agent proposal* on Ben's card). Fixed per decision kind: `tier` (`now`: money or a promise within a day; `when_you_can`; `good_to_know`) and `group_form` (`single`, `batch`, `queue`), from the table in [today feed and card states §3](../../../../research/today/ben/today-feed-and-card-states.md#3-every-card-kind-its-form-and-its-states). Per decision: `group_key` (the item and kind, or the kind) and `group_rank` (best option first). A decision due within a day is never grouped.

**5. Seller intent** on `limits`, per item ([price](../../../../spec/features/price.md#selling-intents)): `plan_choice` (`sell`, `fast`, `best`, `reserve`, `check`; not `intent`, which your assist entity and `message.intent` already use), `gone_by?`, `fallback` (`ask`, `donate`, `keep`, `trade_in`, `relist`; relist never on Poshmark), `markdown_on`, `review_at?`, `accept_mode` (`auto`, `ask_all`). It maps onto `objective`: sell → balanced, fast → quick, best → max_return, reserve → max_return with no path, check → an appraisal or balanced with ask_all. Engine changes: a `fast` plan with a date uses a step holding cost at the date; `reserve` builds no path and never enters `stale`, and offers below its number go to `decline_offer` (a counter at the floor) or ask; D15 skips `reserve` and `check`. `end_unsold` stays ask and not promotable; `fallback` only preselects its answer. Always accept is offered, never preset. A suggested price never goes below `floor_cents`. Also wanted: a read of the five choices with days and you-keep before one is picked (e.g. `GET /v1/items/:id/plan-choices`), with per-site sold prices.

**6. Standing** on each listing as `market_standing` (your `strategy.standing` already names the standing levers) ([score](../../../../spec/features/score.md#standing-against-the-market)), recomputed with the success score and sent on `score.change`:

```json
"market_standing": {"word": "on_pace", "place": {"rank": 3, "of": 14, "basis": "price"},
             "outlook": {"days_lo": 4, "days_hi": 9},
             "fix": {"change": "Add a photo of the tag", "points": 6, "action_id": "act_tagphoto"},
             "citation_id": "ci_77a", "state": "shown"}
```
`word` is `hot, on_pace, slow, stuck, still_learning`, or `waiting_for_price` for a reserve listing. `U_best` in the success score is the best plan under the chosen intent.

**6b. Facts one at a time while the camera is open.** The camera shows each fact as it is found and a blank for each it cannot find, with the comparison in words ("Matching against 214 sold jackets"). So the identify and valuate job streams send one frame per attribute and the comp count as it grows:

```json
{"event": "fact.found", "job_id": "job_9a", "attribute": {"name": "brand", "value": "Carhartt", "source": "label"}}
{"event": "fact.found", "job_id": "job_9a", "attribute": {"name": "size", "value": null, "unknown_reason": "not_visible"}}
{"event": "job.stage", "job_id": "job_9b", "stage": "comps", "found": {"comps": 214, "kind": "sold jackets"}}
```

**7. Your style**: `GET`, `PATCH /v1/me/style` is already in product.md §7; nothing to add.

**7b. Smaller asks**, each a row in [pages §8](../../../../spec/pages.md#8-what-the-pages-need-that-the-canon-does-not-have-yet): a purpose on the capture (`sell`, `appraise`, `find`) beside `capture.mode`; a realtime session for talk mode; an import preview ("We found these"); job events for a visitor's search; the open-decision count and top kind per item on `GET /v1/items`; web sessions (storage, CORS, Apple and Google web client ids); `format=pdf` on records, or tell us to drop it.

**7c. Ways out** ([spec/ways-out.md](../../../../spec/ways-out.md), from Ben at 03:55: no one gets stuck in the AI flow). Each is one tap off the main path:
- a person-set ask on promotable auto kinds through your existing `POST /v1/rules` (never `delist_after_sale`); `user.auto_reply` (`on`, `drafts`, `off`, per site; offers still follow the plan)
- `user.paused_until` with a Pause selling job (each site's own away mode; else end, then a `relist` card on the date, never on Poshmark)
- `POST /v1/decisions/:id/snooze {until}` (never past the deadline); an act option `done_elsewhere` that closes a card and reads the site
- an item from words, with no photo (Post asks for one before posting); one listing imported by link
- `attribute.locked` (the agent never proposes a change to that field); a typed price on the plan
- `POST /v1/items/:id/sold-elsewhere {price_cents?}` (a user transition to `done` with an order of kind `offline`), `DELETE /v1/items/:id` (refused with an open order), copy an item, split an item, a capture that matches a held item asks Same thing?; photo add, remove and reorder on a live item
- self-ship on `POST /v1/orders/:id/ship {carrier, tracking?}`; moving a pickup time; quiet hours for sellers; per-site price and returns terms
- `user.prefs {suggest_edits}` (never offer photo edits); "Not my size" on a match

**8. One name for the relink card.** The canon's decision kind is `relink`; [protocol and adapters §3.6](../../../../spec/engines/protocol-and-adapters.md#36-how-every-event-reaches-the-system-agent-proposal) says `account_stale`. Pick one; the pages use whichever you keep.

## How we build at the same time

From [parallel-build.md](../../../../spec/plans/parallel-build.md):

- The seam is `spec/examples/` (`T0-2`). The pages need it first, so it is the most valuable thing your side can land: one request and response per endpoint, the stream frames for one job, and every error.
- The screens call the API through one client in `app/src/api/` (task `W0-1`, Ben's side). When a route is not in the edge's route list yet (a manifest, not a 404, since your 404 also means "not yours, or gone"), the client answers from `spec/examples/`; when stream 15 adds the route, the real answer flows with no change on either side. `MOCK=<names>` forces the example for a demo. Nothing on Ben's side writes `app/src/app/v1/` or `spec/examples/`, which [workstreams](../../../../spec/plans/workstreams.md) gives to stream 15. Nobody waits.
- The pages run on the examples until your wave 2 is done at 02:00, so they never wait on your clock; they meet your checkpoints (21:45, 23:30, 02:00, 03:00 Central) to swap mocks for real routes as each lands. Joining is in your 03:00 to 07:00 leeway, as packet 45 already says.
- The website is the same Expo Router codebase on the web (react-native-web is already installed), so the edge stays in the Expo API routes and is hosted with the web build. This replaces "the edge on Next.js" from app/README. Your call; option C there keeps Next.js for the signed-out Home only.
- The first wave is the thin path both sides already agreed: sign-in, ＋, capture, identify, a price range, one eBay listing, a Today card.

## Things from your side that conflict with Ben's, for the two of you

| Your line | Ben's line | What depends on it |
|---|---|---|
| The success score is shown by color ([score](../../../../spec/features/score.md)) | The brand allows four state colors, though Ben said at 02:59 not to weight color blindness too much ([words](../../../../product/words.md#2026-11-15-do-not-weight-color-blindness-too-much)) | Proposed in [pages §3](../../../../spec/pages.md#3-what-every-card-and-tile-tells): stage keeps the four fills; standing (your bands) is drawn separately; Ben picked red for Hot at 03:41, and a card's gradient grows stronger as its deadline nears (constitution Articles 5 and 11). The API needs nothing new for that: `decision.deadline` already carries the time. Your bands map to the words; the API sends `market_standing.word`, never a color |
| Capture opens on the type pick ([capture](../../../../spec/features/capture.md)) | Capture opens on the guided shot list ([decision](../../../../product/decisions.md#2026-11-14-capture-opens-on-the-guided-shot-list-talk-mode-is-one-tap-away)) | The camera page; [pages §6.5](../../../../spec/pages.md#65-camera) follows yours with the shot list as the process after the pick |
| A sale is batched with other alerts ([today](../../../../spec/features/today.md)) | Ben's research proposes an immediate push for a sale ([today research §3](../../../../research/today/ben/today-wants-alerts-and-clickability.md#3-alerts-a-person-perks-up-at)) | The notifications step and the push rules |
| You answered B6, B7, B8, B10 and J17 in [open-questions](../../../../spec/open-questions.md) | Ben has not agreed on record | Studio, capture and photo defaults |

## Next action

Nate: have stream 15 land `T0-2` with the rows above in it, pick the sign-in library and the relink name, say which stream owns sign-in (`AU-1` writes `app/src/edge/auth.ts`, which no stream owns yet), and reply here with anything you would shape differently. Ben's agents build the parts kit and the wave 1 pages against the examples meanwhile.

## From Nate's side

November 14, 2026, about 22:30 Central. Written by stream 15 (API and contract), Claude Code, for Ben. Each choice below is an *agent proposal* for Nate. The rows are sent to the orchestrator for [product.md](../../../../spec/product.md), which only it writes.

**What landed.** Everything is in [spec/examples/](../../../../spec/examples/README.md), and `node --test spec/examples.test.mjs` passes on `main`:
- one request and response for each of the 71 endpoints in §7
- every row this packet asks for, marked `"proposed": true`
- the stage frames of an identify-then-valuate job, a visitor's search and the signed-in `/v1/stream`
- every error code

The test fails on any of these: a dollar float, an id without its prefix, a time that is not UTC, a client-sent `user_id`, a POST without `Idempotency-Key`, or a §7 endpoint with no example. Items 1 to 8 and 7b are all in, with the shapes above.

The edge's contract layer is also on `main` ([http.ts](../../../../app/src/edge/api/http.ts)). Each route serves its example through the same handler until its engine lands. Ids an example does not name get `404 not_found`, which is how the real route answers.

**Choices on the open points:**
- **Relink name:** the decision kind stays `relink`. `account_stale` is the event that raises it.
- **Sign-in:** stream 15 owns `app/src/edge/auth.ts` and `/v1/auth/*`. Apple and Google id tokens are checked against their keys on the edge. Email codes are 6 digits and last 10 minutes. Sessions are opaque tokens that are stored hashed: access lasts 1 h, refresh lasts 30 days and rotates.
- **Where users live:** behind an `AuthStore` interface, in memory tonight. Better Auth on Lakebase replaces the store behind that interface; the library is not added tonight. Web sessions use the same bearer tokens, with CORS for the site's origin.
- **The edge stays in the Expo Router API routes**, as you proposed.

**Shaped differently:**
1. `fact.found` and `job.stage` frames are SSE frames `{id, event, data}`, with `job_id` inside `data`, so `Last-Event-ID` resumes them. The comp count rides in `found` as `{comps, kind}` next to the canon's counts.
2. The visitor search stream is `GET /v1/jobs/:id/events` with no token, for the visitor's own job. There is no second stream.
3. `GET /v1/items` rows carry `needs_you {count, top_kind}`.
4. The talk session is `POST /v1/captures/:id/talk`. The client secret is ephemeral and never stored.
5. Records keep `format=pdf`. The example answers `application/pdf`.
6. A new route, `GET /v1/routes`, is the manifest your client reads. It says whether each endpoint answers from its engine or from its example. Your client can switch on that instead of guessing from a 404.
7. Stream 2's decision kind `confirm_trade` and its job kinds `answer_offer`, `make_offer`, `sweep` and `relink` are in the examples. A job waiting on a relink shows `paused: "account_stale"`.

**For Ben:** if a page needs a field the examples lack, ask here and stream 15 adds it to the example first.
