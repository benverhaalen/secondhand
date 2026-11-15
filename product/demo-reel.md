# Demo reel: the clips, how we show how it works, and faster demo loops

Ben, 06:01: "the best is just showing the magic of it. the different features and flows and letting the demos or the videos of them talk. us actually demoing them in the basement. try to make the demoing loops faster for website and app too. also think about how to visually convey how it works. use things like exa and firebase and treg x videos that they do to demo new features." ([words](words.md#2026-11-15-show-the-magic-clips-basement-demos-faster-loops-and-the-intelligence-engine)). *Agent proposal*. The messaging he asked for is in [pitch.md, the new framing](pitch.md#the-new-framing-it-watches-and-manages-your-markets). Each clip is marked as **live** (shot from the real app on a real site), **demo world** (the app's built-in demo data, said on screen) or **recorded** (a real past run, with its date).

## 1. The evidence is the clip

A judge believes what they watch happen more than any number we put on a slide. So every claim in the pitch gets one short clip that shows it, and the numbers go in the caption, not the voice-over.

The rules for every clip:
- **One feature, 8 to 20 seconds.** It opens on the problem's moment and ends on the result. Nothing else is on screen.
- **Real time.** The clock stays visible; nothing is sped up unless the caption says "2x".
- **Real things.** Ben's and Nate's own things, shot in the basement. A demo-world screen says "demo data" in the corner. Never Ben's personal Depop ([05:54](words.md#2026-11-15-stop-using-my-personal-depop)); posts go to a demo account.
- **The hand in frame for the phone, the screen recording for the result.** A phone filmed over the shoulder proves it's real; the clean screen capture makes it readable. Cut between the two.
- **A caption with the proof.** "173 of 174 planted lies caught. Re-run: `python3 scripts/bench/gate.py`."

| # | Clip | The moment it opens on | What we show | Proof in the caption | Status today |
|---|---|---|---|---|---|
| 1 | Three photos to a plan | a jacket on the basement floor | guided camera, the found pop-up, the plan with keep per site and the sites to skip | "On $20 you keep $18.69 on Depop and $16.00 on Poshmark" | live up to the plan; demo world for the sites |
| 2 | The couch doesn't go on Depop | the same app pointed at a couch | the site verdicts: Facebook pickup, not Depop, with the one-line reason | the reason on screen | live |
| 3 | Photos that can't lie | a jacket photo with a print | the honest relight passes; the print painted out is held, with the box that failed | "173 of 174 planted lies caught; 17 of 38 honest ones held too" | live (runs locally, no model) |
| 4 | The photo set, made for you | four rough phone shots | the pipeline lays them out as slide 1, 2, 3 by kind of item | (from the photo thread, once it runs) | owned by the photo pipeline thread; shoot when it runs |
| 5 | A buyer asks, it answers from facts | a "what are the measurements?" message | the reply with its fact chip, "Sent for you" | the claim it held: "smoke-free home" shown to you, not sent | demo world |
| 6 | A lowball offer asks you | an offer under the minimum | the offer card with what you'd keep, Counter at your number | "Code checks your minimum, not the model" | demo world |
| 7 | Sold, coming down everywhere | the sold card | tiles go to gone one by one; a red one with Try again | "Seen from Poshmark's public page in 0.44 s (observed)" | the 0.44 s read live; the take-downs demo world until a signed-in delist runs |
| 8 | Who's coming, then Add to Calendar | a pickup request | the picker, the who-is-coming card, the calendar button | none needed | demo world |
| 9 | Find this, used | the same jacket photo on the Buy side | every site at once, a fair range, the total with shipping | the range with its n | live if search answers in rehearsal |
| 10 | Both sell at once | two buyers pay within a minute | the one card that names both and suggests keeping the first paid | "60,936 orders checked; break the refund and it fails in 6 steps" | the checker live in a terminal; the card demo world |
| 11 | When the page changes | a site's page shape breaks our reader | the fallback finds the listings anyway | "48 of 48 in 0.64 s (observed 2026-11-15)" | recorded, trace hp-9 |
| 12 | Nate posts, the find shows on Ben's phone | Nate's thumb on Post | the watcher's terminal, then Ben's phone: the want screen with the find, "Under your price" | "Found N s after it was listed, by Poshmark's own clock" | the watcher is built and tested on sample pages; record at tonight's rehearsal ([plan](live-buy-demo.md)) |

Clips 1, 3 and 10 are the three to shoot first: each is our own engineering, each runs today, and each answers a question judges ask ("will it put my couch on Depop?", "is the photo lying?", "what if both sell?").

**The basement session (about an hour).** Ben and Nate, 8 to 10 real things of three kinds (clothes, a shoe, something hard). Phone on a hotspot. Run the [hands-on test](numbers.md#the-hands-on-test-before-the-pitch-about-45-minutes) and film it at the same time: the stopwatch is in the shot, so the speed claim and the clip come from the same take. Keep the misses too; one honest miss with the app's "still learning" answer is worth more than a perfect run nobody believes.

## 2. Showing how it works

Ben named the feature-launch videos from developer-tool companies (Exa, Firebase, Treg). We haven't studied those specific videos here; the techniques below are the ones that kind of video uses, written so we can make them in CapCut or with the website's own components.

| Technique | What it looks like | Where we use it |
|---|---|---|
| The real UI, zoomed | a screen recording that pushes in on the one thing that changed, then pulls back | every clip in §1 |
| One sentence on a plain card | the brand's type on the brand's background, one line, then straight back to the product | between clips: "AI can write a listing. That was never the hard part." |
| The data moving | a diagram where a single item's facts flow out to five sites and the sale flows back | how it works, once (see the four diagrams below) |
| Before and after on a slider | the same frame split down the middle, dragged | the photo gate: `gate-original.jpg`, `gate-lie.jpg`, `gate-heat.jpg` are already the same size and lined up |
| The number counting up | a counter that runs to the measured figure, with its mark under it | 60,936; 173 of 174; $2.69 |
| The terminal as a character | a real command typed and its real output | `node scripts/bench/bench.mjs` finding the double sale in 6 steps |

**The four diagrams**, each a still for the Devpost and a 6-second animation for the video. The website thread can build them from the site's components.
1. **One record, five listings.** A photo's regions become facts ("size M", from the tag), and the facts become a different listing per site.
2. **Watching cheaply.** eBay pushes the sale; Poshmark and Mercari are read from the public page; Depop is a signed-in sweep that slows down when the item is quiet; a browser opens only to confirm.
3. **Who decides.** Code checks the money and the address; the model only words things; anything over your line comes to you.
4. **A price you can open.** One shown price, its comparable sales and their weights, and a thin one hidden with its reason (designed, see [showcase](showcase.md#2-how-we-use-databricks)).

## 3. Faster demo loops, website and app

The app already opens any screen in a known state from its address: `?world=` picks a person (`clearing`, the person we build for; `flipper`, 64 things; `buyer`; `new`) and `?state=` picks a state (`typical`, `empty`, `loading`, `failed`, `offline` and others) ([app/src/demo](../app/src/demo/README.md)). So a demo reset is a reload, not a re-seed.

- **One page of demo links.** A list of the exact addresses for each step of the [full demo](showcase.md#3-the-full-demo-start-to-end-both-sides), in order, on the laptop and as a home-screen bookmark on the phone. A judge asks to see the offer card again: one tap. (*Agent proposal*; a short page any thread can add.)
- **The table loop is 2 minutes**, the full demo 4. Rehearse each three times against a timer and cut any step that waits on screen for more than two seconds.
- **Screens for the reel come from app-check.** `node scripts/app-check.mjs` already renders every screen in every required state, light and dark, into `features/app/renders/`; those are the stills for the Devpost and the website, with no manual screenshots.
- **Live steps are warmed.** The cloud browser is opened before going on (61 ms warm against 1.6 s after a reboot, observed).
- **Every live step has its clip queued.** If a site is slow on the day, the clip from §1 plays in its place and we say it is a recording.
