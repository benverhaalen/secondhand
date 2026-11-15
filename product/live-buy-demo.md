# The live buy beat: Nate posts, the find shows on Ben's phone

Ben, 07:46: "demoing the buy feature live would be so cool... nate does it live on his phone and it then notifies me right then and there" ([words](words.md#2026-11-15-demo-the-buy-side-live-nate-posts-and-my-phone-pings)). *Agent proposal*. Nothing below has run against a real site yet. The timings come from the rehearsal.

## What exists today

| Part | State | Where |
|---|---|---|
| The want screen | built, on demo data | `app/src/app/want.tsx` |
| `/v1/wants` | answers with examples; nothing is stored | `app/src/edge/api/wants.ts` |
| The alert rule (fits, under your price, new, at most 3 a run) | built and tested, not connected to any reader or schedule | `app/src/edge/watch/watch.ts` |
| Public search readers for 7 sites | built; not sorted newest first | `app/src/edge/intel/public/readers.ts` |
| A push to a phone | **none**: a push token can be saved, nothing sends one, `expo-notifications` isn't in the app, and the app hasn't run on a phone yet | `app/src/edge/api/me.ts`, `app/README.md` |
| **The stage watcher (new)** | reads one newest-first search every 10 s, takes the listings already there as seen, re-reads a new listing's own page to confirm the price and take its photo, and writes the find to `logs/stage-alerts.json`; every read is logged. 13 tests pass on sample pages; **not yet run against a real site**, because this container can't reach the marketplaces | [`scripts/demo/stage-watch.mjs`](../scripts/demo/stage-watch.mjs) |

| **The find in the app (new)** | Ben chose the alert inside the app, with the app open (decision card, 08:06). The want screen opened with `?live=1` reads `GET /v1/stage` every 2 s and shows each find under what's being watched: the listing's photo, "Under your price", the price, and how many seconds after listing it was found. Tap opens the listing; the phone gives a success haptic in the native app | `app/src/app/want.tsx`, `app/src/buy/stage.ts` (4 tests), `app/src/app/v1/stage+api.ts` |

So the beat is real detection by our code on the site's own public page, shown in our own app. The rest of the want screen (the price dots, the sites' status) is demo data, and the watching runs from the laptop. Say that if asked.

## Which site

| Site | How soon a new listing shows in a signed-out search | Verdict |
|---|---|---|
| **Poshmark** | timed run pending ([brewers trial](../research/watch/ben/brewers-alert-trial.md)). From Ben's Mac it is the only one of six sites that answers a signed-out read: 0.70 s, and the page carries each listing's publish time, size, department and category (*observed*, 08:12 UTC). Its terms ban automated collection and its robots.txt disallows `/search` (*observed*) | **The demo's site**; say it reads Poshmark's public page |
| eBay | the search page returns 403 to a plain read (*observed*). The Browse API is the sanctioned route (newest first, creation date, 5,000 calls a day) but needs developer keys we don't have | backup once keys exist; the product's watch source (*agent proposal*) |
| Mercari | 403 to a plain read (*observed*) | out |
| Facebook | of 6,658 new listings, 9 showed in search before they were 6 minutes old (*asserted*, a vendor's count, [new-listing-detection §6](../research/watch/nate/new-listing-detection.md#6-facebooks-delay-before-a-listing-is-visible)) | out |
| Depop | Cloudflare, and it needs a sign-in; and never Ben's personal Depop ([05:54](words.md#2026-11-15-stop-using-my-personal-depop)) | out |

**The rule:** three timed posts tonight per site. Use the one with the lowest worst-case time from Nate's tap to the find on Ben's phone. If none comes in under 90 seconds, the price-drop version below becomes the main beat.

## Time from tap to the find on Ben's phone

| Step | Expect | Basis |
|---|---|---|
| Nate taps Post on a draft with photos already in | a few seconds | *inferred* |
| The listing shows in the signed-out newest-first search | **unknown; the number the rehearsal measures** | |
| Waiting for the next read | 0 to 10 s, 5 on average | the script |
| Read the search, then the listing | about 1 s | 0.44 s per Poshmark read, *observed* |
| The app's next read of the find | 0 to 2 s | the screen |

## The beat, about 60 to 90 seconds

| Time | Ben says | On screen |
|---|---|---|
| 0:00 | "Buying works the other way round. I want a Carhartt Detroit jacket under $25." | the want screen, on the big screen |
| 0:08 | "Nate, list yours." | Nate, phone in hand, taps Post on a ready draft |
| 0:12 | "It's reading Poshmark's own public search, the page you'd refresh yourself, every few seconds while we're up here. It only tells me about one that's under my price." | the watcher's terminal, "watching Poshmark: 48 listings already there, none will ping" |
| ~0:40 | *(silence; let the find appear)* | Ben's phone, mirrored: the want screen, and under it the find, "Under your price", $18, "41s after listing" |
| ~0:45 | "Found 41 seconds after Nate listed it, by Poshmark's own clock." | the tap opens the listing; the found-after number |
| ~0:55 | "Nate, take it down." | it's gone |

**At the booth, use the price drop instead.** It repeats for every group of judges. Nate's listing sits at $60, and he drops it to $20 on his phone, which shows as a find for the same reason a new one does. Between groups he puts it back to $60, and Ben restarts the watcher (2 seconds) so it can ping again.

**If nothing has arrived by 1:30**, say "sites take a minute to show new listings", and switch:
1. The price drop on a listing Nate posted before we came up (real, and usually faster than a new listing).
2. The clip of tonight's best run, with the phone and the terminal both in frame and the clock visible. Say "recorded at [time] tonight".

Never fire a fake alert. A demo-data alert is shown only with "demo data" said out loud.

## Risks

- **A stranger buys Nate's listing.** A low price draws buyers fast. List only a thing Nate owns and is glad to sell at that price. Take it down right after the beat, and if it sells, he ships it.
- **A stranger's listing shows first.** Choose a narrow search that usually costs well over the cap; the first read takes what's already there as seen. A real new match is still a real alert, so say so.
- **A bot wall or bad wifi on the day.** The watcher backs off to 60 s; switch to the clip. Phone and laptop on a hotspot.
- **Poshmark's terms ban automated collection, and its robots.txt disallows `/search`** (*observed*, [brewers trial §1–2](../research/watch/ben/brewers-alert-trial.md#1-what-answers-a-signed-out-read-from-bens-mac)). It's one signed-out search every 10 seconds, for the length of the beat. If a judge asks, say so plainly, and that the product's route is eBay's API. At the first warning from a site, stop.
- **A price cap alone pings for the wrong things.** On "brewers jersey", 40 of 48 results were tees, women's or kids' cuts, other teams or giveaways (*observed*). Run with `--want`, which judges Poshmark's own department, category and size.
- **The phone has to reach the laptop, with the app open.** The phone and the laptop are on the same hotspot, the app is open on the want screen, and the screen is set not to lock. The find shows in the app, not as a notification: there's no push sender yet. The watcher's `--ntfy` option is kept as a spare only.
- **The listing page may not carry a structured price.** Then the confirm step never passes; the rehearsal checks this. `--trust-search-price` uses the search page's price instead; say so if it's on.
- **Cadence.** The product checks each want every 5 to 60 minutes ([watch spec](../spec/features/watch.md)). On stage it's every 10 seconds, for one search. If asked, say both.

## What to say, and not

- Say: "It reads Poshmark's own public search." "Found 41 seconds after Nate listed it, by Poshmark's own clock."
- Don't say: "instantly", "on every site", "every 10 seconds, all the time", or "a notification": it shows in the app, which is open.

## Rehearsal checklist, tonight

1. Nate: a demo account on Poshmark, and on eBay as the backup. Never Ben's personal Depop.
2. Pick the item, the search and the cap. Nate owns the item. On the newest-first page, count how many listings under the cap arrived in the last day; it should be close to none.
3. On the laptop: `cd app && npm start`. On Ben's phone, on the hotspot, open the app at the laptop's address: `/want?q=<the item>%20under%20%24<cap>&live=1`. Set the price on screen to the watcher's cap, and tap Watch.
4. On the laptop, on the hotspot: `node scripts/demo/stage-watch.mjs --url '<newest-first search>' --want scripts/demo/wants/<want>.json --every 10 --for 15` (or `--cap 25` for price only) (it writes `logs/stage-alerts.json`, which the app reads). It should print "watching Poshmark: N listings already there".
5. Nate posts. Note the time of the tap, the time the find shows on Ben's phone, and the found-after number. Take it down. Three runs.
6. Check that the confirm step passed. If it didn't, re-run with `--trust-search-price` and note it.
7. Run the price drop once.
8. Record the best run as the clip.
9. Choose the beat: a new listing if its worst run is under 60 s, the price drop if that's faster, otherwise the clip.

**Before going on:** start the watcher 2 minutes early; the phone on the want screen with Watch tapped, Auto-Lock off, brightness up; Nate's draft open with the photos in.
