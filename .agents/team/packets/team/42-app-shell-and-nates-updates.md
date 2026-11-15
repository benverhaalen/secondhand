# 42: the Expo app shell exists, and what changed on Nate's side since packet 40

Updated: November 14, 2026. Owner: Nate. Agent: Claude Code, project thread "Lay out the whole product and write the unified spec". Branch: `main`. Status: app shell pushed and usable on a laptop; spec second review done and its fixes in progress. Everything here is an *agent proposal* unless it links a decision.

## The app shell (touches Ben's side)

Nate asked for it ([words](../../../../product/words.md#2026-11-14-nate-create-the-expo-app-and-connect-it-to-databricks)). It is at [app/](../../../../app/README.md): Expo SDK 58 with Expo Router, created with the default template and reset to an empty project, linked to the EAS project `secondhand` under Nate's Expo account. `npm run check` in `app/` runs types and tests.

- The only screen is a development placeholder that shows whether Databricks answered. No tokens, components, navigation or camera module are there: screens are yours.
- `src/app/v1/health+api.ts` is a server route. It runs one query on the workspace's SQL warehouse and answers `{ok, state, catalog, at}`. Observed working against the real workspace in a browser; not yet run on a phone.
- This is the thin public edge from [spec/product.md section 6](../../../../spec/product.md#6-systems): the phone calls routes in the Expo project, and those hold the workspace identity. It answers your hour-one check "the Expo app can call the App's API" one way: through the edge, with no Databricks token on the phone. The Databricks App and Lakebase behind it are not built.
- `log/index.d.ts` is new: types for the logger's `createLog`, `call`, `child` and `error`, so TypeScript callers compile. Add a method there when a caller needs it.
- Two of your checks failed on Windows and were changed to hold on both systems: the links check now builds repo paths with forward slashes, and the image-gen test resolves `/refs/colors.png` the way `run.mjs` does. On a machine whose temp folder sits under a folder with an `AGENTS.md`, the image-gen tests need `TEMP` pointed elsewhere. One image-gen test still fails on Nate's machine and was left alone: "a busy machine gets one new call every few ticks, not a burst" (expected 3 overlapping calls, got 2, twice in a row, while several agents and a dev server were running). It looks timing-dependent; it is yours to judge.

## Your packets, answered

| Packet | What was done |
|---|---|
| [21](../price/21-pricing-search-watch-plan.md) interfaces | `spec/product.md` now has one set of `comp` field names with a line mapping yours to it, `valuation.level` and `max_pay`, and the two event layers (your monitor's below `watch.ran`, `match.found`, `match.alerted`; `monitor.behind` sets `behind[]` on `GET /v1/wants`). One name was declined: a model's output is not a `comp`, so `price_basis: model` maps to valuation level 3 |
| [21](../price/21-pricing-search-watch-plan.md) eBay line | The joint decision that licences and site terms are facts and do not shape the build ([decisions](../../../../product/decisions.md)) removes the split shelves from the second-pass specs; `display_group` stays in the schema |
| [32](../data/32-databricks-judging-evidence.md) nine proposals | All nine are taken into `spec/databricks.md`, with an appendix saying where each landed. That file is written and still waits on Nate's yes to publish (packet 7) |
| [31](../list/31-platform-fit.md) | Being folded into `list.md`, `price.md` and the listing determinations now; your profiles and `listing-seo.md` are cited as the source for per-site limits |
| [7](7-spec-databricks-not-pushed.md) | Still open: Nate has not yet said the file may be public |

## New since packet 40

- [spec/determinations/](../../../../spec/determinations/): every thing the system works out, as cards with sources, weights, method, when it is hidden and how it is explained.
- [docs/how-it-works/](../../../../docs/how-it-works/README.md): explanations written for people, separate from the spec.
- A second fresh review found 5 fix-first findings, most of them places where `studio.md` and `capture.md` contradict what you decided later (no AI label, level 2 flattening, ranked redraw). Your words win and the fixes are being applied.
- Coming in this pass: `spec/features/assist.md` (the assistant, and inputs generated under the prompt instead of questions), a unified catalog and a "better official option" comparison on the buying side, an analytics suite in `insights.md`, and a source registry in `data.md`.

## Waiting on Ben

Rows B3 and B6 to B9, and J10, in [spec/open-questions.md](../../../../spec/open-questions.md).

## Next action

Ben's agents: build screens in `app/src/`; if the app folder or its structure should differ, say so here before more is built on it.
