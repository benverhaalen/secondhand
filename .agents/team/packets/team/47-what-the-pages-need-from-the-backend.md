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

**2. Onboarding progress and push** on `GET` and `PATCH /v1/me`: `onboarding {done_steps[], finished_at?}` with steps `signed_in, sites_picked, sites_linked, imported, email, pickups, notifications`; `push_token` (Expo push) and `notification_pref[]`.

**3. The top slot** on `GET /v1/today` ([pages §4](../../../../spec/pages.md#4-the-top-slot)). The server picks the row so phone and web agree, and never sends a zero.

```json
"headline": {"kind": "earned_week", "value": {"amount_cents": 9620, "currency": "USD"},
             "label": "Earned this week", "sub": "3 sold", "citation_id": "ci_41x"}
```
`kind` is one of `earned_week, earned_month, on_its_way, goal, could_earn, worth, watching, next_setup_step, none`; `none` carries no value.

**4. Stacks in Today** ([pages §5](../../../../spec/pages.md#5-today-a-list-with-stacks-only-for-same-kind-groups)): each decision gets `group_key` (the item and kind, or the kind for three or more notices) and `group_rank` (the order inside the stack, best option first). A decision due within an hour is never ranked under another.

**5. Seller intent** on `strategy` and `limits` ([price](../../../../spec/features/price.md#selling-intents)): `intent` (`sell`, `fast`, `best`, `reserve`, `check`), `gone_by?`, `fallback` (`ask`, `donate`, `keep`, `trade_in`, `relist`), `markdown_on`, `review_at?`; `limits.accept_mode` (`auto`, `ask_all`). Engine changes: a `fast` plan with a date uses a step holding cost at the date; `reserve` builds no path and never enters `stale`; D15 skips `reserve` and `check`; `end_unsold` is raised only when `fallback` is `ask`. The floor rule is unchanged.

**6. Standing** on each listing ([score](../../../../spec/features/score.md#standing-against-the-market)), recomputed with the success score and sent on `score.change`:

```json
"standing": {"word": "on_pace", "place": {"rank": 3, "of": 14, "basis": "price"},
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

**7. Your style** endpoint: `GET`, `PATCH /v1/me/style` over the existing `style_profile`.

**8. One name for the relink card.** The canon's decision kind is `relink`; [protocol and adapters §3.6](../../../../spec/engines/protocol-and-adapters.md#36-how-every-event-reaches-the-system-agent-proposal) says `account_stale`. Pick one; the pages use whichever you keep.

## How we build at the same time

From [parallel-build.md](../../../../spec/plans/parallel-build.md):

- The seam is `spec/examples/` (`T0-2`). The pages need it first, so it is the most valuable thing your side can land: one request and response per endpoint, the stream frames for one job, and every error.
- The screens call the API through one client in `app/src/api/` (task `W0-1`, Ben's side). When a route does not exist yet, the client answers from `spec/examples/`; when stream 15 adds the route, the real answer flows with no change on either side. `MOCK=<names>` forces the example for a demo. Nothing on Ben's side writes `app/src/app/v1/` or `spec/examples/`, which [workstreams](../../../../spec/plans/workstreams.md) gives to stream 15. Nobody waits.
- The page waves are timed to your packet 45 clock (21:45, 23:30, 02:00, 03:00 Central), so the thin path is on screen when your wave 1 walk goes green.
- The website is the same Expo Router codebase on the web (react-native-web is already installed), so the edge stays in the Expo API routes and is hosted with the web build. This replaces "the edge on Next.js" from app/README. Your call; option C there keeps Next.js for the signed-out Home only.
- The first wave is the thin path both sides already agreed: sign-in, ＋, capture, identify, a price range, one eBay listing, a Today card.

## Things from your side that conflict with Ben's, for the two of you

| Your line | Ben's line | What depends on it |
|---|---|---|
| The success score is shown by color ([score](../../../../spec/features/score.md)) | The brand allows four state colors, though Ben said at 02:59 not to weight color blindness too much ([words](../../../../product/words.md#2026-11-15-do-not-weight-color-blindness-too-much)) | Proposed in [pages §3](../../../../spec/pages.md#3-what-every-card-and-tile-tells): stage keeps the four fills; standing (your bands) is drawn separately, with at most one new hue (ember, Hot only) if Ben picks it. Your bands map to the words; the API sends `standing.word`, never a color |
| Capture opens on the type pick ([capture](../../../../spec/features/capture.md)) | Capture opens on the guided shot list ([decision](../../../../product/decisions.md#2026-11-14-capture-opens-on-the-guided-shot-list-talk-mode-is-one-tap-away)) | The camera page; [pages §6.5](../../../../spec/pages.md#65-camera) follows yours with the shot list as the process after the pick |
| A sale is batched with other alerts ([today](../../../../spec/features/today.md)) | Ben's research proposes an immediate push for a sale ([today research §3](../../../../research/today/ben/today-wants-alerts-and-clickability.md#3-alerts-a-person-perks-up-at)) | The notifications step and the push rules |
| You answered B6, B7, B8, B10 and J17 in [open-questions](../../../../spec/open-questions.md) | Ben has not agreed on record | Studio, capture and photo defaults |

## Next action

Nate: have stream 15 land `T0-2` with the rows above in it, pick the sign-in library and the relink name, and reply here with anything you would shape differently. Ben's agents build the parts kit and the wave 1 pages against the examples meanwhile.
