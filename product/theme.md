# The theme: "Let's dig in"

Ben, 06:35: "the theme is 'Let's dig in' inspired by the book or essay from the uw madison person. but they talk about different ways to interpret this... brainstorm the different ways where what we are doing is special. we should really have a section on whatever we do about this and tailor our presentation or pitch to judges using it." ([words](words.md#2026-11-15-the-theme-lets-dig-in)). *Agent proposal*.

## The source, and how sure we are

**The source (confirmed by Ben, 06:40):** "Time to Dig", an essay by Remzi Arpaci-Dusseau, founding dean of UW–Madison's College of Computing & Artificial Intelligence, dated 2026-07-01 ([cai.wisc.edu](https://cai.wisc.edu/2026/07/01/time-to-dig-founding-dean-essay/), reposted at [stat.wisc.edu](https://stat.wisc.edu/2026/07/01/time-to-dig/)). The [MadHacks site](https://www.madhacks.io/) doesn't name it.

**What the essay says (*observed*, read 2026-11-15):**
- It opens on farming: Russell Lord's 1948 "The Ground from Under Your Feet", about machines changing how the land is worked.
- Its argument: a field's power has to be matched by judgment. The new college should help people decide "not only what we can build, but what is worth building".
- "Instead of technology that feels like it is being done to us, CAI will work towards a future where the power of the tools is clearly for us."
- It closes: "there is only one thing we can do next: start digging, and plant the seeds for our human-driven future." and "The dirt may be fertile, or it may be tough."
- The repost's teaser: the dean "digs deep into the technological moment around us".

## The ways to read "dig in", and where secondhand is special in each

| Reading | What it means | Where secondhand fits | The proof we can show | Strength |
|---|---|---|---|---|
| **1. Start digging** (the essay's own close) | stop waiting; take the first step | most of what people own never gets sold because the first step is five apps. Three photos are the whole first step | clip 1, three photos to a plan ([demo reel](demo-reel.md#1-the-evidence-is-the-clip)) | strong |
| **2. Tools for us, not done to us; power matched by judgment** (the essay's argument) | the AI acts for the person, and a person's judgment stays in charge | this is our design. Code decides money and the address; the model only words things; anything over your line comes to you; it earns "Always do this" after three unedited approvals | the reply queue, the offer card, a held claim ("smoke-free home"); the ways out of every automatic step ([spec](../spec/ways-out.md)) | strongest; say it first |
| **3. What is worth building** (the essay) | judgment about what to build, and what not to | we said no to things on purpose: no auto-accept, no address sharing, no AI photo shown unchecked, no site where the item won't sell (the couch on Depop) | the site verdicts; "What we will not claim" ([numbers](numbers.md#what-we-will-not-claim)) | strong |
| **4. Dig through what's buried** | the closet, the basement, the attic: things worth money that nobody uses | that's the supply. eBay found its sellers had 36 sellable items worth $3,675 at home on average (*observed*, eBay's 2020 report, a sample of people who already sell). We filmed in a basement | the basement clips | strong, and visual |
| **5. Dig like an archaeologist** | unearth a thing, record where each find came from | every fact on an item keeps where it was found: this region of this photo, this line of the tag, "you said". The "I don't know what this is" path for a relative's things | tap "size M" and see the box on the photo | strong for technical judges |
| **6. Dig deep** | examine thoroughly, don't stop at the happy path | we checked every order of events: 60,936 on 3 sites, 931,406 on 4; we broke the refund to prove the check can fail (6 steps); we planted 174 photo lies and caught 173, and found a hole in our own gate on the way | `node scripts/bench/bench.mjs`; `python3 scripts/bench/gate.py` | strong for engineers |
| **7. Dig into the data** | find what the numbers say | the price comes from comparable sales, and it hides itself when they're too few ("3 sales in 90 days"); every number points back to the rows it used (designed) | the Why? on a price, once built ([showcase](showcase.md#2-how-we-use-databricks)) | medium until built |
| **8. Dig in your heels** | hold your ground | it never sells under your minimum; "Only at my price" never drops for you | the lowball offer card | medium; a nice aside |
| **10. Dig into the problem with AI, the unusual way** | use AI where it's strong, and check it with something that isn't AI | the model reads photos and words replies; plain code checks money and facts; the photo check that judges the AI relight has no model in it | the held reply; the photo side by side | strong; the engineering story in one line |
| **11. Dig into the engineering** | how far down we went | a harness per site that reads the site back after every write; a fallback that found 48 of 48 listings when a page changed; a cheap public read that makes watching nearly free | clip 11; the cost table ([numbers](numbers.md#what-it-costs-us)) | strong for engineers |
| **9. Plant seeds** (the essay's farming frame) | what you grow lasts | a sold thing is a thing kept in use instead of in a closet or a landfill. Say it as that, without a footprint number we haven't measured | none; say it plainly | light; one line at most |

The readings that are ours alone are **2**, **5** and **10**. Plenty of projects will say "we dug deep". Few can show a tool that is for the person by design, AI checked by something that isn't AI, and a record where every fact can be traced back to the spot it came from. Lead with 2, prove it with 10, 5 and 6, and use 4 for the picture.

## The theme lines

**Pitch opener (10 s):** "The theme says start digging. Most of us already have: there's a closet or a basement full of things worth money that never get sold. secondhand is the tool that digs in for you, and leaves the decisions to you."

**At the table, if a judge asks how we used the theme (30 s):** "We read it three ways. Dig through what's buried: the average eBay seller has 36 sellable things at home. Dig deep: we checked every order of events for two buyers paying at once, 931,000 of them, and broke our own refund rule to make sure the check can fail. And the essay's own point, that a tool's power has to be matched by judgment: secondhand acts for you, but code checks your money and your address, and anything over your line waits for your tap."

**If the judge knows the essay:** "The dean's line was technology that's for us, not done to us. That's our handoff rule: we worked out exactly when the agent acts and when it hands back to you."

**For the video's first card:** "Let's dig in." over the basement shot, then straight to the three photos.

What not to do: don't say "sustainable" or claim a footprint number; don't stretch the theme over every slide. Once in the opener and once at the table is enough.
