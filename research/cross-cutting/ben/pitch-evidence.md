# What does the data say about selling secondhand, beyond the first pass?
Researched 2026-11-14 by Ben (Claude Code agent, pitch thread). Feature: cross-cutting.

Builds on [problem-and-pitch.md](problem-and-pitch.md) (ThredUp 2026, Morning Consult 2024, FTC 2025, CubeSmart) and does not repeat it. Full source tables with every caveat: [pitch-sources.md](pitch-sources.md). Ben's ask: [words](../../../product/words.md#2026-11-14-pitch-and-structure).

**Draft answer before searching:** "people don't sell because it takes too long." **What changed:** time per listing is no longer the strongest claim. eBay and listing vendors now put AI drafting at about 30 seconds, so a speed-only pitch is a commodity pitch. The stronger, better-sourced problem is the *economics of cheap items*: the choices on offer give you either almost nothing (consignment) or a fair share for work that usually doesn't finish (DIY). Speed still matters, but across the whole job (posting everywhere, messages, delists, pickup), not the first draft.

## Claims the pitch can use

Marks: observed = the page was opened and states it; asserted = stated without method, or vendor marketing; inferred = our reasoning. Checked by Opus 5.5 on 2026-11-14 unless noted.

### 1. The do-it-for-me option pays almost nothing on cheap items
| Claim | Mark | Source |
|---|---|---|
| ThredUp Clean Out pays **3% of a $5 sale, 15% of a $20 sale, 30% of $50, 60% of $100, 80% of $200**, as a share of the selling price | observed (estimator table on the page; no date shown) | [thredup.com/cleanout/guide](https://www.thredup.com/cleanout/guide#earnings) |
| A $14.99 service fee per bag is taken out of earnings | observed (help page updated 2026-08-18; the guide shows a $0.00 promo that may be temporary) | [ThredUp help](https://help.thredup.com/en_us/what-might-i-earn-when-selling-with-thredup-Sk6f9mJoh.md) |
| eBay shut down Valet, its own sell-it-for-you service, in 2018 | observed (date and shutdown); the reason given ("individualized services like Valet are in trouble") is the writer's, not eBay's | [eSeller365, 2018-03-28](https://www.eseller365.com/ebay-shuts-down-its-listing-service-ebay-valet/) |
| 56% of sellers would definitely or probably pay a service to handle reselling, and 68% of them would pay up to 20% | observed, Morning Consult 2024 | [problem-and-pitch.md](problem-and-pitch.md) |

*Inferred:* human consignment fails on cheap items because a person's time costs the same for a $5 shirt and a $200 bag, so the payout tiers slope steeply. An agent's cost per item is close to flat, which is the opening. The 20% people say they'd pay is about what Poshmark already takes, so the room is in doing the work, not in the fee.

### 2. Doing it yourself keeps the money but rarely finishes
| Claim | Mark | Source |
|---|---|---|
| eBay takes **13.6%** of the sale for most categories, plus $0.30 per order ($10 or less) or $0.40 (over $10) | observed | [eBay selling fees](https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822) |
| Depop US charges sellers **0%** since 2024-07-15 (buyers pay up to 5% + $1) | observed | [Depop newsroom](https://news.depop.com/depop-removes-selling-fees-in-the-united-states-evolves-fee-structure/) |
| Poshmark 20% over $15 and $2.95 under; Mercari 10%; Facebook 0% local, 10% shipped | asserted (crosslister blogs; Poshmark's page blocks fetches) | [pitch-sources.md](pitch-sources.md) |
| Only **12.2%** of 33,638 eBay listings sold within 30 days; **8.6%** of those under $15, against 27.6% at $100–$249.99. Median 7.5 days for those that sold | observed (vendor study of its own users, mostly volume used-apparel resellers, May–Sept 2026; the study calls every effect a correlation) | [FlowLister study, 2026-10-15](https://flowlister.com/ebay-listing-data-study/) |
| Writing one listing by hand takes 4–7 minutes for an experienced seller | asserted (vendor, no measurement shown) | [FlowLister AI data](https://flowlister.com/ai-listing-data-2026/) |
| eBay says AI listing cut the steps to list by 50% in UK tests | observed that eBay says it; no time figure | [eBay, 2025-04-09](https://innovation.ebayinc.com/stories/ebay-reduces-the-time-to-list-on-mobile-with-new-simplified-selling-tool-now-featuring-magical-listing-ai-technology/) |

*Inferred, the $20 shirt:* ThredUp pays you $3. eBay leaves you about $16.88 ($20 − $2.72 − $0.40, before shipping, which eBay's fee also applies to). Depop leaves about $18.90 after payment processing (processing rate asserted). The gap between $3 and $17 is the work, and fewer than 1 in 10 cheap eBay listings finish that work within a month in the one dataset we have.

### 3. There is a lot of it, and it sits
| Claim | Mark | Source |
|---|---|---|
| 85% of US eBay sellers found resellable items at home: on average **36 items worth $3,675** | observed (eBay-sponsored, n=4,330 existing sellers in 5 countries, 2020; it samples people who already sell) | [eBay Recommerce Report 2020](https://static.ebayinc.com/assets/Uploads/Documents/eBay-Recommerce-Report-2020.pdf) |
| US secondhand apparel: $78.8B by 2030; resale grew nearly 4x faster than retail clothing in 2025; ThredUp names supply as the constraint | observed (ThredUp/GlobalData, sponsor has a stake) | [ThredUp, 2026-04-02](https://newsroom.thredup.com/news/thredup-14th-resale-report) |
| eBay Q3 2026 GMV $23.2B (+15%); 147M active buyers, but **136M (+1%) without Depop and Tise** | observed | [eBay Q3 2026 release via finviz](https://finviz.com/news/410508/ebay-inc-reports-third-quarter-2026-results) |
| Vinted 2025 GMV €10.8B (+47%) | observed via secondary article | [FashionUnited, 2026-04-09](https://fashionunited.com/news/business/vinted-reaches-1-1-billion-euros-in-revenue-for-2025-accepting-a-strategic-drop-in-profits/2026040971654) |
| Mercari US GMV fell from $1.015B (FY23) to $728M (FY25), then $810M (FY26) | observed via secondary blog | [Value Added Resource](https://valueaddedresource.net/mercari-q4-2026-earnings/) |
| 21% of Americans rent self-storage | observed (StorageCafe self-selected survey, 2023; another aggregator says 33%, so treat as a range) | [StorageCafe](https://www.storagecafe.com/blog/a-fifth-of-americans-rent-self-storage-gen-xers-lead/) |

*Against the draft:* growth is not even. Mercari shrank 28% over two years, and eBay's organic buyer count is flat. The honest framing is "demand is there, supply is stuck", which is ThredUp's own line, not "every platform is booming".

### 4. Agents are wanted, but an agent that acts alone is the known failure
| Claim | Mark | Source |
|---|---|---|
| 48% of secondhand shoppers use AI shopping tools; 63% say they're comfortable with agentic buying | observed (ThredUp survey, stated attitude) | [Retail Dive, 2026-04](https://retaildive.com/news/us-resale-market-surpass-78-billion-in-2030-secondhand/816470/) |
| 31% of US shoppers would let AI spend **$0** on its own; median limit $50; 11.7% would trust it over $100 | observed (n=1,009, undated online survey) | [Search Engine Land](https://searchengineland.com/new-data-77-use-ai-to-shop-nearly-1-in-3-wont-let-it-spend-475614) |
| Meta's Muse agent, on an "Allow Always" setting, accepted a lowball offer and sent a stranger to the seller's home address ("Yep I'm here!") | observed via Proton, 2026-09-30; Meta disputes fault | [Proton](https://proton.me/blog/meta-muse-ai-home-address) |
| eBay's User Agreement, from 2026-02-20, bans "buy-for-me agents, LLM-driven bots, or any end-to-end flow that attempts to place orders without human review" | observed; the examples are about buying, but the clause bans automated access "for any purpose" without permission, so listing tools are not clearly safe either | [Value Added Resource, 2026-01-21](https://www.valueaddedresource.net/ebay-bans-ai-agents-updates-arbitration-user-agreement-feb-2026/) |
| Poshmark suspends listing for 6 days for repeated delist/relist or mass removals, "manual or automation"; crosslister users were hit for deleting items sold elsewhere | observed (news report of the policy, 2025-05-02) | [Modern Retail](https://www.modernretail.co/technology/i-followed-their-rules-and-was-hit-anyway-poshmark-sellers-voice-frustrations-with-new-excessive-listing-policy) |

*Inferred:* the human approving price, address, pickup and any purchase is not a compromise. It is what the platforms' rules and the one public failure both point to, and what most shoppers say they want.

### 5. Scams: real, but size them honestly
| Claim | Mark | Source |
|---|---|---|
| UK purchase scams 2025: 175,809 cases, £118.1m (+20%, a record), 71% of APP fraud cases; UK Finance asks for mandatory seller verification on marketplaces | observed | [UK Finance Fraud Report 2026](https://www.ukfinance.org.uk/system/files/2026-06/UK%20Finance%20Fraud%20Report%202026.pdf) |
| 49% of Barclays' 2025 scam claims began on an online or social marketplace | observed (one bank) | [Barclays](https://home.barclays/insights/2025/03/marketplace-scams-spring-cleaning) |
| FBI IC3 2025: non-payment / non-delivery, 56,478 complaints and $503.4M lost | observed (from a mirror of the report) | [IC3 2025](https://ppc.land/content/files/2026/07/2025_IC3Report.pdf) |
| NYPD counted 90 Marketplace-linked robberies by mid-May 2024, against 58 the year before | observed (CBS, 2024-05-15) | [pitch-sources.md](pitch-sources.md) |

*Against the draft:* the FTC's $2.1B social-media figure is mostly fake stores from ads, not person-to-person resale, and online shopping fraud is a small slice of total fraud (median loss about $130). Use scams as the reason for the guardrails, not as the headline.

## Gaps
- No independent time-and-motion study of listing, messaging or pickups. Every minutes figure is vendor-made. **Instrument we can run ourselves:** time Ben listing one real item by hand on eBay, Mercari and Depop, then with secondhand, and quote it as our own measurement (n=1, observed).
- No data on why people with unused items never sell them (hassle versus scam fear versus "not worth it").
- No crosslister user counts, no share of sellers who crosslist, no Poshmark or Mercari sell-through.
- The ThredUp PDF, the FTC data book and Meta's own marketplace numbers were not opened.
