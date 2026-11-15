# secondhand web

Check from the repository root: `node web/scripts/check.mjs`. This runs the production build, static output checks, each web test file in turn, and copy lint on the app and components.

`/` opens the buying conversation in the hero. `/buy` is the full conversation. `/states` draws empty, typing, photo attached, running, answered, thin data, refused, rate limited, offline, failed, and a long answer with every widget. The header switches light and dark without changing layout.

Recordings work without an API:

- `/buy?replay=words-fixture-prices-counts`
- `/buy?replay=photo-fixture-prices-counts`
- `/buy?replay=trends-fixture-prices-counts`

Every recording says “Recorded answer” and labels prices and counts as fixtures. All listing links and source reports use `example.invalid`. The real garment photo was copied from the path named by `spec/items/capture-real/2026-11-15.json`: `assets/demo-items/real/carhartt-pants/01_cover.jpg`. It illustrates a recording, not a live listing.

Run `node web/scripts/tokens.mjs` after a brand token change. `package.json` already calls this as `prebuild`; `next build` alone does not run npm lifecycle scripts. `app/tokens.css` is the copied output, never an independent palette. The site uses the token font stacks and system fallbacks without fetching a font.

Set `SECONDHAND_API_ORIGIN` before building to rewrite same-origin `/v1/*` to the API. Without it, the pages and recordings work, and live asks show the request failure. There is no key or model call in the site. The only outside calls from application code are the ask, the job read, and its event stream; listing photos may load from returned URLs.

The event and answer types in `lib/types.ts` are copied from `app/src/edge/assist/types.ts`. Widgets read flat result rows, including `q10_cents/q50_cents/q90_cents` (or raw numeric `q10/q50/q90`), `p50_recent_cents/p50_prior_cents/change`, `keep_cents/p_sale_30/days_to_sell`, listing `image_url/price_cents/site/condition/url`, and source `site/title/url/date`. Tables use all returned columns except `sql`, which is disclosed below. The backend's tool row producers are not present in this checkout, so live row compatibility still needs an integration check.

Native EventSource cannot send `X-Visitor-Id`; the API currently reads visitor identity only from that header. The stream is attempted as requested. A stream error or ten seconds without a frame closes it and starts authenticated job polling every two seconds. A completed poll reads the answer from `job.result`. Stream frame ids suppress repeats. Leaving a page closes streams, aborts fetches, and cancels timers. Continue saves turns and recording position through sessionStorage; a storage failure stays visible and does not navigate away.

`lib/log.ts` uses the repository's `log/index.js`. It retains a bounded in-memory diagnostic log of controls, state changes and request status. No ask text, answer text, image, arbitrary error message or visitor id enters that log. `diagnosticLog()` is available to local checks. It is not uploaded. Next's Turbopack root includes the repository so the shared logger can be bundled.

## Screen contract (agent proposal)

Person: a visitor comparing a secondhand item or exploring a style. Frequency: occasional, with no account. Main task: send words or a photo and inspect prices and sources. Costliest mistake: mistaking a recorded price or an unsupported figure for live evidence.

They would say: “Find this.” They want: a comparable item, its price, and enough evidence to judge it. This is inferred from `features/buy/README.md`, `features/assist/README.md`, and `product/vision.md`; no additional user research was performed.

The usual search results page is the strongest rival to an inline conversation. The shared conversation keeps the person's question, work and evidence together, as the brief requires. Interaction references are the repository's SearchField (one field for words or a photo), familiar messaging threads (ask followed by answer), and ordinary disclosure controls (details behind evidence). These are asserted familiar patterns, not a new reference study.

| Element | Need and reason | Source |
| --- | --- | --- |
| Header, home link, Buy link, footer | Enter or leave the buying page without losing the route | brand constitution, web medium |
| Theme button | Review both token modes | brief, dark token set |
| Field behind the home heading | Establish the home hero without tinting long answers | brand C2 |
| Textarea, photo, Remove photo, Ask | Ask by either medium, edit before sending, or back out | buy page contract |
| Photo preview | See exactly which image will be sent | assist photo rule |
| Three starters | Try the experience without knowing a query or having an API | brief |
| Ask, tool lines, answer | Preserve context and show actual work arriving | assist event contract |
| Seven widgets | Compare returned rows without extracting figures from prose | assist widget contract |
| Recorded label, gate count, thin count | Keep fixture data and missing evidence visible | brief, brand E3 |
| Evidence disclosures | Separate tool basis from web sources without crowding the answer | assist answer contract |
| SQL disclosure | Inspect the table's query when supplied | assist table contract |
| Failure messages and Try again | Recover without retyping or reattaching the photo | brief |
| Continue | Carry the home turn into the full conversation | buy hero contract |
| State index | Review each requested state with the same components | brief |
| 16px gutters, 680px column, wrapping grid | Keep asks, prices and actions reachable on phone and web | brief, overrides general brand web margins |
| Short opacity fade on arriving text, tool lines and widgets | Show new results without blocking typing | frontend standard motion |

| State or action | Visible result | Escape or recovery |
| --- | --- | --- |
| Empty, typing | One composer; Ask enabled when there is content | Edit or leave |
| Attach a photo | Local resized preview; nothing sent yet | Remove photo |
| Ask, including a photo alone | Ask appears immediately; input remains usable | Continue typing another ask |
| Tool event, text delta | Tool counts update; provisional text accumulates | Input remains usable |
| Settled | Blocks replace provisional text; sources are disclosed | Follow a listing or ask again |
| Thin data | Named count and no fabricated price estimate | Ask with more detail |
| Refused | Refusal and its supplied text | Change the ask |
| Rate limited | Rate message and Try again | Wait, then retry |
| Offline | Reconnection message; ask retained | Reconnect and retry |
| Failed | Failure and Try again | Retry terminal job with a new key; retry uncertain POST with its original key |
| Continue | Session handoff to `/buy`, preserving recording label and position | Storage error leaves the answer in place |
| Keyboard | Tab to actions; Enter sends; Shift+Enter adds a line | Visible focus and Skip to content |
| Reduced motion | Instant arrivals | Same information and controls |

Pre-code failure tests cover event ordering, stale provisional text, refusal, wrong widget result, missing results, unsafe outbound protocols, storage denial, resize dimensions, request headers, stream fallback and timer cancellation. Later regression tests cover terminal retries, invalid saved tools, and unavailable price bands.

Verification limits: no server, browser, network, deployment or git writes were run. Phone overflow, zoom, rendered contrast, fonts and motion were reasoned about from the CSS, not measured in a browser. Visual review remains unfinished. No image generation was needed; the brief supplied a real photo. API integration awaits the backend and origin.

## Account access

`/signin` and `/signup` accept email codes. With a Google OAuth web client configured, they also offer the Google Identity Services button. Both call the existing auth endpoints through the same-origin `/v1` rewrite. Set `SECONDHAND_API_ORIGIN` for the web build and add the public web origin to `SECONDHAND_WEB_ORIGINS` on the API when it runs on another origin.

For Google, set `NEXT_PUBLIC_SECONDHAND_GOOGLE_CLIENT_ID` in the web build and include the same client ID in the API’s `GOOGLE_CLIENT_IDS`. Register the public origin with that Google web client. Email requires the API’s configured email sender. Browser sessions use the API’s HttpOnly refresh cookie. The web client does not save tokens in browser storage.


### Brand fonts

Both licensed faces are optional local files. Set `SECONDHAND_FONTS` to their folder or put them in `fonts/` at the repository root before building. Browser clients load fonts from the website, including on Windows. When the licensed files are absent, the bundled Hanken Grotesk and Outfit supply the text and wordmark respectively.
