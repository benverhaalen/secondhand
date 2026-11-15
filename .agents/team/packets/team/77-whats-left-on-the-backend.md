# 77: what's left on the backend, from the scope audit

Updated: November 15, 2026, about 05:15 Central. Owner: Nate. From: Ben's thread "List what's left to build in scope" (Claude Code, with four Codex runs on Ben's Mac). Status: an audit, nothing built. Read it to pick the next backend piece; nothing here changes canon.

Ben asked for every planned feature to be marked done, partial or not done, with what's left. The merged list is [spec/plans/whats-left.md](../../../../spec/plans/whats-left.md), and the rows with file and line evidence are in [spec/plans/scope/](../../../../spec/plans/scope/). Checked against main at `22ef056`. The Python tests in `jobs/` and `databricks/` did not run (no `.venv` on Ben's Mac), so those marks rest on reading the code. Rerun them on your side before trusting a mark there.

## Why most rows are "partial"

A row was done only with code, a test or phone capture, and live inputs behind it. Four of the five gaps that keep rows partial are on your side:

1. **Served answers are still examples.** The valuation picks the contract's example item. The insights API returns example money and a fixture funnel. Market product, history and trend return examples. The listing route returns an example. The inbox is seeded from an example thread. ([whats-left §2](../../../../spec/plans/whats-left.md#2-engines-whose-served-answer-is-still-an-example))
2. **State lives in process memory.** The default store is memory or files; 24 `Map`s in `app/src/edge/api/*.ts` hold state a restart loses, including decision versions and last visit (`app/src/edge/api/today.ts:15`). The Databricks client only runs health checks. ([§3](../../../../spec/plans/whats-left.md#3-state-lives-in-process-memory))
3. **Outward actions are dry.** Board milestones M1 to M9 are all unticked. No live post, signed-in read or delist on a real account is recorded, and Ben wants the five-site live post in the demo. ([§4](../../../../spec/plans/whats-left.md#4-outward-actions-are-proved-dry-not-live))
4. **Outside services are not composed.** `createNotifier` has no caller outside its test, so a sale or a watched match cannot ping, as decided. No production watch runner. Studio and identify workers are not joined to stored items and photos. ([§5](../../../../spec/plans/whats-left.md#5-outside-services-are-not-composed))

The fifth gap, screens reading `@/demo` instead of `/v1`, is on Ben's UI side. It shows real data only after gaps 1 and 2 close, so the order between you matters: a screen wired to an example route still shows the example.

## The backend rows, by feature

Each lane file ends every feature with a "Backend, data or Databricks items for Nate" line. The ones that block the most rows:

| Feature | Left on your side | Lane row |
|---|---|---|
| today | headline source and persisted last visit; dispatch for every decision kind (`answer_fact`, `buy_offer`, pickup approval are missing from `ACTION_FOR`); approval counting for Always do this; outward Undo; rule-expiry job; push sender and digest | [c.md](../../../../spec/plans/scope/c.md#today-home-review-inbox-of-one-tap-decision-cards) |
| connect | durable auth and vaults; email sender; eBay consent callback; hosted sign-in for every site. (Lane C also flagged an unscoped account lookup at `app/src/edge/api/runtime.ts:81`; it is scoped to the owner on current main, fixed after the audit commit.) | [c.md](../../../../spec/plans/scope/c.md#connect-onboarding-and-linking-each-platform) |
| price, appraise | real sold sources and dates; condition factors; fitted speed curves and range calibration; fee versions; the app's join to `databricks/pipelines/market/comp.sql` | [b.md](../../../../spec/plans/scope/b.md#price-where-to-sell-at-what-price-ship-or-meet) |
| score | the four axes on real inputs and stored; rank inference; event-driven recompute | [b.md](../../../../spec/plans/scope/b.md#score-scoring-engine-financial-quality-visibility-and-trend-and-the-best-plan-per-site) |
| insights, market | payout semantics and money-line imports; per-site stats; product and history projection; market index MI1 to MI6; brand measure A11 | [b.md](../../../../spec/plans/scope/b.md#insights-you-earned-could-earn-goals-and-seller-analytics) |
| data | hosting and store choice; observations and citations (J1); the dashboard and live-log pipeline on the current deployment | [b.md](../../../../spec/plans/scope/b.md#data-databricks-backbone) |
| list, sold | live submit, read-back and end on each core site; signed-in sale detection; order API; label service choice | [a.md](../../../../spec/plans/scope/a.md#list-post-everywhere-delist-on-sale-browser-use) |
| capture, identify, studio | photo storage and upload targets; worker results into the Store; a host for the studio worker | [a.md](../../../../spec/plans/scope/a.md#capture-guided-shots-whole-item-back-tag-close-ups-defects) |
| watch, messages | due-want job and its routing; authenticated inbox reads; persisted conversation and held-claim state | [c.md](../../../../spec/plans/scope/c.md#watch-fuzzy-wants-exa-alerts-deal-check) |

## Choices that need you

- With Ben: whether clothing gets 3D reconstruction (measure), export-tag behavior (studio), the backup policy when a delist fails (sold), and which service hosts each part given your ask to use the website's Vercel deployment.
- Yours alone: admissible sold states and sources, risk inputs, refresh cadence.

## Docs found stale on your side

- `features/price/README.md` says no `comp` table exists; `databricks/pipelines/market/comp.sql` builds one.
- `spec/plans/joins.md:68-74` calls account, want, reply and rule routes examples; they now write Store rows.
