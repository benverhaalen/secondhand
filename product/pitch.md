# Pitch

How secondhand is told to judges and to users. Every number links to [pitch-evidence.md](../research/cross-cutting/ben/pitch-evidence.md) or [problem-and-pitch.md](../research/cross-cutting/ben/problem-and-pitch.md), where it carries its mark. Everything here is an *agent proposal* until Ben picks; nothing changes the [decisions](decisions.md) (selling leads; appraise and buy are add-ons).

Ben's two meanings of the name, 19:15 ([words](words.md#2026-11-14-pitch-and-structure)):
1. **Your second hand.** It does the actions for you, the way an AI agent does.
2. **The second hand of the clock.** It's fast; you only spend seconds.

The brand thread's recommended wordmark already carries both: the o is a clock with a red second hand.

## The problem in one sentence

For most things people own, there are two ways to sell, and both are bad: hand it to a consignor and keep 15% of a $20 sale, or do it yourself, keep about 85%, and do work that fewer than 1 in 10 cheap listings finish within a month.

That sentence rests on observed numbers (ThredUp's payout table, eBay's fee page, a 33,638-listing eBay study) and is the strongest problem statement we found. It replaced the draft "listing takes too long", because AI drafting is already about 30 seconds at eBay and the listing vendors.

## Five ways to tell it

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
