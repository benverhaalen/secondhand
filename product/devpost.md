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

### Dig through your closet

Pull out something you've meant to sell. Before it goes anywhere, you have to work out what it is, what someone would pay and where it belongs. We built secondhand to bring those decisions into one place. Then we turned the same idea around for someone looking to buy.

### How did we do it?

We dug into the tools underneath a simple price. A sale record has a source, a date and rules about how we can use it. Databricks lets us keep that context as records are checked and versioned. We wrote a SQL function so someone could open a displayed price, see the actual sales behind it and check that the evidence matches. The person can use that evidence to make the decision.

### We dug into what we got wrong

Our photo check lined up the original and edited photo before comparing them. We found that lining them up could hide a stretch we needed to catch. We added a stretch check and show both what it caught and how often it held a good edit. That is what we took from Dean Remzi Arpaci-Dusseau's [Time to Dig](https://cai.wisc.edu/2026/07/01/time-to-dig-founding-dean-essay/). If we want people to trust a tool with their decisions, we owe them a way to see how it works and where it fails.

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

## 84% fewer big pricing misses

If a pair sold for $100, a price estimate below $80 or above $120 counted as a large miss. When we tested on past sneaker sales, the 90-day median missed by that much about once in 10 estimates. Our research model missed about once in 65. This is evidence that the model can give someone a starting estimate with fewer large errors in this market.

*Research model, 39,707 paired StockX sales. Test sales from November 2018 through February 2019, limited to new Off-White x Nike and Yeezy 350 sneakers. 98.5% versus 90.2% within 20%. Estimates used earlier sales. [Method and full results](pitch.md#how-we-measured-pricing-misses).*

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
