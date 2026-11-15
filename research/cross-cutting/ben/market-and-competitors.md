# Market: which problems are real, who else solves them, and where we fit

Researched 2026-11-15 by Ben (Claude Code agent, pitch thread "Frame the problems and beat competitors"), for Ben's ask: break the ideas into a few separate problems, test each against whether real people ask it, compare us to the competitors, quantify the difference, and give an opinion. Builds on the pitch thread's `pitch.md`, `business.md` and `qa.md` (project files, not in the repo), [numbers.md](../../../product/numbers.md), [pitch-evidence.md](pitch-evidence.md), [crosslister-teardown.md](../nate/crosslister-teardown.md) and [existing-tools.md](../../appraise/ben/existing-tools.md), and does not repeat them.

A copy of the pitch thread's working file, kept here so it stays with the product. The pitch thread edits its copy; this one is updated when that changes. The mechanisms in it that Ben approved were applied to the spec: [risk-and-reconciliation.md](../../price/ben/risk-and-reconciliation.md).

Method: RDD with IAE (assume someone already solved each piece, find them, take the mechanism). Three seeded loops: competitors and their pitches; demand signals (Reddit, surveys, app and search numbers); data buyers, brand premiums, environment and partnerships. Marks as in the repo: *observed* (the page was opened and says it), *asserted* (a source says it without showing how, or a vendor's own claim), *inferred* (my reasoning), and **speculation** where it is a bet about the future. Everything here is an *agent proposal* until Ben or Nate picks.

## My answer first

**Lead with one problem, the one people actually type: "Is this worth selling, and for how much?"** It is the most-asked question in every place I looked, it is the question that decides whether an item ever leaves the closet, and it is the one where our engine does something the others don't: it answers *where* and *how much you keep*, then does the work if the answer is yes. Everything else either supports that (sale detection, trust, site choice) or is a later stage (business data, brand insights, partnerships).

Four things changed from my draft, and they matter for the pitch:

| My draft before searching | What the evidence says |
|---|---|
| dupe.com and ThriftX are the closest rivals | **ThriftX is not a company I can find**: a GitHub repo with 0 stars, a UK shell company and social accounts (*observed*). The real buyer-side rival is **Phia** ($43.5M raised, 1.5M users, 350M products, *observed* via press). Dupe.com is new goods, not used, and earns from affiliate links, including eBay's (*observed*). |
| "Semrush for resale" is the business story | The consumer version already exists and is cheap or free: eBay gives sellers 3 years of its own sold data in Seller Hub (*observed*), WorthPoint sells about 1 billion sale records for $29.99 a month (*observed*). The people who pay real money for used-item values are **insurers** and **investment funds**, and two of them are MadHacks sponsors (American Family, Susquehanna). |
| The environment is a strong headline | It is quantifiable (WRAP: 5 used items bought replace about 3 new ones, *observed*), but nobody asks a selling app to save the planet. It is a closing line with a number, not a problem. |
| "The brand adds X value" is a consumer hook | Real and well measured only for luxury bags (Rebag) and sneakers (where premiums are falling). For mainstream brands, the public numbers are vendor blogs with no method. **That gap is the opportunity**: we could publish the first honest brand resale index for ordinary brands. It is a business product, later, not a demo beat. |

The honest twist that makes us credible: for most cheap things, the right answer is "don't bother, donate it". r/declutter's own guide says "Your stuff is worth less than you think it is" (*observed*). An app that tells you in ten seconds "these three are worth $90 to you, these twelve aren't worth the trip" is more trustworthy than one that tries to list everything. **Triage is the product's first act, and it is the thing nobody else does for a non-reseller.**

## The problems, tested against demand

Each row is a problem in the words a person would use. "Source" is where it came from: pitch.md, Ben's message, or mine. "Asked?" is the evidence that real people ask it. Verdict: **Lead**, **Support** (true and shown, not headlined), **Later** (a stage, said as a plan), **Cut** (from the pitch, not necessarily from the app).

| # | The problem, as a person says it | Source | Who | Asked? (evidence) | Strength | Verdict |
|---|---|---|---|---|---|---|
| 1 | "Is it even worth selling, or should I just donate it?" | pitch.md (narrative C), Ben | People clearing out | UK Post Office/OnePoll, n=2,000: 31% don't sell unused things because it is "too much effort", 30% "don't think their belongings are worth much" (*observed*). MagnifyMoney/Qualtrics, n=1,013, 2021: 41% usually donate against 30% who sell online; 65% have a bag or box waiting to go (*observed*). CNET 2024: 33% say reselling a phone "just isn't worth the hassle" (*observed* via MacObserver). r/Flipping, Apr 2025 (86 upvotes, 129 comments): "Shipping and fees absolutely decimates low value items" (*observed*). r/declutter made a mod policy in Oct 2023 to cut down "how do I sell X?" posts because there were so many (*observed*). | Strong, repeated across surveys and forums | **Lead** |
| 2 | "What is this worth?" | Ben ("we can tell the value"), appraise feature | Everyone | r/whatsthisworth's front page is nothing but this question ("How much is this worth?", "Are they worth something?", *observed*). Its rule 1 bans common items "where the price can easily found on Ebay" (*observed*): for common things, people already know where to look; they ask strangers only for odd ones. Dozens of "Thrift AI profit" scanner apps on the App Store (*observed*). WorthPoint sells ~1B sale records at $29.99/mo (*observed*). Google Lens: 25B visual searches a month, 20% with commercial intent (*observed*, Google VP quoted by Asia Business Daily, Mar 2026). Swappie/OnePoll, n=8,000: 25% say "a clear, live estimate of what a device is currently worth" would make them sell sooner (*observed*). | Strong; crowded for single lookups | **Lead, merged with 1**: the value answers the "worth it?" question |
| 3 | "Where should I sell this?" | pitch.md (the couch on Depop), mine | Sellers | CNET 2024: 21% don't know where to resell a phone (*observed*). Every crosslister writes "best place to sell clothes online" and "Depop vs Poshmark" pages (Vendoo, Nifty, Crosslist, Voolist, *observed* in search results); vendors write SEO pages where search volume is (*inferred*). r/declutter's guide has a heading "Where can I sell items?" (*observed*). | Medium | **Support**: it is part of the answer to 1, shown as the per-site "you keep" |
| 4 | "I sold it on two sites at once" / "delisting everywhere is a pain" | pitch.md, qa.md | Resellers who crosslist | Vendors build whole paid tiers around it (List Perfectly's Auto Delist is Pro Plus only; Nifty and Closo document auto-delist, *observed*). Vendoo Trustpilot reviews of missed sales Jul to Oct 2026 (*observed* in Nate's teardown). Poshmark's 2025 crackdown hit crosslisters who delete sold items (*observed*). | Strong, but among resellers already served by tools with 81,000+ users | **Support**: proof we are reliable (60,936 states checked), not the headline |
| 5 | "Selling to strangers is exhausting or unsafe" | pitch.md (narrative D) | Facebook and local sellers | "Is this available?" is a running joke with its own essays and forum threads (*observed* in search results). r/Flipping titles on scammers and lowball offers (*observed*). NYPD: 90 Marketplace-linked robberies by mid-May 2024 against 58 the year before (*observed*, pitch-evidence). | Medium; people complain, rarely search for a fix | **Support**: the trust beat |
| 6 | "Listing takes too long" | pitch.md (narrative B, already demoted) | Sellers | List Perfectly sells "list 80% faster" (*asserted*); eBay says AI cut listing steps by 50% (*observed*). The fix is already a commodity. | Real but solved | **Cut as a problem**; keep the clock as the demo |
| 7 | "Find me the cheapest used one" / "Is this a fair price?" | Ben ("get the user the cheapest items"), buy feature | Buyers | Phia: 1.5M users in about a year, $43.5M raised, valued at about $180M in Dec 2025 (*observed* via press). Dupe.com: 6.1K App Store ratings at 4.8, 40,000 Chrome users (*observed*). Onton (AI furniture shopping): 2M monthly users, $7.5M raised (*observed*, TechCrunch Nov 2025). | Strong and proven, but crowded and funded | **Support**: the same photo answers the buy side; don't pitch against Phia head-on |
| 8 | "Track my earnings" | Ben | Resellers | Many spreadsheets and tracker apps exist (Closo, Underpriced, Vendoo's own profit tracking, *observed* in search results). r/Flipping: "what's the best online accounting software" (*observed*). | Real for resellers, weak for someone clearing a closet once | **Cut from the pitch**; a Records screen with the 1099-K figure is enough |
| 9 | "Get me the most money" vs "get rid of it fast" | Ben ("maximize for the user's goals") | Sellers | Not asked in those words. Asked indirectly: "I'd rather not slash prices or deal with consignment delays" (r/Flipping, *observed*); only 8.6% of eBay listings under $15 sell within 30 days (*observed*, FlowLister). | Implicit | **Support**: say it as how pricing works ("fast, or at my price"), not as a problem |
| 10 | "Is this rare?" / "How much does the brand add?" | Ben ("brand adds x value", "rarity") | Consumers: odd items. Businesses: brands | Consumers: r/whatsthisworth posts like "Are these rare or just homemade hair pins?" (*observed*). r/declutter's guide: "only designer or desirable vintage clothing in excellent condition sells well" (*observed*). Businesses: brands treat their resale programs as "a data collection play" (Modern Retail, 2023, *observed*); Archive runs resale for 50+ brands and has raised $54M (*observed*, TechCrunch 2025). | Consumers: medium. Businesses: real, but they buy it from resale operators today | **Later**: a brand resale index, see below |
| 11 | "What is this used thing actually worth?" (for an insurance claim) | mine, from the sponsor list | Insurers | Verisk's contents pricing is "used by eight of the top ten insurers in the United States" and prices from current *retail* feeds, then applies life expectancy and depreciation formulas to get actual cash value; it does not mention used-market prices (*observed*, Verisk whitepaper). Enservio: 17M products, nightly prices, "Like Kind and Quality" matching (*observed*). 30.2% of Americans say none of their valuables are insured (Compare the Market, n=1,000 US, 2024, *observed*). | Real buyer, real budget; whether they want market prices instead of formulas is untested | **Later, speculation** |
| 12 | "Is resale demand for a brand a signal?" (for traders) | mine, from Ben's Semrush/SERP idea | Investment funds | Investment managers spent about $2.8B on alternative data in 2025, up 17% (Neudata, Feb 2026, *observed*); the average dataset earns its vendor $1.1M a year (Neudata, Feb 2025, *observed*). A 2026 article calls StockX and GOAT search "a leading indicator of consumer intent" (*observed*, vendor-adjacent). | Real buyer; needs scale we don't have | **Later, speculation** |
| 13 | "I want my stuff not to end up in a landfill" | Ben ("helps the earth") | Everyone, stated | People say it in surveys; I found no one asking a selling app for it. Depop/WRAP: 71% of buyers would keep searching or not buy if a used item weren't there; only 6% would buy new fast fashion instead (*observed*). | Stated, not a driver | **Support**: one quantified line at the close |
| 14 | "Can the marketplaces work with us instead of against us?" | Ben ("partner with these selling sites") | The sites | ThredUp's 2026 report names "Supply, Not Demand" as the market's constraint (*observed*). eBay paid about $1.4B for Depop, closed July 30, 2026, and keeps it as its own brand (*observed*, Shopifreaks). Depop runs a partner API (*observed* earlier at partnerapi.depop.com; this pass could not open it). | Plausible; no site has said yes to us | **Later, speculation** |

**What I cut, and why.** Speed (6) is a solved problem; eBay and the listing tools already sell it. Earnings tracking (8) belongs to resellers and is crowded. Business data (11, 12) and partnerships (14) are real markets, but saying them as present-day value would be overclaiming: we hold almost no rows today. They go in the pitch as one honest sentence about where the data leads.

## Competitors, and how each pitches

Verbatim lines are from each company's own page or app listing unless noted.

| Who | Their line | Customer | Numbers | How it earns | What it doesn't do that we do |
|---|---|---|---|---|---|
| **Vendoo** | "The Best Crosslisting Platform for Resellers" | Resellers | "81,000+ resellers", "78 M" listings created; "Users who list on 3 or more marketplaces have a sell-through rate 180% higher" (*asserted*, vendor); YC W22; 2020 revenue $1.4M with 11,000 paid users (*observed*, FreightWaves 2021) | Subscription | Starts from a listing, not from a photo of an unknown thing; polls for sales every 10 minutes with your browser open (Nate's teardown); built for people with inventory, not a closet |
| **List Perfectly** | "Your AI-Powered Listing Assistant"; "the #1 Way to Crosslist" | Resellers | "Average customers list 80% faster" (*asserted*) | Plans; auto delist only on Pro Plus | Same as Vendoo; a sale on a lower tier only alerts you |
| **Phia** | "AI-powered shopping platform and browser extension" that helps people "find resale alternatives" | Fashion shoppers | $43.5M raised; 1.5M users; 350M products; about $180M valuation (Dec 2025); "50% reduction in return rates" (*asserted*) | Not stated in what I opened; brand partnerships | Buyer side only; doesn't sell your things |
| **Dupe.com** | "Find similar products for less", "up to 90% off" | Furniture and fashion shoppers | 6.1K ratings, 4.8 (App Store); 40,000 Chrome users, 4.7 (*observed*) | Affiliate: "As an eBay Partner Network Affiliate, Dupe earns from qualifying purchases" (*observed*) | New lookalikes, not used; no selling. Note: its model is exactly our buy-side model, which is evidence it works at small scale |
| **Onton** (formerly Deft) | "AI-powered furniture shopping platform" | Furniture shoppers | 2M monthly users; $7.5M raised (*observed*, TechCrunch Nov 2025) | Not stated | Buy side only |
| **"Thrift AI" scanners** (ThriftLens, ThriftAI, Thrift Pal and many more) | "AI Thrift Profit Identifier" and similar | Thrift flippers | Many near-identical apps on the App Store (*observed*) | Subscriptions | Stop at a verdict; mostly eBay sold data; don't list or learn from your outcome (existing-tools.md) |
| **ThredUp Clean Out** | "making the act of selling just as easy as clicking 'buy'" | People clearing closets | Pays 15% of a $20 sale (*observed*, pitch-evidence) | Keeps most of the sale | Takes the money: the $3 against $17 |
| **eBay itself** | AI listing; Product research (Terapeak) | Its sellers | "the last 3 years of eBay sales data for millions of items", free in Seller Hub (*observed*) | Fees | One site; its research is eBay only |
| **WorthPoint** | Price guide for antiques and collectibles | Collectors, appraisers | "approximately 1 billion historical sales records"; $29.99/mo or $305.90/yr (*observed*) | Subscription | Lookup only; collectibles |
| **Archive, Trove** | Resale-as-a-service for brands | Brands | Archive: 50+ brands incl. New Balance and The North Face; $54M raised (*observed*) | A cut of each resale | Run a brand's own resale store; not the person's closet |

**What the competitors tell us about pitching.** The funded ones each own one sentence: Vendoo "list everywhere", Phia "find it secondhand", Dupe "the same for less", ThredUp "we do it for you". None claims both sides, and none claims triage. The two crowded spaces are crosslisting for resellers and price-comparison for buyers; the open space is the person with a closet who doesn't know what's worth anything (*inferred*).

## How we differ, quantified, and shown rather than said

**What we can show today** (all from `product/numbers.md`, re-runnable):

| Claim | Number | Mark | The rival's number |
|---|---|---|---|
| Choosing the site is worth money on its own | $2.69 on a $20 item ($18.69 on Depop against $16.00 on Poshmark); $16.05 on $100 | measured | Crosslisters copy one price to every site (*inferred* from their pitch) |
| A sale is seen and every other listing comes down fast | about 4 minutes worst case by design; a Poshmark sale seen in 0.44 s | design budget; 0.44 s observed | Vendoo: a 10-minute poll, then the delist, with your browser on (*observed* in Nate's teardown) |
| Double sales are never silent | 60,936 event orders on 3 sites, 931,406 on 4, none stuck | measured | No rival publishes one |
| AI photos can't lie about the item | 173 of 174 planted lies caught | measured, on our own planted edits | No rival publishes one |
| Consignment against us on a $20 item | $3 against about $17 | observed fee tables | ThredUp 15% payout |

**Why our data could be better, said precisely.** Today we have almost no rows, so "our data is better" is false as a present-tense claim. What is true is the *shape* of the data the product collects, which no single rival collects all of:

| What a row knows | eBay research | WorthPoint | Phia | Vendoo | Thrift scanners | secondhand (designed) |
|---|---|---|---|---|---|---|
| Sold price | eBay only | yes | no (asking prices) | its users' sales | eBay sold, mostly | yes, every site we watch |
| Days to sell | partly | no | no | yes | no | yes |
| Items that never sold | partly | no | no | yes | no | yes, kept as censored rows |
| Condition, measured from photos | no (seller's word) | no | no | no | no | yes, each fact points at a photo region |
| Same item on several sites at once | no | no | no | yes | no | yes |
| Buyer questions and offers | eBay only | no | no | no | no | yes |
| Who the seller is (a closet, not a reseller) | mixed | n/a | n/a | resellers | flippers | people clearing out |

Two of those columns are the real difference. **Measured condition** is the variable everyone else leaves to the seller's word, and condition is a large part of used price (*inferred*). **The same item listed on several sites at once** is a natural experiment on which site pays more for that item; Vendoo has this too and already mines it ("180% higher sell-through", *asserted*), so we should say "like Vendoo, but with the condition verified and for people who aren't resellers", not "nobody has this". The constraint: eBay's API licence is read as barring price modelling on eBay content (*asserted*, flagged in `research/price/ben/sold-price-data.md`), so eBay rows stay out of models until a licence says otherwise.

**The way to show it, not say it** (*agent proposal*): on stage, tap one price and open its citation, the comps it used, each with its site, date, condition and whether it sold. Then say one sentence: "Every price shows its work, and every sale we see teaches the next one." That is the Semrush move done honestly: Semrush's value is that you can see the data behind the number.

## Consumer value and business value

**Consumers** get money and time: the right site is worth $2.69 to $16 per item (measured); the triage saves the trip for the items that aren't worth it; buying used at a fair price saves against new. These are provable now.

**Businesses** would pay for what the data says about used goods at scale. What each comparable buyer pays today:

| Buyer | What they buy now | What it costs | Fit for us |
|---|---|---|---|
| SEO teams (the Semrush analogy) | Search and competitor data | Semrush $139.95 to $499.95 a month per plan (*observed* via SEO.com; Semrush's own page blocked the fetch) | The analogy is the product shape: a dashboard that shows the data behind every number |
| Resellers and collectors | Sold-price lookups | WorthPoint $29.99 a month; eBay's research free to its sellers (*observed*) | We would be cheaper than neither; don't compete here |
| Insurers (**American Family** is MadHacks' top sponsor) | Replacement and actual cash value of household items | Verisk's Xact is used by 8 of the top 10 US insurers; prices not public (*observed*) | **Speculation**: their actual cash value comes from new prices and depreciation formulas, not what the used thing sells for. Market evidence could settle disputed claims. Worth one question to the AmFam judges |
| Investment funds (**Susquehanna** is a sponsor) | Alternative data | About $2.8B spent in 2025; average dataset earns $1.1M a year (Neudata, *observed*) | **Speculation**: resale prices and sell-through by brand as a demand signal. Needs years of data and consent |
| Brands | Their own resale programs and the data from them | Archive and Trove take a cut of resale (*observed*) | **Speculation**: a mainstream brand resale index, sold as insight |
| Platforms (**Salesforce**, **Databricks** are sponsors) | Data plumbing for AI agents | Salesforce paid about $8B for Informatica, completed Nov 2025, to give agents "a unified data foundation" (*observed*) | Not a buyer of our data. The honest use: our build on Databricks is an example of the agent-data pattern they sell |

## Brand premiums and rarity: what is measured, and the gap

| Segment | What resale keeps of retail | Source and mark |
|---|---|---|
| Luxury bags | The Row 97% on average; Goyard 123%; Hermès Kelly Mini II 282% (2025); Hermès 100%, Chanel 92%, Louis Vuitton 88% (2024) | Rebag Clair report via FashionUnited and Fashion Dive (*observed*; Rebag's own index, method not public) |
| Sneakers | Share of releases trading above retail fell from 58% (2020) to 47% (2024); typical margin 10 to 25%, against about 100% at the peak | Measure Protocol, June 2026 (*observed*; publisher sells signal products) |
| Mainstream brands (Nike, Coach, Patagonia, Carhartt) | "often 50-70% of retail on clean, in-demand styles"; fast fashion "below 15%" | Closo blog, Sept 2026 (*asserted*: a vendor, no method stated) |

So "the Nike brand adds X" is not answered anywhere with a method for ordinary items. Our comps can answer it the way house prices are answered: compare otherwise-similar items with and without the brand, and report the difference with its n (a hedonic model, already the approach in the valuation research, *inferred*). Rarity works the same way: how few comparable sales there are, and how far above the category they sold. The test that would make this a claim: 500+ sold comps per brand across at least two sites. Until then it is a design.

**Speculation, the "keep wowing" move:** publish a free monthly "What ordinary things are worth" index (Rebag's Clair report, but for Nike, Levi's, Patagonia, IKEA, Nintendo). It is press, it builds trust with consumers, and it is the first thing a brand or a fund would pay for.

## The environment, quantified honestly

| Number | Source and mark |
|---|---|
| Buying 5 used items replaces about 3 new ones (64.6% displacement) | WRAP "Displacement Rates Untangled", via the EU Textiles platform, Apr 2025 (*observed*) |
| Buying used jeans saves about 30 kg CO2e | same (*observed*) |
| 64% of Depop US purchases displace a new one | Depop with WRAP, Aug 2025, survey of Depop buyers (*observed*; Depop has a stake) |
| eBay recommerce avoided 1.6 million metric tons of CO2e and 71,000 tons of waste in 2025 | eBay Impact Report story, May 2026 (*observed*; method not stated) |

*Inferred*, per item: one pair of jeans that sells instead of sitting saves about 30 kg × 0.646 ≈ 19 kg CO2e, because the buyer skips a new pair. The saving comes from the buyer's displaced purchase, not from the closet, and it shrinks if the item would have been donated and resold anyway. So the honest line is: "Every item that sells instead of sitting replaces about two-thirds of a new one." Don't multiply it into a big total until we have real sales.

## Start small, keep wowing: the path

Each stage has a gate it must pass before the next is said in the present tense. Stages 3 to 5 are **speculation**.

| Stage | What | Gate to move on |
|---|---|---|
| 0, now | One item from photo to "worth it?", price per site, listings, both sides | The demo runs live; numbers.md holds |
| 1 | Campus move-out: 100 real items with students | Publish sell-through, days to sell, and keep against consignment, n shown |
| 2 | Free consumer app, all kinds of things; buy-side referrals pay (Dupe.com shows the eBay Partner Network model works) | Purchases per user per month covers listing cost (business.md's break-even) |
| 3 | The free monthly brand resale index | 500+ sold comps per brand on 2+ sites |
| 4 | Data products for brands, insurers and funds, from consenting sellers and licensed sources | One paid pilot; a licence that permits it |
| 5 | Marketplace partner: we bring supply, the constraint ThredUp names | One official API partnership beyond eBay (Depop's partner program is the first to apply to) |

## The mechanisms underneath, and what to take

Added 2026-11-15 06:40 UTC from Ben: "find the underlying mechanisms for how these all work and then possibly use them to improve our product." For each rival, the mechanism that makes it work, whether our spec already has it, and what to do. I checked `spec/` first so this lists only what is missing or under-used. All *agent proposal*.

| Who | The mechanism that makes it work | Already in our spec? | What to take |
|---|---|---|---|
| r/whatsthisworth, r/declutter | Common items are priced by searching sold listings; people ask humans only about odd or old things (rule 1 bans the common ones, *observed*). The declutter guide's default is "donate" | Yes, item by item: "too cheap to be worth listing" offers donate or bundle beside "you keep $0.40" (`spec/edge-cases.md`), and appraise compares sell, trade in and donate (`spec/features/appraise.md`) | **Move it to the front.** Make triage of a whole pile the first screen: one photo of a shelf or a box, sorted into Sell, Bundle and Donate, with what you'd keep and how long it takes. Today it shows up per item, after you've started listing. This is the pitch's lead problem, so it should be the demo's first ten seconds |
| Thrift profit scanners (ThriftAI, FlipTip and others) | One photo gives a verdict ("buy" or "skip") with profit after fees. The verdict sells it, not the number | Partly: the price engine gives ranges and keep per site; a single verdict line is an open question (`spec/features/score.md`, "whether a combined 'worth listing here' line exists is open") | **Answer the open question with yes, for triage only:** one word per item (Sell, Bundle, Donate), with the four numbers one tap away. Ben and Nate decide |
| Vendoo | Every user's listings sit on several sites at once, so Vendoo sees which site sold each item, and turns that into a marketing stat: list on 3+ sites and "sell-through rate 180% higher" (*asserted*) | We collect the same thing (`comp.cluster_id`, one physical listing across sites, `spec/product.md`) | **Publish our own version from day one of testing**: "of N items listed on 3 sites, X sold first on Depop, and the keep difference was $Y." It's the cheapest proof that our data shows something |
| Semrush | It shows the data behind every number (volume, difficulty, the pages that rank), so people trust it and come back | Yes: every price carries a citation of its comps (`docs/how-it-works/how-we-prove-it.md`); the plan shows "96 active comps, 21 sold in 90 days" (`spec/marketing-engine.md`) | Nothing to build. **Show it on stage**: tap a price, open the comps. That's our "SERP" |
| Rebag (Clair report) | A private appraisal index used to make instant offers, and a free yearly report from the same index that gets press every December | The measures exist: retention, depreciation and premium by brand (`spec/determinations/market-insight.md`, M10 and M11) | **New: publish them.** A free monthly "what ordinary brands resell for" page, built from the same tables. Press, trust, and the first data product, at no extra build cost once there are enough comps |
| Verisk and Enservio (insurers' pricing) | Every household item gets a replacement price from retail feeds, then a life-expectancy depreciation formula gives "actual cash value". Nightly updates; "like kind and quality" matching for discontinued items | Our depreciation curves (M10) and identity matching cover the method | **New, small: let people keep a card.** Items you photograph but decide to keep become a home inventory with a current market value, exportable as a PDF for insurance. 30.2% of US adults say none of their valuables are insured (*observed*). It costs one screen, it makes the app useful to people who don't sell, and it's the bridge to American Family. Speculation that insurers would want it |
| Phia | Prices labelled "high, typical or fair", and what an item "will retain" when you resell it | Yes: the fair-price meter and cost of ownership (price + shipping + repair − exit value, `market-insight.md`) | Nothing to build. **Say it in one line on stage**: "it tells you what it'll be worth when you're done with it." Phia shows this; we show it from the same engine we sell with |
| Dupe.com | Visual similarity finds lookalikes; affiliate links pay | Yes: "cheaper equal options" in appraise | Nothing new. Its eBay Partner Network income is evidence the free model can work |
| WRAP and Depop | A displacement rate turns "secondhand is green" into a number per purchase | No | **New, small:** a line in Records after each sale ("replaced about two-thirds of a new one") and a running total. Use the 64.6% rate and say where it's from |
| Swappie survey | 27% say a guaranteed price and 25% a live estimate would make them sell sooner (*observed*) | The trade-in route exists but has no partner with a quote API (`appraise.md`) | Later: a guaranteed offer needs a buyer partner. Note it as the reason a trade-in partnership is worth chasing |

**The three changes I'd make, in order:** (1) pile triage as the first screen, (2) publish the cross-site stat from the first test, (3) the keep-a-card home inventory. The first changes the demo; the second is free; the third widens who the app is for.

## How to prove our data is better when we test

Ben: "we can say our data collection is better using examples when we start to test." Agreed, and the test should be set up now so the examples fall out of it. Extend the hands-on test in `product/numbers.md` (10 items) or the campus test (100 items) with these columns, then compare against what each rival could have known about the same items.

| Claim we want to make | What to record per item | The comparison | What would make the claim false |
|---|---|---|---|
| Our price is closer to what it actually sold for | our price range before listing; eBay's sold median for the same search (what Terapeak and the scanners use); one scanner app's estimate (FlipTip gives 3 free scans a day); the real sale price | median absolute error of each, with n and a 95% interval (`hands-on.mjs` already computes intervals) | ours isn't lower than the eBay median, or the intervals overlap fully |
| Condition from photos beats the seller's word | each flaw we recorded, with its photo region; the flaws a person writes when listing the same item by hand | count of flaws found by each; later, "not as described" returns and buyer questions about condition | the hand-written listing finds as many flaws |
| We keep what others throw away | items that didn't sell, with their asks and days live | share of items that would be invisible to a sold-only dataset | none; this one is true by design, so just count it |
| One item on several sites shows where it sells | which site sold first, at what price, and the keep on each | the per-item keep difference across sites | the difference is under a dollar on most items |
| The item card answers buyers | each buyer question, and whether a card fact answered it without the seller | share answered from the card | under half answered |

Say each result with its n ("on 10 of our own items"), and say the losing ones too. One honest loss in the table makes the wins believable.

## What we do that no competitor does, in one product

Added 2026-11-15 06:55 UTC from Ben: "what we do that we know competitors don't. how we engineered it better and can do more things and its all in one." Each cell is what that product's own pages say it does (the competitor table above and Nate's crosslister teardown). The status column for us follows qa.md's honesty gate: **measured** (re-runnable number), **built** (code and tests on main, run on fixtures or recorded pages), **designed** (in `spec/`, not built).

| Job | Crosslisters (Vendoo, List Perfectly) | Phia, Dupe.com | Thrift scanners | eBay itself | ThredUp Clean Out | secondhand | Status |
|---|---|---|---|---|---|---|---|
| Name the thing from photos and its tag | no (you type it) | photo search to find similar | yes | yes (eBay only) | they do it | yes, with the tag and code read first | built (identity ladder; its proof set is synthetic, so no accuracy claim) |
| Measure size and flaws, each fact pointing at a photo region | no | no | no | no | they inspect | yes | designed; the photo check is measured |
| Worth it? Sell, bundle or donate | no | no | buy/skip for flippers | no | they decide for you | yes | designed (per item); pile triage is the proposal above |
| Price per site, solved from what you keep | one price copied | no | profit after fees, mostly eBay | eBay only | n/a | yes | **measured** ($2.69 on $20) |
| Which sites to skip, and why | no | no | no | n/a | n/a | yes, 31 kinds of thing × 7 sites | built (fit table) |
| A different listing per site's buyers | one listing copied | n/a | no | n/a | n/a | yes | designed |
| Post | yes, browser extension | n/a | no | yes | n/a | eBay API; others in your own signed-in session | built, not yet run on a live account |
| Answer buyers, every claim checked against the item's facts | no reply automation found | n/a | n/a | drafts only, you send | n/a | yes; unbacked sentences are held | built, not measured on real conversations |
| Offers inside your minimum | some | n/a | n/a | auto-accept rules | n/a | yes, in code, never below your floor | built (negotiation engine) |
| See a sale and take down the rest | 10-minute poll, browser on; auto-delist on top tiers | n/a | n/a | n/a | n/a | yes, and two payments always open a refund decision | **measured** (60,936 orders of events checked; sale seen in 0.44 s on Poshmark) |
| AI photos checked against the original | no | n/a | n/a | no | n/a | yes | **measured** (173 of 174 planted lies caught) |
| Buy side: every site at once, fair price, what it'll resell for | no | yes (Phia: resale value; Dupe: lookalikes) | n/a | eBay only | n/a | yes, from the same engine | built (intelligence engine on fixtures) |
| Learns from your actual sale | sees the sale, not the condition | no | no | its own sales | its own sales | yes: the sale writes back to the card that priced it | designed |
| Every number shows the rows it came from | no | no | some link to eBay sold | no | no | yes | built (citations); live on Databricks only if deployed |
| Asks less over time, never about money or your address | n/a | n/a | n/a | n/a | n/a | yes, after 3 unedited approvals | designed |

**Why "all in one" is an engineering advantage, not just a feature list** (*inferred*). Every competitor owns one step, so each step starts from what the person types into it. A price app never learns whether its price sold; a crosslister sees the sale but never measured the condition; a buyer search sees asking prices, not sales. We keep one item card from the first photo to the last delist, so a fact measured once is reused by every step (price, listing, buyer answers, delist), and **the sale writes its real price and days to sell back to the same card that made the estimate**. That closed loop is the only way to measure our own error item by item, and no single-step tool can build it. Said on stage: "Everyone else does one step and forgets. We do every step on one record, so every sale grades the price we gave it."

**Engineered better, with numbers we can re-run.**
- **We proved the double-sale rule; we didn't just test it.** A model checker walked every order of posts, payments and delists: 60,936 states on 3 sites and 931,406 on 4. Break the refund on purpose and it finds the double sale in 6 steps, so the check can fail (measured).
- **Photos can't lie.** 173 of 174 planted lies caught, with no model in the check (measured). No rival publishes a number for this.
- **The money is solved, not guessed.** Keep per site from each site's fee page: $2.69 on a $20 item, $16.05 on $100 (measured).
- **We see sales cheaply.** One request to a public Poshmark page, 0.44 s, against a 10-minute poll with your browser on (observed).
- **The model never decides money.** Plain code decides offers and floors; the model only words the reply, and every claim is checked before it is sent (built).
- **Ranges that know how often they're right.** Conformal ranges must cover 80% of outcomes and roll back under 70%; the backtest refuses any estimate whose comps include its own sale (built, on fixtures).

What we must not say: that posting runs live on four sites, that identity is accurate (its proof set is synthetic), or that our data is bigger. Say "designed" for those.

## How other fields appraise, and what improves our accuracy

Ben: "think about insurance and other adjacent fields about how they appraise and see if based on our information there are any mechanisms to improve accuracy." Cars (Manheim MMR), real estate comps, card grading and catalogue guides were already studied in `research/price/ben/adjacent-valuation.md`, and the spec already uses them: a hedonic model with a site effect, comps backed off from exact to category, paired sales for flaw discounts, catalogue IDs, offer discounts learned per site, battery health and IMEI for phones, a deal check that distrusts a price too good for the condition. This pass covered the fields not yet studied: insurance, mortgage valuation models, iBuying and pawn shops. Four things are new.

| Field | How it appraises | What it teaches us | Already in spec? | Change |
|---|---|---|---|---|
| **Home-valuation models (AVMs)** used by lenders | Tested against real sales with standard metrics: **hit rate** (share of items it will value at all), **PPE10** (share within 10% of the sale price), **median absolute error**, and **FSD**, a per-estimate confidence ("an FSD of 0.07 or 7 percent is a confidence score of 93 percent"). Clear Capital warns PPE10 "does not capture" the far misses (*observed*, Clear Capital glossary). Zillow publishes its error openly | Accuracy is a set of numbers, reported per segment, and includes how often you refuse | Partly: the backtest and conformal coverage exist; the industry metrics and per-category reporting don't | **Report hit rate, PPE10, PPE20, median error and the share off by more than 30%, per category, from the backtest and from every real sale.** Show it on the site the way Zillow does. It's the credible answer to "how accurate is it?" |
| **Insurance claims** (Claims Pages depreciation guide, Verisk Xact) | Replacement cost from retail feeds, then a depreciation table: each item gets "an annual depreciation rate and expected years of service"; the guide is "utilized by hundreds of insurance companies annually"; working items aren't depreciated past 90% (*observed*). Policyholder advocates say "there is no agreed-upon schedule" and adjusters use "their own personal views" (*observed*, United Policyholders). California's rule says depreciation must "reflect a measurable difference in market value attributable to the condition and age" (*observed*, quoted by United Policyholders) | (1) A life-expectancy table is a prior for every category on day one, where we have no sales. (2) The market-value difference the California rule asks for is exactly what our sold comps measure | No: the spec says "no standard depreciation curve for used consumer goods was found" (`market-insight.md`, M10) | **Use the insurers' life-expectancy and rate tables as the cold-start prior** for categories with too few comps, labelled "insurer schedule, not market", and let our comps replace it as they arrive. **Measure the gap** between the insurer formula and real sold prices per category: that number is the pitch to American Family. The Claims Pages PDF needs a sign-in; get it before relying on it |
| **iBuying** (Zillow Offers) | An algorithm made instant cash offers. "Owners with lemons are more eager to sell to them"; Zillow then bid above its own model to compete, and wrote down $569M, about $30,000 per home (*observed*, Stanford GSB on NBER w28252) | Any guaranteed offer attracts the items it overprices. Intermediation pays "only in the most liquid and easy to value" goods (*observed*) | Partly: the deal check distrusts too-good prices on the buy side; nothing covers a guaranteed sell price | **Never make a guaranteed offer from our own estimate.** If a trade-in route ever pays cash, the partner carries the risk, and only for liquid, catalogued items (phones, consoles) |
| **Pawn shops** | Base value from blue books and eBay comps, then condition, completeness and function: complete, working items "often get offers of 60–70% of their resale value", damaged or incomplete "20–30%" (*asserted*, a shop's blog, internally inconsistent); packaging and accessories named as drivers (*observed*, Chron) | Completeness and a working check move price as much as cosmetic condition | Partly: accessories and battery health are fields; a function check isn't a price driver | **Make "works" and "complete" explicit adjustments**, learned by paired sales like flaws are, and add a 5-second function shot to capture for electronics (it powers on, the screen has no dead pixels). It also answers a buyer's first question before they ask |

**Mechanisms that only work because of what we capture** (*inferred*, each testable in the hands-on run):
1. **Condition as a vector, measured.** Card graders score corners, edges, centering and surface separately (adjacent-valuation.md). We capture each flaw with its photo region, so we can learn a discount per flaw type instead of one "good / fair" label. Others price from the seller's word.
2. **The same item on several sites at once** gives a within-item site effect, like MMR's wholesale against retail for the same car. A hedonic model's site term is only as good as how often it sees the same product on two sites; ours sees the same physical item.
3. **Items that didn't sell** let the ask be corrected for the ones that never cleared; sold-only data overstates value (an r/Flipping seller: going "off of the sold/completed information, you might be overstating the value", *observed*).
4. **Offers and questions while listed** are the bid side of the market, the way StockX shows bids. They tell us mid-listing whether the price is high, before the item goes stale.
5. **Every sale grades the estimate** (the closed loop above), so per-category accuracy improves where we're worst, and the AVM-style report shows it.

**What would prove this:** in the hands-on test, report PPE20 and median error for our price against eBay's sold median and one scanner app on the same items (the proof table above). If ours isn't better on at least half the items, the accuracy claim waits.

## Quantifying the risk of everything we do

Added 2026-11-15 07:05 UTC from Ben: "ways to quantify the risk of everything we are doing ... or like reasons why we make decisions to price at whatever based on similar products and whats sold." I checked `spec/` first. Already designed: the chance of sale by a date at each price (D10), a holding cost per day per goal (`marketing-engine.md` §3.3), the markdown ladder (D15), the model check that no double sale is silent, a qualitative risk line per site (`spec/features/connect.md`), shrinkage for thin categories (D2), and comps adjusted with the adjustments written out (D1, D2). What follows adds what other fields do that the spec doesn't yet have. Methods are standard and named from memory unless a source is given (*asserted*); the numbers in examples are illustrations, not measurements.

| Risk | Borrowed method | How it works for us | In spec? | Verdict |
|---|---|---|---|---|
| **The price is wrong** | Lending: report hit rate and the share within 10% or 20% (PPE10/PPE20) per segment (Clear Capital, *observed*) | Covered in the accuracy section above | Partly | **Build** (the report) |
| **It doesn't sell, or sells low** | Quant: **expected shortfall**, the average of the worst 10% of outcomes, not just the middle | From the distribution we already compute (P(sale by day 30) × keep, and the markdown or donate value if it doesn't sell), show one downside line: "Likely $41 to $52. If it hasn't sold in 30 days, we drop to $46, then suggest a bundle." It turns "might not sell" into a number the person can plan around | No (ranges are shown, the downside isn't) | **Build now**: arithmetic on numbers we already have |
| **The listing loses value while it sits** | Options: **time decay** (theta) | Expected keep falls each day as the chance of sale at that price drops. The holding cost and markdown ladder already price this | Yes | **Don't build**; use it as a pitch line: "a listing loses value every day it sits, and we price that in" |
| **Double sale** | Insurance: **frequency × severity**, and **correlated risk** | Frequency per other site ≈ the chance a buyer pays there inside our window (about 4 minutes by design). For a normal item that takes 20 days to sell, that's about 4 / 28,800 minutes ≈ 0.01% per extra site: negligible. For an item priced under fair value that a buyer snaps up in about 2 hours, it's about 4 / 120 ≈ 3% per extra site, so roughly 10% across 3 extra sites (*inferred*, assuming buyers arrive at a steady rate). Severity is the cancel: an eBay defect, a mark toward Poshmark's 3% cancel limit, and an unhappy buyer. Like correlated insurance losses, the risk sits almost entirely in **hot or underpriced items** | No: the checker makes a double sale safe, not rare | **Build now, as one rule**: when the expected time to sell is under a day, list on the best site first and add the others after a delay, or not at all |
| **An account is limited or banned** | Insurance: **class rating** (price and limit each class of risk by the loss rate pooled across everyone in it) | Count warnings, challenges and limits per 1,000 actions, per site and per route, across all users. Frequency × severity (what the account holds: its sales history and live listings) gives an expected loss per site. When a site's rate rises, slow that route for everyone automatically. Before we have users, the rate is "unknown", and the risk line must say unknown, not low | No: the risk line is qualitative | **Build once there are users**; the logging already records every outside call |
| **The model acts where it's weak** | Banking: **model-risk limits** (a model only gets the decisions its validation supports) | Earned autonomy (3 unedited approvals) learns the person's trust. Add a second gate: the agent may accept offers alone only in categories where the backtest shows PPE20 above a bar and the range covers what it claims | No | **Build now**: a check against numbers the backtest already makes |
| **Buying the wrong thing** | Kelly sizing (how much of a bankroll to stake on an edge) | Only meaningful for flippers deciding how much inventory to buy. Our first person is clearing out, not buying stock | No | **Don't build** |
| **Money we owe if we're wrong** | Insurance **reserves** | Only needed if we ever guarantee a price or pay refunds ourselves. We don't (see Zillow above) | n/a | **Don't build**; it's the reason not to guarantee offers |

## Why we priced it at X: the appraiser's reconciliation

Appraisers don't average their comps. They adjust each sale for its differences, then **reconcile**: give the most weight to the sales that needed the least adjustment, and write down why. "A sale with small gross and net adjustments usually deserves more weight than one with a 35% gross adjustment package"; "blind averaging" is "generally unacceptable" (*observed*, OpenExamPrep study guide, Aug 2026). The weighted mean is written out so "a reviewer can replicate your steps" (*observed*, McKissock). The final value "must be within the range of the adjusted sales price of the comparables" (*observed*, Homium underwriting guide), and comments must "identify why the sale(s) were given the most weight" (same).

**What the spec already does:** each comp is adjusted with the steps written out ("This one sold for $40; yours has its box, so we count it as $44"), comps needing more than 25% adjustment are dropped, weights are shown as "counts a lot / some / a little" (D1, D2).

**What to add** (*agent proposal*):
1. **Weight by gross adjustment, continuously.** Today a comp is either in (under 25%) or out. Appraisers give less weight as the total adjustment grows. Fold `1 / (1 + gross adjustment %)` into D1's weight, and say it.
2. **The bracketing check.** If every comp had to be adjusted *up* to match ours (all worse than ours), the price is extrapolated, not supported. Widen the range and say "fewer sales this good; the top of the range is less sure."
3. **One reconciliation sentence, then the curve.** The person sees one line and can open the rest. Illustration with made-up numbers:

> **$48 on Depop.** 14 similar fleeces sold for $36 to $52 in the last 90 days. Most weight on the 3 that needed the least adjustment ($44, $47, $50). Yours is in better shape than most (+10%) and has no pilling. At $48 there's about a 55% chance it sells within 30 days; at $60, about 20%. Depop leaves you the most of it.

The last line is D13's own trade-off between price and speed, shown instead of hidden. **Highest and best use**, the appraisal idea that something is worth what its best realistic channel pays, is the same logic as the triage screen: sell, bundle or donate is choosing the item's best use.

**Which of these to build, in order:**
1. **Reconciliation sentence, gross-adjustment weighting and the bracketing check**: small changes to D1 and D2, and they make "why this price" answerable by any judge.
2. **The downside line (expected shortfall)**: arithmetic on numbers the engine already makes.
3. **The rule that holds back extra sites for hot items**: it removes nearly all real double-sale risk with one condition.
4. **Accuracy-gated autonomy**: a check against the backtest.
5. **Measured account-risk rates per site**: once there are users.

Skip Kelly, option pricing models and reserves; they solve problems our person doesn't have.

## What to say on stage

- Problem: "Most people don't know if their stuff is worth selling, so it sits. 31% say selling is too much effort; 30% think their things aren't worth much. Sometimes they're right."
- Product: "secondhand tells you in seconds what's worth selling, where, and what you'll keep, then does the selling for you."
- Difference: "Crosslisters are for resellers. Price apps stop at a number. We start at the camera, stop at the sale, and show the evidence behind every price."
- Data (Databricks, business judges): "Every price cites its comps, with measured condition. Over time that's the first honest index of what ordinary things are worth, which insurers, brands and funds pay for today. That's a plan, not a claim."
- Planet: "Every item that sells instead of sitting replaces about two-thirds of a new one."

## ThriftX

Nate mentioned it. I found no company by that name with a product (a GitHub repo with 0 stars, a UK company with no site, social accounts), so it is left out. The "Thrift AI" profit scanners are covered above.

## Searched, and could not reach

- Reddit directly (r/Depop, r/poshmark) blocked fetches; I read r/Flipping, r/whatsthisworth and r/declutter through public mirrors, so subscriber counts are missing.
- No search-volume tool: Google Trends and Semrush's own pages were not reachable (Semrush showed a captcha). App keyword scores from AppGoblin exist ("worth" scores 73 on its scale) but have no stated units, so I didn't use them.
- Depop's partner API page failed this pass.
- Dupe.com's funding: one profile I found was a different company (dupe.fi); not used.
- The full ThredUp 2026 report and the WRAP report itself were not opened, only their summaries.
- No survey splits "not worth it" from "don't know what it's worth" for US adults today; the UK Post Office poll is the closest and is UK only.

## Sources

Competitors: [Vendoo](https://www.vendoo.co/) · [FreightWaves on Vendoo, 2021](https://www.freightwaves.com/news/vendoo-magic-platform-puts-multiple-marketplaces-at-resellers-fingertips) · [List Perfectly](https://listperfectly.com/) · [Phia Series A, Pulse 2.0, Jun 2026](https://pulse2.com/phia-raises-35-5-million-series-a-and-reveals-star-studded-investor-roster-to-expand-ai-powered-shopping-platform/amp/) · [Phia valuation, Dec 2025](https://pulse2.com/phia-30-million-in-funding-at-180-million-valuation/) · [Phia seed, Digital Commerce 360](https://www.digitalcommerce360.com/2025/09/18/phia-raises-8-million-to-scale-ai-shopping-platform/) · [Dupe.com app](https://apps.apple.com/app/id6752661840) · [Dupe.com Chrome extension](https://chromewebstore.google.com/detail/dupe/pkhpcfoaocmmpmphhenoblggeinedlah) · [Onton, TechCrunch](https://techcrunch.com/?p=3070538) · [thriftx repo](https://github.com/gargshivam963963/thriftx) · [Archive, TechCrunch](https://techcrunch.com/2025/02/04/archive-raises-30m-to-solve-fashions-pollution-problem-with-online-resales/) · [Archive and Trove, Modern Retail 2023](https://www.modernretail.co/operations/how-startups-like-archive-and-trove-are-convincing-more-brands-to-launch-their-own-resale-programs/) · [eBay closes Depop, Shopifreaks](https://www.shopifreaks.com/ebay-closes-its-1-4b-depop-acquisition-and-says-the-resale-marketplace-will-keep-its-own-brand-platform-and-culture/)

Demand: [r/Flipping mirror](https://reddit.sudovanilla.org/r/Flipping) · [r/Flipping "it's not…" thread, Apr 2025](https://nyc1.lr.ggtyler.dev/r/Flipping/comments/1ju4uhy/what_ive_quickly_learned_about_reselling_its_not) · [r/whatsthisworth mirror](https://r.datuan.dev/r/whatsthisworth) · [r/declutter selling guide](https://lr.eu.psf.lt/r/declutter/wiki/index/selling) · [r/declutter "how do I sell X" policy](https://lr.eu.psf.lt/r/declutter/comments/17a1rf2/reducing_basic_how_do_i_sell_x_posts_new_policy/k5aefj7/?context=3) · [Post Office/OnePoll via The Star](https://www.thestar.co.uk/read-this/the-average-brit-owns-17-items-they-no-longer-use-hanging-onto-them-just-in-case-5333703) · [MagnifyMoney](https://www.magnifymoney.com/news/selling-online-pandemic-survey/) · [CNET survey via MacObserver](https://macobserver.com/?p=217844) · [Swappie/OnePoll](https://swappie.com/ie/blog/europe-is-sitting-on-a-drawer-full-of-money-and-doesnt-know-it/) · [Morning Consult 2024](https://pro.morningconsult.com/analysis/state-of-secondhand-ecomomy) · [Google Lens, Asia Business Daily](https://view.asiae.co.kr/en/article/2026031214442621001)

Data buyers: [Semrush pricing via SEO.com](https://www.seo.com/blog/semrush-pricing/) · [WorthPoint](https://www.worthpoint.com/) · [eBay Product research](https://www.ebay.com/help/selling/selling-tools/terapeak-research?id=4853) · [Verisk XactContents methodology](https://files.helpdocs.io/pxEGJf5YY0/other/1733939186850/2146-whitepaper-xact-contents-pricing-methodology.pdf) · [Enservio](https://www.enservio.com/landing/contents-valuation) · [Compare the Market survey, Claims Journal](https://claimsjournal.com/news/national/2024/11/05/327160.htm) · [Neudata 2025](https://www.neudata.co/press-release/alternative-data-spending-by-investment-management-firms-could-top-15-4bn-in-2025-according-to-neudata-s-latest-report) · [Neudata 2026](https://www.neudata.co/press-release/ai-adoption-is-rising-but-alt-data-vendor-spend-hasn-t-neudata-report-finds) · [Salesforce and Informatica, Pulse 2.0](https://pulse2.com/salesforce-completes-8-billion-acquisition-of-informatica-to-accelerate-agentic-ai-data-platform)

Adjacent appraisal: [Clear Capital AVM glossary](https://www.clearcapital.com/blog-avm-testing-glossary/) · [Claims Pages depreciation guide](https://www.claimspages.com/documents/depreciation-guide-personal-property/i777/) · [United Policyholders, Depreciation Basics](https://uphelp.org/claim-guidance-publications/depreciation-basics/) · [Stanford GSB on Zillow Offers](https://gsb.stanford.edu/insights/flip-flop-why-zillows-algorithmic-home-buying-venture-imploded) · [GEM Pawnbrokers](https://www.gempawnbrokers.com/blogs/news/how-pawn-shops-value-item-condition) · [Chron on pawn values](https://smallbusiness.chron.com/pawn-shops-determine-value-65950.html)

Reconciliation: [McKissock, weighted mean](https://www.mckissock.com/?p=48967) · [OpenExamPrep, reconciling the sales comparison approach](https://open-exam-prep.com/study-guides/real-estate-appraiser/sales-comparison-adjustments/sca-reconciliation) · [Homium underwriting guide](https://underwriting.homium.io/underwriting-property/appraisal-requirements/adjustments-to-comparable-sales/appraisers-comments-and-indicated-value-in-the-sales-comparison-approach)

Brands and environment: [Rebag Clair 2025 via FashionUnited](https://fashionunited.uk/news/retail/second-hand-the-row-follows-close-behind-hermes-and-goyard-with-97-percent-retention-rate/2025121185310) · [Rebag Clair 2024 via Fashion Dive](https://www.fashiondive.com/news/rebag-annual-clair-resale-retention-value-report/) · [Measure Protocol on sneaker resale](https://www.measureprotocol.com/insights/is-sneaker-resale-dying-buyers-sellers-search-signals-2026) · [Closo brand retention](https://closo.co/blogs/the-inventory-insider/best-brands-for-resale) · [WRAP displacement, EU Textiles platform](https://transition-pathways.europa.eu/textiles/library/wrap-report-publishes-results-calculating-displacement-rates-clothing-circular) · [Depop with WRAP](https://www.theindustry.fashion/depop-reveals-second-hand-fast-fashion-is-displacing-new-purchases/) · [eBay 2025 Impact Report story](https://www.ebayinc.com/stories/news/ebay-publishes-2025-impact-report/) · [ThredUp 2026 top 10 themes](https://cf-assets-tup.thredup.com/resale_report/2026/ThredUp_Resale_Report_2026_Top_10_Themes.pdf)
