# The live buy beat: Nate posts, Ben's phone pings

Ben, 07:46: "demoing the buy feature live would be so cool... nate does it live on his phone and it then notifies me right then and there" ([words](words.md#2026-11-15-demo-the-buy-side-live-nate-posts-and-my-phone-pings)). *Agent proposal*. Nothing below has run against a real site yet. The timings come from the rehearsal.

## What exists today

| Part | State | Where |
|---|---|---|
| The want screen | built, on demo data | `app/src/app/want.tsx` |
| `/v1/wants` | answers with examples; nothing is stored | `app/src/edge/api/wants.ts` |
| The alert rule (fits, under your price, new, at most 3 a run) | built and tested, not connected to any reader or schedule | `app/src/edge/watch/watch.ts` |
| Public search readers for 7 sites | built; not sorted newest first | `app/src/edge/intel/public/readers.ts` |
| A push to a phone | **none**: a push token can be saved, nothing sends one, `expo-notifications` isn't in the app, and the app hasn't run on a phone yet | `app/src/edge/api/me.ts`, `app/README.md` |
| **The stage watcher (new)** | reads one newest-first search every 10 s, takes the listings already there as seen, re-reads a new listing's own page to confirm the price, and pings a phone through ntfy; every read is logged. 10 tests pass on sample pages; **not yet run against a real site**, because this container can't reach the marketplaces | [`scripts/demo/stage-watch.mjs`](../scripts/demo/stage-watch.mjs) |

So the beat is real detection by our code on the site's own public page. The want screen on stage is the design, on demo data. The watching runs from the laptop. Say that if asked.

## Which site

| Site | How soon a new listing shows in a signed-out search | Verdict |
|---|---|---|
| **Poshmark** | not measured. Its newest-first search (`sort_by=added_desc`) is plain HTML. A listing's id holds its creation time, so we can show how long after listing we found it (*observed*, [exa-empirical §5](../research/watch/ben/exa-empirical.md#5-freshness-against-each-sites-newest-first-page)). A public Poshmark read took 0.44 s (*observed*) | **First to test** |
| eBay | not measured. Its newest-first page held listings 9 minutes old (*observed*, same note). It shows bot walls, and listing from a phone takes longer | backup |
| Mercari | not measured. The reader exists | third |
| Facebook | of 6,658 new listings, 9 showed in search before they were 6 minutes old (*asserted*, a vendor's count, [new-listing-detection §6](../research/watch/nate/new-listing-detection.md#6-facebooks-delay-before-a-listing-is-visible)) | out |
| Depop | Cloudflare, and it needs a sign-in; and never Ben's personal Depop ([05:54](words.md#2026-11-15-stop-using-my-personal-depop)) | out |

**The rule:** three timed posts tonight per site. Use the one with the lowest worst-case time from Nate's tap to Ben's ping. If none comes in under 90 seconds, the price-drop version below becomes the main beat.

## Time from tap to ping

| Step | Expect | Basis |
|---|---|---|
| Nate taps Post on a draft with photos already in | a few seconds | *inferred* |
| The listing shows in the signed-out newest-first search | **unknown; the number the rehearsal measures** | |
| Waiting for the next read | 0 to 10 s, 5 on average | the script |
| Read the search, then the listing | about 1 s | 0.44 s per Poshmark read, *observed* |
| ntfy to the lock screen | 1 to 3 s | *asserted*, not measured |

## The beat, about 60 to 90 seconds

| Time | Ben says | On screen |
|---|---|---|
| 0:00 | "Buying works the other way round. I want a Carhartt Detroit jacket under $25." | the want screen, on the big screen |
| 0:08 | "Nate, list yours." | Nate, phone in hand, taps Post on a ready draft |
| 0:12 | "It's reading Poshmark's own public search, the page you'd refresh yourself, every few seconds while we're up here. It only tells me about one that's under my price." | the watcher's terminal, "watching Poshmark: 48 listings already there, none will ping" |
| ~0:40 | *(silence; let the phone buzz)* | Ben's lock screen, mirrored: "Under $25: $18 on Poshmark" |
| ~0:45 | "Found 41 seconds after Nate listed it, by Poshmark's own clock." | the tap opens the listing; the found-after number |
| ~0:55 | "Nate, take it down." | it's gone |

**At the booth, use the price drop instead.** It repeats for every group of judges. Nate's listing sits at $60, and he drops it to $20 on his phone, which pings for the same reason a new one does. Between groups he puts it back to $60, and Ben restarts the watcher (2 seconds) so it can ping again.

**If nothing has arrived by 1:30**, say "sites take a minute to show new listings", and switch:
1. The price drop on a listing Nate posted before we came up (real, and usually faster than a new listing).
2. The clip of tonight's best run, with the phone and the terminal both in frame and the clock visible. Say "recorded at [time] tonight".

Never fire a fake alert. A demo-data alert is shown only with "demo data" said out loud.

## Risks

- **A stranger buys Nate's listing.** A low price draws buyers fast. List only a thing Nate owns and is glad to sell at that price. Take it down right after the beat, and if it sells, he ships it.
- **A stranger's listing pings first.** Choose a narrow search that usually costs well over the cap; the first read takes what's already there as seen. A real new match is still a real alert, so say so.
- **A bot wall or bad wifi on the day.** The watcher backs off to 60 s; switch to the clip. Phone and laptop on a hotspot.
- **The sites' terms for automated reads haven't been read** ([backtest plan, decision 32](../spec/plans/backtest/plan.md)). It's one signed-out search every 10 seconds, for the length of the beat. At the first warning from a site, stop.
- **ntfy is a third party, and a topic is public to anyone who guesses its name.** Use a long random topic. The alert carries only the listing's title, price and link. If asked, say the ping rides on ntfy until our own push sender is built.
- **The listing page may not carry a structured price.** Then the confirm step never passes; the rehearsal checks this. `--trust-search-price` uses the search page's price instead; say so if it's on.
- **Cadence.** The product checks each want every 5 to 60 minutes ([watch spec](../spec/features/watch.md)). On stage it's every 10 seconds, for one search. If asked, say both.

## What to say, and not

- Say: "It reads Poshmark's own public search." "Found 41 seconds after Nate listed it, by Poshmark's own clock."
- Don't say: "instantly", "on every site", "every 10 seconds, all the time", or "our push" if it rides on ntfy.

## Rehearsal checklist, tonight

1. Nate: a demo account on Poshmark, and on eBay as the backup. Never Ben's personal Depop.
2. Pick the item, the search and the cap. Nate owns the item. On the newest-first page, count how many listings under the cap arrived in the last day; it should be close to none.
3. Ben: install ntfy, subscribe to the topic, send a test ping.
4. On the laptop, on the hotspot: `node scripts/demo/stage-watch.mjs --url '<newest-first search>' --cap 25 --every 10 --for 15 --ntfy https://ntfy.sh/<topic>`. It should print "watching Poshmark: N listings already there".
5. Nate posts. Note the time of the tap, the time of the ping, and the found-after number. Take it down. Three runs.
6. Check that the confirm step passed. If it didn't, re-run with `--trust-search-price` and note it.
7. Run the price drop once.
8. Record the best run as the clip.
9. Choose the beat: a new listing if its worst run is under 60 s, the price drop if that's faster, otherwise the clip.

**Before going on:** start the watcher 2 minutes early; the phone off Focus and Do Not Disturb, the volume up, notification previews shown on the lock screen; Nate's draft open with the photos in.
