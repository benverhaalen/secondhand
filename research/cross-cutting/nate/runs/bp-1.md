# bp-1: the hosted browser pool, observed runs
Researched 2026-11-14 by Nate (original agent not recorded).

Host: our own compute (this Windows workstation). The Databricks verdict waits on T0-1. The pool code does not depend on the host: the launcher runs wherever the process runs.
Browser: Playwright Chromium headless shell 1217, launched with only `headless` and an optional proxy. No user-agent override, no stealth flag, no challenge solver.

## Cold against warm (measured 2026-11-14, `node --test app/src/edge/browser/pool.test.ts` with SECONDHAND_PLAYWRIGHT set)

| what | ms |
|---|---|
| the first browser launch after a reboot, before the OS cache is warm (one-off probe) | 1657 |
| cold dispatch: launch the account's persistent profile, then a page | 321 |
| warm dispatch: a page in an already-launched profile | 61 |
| 8 public pages at once, each on its own warm context | 152 |
| a fresh context plus a page on a launched shared browser | 55 to 103 |

So a warm pool cuts a dispatch from about 0.3 to 1.7 s down to about 60 ms. `pool.warm(account_ids)` launches each linked account's profile ahead of any call.

## The observed run on signed-out public pages (three home pages at once, one request each)

Run with `/c/dev/.tmp-check/bp1-run.ts`, a dispatchAll of 3 tasks on the 3 warm public contexts. The trace below comes from `node scripts/runs.mjs record bp-1`.

| site | HTTP | challenge in title | ms (first run, then second) |
|---|---|---|---|
| depop.com | 403 | no | 10083, then 299 |
| poshmark.com | 200 | no | 12210, then 2280 |
| mercari.com | 403 | yes | 10355, then 495 |

What it shows (observed):
- Depop and Mercari refuse a plain signed-out headless Chromium on this host's address, and Mercari shows a check page. Per the protections this is `blocked`: the session is paused and the person asked. Nothing solves it or routes around it. For the platform teams, a signed-out public browser read is not a route on those two sites from this address. Their signed-in profile route, or the cookie runner where recon finds endpoints, has to be proved per site.
- Poshmark serves the public page. The second run took 2.3 s, the first 12.2 s, the gap being site caching and the first DNS and TLS.
- The three were dispatched at once and ran in parallel: the total equals the slowest, not the sum.

What is missing: no signed-in run, because there is no go from Nate for any account. There is no per-account proxy yet (the `AddressBook` port is in place with no provider), and resident memory per profile is not measured.

## Steps

| session seq | event | detail | since previous |
|---|---|---|---|
| s_mwhb6x5jy4h2sy 0 | session.start | level=info | +0 ms |
| s_mwhb6x5jy4h2sy 1 | call.start | kind=browser name=pool.dispatch level=info call=c1 | +731 ms |
| s_mwhb6x5jy4h2sy 2 | call.start | kind=browser name=pool.dispatch level=info call=c2 | +1 ms |
| s_mwhb6x5jy4h2sy 3 | call.start | kind=browser name=pool.dispatch level=info call=c3 | +0 ms |
| s_mwhb6x5jy4h2sy 4 | call.end | ok=true level=info ms=299 call=c1 | +298 ms |
| s_mwhb6x5jy4h2sy 5 | call.end | ok=true level=info ms=495 call=c3 | +197 ms |
| s_mwhb6x5jy4h2sy 6 | call.end | ok=true level=info ms=2280 call=c2 | +1785 ms |

## Fields against the spec

- session.start x1: spec needs build, seed; 0 line(s) short
- call.start x3: spec needs call, kind, name; 0 line(s) short
- call.end x3: spec needs call, ok, ms; 0 line(s) short

## Missing

- nothing

## Contract problems and warnings

- none

## Run 2, through the browser-use path (real Chrome over CDP), 2026-11-15

One signed-out search page per site, one request each, run one site at a time on a local Chrome 2026 build (`C:/Program Files/Google/Chrome/Application/chrome.exe`), reached over CDP by `cdpLauncher(localChrome)`. No captcha solver, no stealth flag, no user-agent change. The scripts were `/c/dev/.tmp-check/cdp-run.ts` and `cdp-run-headed.ts`.

| site, page | headless Chrome | headed Chrome (a real window) |
|---|---|---|
| depop.com/search/?q=levis | 403, title "Forbidden - Depop", 0 listing links: a block page, not a challenge | 200, "Search \| Depop", 24 listing links |
| mercari.com/search/?keyword=levis | 403, title "Just a moment...": a challenge page | 200, "Shop levis on Mercari", no challenge (the cards had not rendered in the 3 s wait, so the link count read 0) |
| poshmark.com/search?query=levis | 200, "levis on Poshmark", 96 listing links | not needed |

What it shows (observed): Depop and Mercari refuse a headless browser, not automation as such. The same Chrome in a real window gets each site's real search page, with no challenge shown. So the platform profile carries `headed: true` for Depop and Mercari, and the pool runs their accounts and their public reads in a real window (on a server, a virtual display such as Xvfb). Nothing here solved or skipped a check. If a check page appears in a real window, the session pauses for the person.
