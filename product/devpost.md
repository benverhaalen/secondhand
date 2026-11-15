<!-- Devpost write-up. Agent proposal until Ben and Nate approve it; every benchmark number needs both of them before it is published. -->

# secondhand

Your second hand for buying and selling used things.

![The secondhand app icon: two price tags, one mint and one white.](https://raw.githubusercontent.com/benverhaalen/secondhand/main/app/assets/images/icon.png)

## The problem

Ben thrifts most of his clothes. Over time he grew out of a lot of them. They still have value, so he always means to sell them, and they pile up in his room. He has hundreds of photos of clothes from different angles. Getting a single listing up took hours. He had to shoot it, sort the photos, write it, note every flaw and work out a price. If you want more buyers to see it, you do much of that again on the next site, where a good title reads differently and the fees leave you with a different amount.

Buying has its own versions of this:

- You have something and no idea what it is or what it costs.
- Someone who isn't comfortable with technology sells something valuable for hundreds less than it's worth, because looking it up was too hard.
- You want one specific thing. Ben is a Brewers fan and wants a jersey, but jerseys are overpriced. He'd like to set his price and hear about it when one comes up.

## Let's dig in

For us, digging in meant not stopping at the first answer. At each step of selling and buying, the first idea we had was usually a chatbot or a guess, so we kept reading and testing until we understood the step.

That changed where we use AI. Most of secondhand isn't a language model: prices come from sales records, fees come from a table, and listing titles are assembled by rules. A model reads your photos and answers follow-up questions, and when it does, it works through the app's own interface. It fills in facts as small labels you confirm, asks by offering options to tap, and answers with a table or a price range. A person confirms every step.

| Step | Who | What happens |
|---|---|---|
| 1 | **You** | Take a few photos |
| 2 | **AI** | Fills in brand, size and condition |
| 3 | **You** | Confirm or correct |
| 4 | **Code** | A price from sold listings |
| 5 | **Code** | A listing built for each site |
| 6 | **You** | Read, edit, post |

## What is the item?

An upload button would have been simpler. The trouble is that a model can't report a stain it was never shown, and condition is what buyers and sellers argue about later. So the camera asks what kind of thing you're selling and then asks only for the shots that kind needs. A t-shirt and a pair of headphones get different steps. The app has 14 kinds of item, and each one opens with its own shot list. The camera is a native Swift module inside an Expo app, which lets it guide each shot.

AI reads the photos and fills in the brand, the model and the size. You confirm each one or fix it, and you set the condition yourself, because you're the one who knows about the loose button.

![Two screens of the app. The first shows facts the AI read from the photos. The second asks the seller to confirm the condition.](https://raw.githubusercontent.com/benverhaalen/secondhand/main/product/graphics/devpost/capture-ai-fills-you-confirm.png)

*One of Ben's own listings. Left: the brand, model and size the AI read from the tag. Right: Ben confirms the condition.*

## What is it worth?

We price from what sold. In one run, the app priced an item we had just photographed in 3.6 seconds, from 31 sold listings on Poshmark. If it can't tell what the item is, it doesn't give a price.

To know whether the prices are any good, we backtested the pricing code. A backtest hides a real sale, prices the item using only the sales that came before it, and compares the estimate with what the buyer paid. We did that for 41.9k StockX sneaker sales, because StockX publishes real sale prices.

The median error was 3.89%, and 96.0% of estimates landed within 20% of the sale price, against 89.1% for the 90-day median price. In plain terms, on a $100 pair the typical estimate is off by about $4. It misses by more than $20 about once in 25 tries, where the 90-day median misses about once in 9.

One simpler guess still beat us. The last sale of the same shoe landed within 20% about one point more often than our estimate did. We publish that beside our own figure, and our Genie space says it when you ask.

We haven't run a backtest that size on clothes yet. Clothes are priced the same way, from sold listings.

## Why that price?

A seller's next question is "why that number?", and we wanted a real answer. This is where we used Databricks.

Unity Catalog can tell you which tables and columns a number came from. A seller is asking about rows: which sales? So we wrote a SQL table function, `why(id)`. Give it any price or figure the workspace holds, and it returns the exact sales behind it and rebuilds the number from them. Today those are the figures from our backtests on public sales. A price made on your phone shows its sold listings in the app, and those listings don't land in the workspace yet. We ran the rebuild on all 42,405 figures in the workspace. 42,399 came back exactly. The other six are five asking-price figures and one sold-price figure, and the workspace lists them.

**A price in the app** → **`why(id)`**, our SQL table function → **the exact sold listings** behind that price

From those listings:

- each row's source, and what that source allows
- the number is rebuilt and compared with the one shown
- a scheduled job and a SQL alert flag any number that can't be rebuilt

Here is the path one sale record takes to make that possible.

It arrives in a Unity Catalog volume, one of six public datasets of sold items we loaded, 1,688,603 sales in all. A Lakeflow Declarative Pipeline checks it and drops it if it's bad. Every row keeps the name of its dataset, and a rights table holds one row per dataset saying what its terms let us do: store it, show it, train on it. We read each dataset's terms, and only two of the six allow training. The pricing code reads through one view that leaves the other four out.

The workspace also backtests a second pricing model that runs nightly, on the same sales. Each of those backtests is an MLflow run, and the run records the Delta version of the table it read, so it can name its exact data. The app doesn't serve that model yet, and the dashboard and Genie name the two apart.

One weight in the pricing code says how fast an old sale stops counting. Each month a job fits a new value on the past and scores it on the next month. The new value replaces the old one only if it wins by more than the noise. It moved once, from 90 days to 7, and every later challenger lost and was held. Delta's change data feed keeps each move, so the history is a query.

A metric view defines each measure once. The AI/BI dashboard and Genie both read it, so anyone with the workspace can ask a question in plain words and see the SQL behind the answer. When there are too few sales to say, Genie answers "too few" and gives the count. We wrote eight questions a judge might ask and a script that asks all eight and saves each answer with its SQL. The app's server reaches Genie through its Conversation API and returns an answer only with its SQL and row count attached. That route is built and tested, and no screen uses it yet.

Two Unity Catalog policies, driven by governed tags, lock all 11 core tables to the person who owns each row and mask buyer and seller handles. They hide those rows from the workspace owner's own jobs too. Maintenance goes through a logged, time-limited window, and the rule check flags any window that wasn't logged.

Databricks publishes an Open Retail Data Model for stores. Resale doesn't fit it as is: every item is one of a kind, it has a condition, and the store is a marketplace. We put our tables under its product and sales names and added those fields, with the rights on every row. On top of that, `ai_forecast` projects 28 days of sneaker prices past the end of the 2019 data.

All of it deploys from one bundle with one command: the pipeline, the jobs, the dashboard, the Genie space and the alert. The code that builds a figure from its sales exists in TypeScript for the app and Python for the jobs, and one of those jobs checks that both give the same result.

In five places the platform stopped short of what we needed, and we built the rest:

| What the platform does | What we needed | What we built |
|---|---|---|
| Lineage stops at tables and columns | The rows behind one number | `why(id)`, which returns the rows and rebuilds the number |
| Delta refuses a CHECK constraint on a row-filtered table | "Every figure has its sales behind it" as a rule | A check when a figure is written, a Lakeflow job that checks 18 rules, and a scheduled SQL alert. On the last run none had broken |
| Genie can't call a table function | Genie answering "which sales?" | The rows behind `why(id)` as a view it can read |
| Time travel is refused on a view | A backtest that names its exact data | Each MLflow run records the Delta version of the table under the view |
| A row filter hides rows from the owner's jobs too | Maintenance and the rule check seeing every row | The logged, time-limited window above |

## Where should it go?

Each marketplace is its own search engine with its own form, so the same listing doesn't fit every site. We built this part as tables and rules.

- **Which sites.** A fit table scores each kind of product against each marketplace, from vintage clothing to fan apparel to furniture. An item goes only where that kind of thing sells.
- **Which fields.** For each kind of item, a requirements table lists the fields every site has, what the site calls each one, its length limit, and how much it matters in that site's search.
- **The title.** Code puts the fields in the order that site's search rewards and shortens whole words to fit the limit. Then a check rejects any word that a confirmed fact doesn't support.
- **The price.** The engine starts from the amount you'd keep, and solves for the asking price on each site that leaves you that amount after that site's fees.
- **The photos.** Scored, then cut to each site's limit.

The same confirmed facts come out differently on each site:

| eBay | Depop | Poshmark |
|---|---|---|
| Carhartt Detroit Jacket Men's L Brown | Vintage 90s Carhartt Detroit Jacket Brown Size L | Carhartt Detroit Jacket Brown Size L |

"Vintage 90s" leads on Depop because the seller confirmed it and our Depop rules put the era first.

What you get is a draft for each site. We chose drafts over posting for you, because it's your account and your name on the listing. The same code can start from listings you already have. Ben's Depop listings, with the photos he already took, can become drafts for the other sites.

![The listing preview screen for a pair of Carhartt jeans, with the asking price and the item's details.](https://raw.githubusercontent.com/benverhaalen/secondhand/main/product/graphics/devpost/listing-preview.png)

*One of Ben's own listings, in the listing preview. Every field can be edited before anything is posted.*

## Where is the one you want?

For buyers we built one search that reads the marketplaces at once. Our rule was to use a site's own API wherever it offers one. eBay does, so we use it. Other sites turn away ordinary automated requests, so we read those pages through Browser Use Cloud, which runs a real browser for us, with Playwright driving it. Treg puts specialist data tools behind one account, and we used it for Google Shopping, to see what an item costs new. A small model answers one narrow question through OpenRouter's Decisions API: are these two results the same product? A price comparison is only worth showing if the answer is yes.

We ran 16 test searches. All 16 returned results, and the first ones usually showed up in about 0.6 seconds.

You can ask a follow-up question about the results. The app answers in the shape that fits the question, such as a table or a price range, built from the same parts as the rest of the app. Before it reaches you, every price in it is checked against a listing the search found. We planted 20 false prices to test that check. The first version stopped 2. The current one stops all 20.

![Two screens of the app. The first shows one search with results from several marketplaces. The second shows the answer to a follow-up question as a table and a price range.](https://raw.githubusercontent.com/benverhaalen/secondhand/main/product/graphics/devpost/search-and-answer.png)

*For these two screenshots we loaded Ben's own Depop listings in as the results, so the data here is sample data and the screens are the app's. Left: one search. Right: a follow-up answer drawn as a table and a range, with the app's note that these are asking prices.*

If the thing you want isn't there at your price, you can track it. The app keeps the search and shows you new matches when you open it.

## How it fits together

| Part | What it is | What it talks to |
|---|---|---|
| **Phone** | Expo app with a Swift camera | Our server |
| **Our server** | TypeScript: identify, price, list, search | Marketplaces, models, Databricks |
| **Marketplaces** | The eBay API, or a real browser | |
| **Models** | Read photos, match products, answer questions | |
| **Python twins of the pricing code** | Compared with the server's code on the same inputs | Databricks |
| **Databricks** | Public sales, backtests, `why(id)`, Genie (built, no screen in the app yet) | |

The phone talks to one server. The pricing, fee, listing and search code lives there as plain TypeScript, each part with its own tests. A model is called in three places: reading photos, deciding whether two results are the same product, and answering a follow-up question. Each time, code checks what came back before you see it.

Everything the server does goes through one logger: every input, outside call, approval and error. A script reads a run's log and fails it if a step is missing or a secret appears.

Databricks holds the history and the proof. The pricing code on the server has a Python twin that runs there as jobs, and tests compare the two on the same inputs. A job on the workspace does the same for the code that builds a figure from its sales.

## Challenges

**The same item, listed twice.** A lot of sellers post one item on Depop and eBay at the same time. If we count that as two sales, our price data is wrong. So the pricing code compares the photos and the titles, and when two posts match, it counts them once.

**Two buyers at the same moment.** If a jacket is up on four sites, two people can pay for it before the other listings come down. We wrote down what should happen, then tested it with a model that tries every order of events for one item on four sites. That came to 931,406 cases. In every case where two people paid, the seller sees both buyers and picks who gets refunded. We also broke the refund rule on purpose to see if the test would catch it. It did, in six steps. So far we've only tested this on our own rules. It hasn't seen a real sale.

**Sites that block automation.** Depop and Mercari blocked a plain headless browser with a 403. So the search uses a site's own API when it has one, and a real browser through Browser Use Cloud when it doesn't.

## Ideas we tried and left out

![The original photo, the outline we gave the model, and the result.](https://raw.githubusercontent.com/benverhaalen/secondhand/main/research/studio/ben/renders/trials-2026-11-14/template-trial-original-guide-result.jpg)

*One of Ben's own shirts. The original photo, the outline we gave the model, and the result.*

This one worked, and we still left it out. We gave an image model (Seedream 5.0 Pro, through Higgsfield) Ben's photo of a shirt and a second image with the outline of one laid flat. The outline tells the model where the body and sleeves go. It came back laid out evenly, with the same graphic and the same wrinkles.

Then we talked it through with a mentor. A listing photo shows one specific used item. If an edit changes that item even a little, the seller has posted something they don't own, and the buyer finds out when the box arrives. A nicer photo isn't worth that risk, so we decided it doesn't belong in the product yet.

We had already started on the check it would need. It compares an edited photo to the original with plain image math, and we tested it by planting 174 false edits in our own photos. It caught 173. Along the way we found a hole in our own check: lining the two photos up before comparing them hid a stretch. We fixed that. We've only run it on our own photos, so for now the original photo is the listing photo.

Other ideas we set aside for later:

- Video capture, where a short scan picks the useful photos for you.
- More marketplaces. The item facts carry over, and each new site needs its own rows in the tables above.
- Posting for you through each site's official partner program.
- A pricing model that keeps learning from the sales the app sees.
- Push notifications when a tracked item shows up at your price.

## If this scaled

This part is hypothetical. We'd want the app to be free. By our estimate from the list prices of the tools we use, it costs 2 to 8 cents to identify, price and draft one item, and that cost is about the same for a $5 shirt as for a $200 bag.

The money would come from buyers. When someone buys an item we helped them find, the marketplace pays a referral fee. On eBay's published rates we estimate about $0.71 per purchase. At those numbers, the app covers the cost of a seller who also buys one thing through it every two months. A referral fee can't move a listing up. The search already ranks results without looking at referral fees.

More sales would also mean better prices, for more kinds of things. That is what would help the person who has something and doesn't know what it is.

We'd start small. We'd list 100 real items with students during move-out week and publish how long it took and how much they kept.

## Built with

Expo and React Native, Swift, TypeScript, Python, Databricks (Lakeflow Declarative Pipelines, Delta Lake, Unity Catalog, Databricks SQL, MLflow, metric views, AI/BI dashboards, Genie, Lakeflow Jobs, AI Functions, SQL alerts, Declarative Automation Bundles), Browser Use Cloud, Playwright, Treg, OpenRouter, the eBay API.

Built by Ben Verhaalen and Nate Garelik at MadHacks 2026.
