# Assistant and generated inputs

Status: specced 2026-11-15; tools, loop and evaluation set merged as drafts, not yet joined to the route ([packet 78](../../.agents/team/packets/team/78-buying-conversation-handoff.md)). Owner: Nate (backend), the buying-conversation lead. Packet topic: `assist`.

Spec of the asking side (agent proposal): [spec/features/assist.md](../../spec/features/assist.md). This page holds the answering side: the conversation a person types to or shows a photo to, and the tools it answers with.

## What and why
An assistant in Sell, in Buy search and in market research that never asks a question you must answer in text. Words in your prompt that it cannot resolve are highlighted; a tap opens the right control under the input, with an option already picked and Other for anything else. Nate: [words](../../product/words.md#2026-11-14-nate-the-assistant-asks-through-inputs-not-questions).

The buying side is a conversation over the search and the engines: words or a photo in, the broad search across every source, then what it is, what it is worth and how the price moves, where and when to list it, and general questions answered by our data plus the web ([Nate](../../product/words.md#2026-11-15-nate-the-buying-side-is-a-conversation-text-or-a-photo-in-the-broad-search-and-the-engines-behind-it-and-general-questions-too)). The answer drops widgets in place: the model writes a tag and the page draws it ([Nate](../../product/words.md#2026-11-15-nate-the-conversation-drops-widgets-into-its-answer-the-model-writes-a-tag-and-the-page-draws-it)).

## The conversation (agent proposal)

**One model plans and writes; it computes nothing.** Claude Sonnet 5.5 at `low` or `medium` effort, chosen by the evaluation run below (answer score, seconds to first text and to done, cost per answer), never by taste. It is called through the official `@anthropic-ai/sdk` with adaptive thinking, `tool_choice: auto` (Sonnet 5.5 refuses a forced choice), strict tool schemas and streaming. The client reads `ANTHROPIC_API_KEY` first; with none it uses OpenRouter's Anthropic-format endpoint (`baseURL https://openrouter.ai/api`, `authToken` from `OPENROUTER_API_KEY`, model `anthropic/claude-sonnet-5.5`). Both keys are checked by presence only. Measured 2026-11-15: one call at `low` with a strict custom tool and web search, 1.17 s, $0.0070 by OpenRouter's `usage.cost` (scratch probe, not in the repo).

**Every fact comes from a tool.** Each tool is a thin typed wrapper over code that runs today, and answers with rows, counts, dates and citation ids, never prose. Each result gets an id `r1, r2, …` for the turn.

| Tool | Wraps (exists today) | Returns | Not built yet, so the tool says so |
|---|---|---|---|
| `search_market {query, sites?, exclude_brand?}` | `searchSource` per `SOURCES` (`app/src/edge/intel/public/search.ts`), the live public reads of eBay, Poshmark, Mercari, Depop and Dupe | rows `{site, title, price_cents, condition, size, listed_at, likes, sold, sold_date, url}`, `found{}` and `searched[]` per site with outcome, ms and count | answering from stored rows first (MI2); the attribute record (AD9), so `exclude_brand` drops rows by brand words in the title or brand field and labels the rest `unmatched_attributes` |
| `value_item {query, condition}` | valuation `check()` (`app/src/engines/valuation/check.ts`) over `soldSources` (Mercari and Poshmark sold reads) | `range{q10,q50,q90,state}`, `n_eff`, `per_site[]`, `basis{count, n_eff, oldest, newest}`, basis `level`, `citation` | eBay sold (needs the person's account) |
| `price_trend {query}` | `productTrend` (`app/src/edge/market/market.ts`) over the same sold comps | `p50_recent`, `p50_prior`, `change`, `direction`, each a guarded fact with `basis_count`, `as_of`, `citation_id` | a repeat-sales index (A8) |
| `where_to_list {query, condition}` | `check()`'s `per_site` (keep, `p_sale` at 7, 30, 90 days, days to sell) and `bestSites` (`app/src/engines/valuation/path.ts`) | per site: keep after fees, chance of sale and days, with what each rests on (a measured curve or the prior) | AD5's ranking by A6 and A1 to A5 from the panel; until then each term names its prior |
| `market_store {function, args}` | governed SQL functions on the Databricks workspace through the Statement Execution API; Genie (`app/src/edge/genie/genie.ts`) for a question no function covers | rows, the SQL, the tables read, `row_count`, `as_of` | the corpus of listings (MI4): until it lands, the functions answer what the workspace holds and say what it does not |
| `web_search` | Anthropic's server tool `web_search_20260209`, `max_uses` 3 | results with URL, title and date, cited | |

What the tools can reach today, from a fresh review of the code (2026-11-15, side-session note `buy-spec-review-1.md`), and so what an answer says:
- A visitor's search reaches Poshmark and Dupe only. Depop, Mercari and eBay need the cloud browser (the Harness) or a linked account, and each says so in the basis instead of reading as empty. Dupe rows are retail, commercial links, shown and never stored.
- `search_market` computes, in code, per site: count, median ask and likes per listing (likes only where the site shows them, Poshmark today). So the model never computes a median.
- `value_item` needs the sold reads switched on (`SECONDHAND_LIVE_SITES`); when they are off it says not connected. Its product id is a slug of the query.
- `where_to_list` has no sale curve anywhere, so chance and time to sell are empty and the answer says "fees only". The keep per site after fees is real.
- `price_trend` needs a noise band nobody supplies yet, so its direction reads "noise" and it says so. Poshmark's sold rows carry the listing date, not the sale date.
- Genie answers signed-in people only, within 30 s.

The gate's matching is by equal value, so numbers are rewritten to one unit-tagged token on both sides before it runs (`$1,299` and 129900 cents become `usd1299`, `12%` and 0.12 become `pct12`), and each number is its own claim. That way "12%" is never backed by an unrelated 12, and "not enough data: 3 listings" keeps its 3. The log records the input's length, a hash, whether a photo was attached and every tool input; never the raw text or the photo.

A photo goes to the model as an image block only when the person sends it with their own ask. The model's reading of it (kind, brand, model, material) is labelled "read from your photo" and is never a measured fact; `search_market` then confirms it with matching rows, and the count of matches is the evidence. Capture's identify job (identity F6) replaces the reading when it lands. Nothing personal is logged: the log records tool names, counts, ms, tokens and cost, never the photo or the text.

**What the answer must do.**
- It says which parts we measured and which come from the web, each with its source: our tool results by their citation id or site and read time, web results by URL.
- A number appears only if a tool returned it this turn, with what it rests on (count, sites, dates, asking or sold). When the basis is thin it says so and names the count.
- Where a platform's audience stands in for a generation, it says so and cites the source for the audience claim.
- Before it is sent, the draft runs through the claim gate (`app/src/edge/gate/gate.ts`): every number in the text is its own claim, and the facts are the numbers the tools returned plus the person's own words. A sentence with an unbacked number is cut, and the count of cuts is returned with the answer (how numbers are matched: below the tool table).

**Widgets in the answer.** The model writes a tag in its text, `[widget:result_id]`, for example "The asks run [price_range:r2] and have eased [price_trend:r3]." Code draws the widget from that result's rows, so the model never types the numbers a chart shows. This is a deliberate change from Nate's example (`[price graph:iphone16-678 iphone17-999]`): there the numbers live in the model's text, and nothing checks them.

| Tag | Draws | From a result of |
|---|---|---|
| `price_range` | the q10 to q90 band with q50 and the count | `value_item` |
| `price_trend` | recent against prior median, the change, the count | `price_trend` |
| `sites` | per site: keep, chance of sale and days | `where_to_list` |
| `listings` | up to 6 listing cards: photo, price, site, condition, link | `search_market` |
| `alternatives` | other-brand rows beside the brand's own, with median asks and counts | `search_market` with `exclude_brand` |
| `table` | the rows as a table, with the SQL behind them | `market_store` |
| `sources` | the web sources used, title, site and date | `web_search` |

A tag that names an unknown result, or a widget its result cannot feed, is removed and counted. The page shows text, tags and sources in one stream.

**The route.** `POST /v1/assist {surface: 'buy', text, image?, conversation_id?}` starts a job of kind `assist` as today (`202 {id, kind, state, stages}`). The job's events: `assist.tool` (a tool started or ended, with its counts and ms), `assist.text` (text as it is written), `assist.settled` (the answer: `blocks[]` of text and widgets, `results{}` by id, `sources[]`, `gate{cut, checked}`, `model`, `effort`, `usage{input, output, cost_usd}`, `ms{first_text, done}`). A visitor may ask, under the visitor limit and a daily spend cap (`assist_daily_cents`, a param, prior 500, Nate's call), and nothing of a visitor's is stored past the job.

## Databricks: the store is the tool (named fix DBX-A1 for the Databricks lead)

Decided with the docs (*agent proposal*). Governed SQL functions in `secondhand.market`, called by the tool with typed arguments through the Statement Execution API. They return the same answer every time, run in about a second on a warm warehouse, and are the same views a dashboard reads, so a dashboard is a view of the store, not a second source. Genie over the existing space stays as the fallback for a question no function covers (it is already wired, with its SQL as the citation). The managed MCP server is not used today: it is Public Preview, needs an admin to switch it on and documents OAuth only ([Databricks, managed MCP](https://docs.databricks.com/aws/en/generative-ai/mcp/managed-mcp)). The exact views and functions are in [packet 78](../../.agents/team/packets/team/78-buying-conversation-handoff.md#dbx-a1).

## The question to test best

"What are the latest fashion trends millenials are wearing, what about gen z". Our data has no buyer ages. The expected answer has three labelled parts:
1. **From the web, with sources:** what this season's trend reports name for each generation, and what kind of evidence each report rests on (sales, search or a survey with its size, or an editor's view).
2. **Measured by us, now:** for the styles the web names, live reads across the sources: how many listings, median ask, likes per listing where the site shows likes, per platform, labelled a one-day read of asking prices. "Rising" is claimed only from a trend the tools return; with one day of reads it says it cannot yet tell rising from present.
3. **The stand-in, marked:** where a platform's audience stands in for a generation (Depop's users skew young), it says so and cites the source for the audience claim.

The research behind it: [research/buy/nate/generations-and-platforms.md](../../research/buy/nate/generations-and-platforms.md).

## The evaluation set

`bench/assist/questions.json`: 25 questions across identify from words, identify from a photo (the real garments in `spec/items/`), price and trend, where and when to list, off-brand alternatives, corpus-wide questions, general knowledge with the web, and questions it must refuse or answer "not enough data". Each states what a correct answer must contain, must not contain, and which tools it must call. `node bench/assist/run.mjs --effort low|medium` asks each one through the route's own conversation code and records model, effort, seconds to first text and to done, tokens and cost. `bench/assist/score.mjs` scores each answer: the tools called, the gate's cuts, tags that resolve, and a rubric judge (Claude Haiku 5.5) on the must and must-not lines. This is what the buying side is judged by.

## Decided
- Nothing specific to this feature yet. Joint decisions that touch it are in [decisions.md](../../product/decisions.md).

## Open
- The controls are proposed as new entries in Ben's component catalog: row B9 in [spec/open-questions.md](../../spec/open-questions.md).
- For Nate: the visitor spend cap (`assist_daily_cents`), and whether a visitor's photo may go to the model provider at all.

## Research
Research for this feature is filed under [research/identify/](../../research/identify/), [research/watch/](../../research/watch/) and [research/buy/](../../research/buy/).
