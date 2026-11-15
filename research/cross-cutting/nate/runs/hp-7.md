# hp-7: recon, observed runs
Researched 2026-11-15 by Nate (original agent not recorded).

## Run 1, 2026-11-15: signed-out search on Poshmark and Depop

Each site's public search page ("levis 501") was opened once, one site at a time, on a local Chrome reached over CDP through the pool (`cdpLauncher(localChrome)`). Poshmark ran headless. Depop ran headed, as its platform profile says. `recordVerb(..., account: 'public')` kept the site's own fetch and xhr JSON (first party only, redacted), the embedded state (redacted) and the allowed controls. The script was `/c/dev/.tmp-check/recon-run.ts`. No account, no sign-in, no check page.

| site | HTTP | load, total ms | first-party JSON on load | embedded state | what the author gets |
|---|---|---|---|---|---|
| Poshmark | 200 | 2339, 6813 | none | `window.__INITIAL_STATE__` (3.5 MB): 143 titles, 48 `price_amount {val, currency_code}`; plus 2 ld+json blocks | a page recipe over the embedded state, one request per search, no DOM walking |
| Depop | 200 | 1843, 5873 | `webapi.depop.com/presentation/api/v1/...` (session, experiments, consent) and `/v2/search/filters/category`, `/v1/search/filters/size`; no product list on load | none | 23 listing links in the DOM: a DOM recipe. The product search call was not seen on first load (server-rendered); a scroll or a second page is the next recon step to find it |

What it shows (observed): the two sites need different recipes from the same kernel. Poshmark is embedded-state first. Depop is DOM first on load, and its own client's API lives under `webapi.depop.com/presentation/api/`. Third-party calls (branch.io, Facebook, Google Ads, Pinterest and others) were dropped after the first run: they made up most of what the page fetched.

What is missing: any signed-in verb (no go from Nate for any account); Depop's product search call (needs a scroll or a page-2 recon); Mercari, eBay, Facebook, OfferUp and Grailed are not run yet.

## Steps

| session seq | event | detail | since previous |
|---|---|---|---|
| s_mwhcn8jmpd1z0v 0 | session.start | level=info | +0 ms |
| s_mwhcn8jmpd1z0v 1 | call.start | kind=browser name=pool.dispatch level=info call=c1 | +581 ms |
| s_mwhcn8jmpd1z0v 2 | call.end | ok=true level=info ms=7082 call=c1 | +7082 ms |
| s_mwhcn8jmpd1z0v 3 | call.start | kind=browser name=pool.dispatch level=info call=c2 | +44 ms |
| s_mwhcn8jmpd1z0v 4 | call.end | ok=true level=info ms=6368 call=c2 | +6368 ms |

## Fields against the spec

- session.start x1: spec needs build, seed; 0 line(s) short
- call.start x2: spec needs call, kind, name; 0 line(s) short
- call.end x2: spec needs call, ok, ms; 0 line(s) short

## Missing

- nothing

## Contract problems and warnings

- none
