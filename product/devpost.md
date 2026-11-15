# Devpost draft

The write-up for the MadHacks 2026 submission. Ben: "considering we can only live demo the app we really need the written portions to convey its use and what it does super well and super easily. we need to be personable." Plain, personal, every claim true on the day: check each number against [numbers.md](numbers.md) and each "it does" against the [honesty gate](qa.md#before-you-say-it-the-honesty-gate). Lines in [brackets] are for Ben or Nate to fill or cut. *Agent proposal*.

Images to put in, in this order: the $3 against $17 card; one phone screen of Today; the keep-per-site table; the couch's site verdicts; [gate-side-by-side.jpg](../scripts/bench/out/gate-side-by-side.jpg); the architecture diagram from the website.

---

## secondhand

**Your second hand for buying and selling used things.** We're building secondhand to help you turn a few photos into a plan for selling: what the item is worth, where to list it, and what you would keep after fees. The goal is to handle the work around a sale while you approve the decisions and send the replies. For buyers, the goal is to compare used listings across marketplaces, including shipping.

The app demonstrates that workflow with demo data. Its engines have separate tests and dated live experiments; a complete sale across all five marketplaces is still to be demonstrated. Our historical StockX research benchmark recorded **84% fewer big pricing misses**, with the comparison and limits below. [Feature proof](https://github.com/benverhaalen/secondhand/blob/main/product/features-proof.md).

## Inspiration

[Ben or Nate, one true sentence: the thing you meant to sell and never did, and why.]

Most of what people own and don't use never gets sold. There are two options, and both are bad. Hand it to a consignment store and a $20 shirt pays you $3. Sell it yourself and you keep about $17, if you can face five apps, thirty "is this still available?" messages, a sale on one site while it's still up on four others, and a pickup with a stranger. So it sits in the closet.

AI can already write a listing in seconds. That was never the hard part. The hard part is everything after you post, so that's what we built.

## Let's dig in

We read "Let's dig in" three ways.

**Dig through your closet.** Start with something you meant to sell and never did. In its [2020 Recommerce Report](https://static.ebayinc.com/assets/Uploads/Documents/eBay-Recommerce-Report-2020.pdf), eBay reported an average of 36 sellable household items for its U.S. respondents. Our goal is to make selling it worth the trouble, with you in charge of the price, the conversation and the handoff.

**Dig into the complex tooling.** Follow that item beneath the screen: comparable sales behind a price, fees behind what you keep, and a photo checked against the original. We explored 931,406 states in a model of one item selling on four sites, and planted 174 lies in our photos to find what the check missed. Those are tests of the mechanisms; the complete live selling journey is still to be demonstrated.

**Dig into what we got wrong.** Our first pricing model missed which shoe it was. We changed it to start from that product's own recent sales. On the same 39,707 historical StockX sneaker sales, the research model then made **84% fewer big pricing misses** than the shoe's 90-day sold-price median: **1.5% versus 9.8%** more than 20% from the actual sale price. This was the development window where we found the bug, covering deadstock sneakers from November 2018 to February 2019. It measures historical pricing accuracy, not seller savings or sale speed, and it is not a result for the live app. On 35,862 paired sales from eight unseen months, the fixed model priced 97.5% within 20% of the sale price, against 90.5% for the median. [Development results](https://github.com/benverhaalen/secondhand/blob/main/scripts/bench/out/backtest-stockx.json). [Unseen-month results](https://github.com/benverhaalen/secondhand/blob/main/scripts/bench/out/backtest-stockx-2018-03-to-10.json).

We found a similar failure in the photo check: aligning two images could hide a stretch. The planted tests exposed it, and we changed the check. Digging in means showing what failed and what we learned from it.

The theme comes from Dean Remzi Arpaci-Dusseau's essay ["Time to Dig"](https://cai.wisc.edu/2026/07/01/time-to-dig-founding-dean-essay/), which calls for tools that are "clearly for us". That is the connection to our handoff rule: secondhand helps with the work, and you keep the judgment.

## The workflow we're building

These are the intended selling and buying journeys. The [feature proof](https://github.com/benverhaalen/secondhand/blob/main/product/features-proof.md) distinguishes what is built, measured, observed live and designed.

**Selling.** You take a few guided photos. secondhand works out what the thing is, measures it, and finds what it really sells for. Then it:
- picks the sites where it will sell, and tells you where it won't. A couch goes to Facebook Marketplace, not Depop, because Depop only ships and its buyers want clothes;
- writes a different listing for each site's buyers, at a price worked out from what lands in your account after that site's fees;
- answers buyers' questions with facts from your item, and handles offers inside the lowest price you set;
- notices when it sells, and takes it down everywhere else.

You see one short list of decisions. Anything that touches your money, your address or a stranger waits for your tap.

**Buying.** Type, photograph or paste a link to something you want. One search covers eBay, Depop, Poshmark, Mercari and Facebook Marketplace, plus official stores. You get what it usually sells for, the total with shipping, and a heads-up when new or refurbished is the better buy. Save it, and it watches for you.

**Our goal is a free app.** We plan to fund it through purchase referrals, with referral fees excluded from ranking. Estimated per-item processing costs are only part of that plan; the full operating cost and referral revenue still need to be measured.

## One jacket, start to finish

This is a worked example of the intended journey, not a recorded live sale.

You take three photos of a $40 jacket. It becomes one record: what it is, its size, its flaws, each fact pointing to the spot in the photo it came from. Before anything goes live, it picks the sites and the price from what similar jackets actually sold for, and where there's too little to go on, it says so. You set the limits once; inside them it acts, outside them it asks. Saturday at 2:14 it sells on Depop. From that moment the other listings are a risk, so it takes them down and checks each one is gone. If a second buyer pays anyway, that's a case we planned for: the model explored 931,406 states for one item across four sites and flagged every state with multiple payments. Every step is written down and never overwritten.

## How we built it

**It's open source.** The whole project is public on GitHub under the Apache 2.0 licence. [Add the repo link.]

[Say only what runs on the day; cut the rest or mark it "designed".] The full list, with each feature's proof mark, is [features-proof.md](https://github.com/benverhaalen/secondhand/blob/main/product/features-proof.md); pull from it.

- **One record per item.** Every fact on an item (brand, size, a stain) keeps where it came from: a region of a photo, a line of the tag, a measurement, or "you said". Listings for every site are built from that record.
- **A harness for each marketplace.** eBay through its official API. For the others, your own signed-in session runs in a cloud browser (Browser Use Cloud) and does each action the way the site's own web app does it, then reads the site back to confirm. Nothing counts as done until the site shows it.
- **Seeing a sale without watching all day.** A sold Poshmark or Mercari listing stays public with a sold mark, so we check the public page, which took 0.44 seconds in one observed read, and use a signed-in browser for actions that require one.
- **A fee engine.** One dated row per site per fee. On a $20 item you keep $18.69 on Depop and $16.00 on Poshmark; to keep $17 you'd ask $18.25 and $21.25.
- **Photos that can't lie.** Clean up only adjusts the light in your own photo. AI relighting is optional, labeled, and checked against your original before you see it: color, structure, and every logo, tag and flaw box. The AI doesn't keep sizes on its own: on a tee that tapes 21.25 in across, it drew 18.6 in, and all 15 raw redraws came out 8 to 21% narrow. So every AI photo is measured against your tape before it posts, set back to the measured shape or thrown out; the three published slides landed within 1.2%. That's one tee so far, not a rate. The real photo is always first.
- **Databricks** [only what's deployed]: live state in Lakebase, every event and comparable sale in Delta tables, photos in a Unity Catalog volume, every model call through one gateway, and every agent step as an MLflow trace that the app shows when you tap Why?.
- **The phone app** is Expo with a native Swift camera module; the website is the same app on the web.

## What's new here

Three things we haven't seen another tool do (we checked the crosslisters, the price-check apps and the photo tools first; [details](https://github.com/benverhaalen/secondhand/blob/main/product/unique.md)):
- **We proved a double sale can't go unnoticed.** Every order of events for one item on four sites, 931,406 of them, ends with you seeing it. Break the refund rule on purpose and the check fails in 6 steps.
- **AI photos are checked by something that isn't AI.** Other photo tools grade AI edits with another model. Ours compares the edit to your photo with plain image math, protects every logo, tag and stain one by one, and shows your real photo when in doubt: 173 of 174 planted lies caught.
- **A reply can't say what your item doesn't back.** Every claim in a draft is matched to a fact on the item before it can be sent; "smoke-free home" with nothing behind it is held for you.

## How deep we dug

The theme says dig. We took it literally, on the product and on how we built it. The links below lead to the decisions, checks and measured results.

**How the project was made**

- **Every decision has a reason someone can check.** The project records who made each decision and why ([decisions](https://github.com/benverhaalen/secondhand/blob/main/product/decisions.md)). The decision record links to what Ben and Nate said ([words](https://github.com/benverhaalen/secondhand/blob/main/product/words.md)). Nothing gets marked decided without one of them agreeing.
- **The rules are written down, then enforced by code.** A brand constitution, a UI constitution and a pitch constitution give a reason for every rule. The repo records UI rules and checks them in code ([checks](https://github.com/benverhaalen/secondhand/blob/main/.agents/checks)). For example, the render check limits Clofie to the wordmark and lead public-page headlines.
- **Research before building.** The research notes mark what we observed, what a source said and what we inferred ([research](https://github.com/benverhaalen/secondhand/blob/main/research)). Pricing alone has 32 money rules and 29 market rules, each with its method, when it's shown, when it's hidden, and how we'd know it was wrong ([money](https://github.com/benverhaalen/secondhand/blob/main/spec/determinations/money.md), [market](https://github.com/benverhaalen/secondhand/blob/main/spec/determinations/market-insight.md)).
- **Everything is logged against one contract**: 27 event kinds, personal data masked, and a checker that replays a run and fails on a leak ([log](https://github.com/benverhaalen/secondhand/blob/main/log/README.md)).
- **A backtest designed before any data, so it can't be tuned to flatter us.** 32 decisions: how to split by time so nothing leaks, what to compare against (the eBay sold median people look up today), why the headline is "within 20%" when identical items resell about 11% apart, and how to test the test itself ([plan](https://github.com/benverhaalen/secondhand/blob/main/spec/plans/backtest/plan.md)).

**Technology used in ways we haven't seen**

- **A model checker for selling one thing in four places.** The model explored 931,406 states for one item on four sites, including simulated failures. It flagged every state with multiple payments and caught a deliberately broken refund rule in six steps. [Model results](https://github.com/benverhaalen/secondhand/blob/main/scripts/bench/out/bench-sites-4.json).
- **AI photos measured against the item.** The AI on its own drew a tee that tapes 21.25 in across as 18.6 in, and all 15 of its raw drafts came out 8 to 21% narrow. Every published slide landed within 1.2%, because each redraw is measured against the tape, set back to the real shape or thrown out ([measure proof](https://github.com/benverhaalen/secondhand/blob/main/research/studio/ben/measure-proof.md)). On LiDAR phones the measurement comes from the capture itself (designed; Ben's call). The same check catches 173 of 174 planted lies with plain image math, not another model.
- **A used item priced like a thinly traded asset.** A hedonic model with calibrated ranges and comparable sales weighted by how close they are, across sites, after collapsing a cross-post into one sale ([market.py](https://github.com/benverhaalen/secondhand/blob/main/jobs/valuation/market.py), [cluster.py](https://github.com/benverhaalen/secondhand/blob/main/jobs/identity/cluster.py)). With too few sales, it refuses to give a price and says why.
- **Identification that knows when it isn't sure.** Four ways of recognising an item run at once, and a conformal set decides how many candidates to show you, so "not sure" is measured, not guessed ([ladder.py](https://github.com/benverhaalen/secondhand/blob/main/jobs/identity/ladder.py)).
- **Site readers that repair themselves.** When a page changes, a fast typed model picks which data on the page are the listings, reading text only, and the fix becomes the new recorded step: 48 of 48 listings found in 0.64 s (observed).
- **Databricks as the place every learned number lives.** Each learned weight is a versioned row; a nightly job fits a challenger and promotes it only when it beats the current one on held-out data, with a rollback ([registry.py](https://github.com/benverhaalen/secondhand/blob/main/jobs/param/registry.py), [bundle](https://github.com/benverhaalen/secondhand/blob/main/deploy/databricks.yml)). Sign-ins sit in a secret scope readable only by the sign-in job. Genie answers questions over our market tables with the query it ran.
- **Codex as an image pipeline with a judge.** Every image is its own fresh Codex call with nothing but the sign-in, told how it will be judged rather than what to draw; a separate call critiques it. Cleaning out the context cut Codex's fixed cost per call from 9,030 tokens to 4,089 (measured, [image-gen](https://github.com/benverhaalen/secondhand/blob/main/.agents/skills/image-gen/SKILL.md)).
- **An API for other AI agents.** Search, prices, history and trends as MCP tools, serving only data we're allowed to share and never anything about a person ([mcp.ts](https://github.com/benverhaalen/secondhand/blob/main/app/src/edge/mcp/mcp.ts)).
- **One Expo app for phone and web**, with EAS build profiles set up for a first TestFlight build, and native screen tests in Swift ([eas.json](https://github.com/benverhaalen/secondhand/blob/main/app/eas.json)).

## Keeping a human in the loop, on purpose

We didn't want an agent that acts alone. In September, an assistant on another platform, set to "Allow Always", accepted a lowball offer and sent a stranger to a seller's home. So:
- **Code decides, the model words it.** Offers are checked against your minimum by plain code. Every sentence the agent wants to send is matched to a fact on your item first; a claim it can't back ("smoke-free home") is held and shown to you.
- **It earns trust slowly.** After you approve the same kind of thing three times without changing it, it offers "Always do this". Your address, payments and off-site deals can never be automatic.
- **Your sign-ins stay locked away.** Marketplace sessions live in a Databricks secret scope, never in a log or a prompt; the AI models never see them. Saved passwords are off unless you turn them on, and never kept for eBay.
- **You can check everything.** Every automatic action has a Why? and a link to the same thing on the site.

## Challenges

- **Two sites can sell the same thing at once.** Our three-site model reached 60,936 states for one item. We checked whether each simulated second payment triggers an alert. We broke the refund rule on purpose to make sure the check can fail: it found the double sale in 6 steps.
- **Proving an AI photo is honest.** We painted out details, swapped tag text, stretched, shifted colors and mirrored Ben's own photos, then checked whether the gate caught them: 173 of 174. The test found a hole first (lining the photos up undid a stretch), so the gate now checks for stretch too. It's cautious, and holds about half of the honest relights too; when it holds one, you get your real photo instead.
- **Sites that refuse robots.** Depop and Mercari turned away a headless browser, so each site's harness is built from how that site actually works, and every action falls back to typed steps, then to an agent, when a page changes.
- **Cost.** An always-open browser would be expensive. We’re testing public reads as a cheaper check when the marketplace shows the listing status.

## Accomplishments we're proud of

- [Live on the web at URL.] [Submitted to the App Store / App Store coming soon.]
- 173 of 174 planted photo lies caught; 76 of 76 cleaned-up photos within the color limit.
- The four-site model flagged every simulated state with multiple payments.
- The frozen research model priced 97.5% of 35,862 paired sneaker sales within 20% of what buyers paid in eight unseen months.

## What we learned

The interesting problems were never the AI writing. They were the moments where software meets a stranger: a second buyer, a meetup, a sentence that sounds right but isn't true. Deciding exactly when the agent hands back to a person was the real design work.

## What's next

- List 100 real items with students during move-out week, and publish how long it took, how much people kept, and how many sold.
- Apply for Depop's partner API and eBay's Partner Network.
- Cut the cost of watching further with official order events where sites offer them.

## Built with

[Keep only what the build uses: Expo, React Native, Swift, TypeScript, Python, Databricks (Lakebase, Delta Lake, Unity Catalog, MLflow, Databricks Apps), Browser Use Cloud, Playwright, OpenRouter, Seedream, eBay APIs.]
