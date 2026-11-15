# The demo constitution

What runs live in front of a judge, in what order, and what happens when something breaks. How the story is told around it is the [pitch constitution](../pitch-constitution.md); the beat-by-beat scripts are in [showcase.md §3](../showcase.md#3-the-full-demo-start-to-end-both-sides), [live-buy-demo.md](../live-buy-demo.md), [demo-reel.md](../demo-reel.md) and the ranking in [features-proof.md](../features-proof.md#what-to-show-ranked). *Agent proposal*; retires after MadHacks judging.

## The problem

A judge at a science-fair table gives each team a few minutes, among dozens, and six teams go on to the finals ([05:41](../words.md#2026-11-15-a-demo-that-stuns-science-fair-judging-and-claims-that-change-how-judges-see-it)). They have seen staged demos and AI-made mock-ups all day, so anything polished reads as fake. secondhand's value happens over days and across five sites we don't control: buyers write, an offer comes in, it sells on one site and comes down from four. The demo has to compress that into minutes, live, on real sites, with nothing failing, and leave the judge sure of two things: it is a working product, and a person stays in charge of every step that matters.

**Success, checkably:** after the table, a judge can name one thing they saw happen that a mock-up couldn't do; no beat fails without a rehearsed fallback taking over in under ten seconds; both selling and buying were shown; and it fit the time.

## Ends

| End | Test |
|---|---|
| They believe it's real | Every live beat touches a real site, a real phone or a real object in the room |
| They are stunned by how finished it is | No loading screen without a reason on it, no dead tap, no AI-looking screen ([05:41](../words.md#2026-11-15-a-demo-that-stuns-science-fair-judging-and-claims-that-change-how-judges-see-it): "judges question how we did it in 24 hours") |
| They see the human in the loop | Each beat has one visible moment where the person approves |
| They see both sides | Selling and buying are both shown ([05:43](../words.md#2026-11-15-both-sides-in-the-demo-why-people-want-it-and-free-as-the-business-model)) |

## Rules

**D1. Show it working first, explain after.** Demo, then the engineering behind it. *Why:* "make sure its clear that its an actual working product not a staged demo. and then dive into the engineering" ([06:40](../words.md#2026-11-15-its-always-you-security-open-source-and-show-it-working-first)); "the best is just showing the magic of it" ([06:01](../words.md#2026-11-15-show-the-magic-clips-basement-demos-faster-loops-and-the-intelligence-engine)).

**D2. A beat runs live only after three clean rehearsals.** Rank beats by how much they stun times how reliably they run; anything below the line is a clip of the same beat. *Why:* Ben asked for "the ranking of demoing capabilities. where we can show it to anyone live and it works so well and so fast that we just stun everyone" ([05:41](../words.md#2026-11-15-a-demo-that-stuns-science-fair-judging-and-claims-that-change-how-judges-see-it)); a failed live beat costs more than a clip.

**D3. Every live beat has a fallback and a time budget.** The fallback is a recording of the same beat, never a different one, and the presenter says it is a recording. *Why:* nothing said may be false on the day ([pitch E6](../pitch-constitution.md#part-i-ends)).

**D4. The candidate live beats, in Ben's words.** (a) A real object in the room becomes a listing, with ranked guesses the person picks from ([08:09](../words.md#2026-11-15-quantify-everything-a-why-for-every-rule-ranked-identify-and-revenue-streams): "photo to listing we can test irl with like a chair or my headphones"). (b) One draft posted to five sites at once, after toggling the plain and the AI photo fixes on and off, with AI-filled fields in their own color ([08:12](../words.md#2026-11-15-a-live-five-site-post-with-the-photo-toggles-and-ai-filled-fields-in-their-own-color)). (c) Nate posts a matching item and Ben's phone pings ([07:46](../words.md#2026-11-15-demo-the-buy-side-live-nate-posts-and-my-phone-pings)). The order and cut line come from D2.

**D5. The hand-off is on screen.** Every beat stops once for the person: approve the price, pick the match, send the reply. *Why:* "a main principle in this app is human in the loop behind decisions. this is how we are justifying automated access to the judges" ([round 10](../words.md#2026-11-15-round-10-picks)); shown as a decision, never a slogan ([04:12](../words.md#2026-11-15-human-in-the-loop-is-a-decision-not-a-line)).

**D6. Demo accounts only.** Never Ben's personal Depop ([05:54](../words.md#2026-11-15-stop-using-my-personal-depop)). Demo data is fine where a site can't be touched, and is named as demo data if asked ([live-buy-demo, what to say](../live-buy-demo.md#what-to-say-and-not)).

**D7. Claims at the table are only ones true on the day.** Ben's list: applied to the App Store, the deployed site, the video, the Devpost ([05:41](../words.md#2026-11-15-a-demo-that-stuns-science-fair-judging-and-claims-that-change-how-judges-see-it)). Each is said only once it has happened; the [honesty gate](../qa.md#before-you-say-it-the-honesty-gate) decides. The App Store is said as "coming soon" ([08:33](../words.md#2026-11-15-nano-banana-stays-app-store-coming-soon-the-voice-waits)).

**D8. Resetting a demo takes one command.** Any beat can be rerun from a clean state in under a minute, so rehearsals are cheap ([06:01](../words.md#2026-11-15-show-the-magic-clips-basement-demos-faster-loops-and-the-intelligence-engine): "make the demoing loops faster"; [demo-reel §3](../demo-reel.md#3-faster-demo-loops-website-and-app)).

**D9. Every point a judge could dock is answered somewhere in the demo or the Q&A.** *Why:* [05:36](../words.md#2026-11-15-what-could-dock-us-points-mitigated-everywhere); the list is [qa.md](../qa.md#where-judges-dock-points).

**D10. A stage rate is a number, never a label, and never a secret.** On stage a check may run faster than in the product (a sale check, a want's search), or fire at once for a post we made ourselves. The speed is a server setting on the same code path, so nothing on screen says "demo" ([08:42](../words.md#2026-11-15-the-demo-runs-on-nates-harness-and-the-cadence-is-a-lever): "a demo mode that never says demo mode for the backend"). If a judge asks, we say the stage rate is faster than production, and give the production rate. *Why:* proof without sales allows a compressed clock, not a false one ([proof-without-sales](../proof-without-sales.md)); the production rates for a want are in [live-buy-demo](../live-buy-demo.md#what-to-say-and-not).

## Open

- Which beats pass three rehearsals. Nothing has been rehearsed end to end yet; the five-site post and ranked identify are not built (see the [ledger](../../spec/intent-ledger.md)).
- Ben's 07:51 question, "is there any downside to doing it on the dev acct?", has no recorded answer.
