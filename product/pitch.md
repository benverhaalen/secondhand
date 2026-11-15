# Pitch

How secondhand is told to judges and to users. The [pitch constitution](pitch-constitution.md) governs how it's told; this file holds the material. Every number links to [pitch-evidence.md](../research/cross-cutting/ben/pitch-evidence.md) or [problem-and-pitch.md](../research/cross-cutting/ben/problem-and-pitch.md), where it carries its mark. Everything here is an *agent proposal* until Ben picks; nothing changes the [decisions](decisions.md) (selling leads; appraise and buy are add-ons).

Ben's two meanings of the name, 19:15 ([words](words.md#2026-11-14-pitch-and-structure)):
1. **Your second hand.** It does the actions for you, the way an AI agent does.
2. **The second hand of the clock.** It's fast; you only spend seconds.

The brand thread's recommended wordmark already carries both: the o is a clock with a red second hand.

## The problem in one sentence

For most things people own, there are two ways to sell, and both are bad: hand it to a consignor and keep 15% of a $20 sale, or do it yourself, keep about 85%, and do work that fewer than 1 in 10 cheap listings finish within a month.

That sentence rests on observed numbers (ThredUp's payout table, eBay's fee page, a 33,638-listing eBay study) and is the strongest problem statement we found. It replaced the draft "listing takes too long", because AI drafting is already about 30 seconds at eBay and the listing vendors.

## Five ways to tell it

*Kept for the record.* The order to use now is in the [pitch constitution](pitch-constitution.md) and the [three-minute version](#the-three-minute-version-with-the-demo) below; it supersedes the recommendation in the next section.

Each differs on the assumption that decides it: what judges and users believe the problem is.

| | Narrative | Headline | Lead evidence | Strong at | Weak at |
|---|---|---|---|---|---|
| **A** | **Your second hand** (the agent) | "A second pair of hands for everything you'd sell, if selling weren't a second job." | 56% would pay someone to handle reselling; ThredUp says supply is the constraint; eBay shut its own sell-for-you service | Matches the AI-agent moment; uses meaning 1; the human-in-the-loop story is a strength for judges | Every hackathon team says "agent". Needs a moment where it visibly *declines* to act, or it reads as the Muse failure |
| **B** | **Seconds, not hours** (the clock) | "From a photo to live on four sites before the second hand comes round." | 4–7 min per listing per site by hand (asserted, vendor); our own stopwatch run | A demo you can time on stage; uses meaning 2 and the clock wordmark | Speed of one draft is a commodity (eBay says 50% fewer steps). Only eBay has an official listing API, so "four sites in a minute" is a live-demo risk |
| **C** | **Keep the money** (the economics) | "Consignment pays you $3 for a $20 shirt. We pay you $17, and do the work." | ThredUp 3% / 15% / 30% payout tiers; eBay 13.6% + $0.40; 8.6% of sub-$15 eBay listings sell in 30 days | The best-sourced story; one comparison slide anyone gets; explains why now (an agent's cost per item is flat, a person's isn't) | Comparing to a named company on stage needs care. We can't yet show we raise sell-through, only that we remove the work |
| **D** | **Sell without the risk** (trust) | "The agent does the work. You keep the keys: price, address, pickup, payment." | Meta's Muse sent a stranger to a seller's home (Sept 2026); eBay bans agents placing orders without human review; 31% would let AI spend $0 | Turns the human-in-the-loop into the product, and it is the honest answer to platform rules | Defensive as an opening; fear doesn't make people want to sell |
| **E** | **A price for everything** (the market engine) | "Every listing and every sale we see makes the next price better. Point at anything and know what it's worth." | Comps and Valuation on Databricks; appraise everywhere ([primitives](primitives.md)) | The clearest Databricks story; covers buy and appraise | Pulls against the decision that selling leads; a hackathon has too little data to prove a model beats eBay's sold listings |

## Recommendation: C opens, A is the product, B is the demo, D and E are beats

Not five pitches: one, with each narrative doing the job it is best at.

1. **Problem (C), 30 s.** The $20 shirt: $3 from consignment against about $17 yourself, and the work that keeps people at $0. "So it sits in the closet." Then ThredUp's own line: supply is the constraint.
2. **Product (A), 20 s.** "secondhand is your second hand." It shoots, measures, prices, posts, answers and delists. You decide.
3. **Demo (B), 60–90 s.** A visible clock on screen. One item from photo to live, then a folder of items into drafts, then Today with three decisions. Run the timer for real; no claimed minutes we didn't measure.
4. **Trust (D), 15 s.** The agent asks before price, address, pickup and payment. One sentence on the Muse incident, no names needed.
5. **Data (E), 30 s.** For the Databricks judges: every observed listing and sale is a comp; every sale writes back its real time-to-sell; the price model learns. Show the table growing during the demo.
6. **Close (both meanings).** "Your second hand. Done in seconds."

**Why this order:** C is the only problem statement backed by numbers we opened ourselves, and it sets up A without the word "agent" doing the work. **What would change it:** if the judging rubric for the main track rewards technical depth over problem framing, lead with B's live demo and move C to 15 seconds.

## The theme: "Let's dig in"

The readings, the likely source and the lines to say are in [theme.md](theme.md). Open with: "The theme says start digging. Most of us already have: there's a closet or a basement full of things worth money that never get sold. secondhand is the tool that digs in for you, and leaves the decisions to you." Don't name the essay until an organizer confirms it.

## The simplest pitch

Added 2026-11-15 from Ben's ask ([words](words.md#2026-11-15-who-judges-it-guarantees-the-buyer-side-messages-you-approve-meetups-audit-every-site-and-no-fixed-pickup-schedule)). The hard questions behind every line are in [qa.md](qa.md); check its honesty gate before saying any "it does".

**One breath (10 s):** "Take a photo of something you own. secondhand lists it on the right sites at the right price, answers the buyers, and takes it down everywhere when it sells. You approve anything that touches your money, your address or a stranger."

**At the table (30 s):** "Most of what people own never gets sold, because there are two bad options. Consignment pays you $3 of a $20 sale. Doing it yourself keeps about $17, but it's five apps, thirty 'is this available?' messages, and a sale on one site while it's still up on four others. secondhand is your second hand. It photographs, measures and prices the item, writes a different listing for each site's buyers, answers questions, handles offers inside your minimum, and when it sells on one site it takes it down on the rest. It never sells below your price and never gives out your address. You keep the $17."

## The most impressive explanation

For a technical or Databricks judge who asks "how does it actually work?" Two minutes; stop wherever they stop you.

1. **One record per item.** The camera fills an item card: what it is, its size, its flaws. Every fact on it points to where it came from: this region of this photo, this line of the tag, this measurement, or "you said". Tap "size M" and you see the box on the frame.
2. **A different listing for each site.** A table of 31 kinds of thing by 7 sites says where each sells and why; a couch is marked avoid on Depop because Depop ships only and its buyers want clothes. The price on each site is solved from what you keep after that site's fees, so you see the same money everywhere.
3. **A harness per site.** eBay through its API. The others through your own signed-in session in a cloud browser, doing each action the way the site's own web app does it, then reading the site back to confirm. Nothing counts as done until the read-back shows it.
4. **Selling runs itself inside your limits.** Plain code decides offers against your minimum; the model only words the reply, and every claim in it is checked against the item's facts before it is sent. A sentence with no backing is held and shown to you.
5. **The sale.** Poshmark and Mercari show a sold item on the public page, so we check those for free every minute or two; Depop through a signed-in watcher; eBay through its orders. A paid order triggers take-downs on every other site, confirmed one by one; anything still up after 5 minutes turns red.
6. **It earns its autonomy.** Every approval is a label. After three unedited approvals of the same kind, it offers "Always do this". Address, payment and off-site deals never become automatic.
7. **Databricks holds the loop.** Live state in Lakebase, every event and comparable sale in Delta, photos in a volume, every model call through the gateway, every agent step as an MLflow trace that the app shows as Why?. Every number cites the rows it read and hides itself when they are too few. Each sale writes back its real price and days to sell, so the next price is better.

## It's always you: AI that helps you, not AI that is you

Ben, 06:40: "pitching about ai impersonation. its always you. also think about how people feel about ai. like its scary. let it help you. not impersonate you. not take you out of it. whether your in an office or just reselling your clothes on the internet its always good to have a human in the loop." *Agent proposal* for the lines.

**Why it matters.** People are wary of AI that acts in their name. The fear is concrete: an assistant elsewhere, set to "Allow Always", took a lowball offer and sent a stranger to a seller's home. We answer it with rules in code, not reassurance.

**The lines** (pick one as the tagline, use the rest in the talk):
- "It's always you."
- "Let AI help you, not be you."
- "From the office to your closet: AI does the work, you make the calls."
- "A human in the loop, built in, not bolted on."

**What makes them true** (each is in the code or the spec; cite it if asked):
- Code, not the model, decides anything about money, your address or a deal off the site; those three can never be automatic.
- Replies start as drafts: you read them and you send them ([Ben, 06:40](words.md#2026-11-15-a-sale-and-a-match-ping-at-once-replies-start-as-drafts-and-agents-build-the-better-way)). Every draft is built from your item's facts; a claim it can't back is held and shown to you.
- It earns "Always do this" after you approve the same kind of thing three times without a change, and every automatic action has a Why? and a way out ([ways out](../spec/ways-out.md)).

**Who sends it.** Ben, 06:44: when you read a reply and choose to send it, you sent it, so it carries no label; if a buyer asks whether AI helped, the reply says yes ([words](words.md#2026-11-15-you-send-it-and-if-a-buyer-asks-it-says-so)). So the honest line is "Every reply is one you read and sent. Ask if AI helped, and it'll tell you." Don't say "no AI ever touches your messages".

**AI photos and size.** The AI on its own doesn't keep dimensions: a raw redraw of the Marquette tee came out about 2 inches too narrow. The published photo is right only because our check measures each redraw against the tape, and sets it back or rejects it. Say "every AI photo is measured against your tape before it posts". Never say "the AI is accurate".

## What's new: three things we haven't seen anyone else do

After the demo, say these three, each with its 5-second proof ([unique.md](unique.md), with what we checked for each): we proved a double sale can't go unnoticed (931,406 states; the broken version fails in 6 steps); AI photos are checked by math, not more AI, with every flaw protected (173 of 174); a reply can't say what your item doesn't back (the held "smoke-free home"). Say "we haven't seen", never "first ever".

## Every feature, how it works, and its proof

The canonical list of every feature worth showing is [features-proof.md](features-proof.md). It has 29 features, each checked against the code, with what it does, how it works in plain words and in the code, its proof mark (measured, observed, built, designed), the proof still to run, and one line to say. It also ranks what goes in the three minutes, at the booth, on the website, and only in answers to questions.

## Proof without sales

We have no month of sales, so we prove the parts of a sale instead, and say so first: "We can't show you a month of sales from a 24-hour hackathon, and we won't pretend to. Here's what we can show." The ranked list of proofs to run before 1 pm, and the comparisons, are in [proof-without-sales.md](proof-without-sales.md).

## Security and open source

Checked against the code on 2026-11-15. Say "built" for these; nothing here has run against a live account at scale.

- **Your marketplace sign-ins live in a Databricks secret scope**, one key per account, named by a reference; never in the repo, a log or a trace (`app/src/edge/browser/auth.ts`; scope `vault` in [the bundle](../deploy/databricks.yml)). `node spec/log.mjs` fails a run whose log carries a secret, and a check on every push fails a commit that carries a key.
- **Saved passwords are off by default** and never kept for eBay (eBay signs in with its own OAuth, so we never see that password). Only the sign-in job can read one, only after a session expires, and every read is logged (`app/src/edge/connect/password.ts`, with tests).
- **The AI models never see your credentials.** Cookies go into the browser or a request header and nowhere else; when a page changes, a model reads the page's text to pick the right control, never the session (`app/src/edge/harness/fallback`). Say "AI model providers never see your credentials", not "no third party": the cloud browser host runs the browser your session is loaded into.
- **Open source.** The whole project is public on GitHub under the Apache 2.0 licence (*observed* 2026-11-15). "Don't trust us; read how it treats your account."

## The new framing: it watches and manages your markets

Ben, 06:01 ([words](words.md#2026-11-15-show-the-magic-clips-basement-demos-faster-loops-and-the-intelligence-engine)): "second hand monitors and manages markets for you... official apis and when and how. how there is low risk on your end. an intelligence engine... price anything you own against the market and for the purpose you want." *Agent proposal*. Each line below has the condition that keeps it true.

**The line:** "secondhand watches the market for everything you own, and manages it for you: where to list, what to ask, who to answer, when it sold, and what to take down."

**How we think about each step, said out loud.** Judges score the reasoning, so say why before what:
- *Where to list:* the buyers decide, not the fee. A couch goes to Facebook pickup because Depop ships only and its buyers want clothes.
- *What to ask:* we solve the price from what lands in your account, so you see the same money everywhere.
- *Who to answer:* code decides anything about money or your address; the model only words it.
- *When it sold:* only a paid order counts, and we watch in the cheapest way each site allows.

**Official APIs, when and how.** The rule: use the site's own API wherever one exists for a person like you; otherwise act as you, in your own signed-in session, after your approval, at a person's pace.

| Site | Official route | What we do |
|---|---|---|
| eBay | public API: Inventory to list, Fulfillment and notifications for orders, Negotiation for offers, Browse for search (named in eBay's API docs; some pages we couldn't open, [platform access](../research/connect/nate/platform-access.md)) | the API, signed in with eBay's own OAuth |
| Depop | a partner API with listings, orders, offers and sale webhooks, but only for approved partners (*observed*, partnerapi.depop.com) | apply; until accepted, your own session |
| Facebook Marketplace | a partner program for businesses, EU only, link-out listings (*observed*) | no US route; your own session, and pickups stay yours |
| Poshmark, Mercari | no public API found | your own session; sales seen from the public page |

**Low risk on your end, said precisely.** Say "low", never "no". What we hold fixed: it never sells under your minimum, never gives out your address, never sends a claim your item doesn't back, confirms every action by reading the site back, and stops at a site's first warning. What isn't ours to remove: some sites' terms bar automated access, and an account limit is possible. That's why official APIs come first, and why the app is designed to show each site's risk before you link it ([qa §10](qa.md#10-blockers-and-risks)).

**An intelligence engine.** Built (`app/src/edge/intel`, with tests): one engine plans which sources to ask for a question (a photo, a link, a name), fetches them under a deadline and budget, decides which results are the same product, reconciles sources that disagree, and returns an answer that says what it searched and what it dropped ([intelligence engine spec](../spec/engines/intelligence-api.md)). Run on fixtures and in dated traces, not yet at scale.

**Price anything, for the purpose you want.** The pricing engine is general: comparable sales weighted by type, match, age and how cleanly they were read ([showcase §4](showcase.md#4-pricing-anything-and-how-it-scales)). The same item gets a different answer for a different purpose: sell it fast, only at my price, just checking what it's worth, best price, or reselling. Where the market is thin it says "still learning" and shows a wide range. Claim: "it can price anything that has a market, for what you want to do with it, and it tells you how sure it is." Don't claim it prices everything today; it runs on fixtures, not live market data at scale.

## The three-minute version, with the demo

Follows the [pitch constitution](pitch-constitution.md): one jacket, shown working first, then how we think, told through the jacket. Ben, 06:40 ([words](words.md#2026-11-15-its-always-you-security-open-source-and-show-it-working-first)): show it working first, with real runs, then dig into the engineering. *Agent proposal* for the times.

| Time | Part | Say | Show |
|---|---|---|---|
| 0:00 | Theme and problem | "The theme says start digging. Most of us already have: a closet full of things worth money that never get sold. Consignment pays you $3 of a $20 sale; selling it yourself is five apps." | the $3 against $17 card |
| 0:20 | **It works** | Three photos of the jacket: what it is, its size, its flaws; what you keep on each site; and the site it won't sell on | the camera, the plan, the clock on screen |
| 1:00 | **It's real** | "That's a real listing, on the real site." Then it sells on Depop and comes down everywhere else, each one checked; live, or the recorded run said as one | the site's own page beside ours; [demo reel](demo-reel.md#1-the-evidence-is-the-clip) clips 7 and 11 |
| 1:30 | **How we think** | The jacket's story ([Part IV](pitch-constitution.md#part-iv-the-worked-example-one-jacket)): one record with four views; a price from what sold, wider when the data is thin; your limits, and the offer under your minimum that comes to you; the second buyer we planned for, 931,406 ways; every step written down. One flaw we found in our own work: lining photos up hid a stretch, so we fixed the gate | the offer card; the held reply; the checker in a terminal |
| 2:40 | Close | "We built it for someone clearing out a closet. It does the work; you make the calls. It's open source, and your sign-ins never reach the AI. secondhand: it's always you." | the wordmark |

**Proving it isn't staged.** Three things a staged demo can't do: a judge's own item, the live listing open on the site itself, and the repo public with the benchmark run in front of them. If posting isn't live on the day, say "this part is a recording of a real run from [date]" before playing it.

## The table demo: science-fair judging

Added 2026-11-15 from Ben ([words](words.md#2026-11-15-a-demo-that-stuns-science-fair-judging-and-claims-that-change-how-judges-see-it)): judging is science-fair style, as last year. Judges walk table to table; 6 finalists are chosen; prizes are then judged on the project as a whole. So there are two audiences. In round one, a judge gives us a few minutes among many tables and decides from the first 30 seconds. With finalists, the whole project is judged: demo, Devpost, video, site and repo together. The written parts carry everything we can't show live ([devpost.md](devpost.md)).

### What to show, ranked

Ranked by stun times the chance it works every time, fast, at a table with bad wifi. Each row says what must be true before it goes in the live loop; anything that fails that test is shown as a recording and said to be one. Numbers are from [numbers.md](numbers.md).

| Rank | Moment | Why it stuns | Works every time? | In the loop if |
|---|---|---|---|---|
| 1 | **Their own thing.** "Hand me something from your bag." Photograph it; it's named and priced per site with what you'd keep on each | it's their object, not our rehearsed one; nobody can fake that | depends on the identify route and the network | it identified 9 of 10 random objects in rehearsal, each in under 10 s. Otherwise use our own items |
| 1b | **The same photo, the buying side.** Switch to Find this: the same thing across every site, the fair used price, the total with shipping, and the better official option when new or refurbished is the better buy | one engine for both sides; it widens the audience from sellers to everyone who buys used | depends on the public search readers answering at the table | the search answered in rehearsal on the same items; a slow site greys out, it never blocks |
| 2 | **The photo lie detector.** Paint a stain out of a photo; it's held, with the box that failed. 173 of 174 planted lies caught | answers the mentor's worry in five seconds; visual | yes: no model, runs locally | always |
| 3 | **It sold, in half a second.** Paste any Poshmark listing; it says live or sold in 0.44 s from the public page | real site, real time, no login | yes, if the page shape holds; the fallback recovered 48 of 48 when it broke | always, with a sold listing bookmarked |
| 4 | **The $20 shirt.** Type a price; you keep $18.69 on Depop and $16.00 on Poshmark; to keep $17, ask $18.25 on Depop and $21.25 on Poshmark | the money is the problem statement made concrete | yes: fixed fee table | always |
| 5 | **The couch.** Facebook best; Depop avoid ("ships only, its buyers want clothes"); Poshmark blocked (15 lb cap) | shows judgment, not a copy-paste crosslister | yes | always |
| 6 | **Today.** One feed: a buyer offer, a held reply, a double sale with both buyers and the cost of each cancel, who is coming to a pickup | the finished, un-sloppy UI; human in the loop as a decision | yes on demo data; say it's demo data | the screens render on the phone |
| 7 | **The checker.** 60,936 orderings of posts, payments and delists on 3 sites, and 931,406 on 4: never a silent double sale, never stuck. Break the refund and it fails in 6 steps | for technical judges: we proved it, not hoped | yes: runs in seconds | a technical judge asks "what if both sell?" |
| 8 | **A cloud browser reading a site live.** 48 Poshmark listings in under 4 s, with its live view | the engineering under the hood | network dependent | a recorded run is ready if it stalls |
| 9 | **A real post going live, then taken down** | the whole promise | not yet run on a live account (milestone M7) | it ran end to end on the morning of the 15th; otherwise the recording, said to be one |
| 10 | **Why? on a price, recomputed from its citation on Databricks** | for Databricks judges | only if deployed | the App and tables exist on the workspace |

### The table loop (about 2 minutes, repeatable)

1. **0:00** "What's the last thing you meant to sell and didn't?" Wait for the answer. It makes it about them.
2. **0:10** Moment 1 with their item, or ours. The phone in their hands if they'll take it.
3. **0:35** Moment 1b on the same photo: "and if you wanted to buy one, here's every site at once, and whether this price is fair." Ben, 05:43: show both sides "to capture as much of the audience as possible" ([words](words.md#2026-11-15-both-sides-in-the-demo-why-people-want-it-and-free-as-the-business-model)).
4. **0:50** Moment 4: "and here's what you'd keep on each site." Then moment 5 in one line.
5. **1:05** Moment 6: "after it's listed, this is all you see." One card, one tap.
6. **1:25** Moment 2: "and the photos can't lie." Hand them the side by side.
7. **1:45** "It's live on the web at [site], the video and write-up are on Devpost." Hand them the card with the QR code.

Two people: one demos, one watches the judge's face and takes the hard question (from [qa.md](qa.md)). The laptop beside the phone loops the video muted with captions, so a judge who walks up mid-demo still gets the story.

**At the table, have:** the phone charged and on a hotspot, Do Not Disturb on, demo account signed in; a sold Poshmark listing and the side by side bookmarked; three of our own items (a tee, a shoe, something hard); a printed card with the one-sentence pitch and a QR code to the site and Devpost; the recorded runs queued on the laptop.

## Claims we can make, and what makes each true

Ben asked for claims that change how judges see the project. Each is said only when its condition holds on the day ([qa.md honesty gate](qa.md#before-you-say-it-the-honesty-gate)).

| Claim | True when | Status 2026-11-15 06:00 UTC |
|---|---|---|
| "It's live: try it at [URL]" | the site is deployed and loads on a phone | the website thread is building it |
| "We submitted it to the App Store" | an EAS build was submitted in App Store Connect; show the "Waiting for Review" screen. A TestFlight external beta review is the faster true version. Server-held site sessions may meet App Review guideline 5.1.1(v) ([connect](../spec/features/connect.md)) | not submitted; "App Store coming soon" is the honest line until then |
| "There's a 2-minute video" | it's on Devpost | planned ([pitch-video.md](pitch-video.md)) |
| "173 of 174 planted photo lies caught" | as measured | measured ([numbers](numbers.md)) |
| "60,936 orders of events checked; a double sale is never silent" | as measured | measured |
| "A sale seen in 0.44 s on Poshmark" | as observed | observed 2026-11-14 |
| "What you keep differs by $2.69 on a $20 item, depending on the site" | as measured from fee pages read 2026-11-14 | measured |
| "About 3 to 10 cents to list an item" | say "estimate from list prices" | estimate |
| "1,420 tests run on every push" | CI is green | red on 2026-11-15; fix before saying |
| "184 research notes, 39 dated decisions, 214 quoted product decisions from us two" | counted on the day | counted 2026-11-15 |
| "Every fact links to the photo it came from" | the item screen shows it | designed; say so unless built |
| "Listed in N seconds against M by hand" | the hands-on test in [numbers.md](numbers.md) was run | not run yet |
| "Built in 24 hours by two people, with AI coding agents" | always true, and say it plainly; judges respect the honesty and it explains the volume | true |

## Taglines (both meanings)

- "Your second hand for secondhand."
- "Your second hand. Done in seconds."
- "Sell it in seconds. We'll handle the rest." (from [problem-and-pitch.md](../research/cross-cutting/ben/problem-and-pitch.md))
- "Keep the $17. Skip the work."

## Who it's for, for marketing after the hackathon

Each audience changes which narrative leads. *Inferred*, no data yet on which converts.

| Audience | Moment | Lead narrative |
|---|---|---|
| Students moving out of a dorm | A deadline and a room full of things | B, with folder drop |
| Parents with outgrown kids' stuff | Constant, low-value, high-volume | C |
| Garage-sale and thrift flippers | Buying is the start of selling | E, appraise then list |
| People who've been scammed or worry about meetups | Fear of strangers | D |

## Numbers to measure ourselves before the pitch

The measured and observed numbers, the cost per listing and the hands-on test are in [numbers.md](numbers.md).

These turn asserted claims into our own observed ones:
1. **Stopwatch run.** Ben lists one real item by hand on eBay, Mercari and Depop, then with secondhand. Quote both times.
2. **The $20 table, live.** Run one real item through the Valuation and show its keep-after-fees by site.
3. **Comps count.** How many comps the Databricks table holds by demo time, and from how many sites.
