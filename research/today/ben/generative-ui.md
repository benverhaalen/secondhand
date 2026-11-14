# How will secondhand compose its UI from a fixed component set with approval cards, on Databricks?
Researched 2026-11-14 by Ben (Claude Code). Feature: today.

Feeds the build plan for workstream 3 in [packet 4](../../../.agents/team/packets/list/4-posting-messages-dynamic-ui-plan.md). Ben's ask (20:41, [words](../../../product/words.md#2026-11-14-human-in-the-loop-and-dynamic-ui)): "judges love human in the loop. i feel like creating dynamic and intelligent ui is really good where you have a huge range of set components." Marks: *observed* (I opened the source or ran it), *asserted* (a source says it without showing it, or memory), *inferred* (my reasoning). Everything recommended here is an *agent proposal* until Ben picks.

**Update 21:10:** Ben picked an Expo app with a Swift camera module ([decisions](../../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)). The client below (React 19 + Vite web app, shadcn) is replaced by React Native components and `@json-render/react-native` 0.22.0 (*observed*, npm). The server, approval flow and catalog schemas are unchanged. See the [build plan](../../cross-cutting/ben/build-plan-posting-messages-ui.md#2-what-runs-where).

## The answer in short

1. **Two layers, not one.** Decision cards (Today) are a fixed frame per Decision kind, filled by a typed tool call whose zod schema *is* the card's props. Inside the frame, one "evidence" slot and the item and Ask screens are composed by the agent from a catalog of about 40 brand components with **json-render**. The model never writes HTML, classes or colors; it picks catalog names and zod-checked props. *inferred design on observed APIs*
2. **The model never holds an outward-acting tool.** It only has read tools and `propose_*` tools. Posting, price changes, replies, pickup, address and refunds run only through one server route, `POST /api/decisions/:id/act`, which checks a signed option, the item's state version and the tier rules. That one choke point is what makes "below your floor never auto-approves" provable. *inferred, mirrors `NEVER_PROMOTED` in [spec/lifecycle.mjs](../../../spec/lifecycle.mjs)*
3. **Start from Databricks' own chat template**, `databricks/app-templates/e2e-chatbot-app-next`: Express + React (Vite) + AI SDK 6 + `@databricks/ai-sdk-provider` + optional Lakebase history + thumbs feedback written as MLflow assessments. It is everything we'd otherwise wire by hand. *observed*
4. **What changed from my memory draft:** I expected AI SDK 5, Next.js, and that I'd have to invent payload-bound approval tokens. In fact AI SDK is on **7** (6 is still maintained), Databricks' template is **Express + Vite, not Next.js**, and AI SDK already **HMAC-signs approvals over a hash of the exact tool input**. AI Elements is being folded into shadcn/ui at the end of this month.

## Versions (checked 2026-11-14)

| Package | Version | Date | Mark | Note |
|---|---|---|---|---|
| `ai` (AI SDK) | 7.0.173 latest; **6.0.332** on tag `ai-v6` | 7.0.0 shipped 2026-06-25 | observed (npm registry) | 7 adds `toolApproval` config with `approved`/`denied`/`user-approval` statuses. 6.0.332 already has `needsApproval`, `addToolApprovalResponse`, `experimental_toolApprovalSecret` |
| `@ai-sdk/react` | 4.0.177 (v7); **3.0.335** (v6) | 2026-11-13 | observed | `useChat` |
| `@databricks/ai-sdk-provider` | **0.5.1** | 2026-03-04 | observed | Peers `@ai-sdk/provider ^3`, `provider-utils ^4`, which is the AI SDK 6 model spec. `responses()`, `chatCompletions()`, `chatAgent()` |
| `ai@7` model union | accepts `LanguageModelV4 \| V3 \| V2` | | observed (index.d.ts line 116) | So the v6-era Databricks provider type-checks under 7; runtime under 7 not tested (*inferred* fine) |
| Databricks template `e2e-chatbot-app-next` | pins `ai 6.0.317`, `@ai-sdk/react 3.0.320`, provider 0.5.1, React 18.3.1, Tailwind 4.3.3, Express 5.3.0, drizzle 0.45.4 | README updated Oct 2026 | observed (raw GitHub) | `app.yaml`: `command: ["npm","run","start"]`, `runtime: nodejs20` |
| `@json-render/core`, `/react`, `/shadcn` | **0.22.0** | 2026-11-04 | observed | 0.x, monthly churn; pin exact. `/react` peers React ^19.2.3; `/shadcn` peers Tailwind ^4, ships 36 components |
| `@a2ui/react` | 0.15.0; spec v1.0 "current" | 2026-11-02 | observed (npm, a2ui.org roadmap) | |
| `@copilotkit/react-core` / `@ag-ui/core` | 1.88.0 / 1.0.4 | 2026-11 | observed (npm only) | |
| `@assistant-ui/react` | 0.15.36 | 2026-11-12 | observed (npm only) | |
| `@thesysai/genui-sdk` | 0.10.3 | 2026-07-01 | observed (npm only) | |
| `@modelcontextprotocol/ext-apps` (MCP Apps) | 2.0.4 | 2026-10-27 | observed (npm only) | |
| `ai-elements` CLI | 1.9.1 | 2026-10-14 | observed | README: "will be deprecated at the end of November 2026", replaced by AI Elements in shadcn/ui, which has **Confirmation** and **Tool** patterns (copy-in, no package) |
| `shadcn` CLI | 4.23.0 | 2026-10-27 | observed | |
| `@mlflow/core` / `@mlflow/vercel` | **0.5.0** / **0.5.0** | 2026-11-12 | observed | `mlflow-tracing` (0.1.3) and `mlflow-vercel` (0.1.1) are the old names |
| `@databricks/appkit` | 0.95.0 | 2026-11-13 | observed | Express + Vite; `lakebase()`, `agents()` (beta) plugins |
| `pg` | 8.23.1 | 2026-09-30 | observed | |
| `zod` | 4.6.7 | 2026-10-12 | observed | |
| `next` | 16.4.6 | 2026-11-09 | observed | Not recommended here, see Deployment |

## Approach: chosen and runner-up

**Chosen: AI SDK 6 typed tool parts for Decision cards + json-render catalog for composed views, both rendering our own shadcn components, on the Databricks template.**

| Option | Model is limited to our registry? | Props zod-checked? | Raw HTML/style possible? | Fits AI SDK + Databricks template | Verdict |
|---|---|---|---|---|---|
| **AI SDK typed tool parts** (`tool-<name>` parts, states `input-streaming` → `input-available` → `approval-requested` → `output-available`/`output-denied`) | Yes: tool name = component | Yes: `inputSchema` | No | Native | **Chosen for Decision cards.** One tool per Decision kind gives exactly one card shape per kind. *observed types* |
| **json-render** (Vercel Labs): `defineCatalog(schema,{components,actions})` with zod props, `catalog.prompt()`, `catalog.validate(spec)`, `catalog.zodSchema()`, JSONL patch streaming, `<Renderer fallback>` | Yes | Yes, server-side via `catalog.validate` (the React `Renderer` does not re-parse props; I found no `safeParse` in its bundle) | No | Framework-agnostic; `pipeJsonRender()` puts specs into AI SDK streams as data parts | **Chosen for composed views** (evidence slot, item screen modules, Ask answers). *observed* |
| Google **A2UI** (spec v1.0, React renderer, catalogs as JSON Schema, catalog negotiation) | Yes | JSON Schema | No | Built around A2A/ADK; no AI SDK integration listed on its roadmap | Runner-up for the catalog layer. A protocol for agents and clients you don't own; we own both ends, so it adds a translation layer. *observed (roadmap page)* |
| **CopilotKit / AG-UI** | Yes (actions, generative UI hooks) | Partly | No | Its own runtime and event protocol beside AI SDK | Second chat runtime to learn in 24 h. Rejected. *asserted, docs not opened* |
| **assistant-ui** tool UIs | Yes | Via tool schemas | No | Wraps AI SDK chat | Chat-thread shaped; Today is not a chat. Rejected. *asserted* |
| **Thesys C1** | No: its model generates the UI | n/a | Its own styling | Hosted API | Breaks brand and copy rules. Rejected. *asserted* |
| **MCP Apps** (ext-apps 2.0) | Server ships HTML in a sandboxed iframe | n/a | Yes, by design | For hosts like Claude or ChatGPT | Wrong direction: we are the host. Rejected. *asserted* |
| AI SDK RSC `streamUI` (`@ai-sdk/rsc` 3.0.173) | Yes | Yes | No | Needs React Server Components (Next) | Still published, but the docs have steered to `useChat` + tool parts since v5 (*asserted*), and the template has no RSC. Rejected |

**Runner-up overall:** AI SDK typed tool parts alone, with no json-render. Simpler, one fewer 0.x dependency. We lose the agent choosing *which* evidence modules to show and in what grouping, which is the "dynamic, intelligent UI" Ben asked for. If json-render fights us for more than an hour, drop to this: the evidence slot becomes a fixed list per kind.

## How a screen is put together

| Part | Who decides | Why (Article 1) |
|---|---|---|
| Nav bar with centered wordmark, bottom bar Today · Sell · ＋ · Buy · You, tab shells, shelves, ＋ capture flow, onboarding, settings | **Hand-built** | Navigation must never move ([decisions](../../../product/decisions.md)); familiarity beats novelty |
| Which Decisions exist | Agents (via `propose_*`) and the lifecycle | A Decision is the primitive; Today is the query of open ones ([primitives](../../../product/primitives.md)) |
| Order of Today | **Deterministic server sort**: money or a sale lost soonest → Never alone → Ask → age. The agent may set `deadline` but never rank | Ranking by model is unexplainable and flickers between reloads |
| Card frame per kind: photo, headline, the amount, primary pill, outline, gray side actions, More (···), the "if you ignore it" line | **Fixed component per kind** (`OfferDecision`, …) | Constitution Art. 6: full action set, one black pill, escape named. Can't be left to the model |
| Card values (amount, buyer, times, drafted reply) | Agent fills the zod-typed props | It's the content; the schema bounds it |
| Evidence slot inside a card (0–3 modules) | **Agent composes** from the evidence subset of the catalog; server validates and caps at 3 | Different Decisions need different proof: a lowball needs comps, a pickup needs the calendar |
| Item screen "what to know" modules, Ask answers, Buy valuation for a pasted link | **Agent composes** a json-render spec from the catalog; deterministic order rules (photo first, money second, why last) applied after | This is where "dynamic" earns its place without touching navigation |
| Every string | Agent drafts; `scripts/copy-lint.mjs` runs on all generated strings server-side before persisting; a hit regenerates once, then falls back to the kind's template string | [copy.md](../../../product/copy.md) applies to generated copy too |

## The component registry (agent proposal)

Columns: catalog name, primitive, what it builds on (shadcn unless noted), zod props sketch. `money` = `z.number().int()` cents; `itemRef` = `z.string().regex(/^it_/)`; `site` = `z.enum(['ebay','facebook','depop','poshmark','mercari'])`. All text props are `z.string().max(n)`; no prop accepts a class, a color or markup.

**Decision frames (one AI SDK tool each: `propose_<kind>`). Each also gets `decisionId`, `itemRef`, `deadline?`, `why: traceId`.**

| # | Name | Primitive | Builds on | Props sketch |
|---|---|---|---|---|
| 1 | `OfferDecision` | Decision (Ask) | Card, Avatar, Button, DropdownMenu | `{site, buyer:{name,ratingCount?}, offer:money, asking:money, youKeep:money, suggestedCounter?:money, expiresAt}`; actions Accept $X · Counter $Y · Decline · Message · More: Not now, Block |
| 2 | `CounterDecision` | Decision (Ask) | Card, Slider, Button | `{site, theirOffer:money, counter:money, min:money, max:money}`; slider bounded server-side at ≥ floor unless kind is priceBelowFloor |
| 3 | `BelowFloorDecision` | Decision (Ask, never promoted) | Card, Button | `{price:money, floor:money, reason:z.enum(['offer','markdown','slow'])}`; no "Always do this" ever |
| 4 | `FirstPostDecision` | Decision (Ask) | Card, Carousel, Toggle group (sites) | `{title, price:money, sites:site[], photos:url[], fieldsToCheck:z.array(z.enum(['size','flaws','measurements']))}` |
| 5 | `PickupTimeDecision` | Decision (Never alone) | Card, ToggleGroup, Calendar | `{buyer, proposed:z.array(datetime).max(3), place:{label,mapUrl}}`; Confirm adds the calendar event |
| 6 | `AddressShareDecision` | Decision (Never alone) | AlertDialog, Button | `{buyer, pickupAt, addressLabel}`; the address itself never goes to the model or the client spec, only its label |
| 7 | `PaymentDecision` / `RefundDecision` | Decision (Never alone) | Card, Button | `{site, amount:money, reason:z.enum(['doubleSale','return','other'])}` |
| 8 | `FailedDelistDecision` | Decision (Ask, red) | Card, Alert | `{site, soldOn:site, attempts:int, buyable:true}`; Retry · Delist by hand (opens site) · Mark as handled |
| 9 | `FailedPostDecision` | Decision (Ask, red) | Card, Alert | `{site, error:z.enum([...known codes]), retryable:bool}` |
| 10 | `ReplyDraftDecision` | Decision (Ask) | Card, Textarea, DiffView | `{conversationId, theirMessage, draft, editsFromLast?:diff}`; Send · Edit · Don't reply |
| 11 | `ShipByDecision` | Decision/Appointment | Card, Badge | `{site, by:datetime, box:{name,dims}, labelFrom:site}` |
| 12 | `DibsDecision` | Decision | Card | `{site, holder, heldUntil}` |
| 13 | `MatchDecision` (Buy) | Decision from a Watch | Card, Image | `{wantId, listingUrl, price:money, fair:{low,high}, mostToPay:money, fits?:bool}` |
| 14 | `AlwaysDoThisOffer` | Rule proposal | Card footer row, Switch | `{kind, approvalsSoFar:int(3), limits?}`; rendered only if server says kind is promotable |

**Evidence modules (json-render catalog; agent may compose into a card's evidence slot or an item screen)**

| # | Name | Primitive | Builds on | Props sketch |
|---|---|---|---|---|
| 15 | `ItemTile` | Item | AspectRatio, Badge | `{itemRef, photo:url, pill:z.enum(['Researching','Review','Live','Offer','ShipBy','Sold','Slow','Failed']), pillAmount?:money, sites:site[]}` |
| 16 | `ItemHeader` | Item | Avatar/Image, Text | `{itemRef, photo, title}` |
| 17 | `ValuationRange` | Valuation | custom bar on Progress | `{low:money, high:money, yours?:money, site?:site, plain:string}` (plain words, no "n=") |
| 18 | `CompsStrip` | Comp | ScrollArea, Card | `{comps:z.array({photo,price:money,soldAt:date,site}).max(8)}` |
| 19 | `SiteStatusRow` | Listing | Table row, Badge, platform logo | `{rows:z.array({site, state:z.enum(LISTING_STATES), price:money, interest?:int})}` |
| 20 | `NetProceeds` | Ledger | Card, Separator | `{price:money, fees:money, shipping:money, youKeep:money}` |
| 21 | `MeasurementList` | Item | Table | `{rows:z.array({name, value, unit, source:z.enum(['measured','estimated','you said'])})}` |
| 22 | `FlawPhotos` | Item | Carousel, Dialog | `{photos:z.array({url, note})}` (unedited only) |
| 23 | `RenderCompare` | Item/Photo | Tabs or a slider | `{original:url, render:url, passedCheck:bool}` |
| 24 | `BuyerSummary` | Conversation | HoverCard, Avatar | `{name, site, ratingCount?, firstMessageAt, priorOffers:int}` |
| 25 | `MessageQuote` | Conversation | Blockquote | `{from, text, at}` |
| 26 | `ReplyDiff` | Conversation | custom inline diff | `{before, after}` |
| 27 | `TimeSlots` | Appointment | ToggleGroup | `{slots:datetime[], selected?}` |
| 28 | `MeetupPlace` | Appointment | Card, map link | `{label, mapUrl, isPublic:true}` |
| 29 | `CalendarPreview` | Appointment | Calendar | `{at, durationMin}` |
| 30 | `WhyTimeline` | Job log / traces | custom vertical list, Collapsible | `{traceId}`: rendered from MLflow spans server-side, not from model text |
| 31 | `JobProgress` | Job | Progress, Skeleton | `{jobId, kind, state:z.enum(['queued','running','done','failed']), step?}` |
| 32 | `RuleCard` | Rule | Card, Switch | `{kind, action, limits, lastRuns:int}` |
| 33 | `ActionLogRow` | Rule log | Table row, Button (Undo) | `{at, action, actor:z.enum(['user','auto','site']), undoable:bool}` |
| 34 | `PriceHistory` | Listing | shadcn Chart (Recharts) | `{points:z.array({at,price:money}).max(30)}` |
| 35 | `BySiteCompare` | Ledger/Listing | Chart or Table | `{rows:z.array({site, daysToSell:number, shareOfAsking:number})}` |
| 36 | `WantCard` | Want | Card, Badge | `{text, ceiling?:money, sites:site[], newMatches:int}` |
| 37 | `MatchTile` | Want match | Image, Badge | `{url, photo, price:money, fits?:bool, underCeiling:bool}` |
| 38 | `AccountHealth` | Account config | Badge, platform logo | `{site, how:z.enum(['api','prefill','browser']), ok:bool}` |
| 39 | `GenieAnswer` | Ask answer | Table or Chart | `{question, columns, rows.max(20), chart?:z.enum(['bar','line'])}` |
| 40 | `Callout` | any | Alert | `{tone:z.enum(['info','failed']), text.max(80)}`; max one per view |

**Layout atoms in the catalog:** `Stack` (vertical only, gap from tokens) and `Section` (titled group). No `Grid`, `Dialog`, `Tabs` or free `Text` in the agent's catalog: those are where AI-made screens drift ([Article 10](../../../product/ui-constitution.md)). We use `@json-render/shadcn` definitions as *starting code* only, restyled to [tokens.css](../../../brand/tokens.css). *inferred*

## Approval flow, end to end

1. **Propose.** An agent run (background job or chat turn) calls `propose_counter({ itemRef, offer, counter, … })`. The tool's `execute` only writes a `decisions` row in Lakebase: `kind`, `props`, `options[]`, `item_version`, `trace_id`, `status='open'`. It returns `{decisionId}`. No outward effect. *inferred*
2. **Sign each option.** For every option (Accept $38, Counter $42, Decline, …) the server stores `{action, input}` and an HMAC-SHA256 over `["sh-decision-v1", decisionId, optionId, action, sha256(canonical(input)), item_version]`. Same construction AI SDK uses for its own approvals (`["ai-sdk-tool-approval-v1", approvalId, toolCallId, toolName, inputDigest]`, Web Crypto HMAC). *observed (ai@7 dist/index.js `tool-approval-signature.ts`); ours adds item_version, inferred*
3. **Tier check at proposal time** (`policy(kind, input, rules)`):
   - kind in `NEVER_PROMOTED` (address, pickupTime, payment, priceBelowFloor) → always Ask; no "Always do this" offered.
   - computed below floor (`input.price < item.floor`), whatever kind the model claimed → re-tagged `priceBelowFloor`. The server computes this from the item row, never from the model.
   - kind promoted by the user and within the rule's limits → Auto: server executes immediately, logs `actor:'auto'`, shows in the action log with Undo.
   - otherwise → Ask: stays open in Today.
4. **Render.** Today lists open rows sorted by the deterministic rule. A card renders while its tool part is `input-streaming` as a skeleton with **actions disabled**. Actions enable only once the row exists and the option signatures are loaded. *observed: AI SDK part states; inferred: the gating*
5. **Tap.** `POST /api/decisions/:id/act {optionId, signature, editedInput?}`. The server, in one transaction (`SELECT … FOR UPDATE`):
   - verifies the HMAC
   - checks `status='open'`
   - checks the current `item_version` equals the signed one, else returns `409 stale` and the card re-proposes
   - re-runs `policy()`
   - if `editedInput` is present (the user changed the counter to $40): re-validates it against the zod schema, recomputes below-floor, and records it as a new user-authored option (signed now, with the user as author)
   - sets `status='acting'`
6. **Execute.** The server-only action (`ebay.respondToOffer`, `sendReply`, …) runs with an idempotency key `decisionId:optionId`. The tool-loop model never sees these functions. Long actions (Browser Use posting) enqueue a Job and return at once. The card becomes a `JobProgress` card. *inferred*
7. **Record.** Write the `item.action` log line ([spec/README.md logging](../../../spec/README.md#logging)) with `actor:'user'` and `trace`. Post an MLflow assessment on that trace: `POST /api/3.0/mlflow/traces/{trace_id}/assessments` with `{assessment_name:'human_decision', source:{source_type:'HUMAN', source_id:user}, feedback:{value:optionId}, rationale?}`. The Databricks template posts this exact shape for thumbs feedback. `@mlflow/core`'s `MlflowClient.logFeedback` wraps the same V3 endpoint but says UC-table (V4) traces are not covered, so keep traces experiment-backed. *observed*
8. **Learn.** `approvals[kind] += 1` only for user taps on Ask kinds outside `NEVER_ALONE`, as in `lifecycle.mjs`. At 3, the next card of that kind shows `AlwaysDoThisOffer`, unless the kind is in `NEVER_PROMOTED`. Promotion writes a Rule row, and the MLflow evaluation job reads the assessments to report "would have matched you N of M times". *observed spec; inferred eval*
9. **Double lock for never-alone.** The executors for `address`, `pickupTime`, `payment` and below-floor price also assert that a `decisions` row with `status='acting'`, `actor='user'` and a matching input hash exists. A bug in `policy()` therefore still can't make them run alone. Add a failing test in `.agents/checks/` for this. *inferred*

**Where AI SDK's own approval API fits.** In the Ask sheet (chat), tools that need a yes/no use `needsApproval: (input) => policy(...) !== 'auto'` plus `addToolApprovalResponse({id, approved})` and `experimental_toolApprovalSecret` (HMAC over the exact input, checked again on resume, plus a schema re-check). *observed in ai@6.0.332 and ai@7 types/source.* It is binary (approved true/false), so multi-option cards use the Decision route above. AppKit's `agents()` HITL gate is stream-bound: `appkit.approval_pending` SSE, auto-deny after 60 s by default. That doesn't fit cards that wait hours. *observed (AppKit docs/plugins/agents.md)*

## Databricks deployment

| Layer | What runs | How it connects | Mark |
|---|---|---|---|
| Client | React 19 + Vite SPA (PWA), shadcn on Tailwind 4, `@ai-sdk/react` `useChat` for the Ask sheet, plain fetch/poll for Today | Same origin as the app | template is React 18 → bump to 19 for json-render (*observed* peer) |
| App server | **Databricks App**: Node (template says `runtime: nodejs20`; AppKit docs say Node 22 runtime), Express 5, forked from `e2e-chatbot-app-next` | `app.yaml` `command: ["npm","run","start"]`; port from `DATABRICKS_APP_PORT` | observed |
| Identity | Workspace SSO in front of every App; user from `x-forwarded-user`/email; OBO token in `x-forwarded-access-token`, needs `user_api_scopes` (`model-serving`, `postgres`, `ai-gateway`, …) | Demo: service principal for all calls, user id only for ownership | observed (developers.databricks.com config page) |
| Proxy limits | **120 s hard request timeout**; medium 2 vCPU/6 GB, large 4 vCPU/12 GB; 10 MB per file | Keep every request short; stream chat turns under 120 s; long work → Jobs + polling | asserted (third-party guide + Databricks employee forum reply 2026-02-26) |
| Models | Claude Opus 5.5 / GPT-6 through serving endpoints / Unity Gateway | `createDatabricksProvider({ baseURL: host+'/serving-endpoints', headers:{Authorization} }).chatCompletions(name)`, **`useRemoteToolCalling: false`** so our tools and approvals run in Node | observed (provider README; template sets `true` for hosted agents) |
| Agents (comps, valuation, identify) | Agent Bricks / custom agent endpoints, Responses API | `provider.responses(endpoint)`, read-only tools only. Hosted tools run inside Databricks and skip any Node approval gate, so nothing outward-acting goes there | observed (AppKit: "human-in-the-loop approval gate does not fire" for hosted tools) |
| Long jobs | Databricks Jobs (Browser Use runs, Seedream renders, comps refresh); state in `jobs` table | App enqueues, client polls every 5 s or listens on short SSE that reconnects | inferred; forum's recommended pattern is 202 + poll (*asserted*) |
| App DB | **Lakebase** Postgres: `decisions`, `options`, `rules`, `action_log`, `items`, chat history (template's drizzle schema) | `pg` pool with OAuth token refresh (1 h tokens, 2 min buffer) via AppKit `lakebase()` / `@databricks/lakebase`; synced to Delta for Genie/eval | observed (AppKit lakebase doc) |
| Traces | MLflow 3 experiment | `@mlflow/vercel` `MLflowSpanProcessor` + OTLP exporter to `<host>/api/2.0/otel/v1/traces` (UC table header) or experiment; `experimental_telemetry:{isEnabled:true}` on each AI SDK call; trace id saved on the Decision row | observed (README); which trace location shows best in the "why?" panel is untested |
| Human labels | MLflow assessments (V3 REST) | Step 7 above | observed |
| Ask over data | Genie | AppKit `genie` plugin or Genie MCP | asserted |
| **Fallback (Ben, 19:41)** | If Apps or Lakebase isn't up by hour 2: the same Express app goes to Vercel (or Railway), the DB to Supabase Postgres (same `pg`, same drizzle schema) | Model calls still go to Databricks serving with a PAT; traces OTLP to Databricks; comps, valuation, eval and Genie stay | Vercel runs Express (*asserted*); the rest *inferred* |

**Why not Next.js:** Databricks' template and AppKit are both Express + Vite (*observed*). Apps run `npm run start`, so `next start -p $DATABRICKS_APP_PORT` should work (*inferred, not verified*), but nothing official shows it. Forking the template saves auth, Lakebase, history and feedback wiring. Next.js would only help the Vercel fallback, and Express runs there too.

**Version call:** **AI SDK 6** (`ai@6.0.332`, `@ai-sdk/react@3.0.335`). It's what Databricks' template and provider are tested on, and it already has `needsApproval`, signed approvals and the `approval-requested` part. AI SDK 7 is a stretch upgrade: it accepts V3 models and adds `toolApproval` config with `isAutomatic` approvals, which would log Auto actions natively (*observed types*).

## Edge cases

| Case | What happens | Mark |
|---|---|---|
| Model names a component not in the catalog, or bad props | Server: `catalog.validate(spec)` + `autoFixSpec(spec,{lossy:false})`, re-prompt once with `formatSpecIssues`, then drop the failing module. Client: `<Renderer fallback>` renders nothing for unknown types (never raw JSON). A Decision frame with invalid tool input never becomes a row; the run is logged `error` and retried | observed APIs; policy inferred |
| Model writes copy that fails lint | Regenerate once; then the kind's template string | inferred |
| User taps a half-streamed card | Impossible: actions are disabled until the row and its signatures exist. The skeleton shows real structure (photo, amount slot) per frontend-standard §4 | inferred |
| Stale approval (item sold on Depop while the eBay offer card was open) | `item_version` mismatch → 409. The card swaps in place to "Sold on Depop" with Decline offer as the only action. Never executes the old payload | inferred |
| Two devices tap different options | Row lock + `status` transition; second gets 409 and sees the result; idempotency key stops double sends | inferred |
| Same device double-tap / network retry | Idempotency key `decisionId:optionId` | inferred |
| Forged or replayed approval from a modified client | HMAC fails, or status not `open` | observed (AI SDK's same check); ours inferred |
| Model claims a kind to dodge the floor rule | Server recomputes below-floor from the item row | inferred |
| Hosted Agent Bricks tool tries an outward action | Not possible by design: outward actions exist only as server functions | inferred from observed AppKit note |
| Chat turn over 120 s | Proxy cuts it; keep turns short. AI SDK resumable streams need a store; skip for demo | asserted limit |
| Latency budget | Today list read from Lakebase: <300 ms (no model in the path). New card: first skeleton <1 s, complete <5 s. Evidence composition runs after the frame, so the frame can show first | inferred targets |
| Offline / bad signal | Today shows the last cached list read-only; taps queue nothing (outward actions need a fresh version check); a gray "Offline" state on actions | inferred |
| Judges' devices | Apps sit behind workspace SSO, so judges can't open the URL without a workspace login. Demo from our logged-in phone, or the fallback host for a public link | asserted; check on day 1 |
| Model output leaks private data into a spec | The address never enters model context; specs carry ids and labels only (spec/README logging rule) | inferred |

## References: job and transfer contract

| Reference | Job | Keep | Change | Check |
|---|---|---|---|---|
| `databricks/app-templates/e2e-chatbot-app-next` (README, `package.json`, `app.yaml`, `databricks.yml`, `server/src/routes/feedback.ts`, `chat.ts`, `providers-server.ts`) *observed* | Skeleton for app, auth, Lakebase, traces, feedback | Express+Vite layout, drizzle on Lakebase, `data-traceId` part, assessment POST | React 19; `useRemoteToolCalling:false` for our loop; Today and Decision routes added; feedback becomes `human_decision` with option id | Deploys with `databricks bundle deploy` in hour 1; a tap shows an assessment in the MLflow UI |
| AI SDK 6/7 source (`index.d.ts`, `tool-approval-signature.ts`, `validate-tool-approvals.ts`) *observed* | Approval semantics and part states | Signed approvals over the input hash; re-validation on resume; part states drive card states | Multi-option Decisions and item_version are ours | Unit test: tampered input → signature error |
| json-render 0.22 (core, react, shadcn READMEs and types) *observed* | Catalog-constrained composition | zod catalog, `catalog.prompt()`, `validate`, `autoFixSpec`, `fallback`, JSONL patches | Only ~26 evidence/layout entries exposed; tokens, not shadcn defaults; no Grid/Dialog/Text | Fuzz: 50 generated specs, 0 render errors, 0 copy-lint hits after the repair pass |
| AppKit 0.95 docs (agents, lakebase, model-serving) *observed* | Databricks-native patterns and limits | Lakebase token refresh; OBO header; note that hosted tools bypass HITL | Not using `agents()` HITL (60 s, stream-bound) | — |
| shadcn AI Elements: Confirmation, Tool *observed (page)* | Visual reference for the approval and tool states | State coverage (requested, approved, denied, running) | Restyled to brand; more than two actions | Frontend-standard §4 state list passes |
| A2UI v1.0 roadmap *observed* | Challenger for the catalog layer | Catalog-as-schema idea, catalog negotiation | Deferred | Revisit if we add a native iOS client (it has SwiftUI and Compose renderers) |
| `@mlflow/core`/`@mlflow/vercel` 0.5.0 *observed* | Tracing from TS | `MLflowSpanProcessor`, `logFeedback` | Use REST for assessments if UC trace location | One trace per Decision, linked by id |

## What I searched and couldn't reach

- Not opened: CopilotKit, assistant-ui, Thesys and MCP Apps docs. I compared them from npm metadata and memory (*asserted*).
- GitHub API tree listing for app-templates was refused (session access). I read files by guessed raw paths.
- Not verified:
  - Next.js running on Databricks Apps
  - whether SSE streams survive past the 120 s proxy cut
  - Agent Bricks durable execution (AgentKit) from TypeScript
  - the exact OpenAI-compatible URL for Unity Gateway model names with dots (AppKit says dotted names route to the gateway)
  - whether MadHacks workspaces have Apps, Lakebase and Agent Bricks enabled
- Not opened: the Exa X post (not in scope here). `experimental_decide`/`experimental_extract` exist in ai@7 exports (*observed*), but I didn't check whether they wrap OpenAI's Decisions API. That belongs to the identify note.
- Narrow searches; absence of a finding is not proof of absence.

## Seed frontier log

1. **Seed: npm registry for 25 packages.** Changed: AI SDK is 7, not 5; MLflow TS moved to `@mlflow/*`; `@databricks/ai-sdk-provider` exists. Next: read the AI SDK approval types. Contrary lead: maybe Databricks pins an older SDK.
2. **Seed: ai@7 types and source.** Changed: `toolApproval` statuses and HMAC over the input hash already exist, so I dropped my plan to invent tokens and reused the construction. Child: is it in v6 too? Yes (6.0.332).
3. **Seed: Databricks provider peers → AppKit → official chat template.** Changed: the platform's own reference is Express + Vite + AI SDK 6, with feedback as MLflow assessments. This flipped the framework (Next → template fork) and the SDK major (7 → 6). Contrary lead: AppKit `agents()` has built-in HITL. Read it: stream-bound with a 60 s auto-deny, so rejected for Today.
4. **Seed: json-render core/react/shadcn.** Changed: the Renderer doesn't re-validate props, so validation must happen on the server; `fallback` exists. A2UI checked as a challenger: viable, but adds a protocol layer. Stopped here: further searches no longer changed the decisions.

## Open questions for Ben

1. Fork Databricks' Express + Vite chat template instead of starting a Next.js app? (Recommended: yes.)
2. Should the agent compose only the evidence slot and item modules (recommended), or whole Today cards too?
3. Is the judge demo on our logged-in phone acceptable, given Apps sit behind workspace sign-in? Or do we want a public link via the fallback host?
