# Devpost draft

The write-up for the MadHacks 2026 submission. Ben: "considering we can only live demo the app we really need the written portions to convey its use and what it does super well and super easily. we need to be personable." Plain, personal, every claim true on the day: check each number against [numbers.md](numbers.md) and each "it does" against the [honesty gate](qa.md#before-you-say-it-the-honesty-gate). Lines in [brackets] are for Ben or Nate to fill or cut. *Agent proposal*.

Images to put in, in this order: the $3 against $17 card; one phone screen of Today; the keep-per-site table; the couch's site verdicts; [gate-side-by-side.jpg](../scripts/bench/out/gate-side-by-side.jpg); the architecture diagram from the website.

---

## secondhand

**Your second hand for buying and selling used things.** Start with something you own or something you want. Secondhand brings price research, listing decisions and marketplace search into one place.

## Inspiration

[Ben or Nate, add one true sentence about an item you meant to sell and what got in the way.]

Selling a jacket can mean looking up prices, checking fees, rewriting the listing for different sites and keeping track of offers. Finding the right thing used has its own version of the same problem. You repeat a search and still have to work out whether the item fits and what it costs to get it home. We wanted one place to make those decisions.

## Let's dig in

A listing is easy to draft. The harder work starts when you have to decide what a jacket is worth, where to list it, and what to do if two buyers pay. We started with the jacket in the closet and followed those decisions as far as we could.

We dug into the sales behind a price so someone can inspect the evidence. We deliberately changed real photos to see what our checks would miss. We modeled what could happen when one item was listed on four marketplaces, then broke the second-payment rule to make sure the test could catch it. The app should bring the important choices back to the person, with enough context to make the call.

That is what we took from Dean Remzi Arpaci-Dusseau's [Time to Dig](https://cai.wisc.edu/2026/07/01/time-to-dig-founding-dean-essay/). More capable tools give us more responsibility for what they do. For secondhand, that means showing the evidence and giving the person a clear point of control.

### Other openings to consider

Use one of these angles when it matches the strongest evidence in the final pitch.

1. **Dig through the closet.** Start with the real object that sat unsold and the decision that kept it there. End by showing the decision becoming easier. This is easiest for a general judge to retell.
2. **Dig into a number.** Start with a price and follow it back to the sales that supported it. Use the Databricks path and the historical comparison to show why the estimate is inspectable. This gives a data judge a reason to open the technical evidence.
3. **Dig past the happy path.** Start when two buyers pay for the same item. Show what the model allows, what it catches and what still waits for the person. This turns one scenario into evidence of execution and judgment.
4. **Dig into who decides.** Put a low offer or buyer reply on screen. Show what the software prepares, what code checks and what the person chooses. This is the closest fit to the essay's question about who directs a powerful tool.
5. **Dig into what we got wrong.** Start with the photo check that missed a detail or held an honest edit. Explain the tradeoff and the next test. This shows what the team learned from looking for failure.

## What it does

**Selling.** Start with guided photos, review the item facts and compare what you'd keep on each site. Review the listing before it goes live. When a buyer reply needs to go out, the draft is there for you to read and send.

**Buying.** Describe what you want and set the constraints that matter to you. Compare matches by what fits and the total with shipping where known. Open the marketplace to buy.

[Insert confirmed marketplace coverage and demonstrated endpoints for the submitted build.]

## One item, one set of facts

[Show one actual item through Capture, Plan and Post preview. Use a verified marketplace confirmation only if the run includes it.]

We built one item record so the size, condition and flaws stay consistent across listings while each marketplace can have a different preview. The same sale price can leave you with a different amount depending on the site. In our dated $20 example, the modeled take-home was $18.69 on Depop and $16.00 on Poshmark, with the buyer paying $6 shipping and no tax or boost. That is why we put take-home next to the price. [Calculation](../scripts/bench/out/bench-sites-4.json)

## The data architecture driving intelligence

A price is easier to trust when you can see where it came from. Lakeflow checks the incoming records. Unity Catalog keeps the source permissions with them. Delta versions the usable rows. We wrote a SQL function that opens a displayed price to the exact sales it used and checks its recorded basis. MLflow records the data version and parameters behind an evaluation so we can examine what changed when a pricing rule changes.

That made it possible to check whether someone else could rebuild the evidence behind a price. One recorded check rebuilt 42,399 of 42,405 bases. Six did not rebuild and remain open in that record. The workspace guide has the queries and the source artifacts. [Databricks guide](../databricks/DEMO.md) · [Recorded handoff](../.agents/team/packets/team/71-databricks-handoff.md)

## Closer to what buyers paid

For every 1,000 past sneaker sales both methods priced, our research model got about 83 more estimates within 20% of the sale price than a 90-day median. On an item that sold for $100, that means an estimate between $80 and $120.

*Research model, 39,707 paired StockX sales. Test sales from November 2018 through February 2019, limited to new Off-White x Nike and Yeezy 350 sneakers. 98.5% versus 90.2% within 20%. Estimates used earlier sales. See the full population, coverage and other baselines in the [results](../scripts/bench/out/backtest-stockx.json).*

## How deep we dug

- **What if a photo edit changes the item?** We changed real photos on purpose. The check caught 173 of 174 planted edits across 19 photos and held 17 of 38 honest relights. When we found alignment could conceal a stretch, we added a stretch check. [Photo test](../scripts/bench/out/gate.json)
- **What if two buyers pay?** A second payment can happen while a listing is still up elsewhere. Our model checked 931,406 possible states for one item on four marketplaces. Every state with two or more payments was flagged. Breaking the rule produced a six-step counterexample. [Model check](../scripts/bench/out/bench-sites-4.json)
- **What if a site action is uncertain?** The posting code reads back the marketplace state before it treats an action as complete or tries again. That matters when the request failed but the site may already have accepted it. [Posting proof](features-proof.md)
- **When does AI hand back to the person?** A model can help gather facts and prepare words. The product surfaces the decision and the context for the person to act. A buyer reply starts as a draft. The seller reads it and chooses what to send. [Product decision](words.md#2026-11-15-you-send-it-and-if-a-buyer-asks-it-says-so)

[Add paired performance results only after running the same task to the same endpoint. See the [pitch evidence map](pitch.md#what-we-want-people-to-remember) for the scope of speed, cost and competitor claims.]

## What we learned

The interesting problems were never the AI writing. They were the moments where software meets a stranger: a second buyer, a meetup, a sentence that sounds right but isn't true. Deciding exactly when the agent hands back to a person was the real design work.

## What's next

- List 100 real items with students during move-out week, and publish how long it took, how much people kept, and how many sold.
- Apply for Depop's partner API and eBay's Partner Network.
- Cut the cost of watching further with official order events where sites offer them.

## Built with

[Keep only what the build uses: Expo, React Native, Swift, TypeScript, Python, Databricks (Lakebase, Delta Lake, Unity Catalog, MLflow, Databricks Apps), Browser Use Cloud, Playwright, OpenRouter, Seedream, eBay APIs.]
