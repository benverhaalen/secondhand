# Devpost draft

The write-up for the MadHacks 2026 submission. Ben: "considering we can only live demo the app we really need the written portions to convey its use and what it does super well and super easily. we need to be personable." Plain, personal, every claim true on the day: check each number against [numbers.md](numbers.md) and each "it does" against the [honesty gate](qa.md#before-you-say-it-the-honesty-gate). Lines in [brackets] are for Ben or Nate to fill or cut. *Agent proposal*.

Images to put in, in this order: the $3 against $17 card; one phone screen of Today; the keep-per-site table; the couch's site verdicts; [gate-side-by-side.jpg](../scripts/bench/out/gate-side-by-side.jpg); the architecture diagram from the website.

---

## secondhand

**Your second hand for buying and selling used things.** Take a few photos of something you own, and it's listed on the right sites at the right price, buyers are answered, and it comes down everywhere when it sells. Looking for something used? One search across every site, with a fair price and the total with shipping.

## Inspiration

[Ben or Nate, one true sentence: the thing you meant to sell and never did, and why.]

Most of what people own and don't use never gets sold. There are two options, and both are bad. Hand it to a consignment store and a $20 shirt pays you $3. Sell it yourself and you keep about $17, if you can face five apps, thirty "is this still available?" messages, a sale on one site while it's still up on four others, and a pickup with a stranger. So it sits in the closet.

AI can already write a listing in seconds. That was never the hard part. The hard part is everything after you post, so that's what we built.

## Let's dig in

We read the theme three ways. **Dig through what's buried:** the closet, the basement, the things worth money that nobody uses (eBay found its sellers had 36 sellable items at home on average). **Dig deep:** we didn't stop at the happy path. We checked every order of events for two buyers paying at once, 931,406 of them on four sites, and planted 174 lies in our own photos to test the photo check. **And keep judgment in charge:** secondhand does the work for you, but code checks your money and your address, and anything over your line waits for your tap. [If an organizer confirms the theme comes from the CAI dean's essay "Time to Dig", add one line linking it: a tool that is for you, not done to you.]

## What it does

**Selling.** You take a few guided photos. secondhand works out what the thing is, measures it, and finds what it really sells for. Then it:
- picks the sites where it will sell, and tells you where it won't. A couch goes to Facebook Marketplace, not Depop, because Depop only ships and its buyers want clothes;
- writes a different listing for each site's buyers, at a price worked out from what lands in your account after that site's fees;
- answers buyers' questions with facts from your item, and handles offers inside the lowest price you set;
- notices when it sells, and takes it down everywhere else.

You see one short list of decisions. Anything that touches your money, your address or a stranger waits for your tap.

**Buying.** Type, photograph or paste a link to something you want. One search covers eBay, Depop, Poshmark, Mercari and Facebook Marketplace, plus official stores. You get what it usually sells for, the total with shipping, and a heads-up when new or refurbished is the better buy. Save it, and it watches for you.

**It's free.** Listing an item costs us a few cents, so we don't charge sellers or buyers. We earn a referral when someone buys through us, and that never changes which listing we show first.

## How we built it

[Say only what runs on the day; cut the rest or mark it "designed".]

- **One record per item.** Every fact on an item (brand, size, a stain) keeps where it came from: a region of a photo, a line of the tag, a measurement, or "you said". Listings for every site are built from that record.
- **A harness for each marketplace.** eBay through its official API. For the others, your own signed-in session runs in a cloud browser (Browser Use Cloud) and does each action the way the site's own web app does it, then reads the site back to confirm. Nothing counts as done until the site shows it.
- **Seeing a sale without watching all day.** A sold Poshmark or Mercari listing stays public with a sold mark, so we check the public page, which takes about half a second (0.44 s, observed), and open a signed-in browser only to confirm.
- **A fee engine.** One dated row per site per fee. On a $20 item you keep $18.69 on Depop and $16.00 on Poshmark; to keep $17 you'd ask $18.25 and $21.25.
- **Photos that can't lie.** Clean up only adjusts the light in your own photo. AI relighting is optional, labeled, and checked against your original before you see it: color, structure, and every logo, tag and flaw box. The real photo is always first.
- **Databricks** [only what's deployed]: live state in Lakebase, every event and comparable sale in Delta tables, photos in a Unity Catalog volume, every model call through one gateway, and every agent step as an MLflow trace that the app shows when you tap Why?.
- **The phone app** is Expo with a native Swift camera module; the website is the same app on the web.

## Keeping a human in the loop, on purpose

We didn't want an agent that acts alone. In September, an assistant on another platform, set to "Allow Always", accepted a lowball offer and sent a stranger to a seller's home. So:
- **Code decides, the model words it.** Offers are checked against your minimum by plain code. Every sentence the agent wants to send is matched to a fact on your item first; a claim it can't back ("smoke-free home") is held and shown to you.
- **It earns trust slowly.** After you approve the same kind of thing three times without changing it, it offers "Always do this". Your address, payments and off-site deals can never be automatic.
- **You can check everything.** Every automatic action has a Why? and a link to the same thing on the site.

## Challenges

- **Two sites can sell the same thing at once.** We modelled every order of events for one item on three sites, 60,936 of them, and checked that a second buyer never goes unnoticed and nothing gets stuck. We broke the refund rule on purpose to make sure the check can fail: it found the double sale in 6 steps.
- **Proving an AI photo is honest.** We painted out details, swapped tag text, stretched, shifted colors and mirrored Ben's own photos, then checked whether the gate caught them: 173 of 174. The test found a hole first (lining the photos up undid a stretch), so the gate now checks for stretch too. It's cautious, and holds about half of the honest relights too; when it holds one, you get your real photo instead.
- **Sites that refuse robots.** Depop and Mercari turned away a headless browser, so each site's harness is built from how that site actually works, and every action falls back to typed steps, then to an agent, when a page changes.
- **Cost.** A browser left open to watch for sales would cost about $170 a month per person. The half-second public check is what makes a free app possible.

## Accomplishments we're proud of

- [Live on the web at URL.] [Submitted to the App Store / App Store coming soon.]
- 173 of 174 planted photo lies caught; 76 of 76 cleaned-up photos within the color limit.
- 60,936 orders of events checked on 3 sites, and 931,406 on 4, with no silent double sale.
- A sale seen in 0.44 s from a public page.
- [1,420 tests on every push, once CI is green.]
- 184 research notes, every claim marked observed, asserted or inferred, and 39 dated product decisions, so every rule in the app has a reason we can show.

## What we learned

The interesting problems were never the AI writing. They were the moments where software meets a stranger: a second buyer, a meetup, a sentence that sounds right but isn't true. Deciding exactly when the agent hands back to a person was the real design work.

## What's next

- List 100 real items with students during move-out week, and publish how long it took, how much people kept, and how many sold.
- Apply for Depop's partner API and eBay's Partner Network.
- Cut the cost of watching further with official order events where sites offer them.

## Built with

[Keep only what the build uses: Expo, React Native, Swift, TypeScript, Python, Databricks (Lakebase, Delta Lake, Unity Catalog, MLflow, Databricks Apps), Browser Use Cloud, Playwright, OpenRouter, Seedream, eBay APIs.]
