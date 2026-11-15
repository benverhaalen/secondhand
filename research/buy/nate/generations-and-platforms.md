# What each generation wears, and which platform stands in for which generation

Researched 2026-11-15 by Nate (Claude Code, the buying-conversation lead; a retriever seat searched with Exa and the web, and fetched the pages marked observed). Feature: buy, for the evaluation question "What are the latest fashion trends millenials are wearing, what about gen z" ([features/assist](../../../features/assist/README.md#the-question-to-test-best)).

Each claim is marked *observed* (the quote was read on the fetched page today), *asserted* (a search highlight or a secondary source says it, not checked further) or *inferred* (ours). Our own data holds no buyer ages, so every generation claim in an answer comes from a source like these, named.

## Platform audiences, the stand-in for a generation

| Platform | Claim | Source | Mark |
|---|---|---|---|
| Depop | users aged 17 to 25 were 47% of weekly active users in January 2026 and 39% by August 3 (an app panel) | [Apptopia, 2026-08-17](https://apptopia.com/en/insights/vinted-passed-ebays-depop/) | observed |
| Depop | "users are mostly under 34" | Fortune, 2026-10-29, a photo caption | observed |
| Depop | 90% of users under 26 | Retail Gazette, 2026-03-02 | asserted |
| Poshmark | "Millennials and Gen Z account for 80% of the Poshmark users" (a company claim; no 2026 figure found) | [NAVER, 2023-01-13](https://www.navercorp.com/en/media/pressReleasesDetail?seq=31083) | observed |
| Poshmark | skews older than Depop | Comscore, 2024-07-18 | asserted |
| eBay | 46% of 18 to 29-year-olds buy secondhand weekly or every two weeks, against 28% overall (all secondhand buying, not eBay's own mix; n 10,523) | eBay Recommerce Report 2026 (Bounce Insights) | asserted |
| eBay | the US base skews older and male | Apptopia | asserted |
| Vinted | "no single generation significantly outpaces the others" | [NIQ, 2024-06-10](https://nielseniq.com/global/en/insights/analysis/2024/the-vinted-tidal-wave-a-second-hand-essential/) | observed |
| Grailed | a mostly male, Gen Z audience | Vogue, 2022-10-25 | asserted |
| ThredUp | Gen Z and millennials are set to drive more than 70% of resale market growth through 2030 (the market, not ThredUp's users) | [ThredUp 14th Resale Report, 2026-04-02](https://newsroom.thredup.com/news/thredup-14th-resale-report) | observed |

Not found: eBay's buyer age mix, Mercari US's, ThredUp's audience, a 2026 Poshmark figure, Meta's figure for Facebook Marketplace.

What this allows (*inferred*): Depop can stand in for "younger buyers, much of them Gen Z", cited to Apptopia; no platform we read stands in for millennials on its own, so a millennial claim comes from a trend source, not from a platform's rows.

## What the sources say each generation is wearing

| Source | Evidence type | What it names, and for whom | Mark |
|---|---|---|---|
| Pinterest Predicts 2026, 2025-12-09 | search data, percentages with no base | "67% of the 2026 trends are driven by Gen Z"; fashion: poetcore (up 175%), '80s luxury "glamoratti" (up 225%), utility dressing (Gen Z and millennials), cool blue (Gen Z and millennials), the brooch revival (led by boomer and millennial men), "wilderkind" (Gen Z and boomers) | observed |
| Lyst Index Q3 2026, 2026-10-28 | a demand index from about 160 million shoppers a year, not sales | Prada first, demand up 55%; the Prada Wish pouch, searches up 498%; COS Trullo bag, Celine x Reebok, Vans Authentic, Chanel ballet flats, Cartier Tank. No generation given | asserted (via FashionUnited and Hypebae) |
| eBay Watchlist fall and winter 2026, 2026-11-10 | eBay's own demand | archival Chanel, Dior and Gucci lifted by creative-director changes. No generation given | asserted |

Not found: a generation-split fall 2026 list from ThredUp, Depop, Poshmark, Vogue Business, WWD or BoF.

## Cautions an honest answer carries

- Sources cut generations at different ages (Vinted's Gen Z is 11 to 26, Harris's 12 to 27) (*asserted*, the sources' own definitions).
- A platform's audience is not the wearer: a buyer, a seller and a gift giver can differ (*inferred*).
- Search growth and demand indexes are not sales, and a percentage with no base cannot be compared across sources (*inferred*).
- Our own reads are asking prices on one day: they show what is listed and liked now, and cannot show rising until the same reads repeat (*inferred*; [market-index.md §6](../../../spec/engines/market-index.md#6-todays-slice)).

The full retrieved evidence, with every quote, is in the side-session notes (`buy-trends-evidence.md`), outside the repo because it was not all checked against the pages.
