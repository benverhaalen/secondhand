# What does Apify show about building our own marketplace API in the cloud?
Researched 2026-11-14 by Nate (Claude Code lead, Fable 5.2). Feature: connect.

Marks: *observed* (read on the page linked, 2026-11-14, through search highlights of that page), *inferred* (reasoning, basis given). Nothing was run. An Actor's description is its author's claim about itself.

## The answer

Apify is a hosting platform for packaged fetchers plus a proxy service. Its marketplace fetchers show that broad reads of these sites need no browser and no login, and its Server Actors show how to keep a fetcher up as a fast HTTP endpoint. Both fit what we already specified. It offers nothing for acting inside a person's account.

## What was read

| Fact | Mark | Source |
|---|---|---|
| A Server Actor (formerly Standby) runs a persistent HTTP server; the platform starts another run when concurrent requests pass a set number and stops a run after an idle timeout; requests need an API token; an Actor can expose an MCP endpoint | observed | [server actors](https://docs.apify.com/actors/development/programming-interface/server-actors) |
| A compute unit is 1 GB of memory for one hour: $0.20 on Free and Starter, $0.16 on Scale, $0.13 on Business | observed | [pricing](https://apify.com/pricing) |
| Residential proxy $8 per GB (Free, Starter), $7.50 (Scale), $7 (Business); Unblocker $1.50 per 1,000 requests down to $1 | observed | [pricing](https://apify.com/pricing) |
| A proxy session id keeps one IP address: about 30 minutes on residential, 26 hours on datacenter; its SessionPool stores cookies per session | observed | [proxy](https://docs.apify.com/proxy), [residential](https://docs.apify.com/proxy/residential-proxy) |
| Most Store Actors charge per event, such as per result; some add platform usage | observed | [pricing](https://apify.com/pricing) |
| A Depop Actor reads "Depop's own public JSON API", no browser, one request per 48 listings, 11 country sites, sold and boosted flags, from $1.50 per 1,000 | observed (author's claim) | [depop-scraper](https://apify.com/ahmed_jasarevic/depop-scraper) |
| A four-site Actor returns Poshmark sold, Mercari US sold and in-transaction, and Grailed sold listings with sold price and date, "No login, no cookies, no browser", and says Depop shows no sold items publicly | observed (author's claim) | [resale-sold-comps-scraper](https://apify.com/kalilfagundes.w/resale-sold-comps-scraper) |
| An eBay sold Actor charges $3.50 per 1,000 sold listings, leaves accepted Best Offers out of its statistics "because eBay hides their real price", and fails loudly when blocked | observed (author's claim) | [ebay-sold-listings-api](https://apify.com/epicscrapers/ebay-sold-listings-api) |
| Grailed Actors read "Grailed's public search service" with no login or proxy, with sold price, price-drop history and seller score | observed (author's claim) | [grailed-listings](https://apify.com/bovi/grailed-listings), [grailed-scraper](https://apify.com/unfenced-group/grailed-scraper) |
| Apify's own Facebook Marketplace Actor returns title, price, location, seller and status (sold, live, pending) from pasted Marketplace URLs | observed | [facebook-marketplace-scraper](https://apify.com/apify/facebook-marketplace-scraper) |

## What follows

| Deduction | Basis | Mark |
|---|---|---|
| Public market reads on Depop, Poshmark, Mercari and Grailed can be plain HTTP calls to each site's own search service, so our intelligence engine's parallel reads cost milliseconds, not browser minutes | four independent Actors say so of four sites | inferred |
| The two Depop Actors disagree on whether sold state is public (one returns sold flags, one says Depop shows no sold items). Our recon settles it on the first run | the two pages | inferred |
| The accepted Best Offer price is not on eBay's public pages, which is why our valuation reads it through the person's own seller session | the eBay Actor's own note | inferred |
| None of these Actors posts, edits, messages or reads a seller's own account. Acting in an account is ours to build, through the person's session | their descriptions list reads only | inferred |
| A fetcher kept up as a server, scaled on concurrent requests, is the shape for our adapters | server actors page | inferred |

## Not checked

- No Actor was run, so no success rate, speed or field was measured by us.
- Apify's anti-blocking internals (fingerprint generation, Unblocker) were not read beyond the names.
- Other hosting platforms of the same kind were not compared in this note.
