# Which sites already show Mercari, Poshmark and other resale listings in one place, and which marketplaces offer a licensed feed?
Researched 2026-11-15 by Nate (Claude Code retrieval seat, Sonnet 5.5). Feature: watch.

Marks: *observed* (read in the page or file fetched on 2026-11-15 with curl, URL given), *asserted* (a search snippet, a third-party page, or the source says it without showing it), *inferred* (my reasoning, basis given). Quotes are verbatim from the saved bytes. Nothing was signed in to, no search was run on any site, no bot check was worked around, and the Dupe MCP server was not called. The decision this feeds: Nate's 2026-11-15 call that broad searches go lightly on Mercari and Poshmark and lean on sites that already display their listings.

## Draft from memory (before searching)

I expected: Dupe.com mostly new goods; Gem and ThriftX showing real resale listings but with no public API and terms that bar automation; Phia comparing new-price sites with some resale; Lyst new-fashion only; ShopStyle gone; eBay the one marketplace with a real search API through the eBay Partner Network; Poshmark, Mercari, Depop, Grailed with no public feed; The RealReal and Vestiaire on affiliate networks with a link-only program; Google Shopping carrying used items only through merchant feeds.

## What changed

- Dupe's terms now have a section 13 that licenses calling its MCP server and API "to search our catalog and display results to your end users", with conditions (cache limits, keep affiliate links). My draft said no such licence. The terms say the catalog includes "retailer and marketplace APIs", and Dupe's partner page lists Depop as a retailer. No Mercari or Poshmark result was seen. (observed, sections 1 and 2)
- Draft held on Lyst: reachable only as far as robots.txt, since Cloudflare blocked the pages (section 7). ShopStyle is gone, which my draft guessed (section 8).
- eBay's Buy APIs (Browse and Feed) are not open: eBay's own page says production use is "intended for eBay partners only", needs approval, with "no guarantee". My draft said "real search API through EPN", which holds, with a gate I had not weighted. (observed, section 9)
- I found no official affiliate page for Poshmark, Mercari US, Depop or Grailed. Search found only third-party listings, and the marketplaces' own help pages were mostly blocked (section 10). The draft's "no public feed" for those four was not contradicted but is not proven either.

## Limits of this run

- A Bash fetch of a Google search results page was refused by the permission classifier ("Unauthorized Access"). I did not retry. Google Shopping and Google Lens were therefore not observed on a results page. Only Google's robots.txt, terms and docs were read. (observed)
- No real results page was loaded for any aggregator. Gem returned an AWS WAF challenge, Lyst a Cloudflare challenge, ThriftX and Phia are apps, Dupe's search is a chat session and `/search` is disallowed. Field (1) "observed on a real results page" is therefore not-found for every candidate. Section by section below says what was seen instead.
- Searching was thin in places: affiliate network dashboards (Impact, Rakuten, CJ, Awin) need an account, so network membership is only asserted from third-party directories.

## 1. Dupe.com

1. Marketplaces shown: no results page was loaded (search is a chat; `https://dupe.com/robots.txt` has `Disallow: /search`). *observed*. The partner page `https://dupe.com/partners` (fetched 2026-11-15) lists "Depop" among "Already sending traffic to" retailers, next to ASOS, Farfetch, Nike, Etsy, Revolve. *observed*. No Mercari, Poshmark, eBay, Grailed, RealReal or Vestiaire name was seen anywhere on the partner page, FAQ or agent.txt. *observed, absence in the pages read only*. Terms: "Prices, availability, stock status, shipping estimates, discounts, and product attributes shown on the Service come from retailer feeds, retailer and marketplace APIs, and other third-party sources. They are snapshots and can be out of date, wrong, or missing." (`https://dupe.com/legal/terms`) *observed*. The About page says Dupe "does not make, stock or sell products". `agent.txt` (last updated 2026-11-11) says "Coverage is strongest in home and furniture, and also spans beauty, fragrance and fashion." *observed*. Earlier note found the catalog is mostly new goods ([teardown](teardown-search-and-similar-finders.md)); that stays *inferred*.
2. Delivery: Next.js behind Cloudflare, chat session streamed from `api.dupe.com` (see [dupe-observed-in-browser](dupe-observed-in-browser.md)). Product pages load as server HTML. A documented public interface exists: MCP at `https://mcp.dupe.com/mcp` (Streamable HTTP). *observed*.
3. Terms (read 2026-11-15, `https://dupe.com/legal/terms`):
   - Section 14: "Access the Service through automated means, including scraping, crawling, robots, or bulk data extraction, except through the interfaces described in section 13 and within the limits described there, or as our published robots policy permits."
   - Section 13: "we grant you a limited, revocable, non-exclusive, non-transferable license to call our developer interfaces to search our catalog and display results to your end users."
   - "Do not cache or store results longer than we permit, and do not resell, sublicense, or redistribute the data as a standalone dataset."
   - "Do not use the interfaces to build or train a competing product catalog, similarity index, or price database".
   - "Preserve our links and their tracking parameters as returned. Do not strip, replace, or substitute affiliate or attribution parameters, and do not insert your own into our links."
   - "If you display our results to consumers, the fact that the underlying links are commercially compensated must be disclosed to them."
   - Section 14: "You may use the Service for your own personal, non-commercial purposes, except as section 13 allows."
   - robots.txt: `Content-Signal: search=yes, ai-input=yes, ai-train=yes`; disallows `/admin`, `/api`, `/redirect`, `/r`, `/l`, `/s/*`, `/link`, `/search` among others. *observed*. The terms page showed no effective date in the text I extracted: date not-found.
4. Official API: yes. `agent.txt` lists tools `search_products_by_url`, `search_products_by_image`, `search_products_by_text` (anonymous, "no key, no account, no OAuth") and `get_product_details` ("Requires an API key"; "Ask legal@dupe.com if you need a key"). *observed*. Partner page: "List your catalog, keep your own checkout, and pay only on performance." The partner form offers networks Impact, Rakuten Advertising, CJ Affiliate, Awin, Partnerize, Skimlinks, Sovrn, ShareASale. *observed*. What joining a developer programme requires beyond emailing for a key: not-found.
5. Cost: "The Service is free to use." (terms) *observed*; API pricing not-found.

## 2. Google Shopping and Google Lens (used items)

1. Observed on a results page: not-found. The fetch was refused (see Limits). What was read: Merchant Center page `https://support.google.com/merchants/answer/6324469?hl=en`: "Use the condition [condition] attribute to tell potential customers about the condition of the product you're selling. It's important to set this value correctly since it is used to refine search results." and "Required for each used and refurbished product". *observed*. So used items reach Shopping only where a merchant submits a feed with condition `used`. *inferred* from that text. Whether marketplaces such as eBay do this on Shopping today was not seen.
2. Delivery: not-found (no page loaded).
3. Terms and robots: `https://policies.google.com/terms` (effective July 30, 2026): "using automated means to access content from any of our services in violation of the machine-readable instructions on our web pages (for example, robots.txt files that disallow crawling, training, or other activities)". `https://www.google.com/robots.txt` includes `Disallow: /search`, `Disallow: /imgres`, `Disallow: /shopping?`, `Disallow: /shopping/product/`. *observed*.
4. Official API: Custom Search JSON API (`https://developers.google.com/custom-search/v1/overview`): "The Custom Search JSON API is closed to new customers." and existing customers "have until January 1, 2027 to transition". It searches pages you configure, not Shopping results. *observed*. A Google Shopping or Lens results API: not-found in the pages read. Third-party SERP APIs were not investigated.
5. Cost: not-found.

## 3. Gem (gem.app)

1. Real results page: blocked. `https://gem.app/` search, `/vintage` and `/womens` returned HTTP 202 with an empty body and header `x-amzn-waf-action: challenge` (AWS WAF). Recorded as a fact; not worked around. *observed*. The teardown asserts Gem aggregates vintage sellers; not re-observed here.
2. Delivery: not-found.
3. Terms (`https://gem.app/terms`, "Effective as of May 15, 2025"): "Gem is for personal use. Don't harvest data or cause harm." / "The Service is for your own personal, non-commercial use only. Prohibited uses include but are not limited to: the collection of product pricing information, product or seller statistics, or research data. Permission may be requested by contacting us at contact@gem.app." / "Any automated access of the Service must obey robots.txt, robot meta and header directives. We also request you to use a descriptive user agent name that includes contact information." *observed*. robots.txt: `User-agent: *` disallows only `/saved`, `/settings`, `/requestEmailLogIn`, `/emailSignUp`, `/productSave`, `/setAlert`, `/saveSearch`, with `Crawl-delay: 1`. *observed*.
4. Official API or affiliate programme: not-found on pages read; terms invite a permission request by email.
5. Cost: not-found.

## 4. ThriftX (thriftx.shop)

1. The home page `https://www.thriftx.shop/` (fetched 2026-11-15) states "ThriftX hunts Depop, Poshmark, Vinted, eBay, Mercari and ThredUp at the same time." and shows a mock-up "Searching 6 marketplaces · 14 matches", item "Vintage Bomber / Depop · Size M / $48 / verified". That is marketing copy, not a live results page. *observed*. The product is an iPhone app (App Store); no web results page exists to load. Link-out, sold status and freshness: not-found.
2. Delivery: app; not visible.
3. Terms (`https://www.thriftx.shop/terms`, "Last updated: July 13, 2026"): "Scrape, crawl, or use automated means (bots, scripts, or similar tools) to access or extract data from the Service;". robots.txt: `User-agent: *` `Allow: /`, GPTBot and ClaudeBot also `Allow: /`. *observed*.
4. API or partner programme: not-found.
5. Cost: "Standard search is free."; "Credits pay for the searches that cost real money to run: photo search and AI search."; "One watch is included free; paid plans watch more." Plan prices not captured. *observed*.

## 5. Phia (phia.com)

1. Home page `https://phia.com/` says "Phia finds the best price across 220,000+ sites." with examples Aritzia, Gap, Sephora. It names no resale marketplace in the text I read. No results page loaded (iOS app and Chrome extension). *observed*. Whether it shows Mercari or Poshmark: not-found.
2. Delivery: extension and app; not visible.
3. Terms (`https://phia.com/terms`, "Last Updated: November 5, 2026"): you may not "use, display, mirror, extract, scrape, copy, index, or frame the Services or any content made available therein ... without Phia's express written consent" and "use any automated means (including spiders, robots, crawlers, or data mining tools) to access or search the Services other than software provided by Phia or generally available web browsers". *observed*. robots.txt: `User-agent: *` `Allow: /` with some disallows. *observed*.
4. API or partner: not-found.
5. Cost: free ("iOS App | Free"). *observed*.

## 6. Beni

`beni.com` is parked and noindexed (earlier fetch, `beni_home.html` and robots). Nothing else was found. *observed* for the parked page; no terms, API or listings.

## 7. Lyst

1. Results page: blocked. `https://www.lyst.com/` and its terms returned HTTP 403 with the title "Just a moment..." (Cloudflare). Recorded as a fact. *observed*.
2. Delivery: not-found.
3. robots.txt was read (203 lines, blocks several named bots such as `apptus_tce` and `MSRBOT`; allows `Adsbot-Google`). Terms: not-found (blocked).
4. API or partner: not-found. Lyst's partner help site was not reached.
5. Cost: not-found. Whether Lyst shows any resale: not-found (the teardown asserts it is new-fashion).

## 8. ShopStyle

`shopstyle.com` hosts returned NXDOMAIN; `shopstylecollective.com` redirects to a page titled "Collective Voice" saying "Collective Voice is officially closed." *observed*. Nothing to use.

## 9. eBay: the one marketplace with an official search API

1. eBay's `robots.txt` was fetched (200, 24 KB). Not reviewed line by line.
2. Interface: Browse API `item_summary/search`. *asserted* (search snippet). eBay's developer pages `…/browse/resources/item_summary/methods/search` and `/join/api-license-agreement` and `/grow/affiliate-program` returned a 403 "Error Page | eBay" to curl. Recorded as blocked. The eBay user agreement page returned "Checking your browser before you access eBay." Recorded as blocked.
3. Terms I could read:
   - `https://developer.ebay.com/api-docs/buy/static/buy-requirements.html` (200): "Many of the Buy APIs are a (Limited Release). The use of eBay's Buy APIs in production is intended for eBay partners only. You must apply for production access through the eBay Partner Network. Acceptance of applications is based on the proposed business model, as well as a formal agreement to abide by the policies and requirements stipulated by eBay." / "Note: There is no guarantee that your application for production use of the APIs will be approved." / "Also, if you want to download the item feed files or get paid for selling eBay items, you need to become an affiliate by joining the eBay Partner Network." / "Prohibited: Disabling eBay's sort functionality. Partners and users are not permitted to sort items." / "Users must meet standard eligibility requirements, get approvals from eBay support organizations, and sign contracts with eBay to access the Buy APIs in production." *observed*. It also says there are contracts specific to the Buy APIs, possible mutual NDAs, and lists the eBay User Agreement, API License Agreement and EPN Agreement.
   - `https://developer.ebay.com/develop/get-started/get-started-on-a-buying-application` (200): "Step 4: Apply for an Application Growth Check to get access to Buy APIs in Production". *observed*.
   - EPN agreement `https://epnpartnernetwork.ebay.com/page/network-agreement` (200): "eBay's Buy API Program: An approved EPN Program that permits Affiliates who have entered into an agreement with eBay, or an EPN approved third party, to display and facilitate the purchase of products through eBay's API." Programme description: "participating in eBay's Buy API Program in exchange for a percentage of GMB". For "Buy It Now" items the attribution is "a click on your Promotional Content within 24 hours preceding that user's purchase". *observed*. The rate card was in the page but I did not extract the percentages.
4. Offers: yes, Browse API and Feed API through the Buy API Program, gated as above. What joining requires: an EPN account, approval of the business model, signed contracts, an Application Growth Check. Whether a read-only search display for a reselling assistant would be approved: not-found; operator's call.
5. Cost: the EPN agreement describes a commission rate card paid to the affiliate; any fee to use the API: not-found.

## 10. Other marketplaces: affiliate or feed programmes

Every marketplace's own help or partner page was either blocked or not found, so all programme claims below are *asserted* from third-party directories, unless stated.

| Marketplace | Own robots.txt (observed) | Own terms on automated access (observed) | Affiliate or feed programme |
|---|---|---|---|
| eBay | fetched, not reviewed | blocked | yes, EPN plus gated Buy APIs (section 9) |
| Poshmark | `Disallow: /search`, `/listings`, `/api`, `/affiliate/*` | `https://poshmark.com/terms` (Effective Date October 3, 2024): "copy, scrape, harvest, crawl or use any technology, software or automated systems to collect any information or data for the Service;" | no programme for outside publishers found. Search found only a seller campaign programme inside the app *asserted* (older blog posts). `/affiliates` returned 404 *observed* |
| Mercari | Googlebot and `*` disallow some paths; `Disallow: /search` not seen in the lines read; PetalBot and YandexBot barred | `https://www.mercari.com/us/tos/` blocked (Cloudflare 403) | not found for the US. A "Mercari Ambassador" 2% programme launched in Japan in November 2023 *asserted* (valueaddedresource.net snippet); no US confirmation |
| Depop | robots.txt blocked (403 "Forbidden - Depop") | terms blocked (403) | no official programme found; third-party pages (2023) say none on Awin and others *asserted*. Dupe lists Depop as a partner retailer *observed* (section 1) |
| Grailed | `Disallow: /search`, `/sold`, `/users/*`, `/listings/*/similar` | `https://www.grailed.com/about/terms`: "Use any robot, spider, scraper, crawler, data mining tools, data gathering or extraction tools, artificial intelligence or machine learning systems (including large language models), or other automated means to access, index, collect, harvest, or extract data or content from our Services;" and "Use any automated means, software, or service, including purchasing agents, automated bidding or buying tools, AI-powered assistants, or any system that submits offers, makes purchases, or completes checkout without direct human initiation and review of each transaction". Page date not captured | none found |
| The RealReal | `Disallow: /cart`, `/checkouts`, `/login`, paginated `?before=`/`?after=` URLs; no `/search` line | `https://www.therealreal.com/terms` ("Last Updated: [05/01/2023]"): "use any data mining, robots, or similar data gathering and extraction tools, or bypass or ignore instructions contained in Our robots.txt file or equivalent restrictive technologies that control automated access to portions of the Service;" and "develop or use any third-party applications that interact with the Service without Our prior written consent, including any scripts designed to scrape or extract data from the Service" | affiliate programme on Impact *asserted* by several directories; rates quoted from 0.8% to 7% conflict, none official. No product feed or search API found |
| Vestiaire Collective | robots.txt blocked (403) | terms blocked (Cloudflare 403) | affiliate programme *asserted* on Awin, Rakuten Advertising, CJ and Admitad depending on region, by third-party directories; rates 6% to 10% conflict. No official page read |
| Facebook Marketplace | not fetched | `https://www.facebook.com/terms.php` returned a JS shell with no readable text | no marketplace feed found; not investigated further |
| Vinted | not fetched | `https://www.vinted.com/terms-and-conditions` (200): users may not "use any kind of external software tools (including but not limited to: bots, scraping programs, crawling programs, spiders)" and may not "data mine, screen scrape, crawl, disassemble, decompile [...] any part of the Site" | not investigated |
| Etsy, ThredUp | Etsy `/legal/api` 403; ThredUp terms 404 | not read | not investigated |

*inferred* from the table: of the eight marketplaces in the brief, only eBay was shown, from its own page, to offer a search API or item feed. For the rest, a licensed feed was not found. That is a statement about this search, not proof that none exists.

## 11. Other sites, APIs or networks that show several marketplaces in one place

Not found beyond the candidates above. Skimlinks, Sovrn and Strackr appear only as affiliate-link tools (Dupe's form lists the first two; its site loads Strackr). No SERP API or feed reseller was evaluated.

## Not found

- A real results page for any aggregator (Google blocked by the permission classifier; Gem, Lyst, Mercari, Vestiaire blocked by bot challenges; ThriftX and Phia are apps; Dupe is a chat). Therefore no counts, source names, price, size, condition, photo, link-out, sold status or freshness seen live.
- Lyst terms; Lyst partner pages; Beni beyond the parked page.
- Official affiliate or feed pages for Poshmark, Mercari US, Depop, Grailed, The RealReal, Vestiaire, Facebook Marketplace.
- Terms for Mercari, Depop, Vestiaire, eBay user agreement and eBay API licence agreement (blocked); Facebook (script shell).
- Dupe terms effective date; Dupe API pricing and key-grant process beyond "Ask legal@dupe.com".
- Whether Dupe's catalog holds Mercari or Poshmark listings; whether Phia shows any resale.
- EPN commission percentages (page held them; not extracted).

## Sources fetched

All fetched 2026-11-15 by curl unless a search snippet is named.

- https://dupe.com/legal/terms, /partners, /faq, /agent.txt, /robots.txt, /about
- https://gem.app/terms, /robots.txt (search pages: blocked, HTTP 202)
- https://www.thriftx.shop/, /terms, /robots.txt
- https://phia.com/, /terms, /robots.txt
- https://www.lyst.com/robots.txt (home and terms: blocked, 403)
- https://shopstylecollective.com (closed page)
- https://beni.com (parked)
- https://policies.google.com/terms; https://www.google.com/robots.txt; https://support.google.com/merchants/answer/6324469?hl=en; https://developers.google.com/custom-search/v1/overview
- https://developer.ebay.com/api-docs/buy/static/buy-requirements.html; https://developer.ebay.com/develop/get-started/get-started-on-a-buying-application; https://epnpartnernetwork.ebay.com/page/network-agreement; https://www.ebay.com/robots.txt (developer search/licence/affiliate pages and user agreement: blocked)
- https://poshmark.com/terms, https://www.poshmark.com/robots.txt
- https://www.mercari.com/robots.txt (terms blocked)
- https://www.grailed.com/about/terms, /robots.txt
- https://www.therealreal.com/terms, /robots.txt
- https://www.vinted.com/terms-and-conditions
- Search snippets only (asserted): linkmydeals.com, affko.com, linkclicky.com (The RealReal); affilimate.com, postaffiliatepro.com, referralrocket.io, affi.io (Vestiaire); knoji.com, getvendo.com (Depop); valueaddedresource.net, affiliateprogramdb.com (Mercari); mommyhustles.com (Poshmark).
