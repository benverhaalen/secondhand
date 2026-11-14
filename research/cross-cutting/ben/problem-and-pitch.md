# What does the data say about the problem, and how could the pitch use it?
Researched 2026-11-14 by Ben (Claude Code agent, concept thread). Feature: cross-cutting.

Ben, 19:15: "as part of pitching it it would be super useful to pitch from databacked research about the problem" ([words](../../../product/words.md#2026-11-14-pitch-and-structure)).

## The problem, in numbers

| Claim | Number | Source and date | Mark | Job for the pitch |
|---|---|---|---|---|
| Supply, not demand, is the constraint on resale | ThredUp: "Supply is the New Constraint"; "making the act of selling just as easy as clicking 'buy'" | ThredUp 14th Resale Report press release, 2 Apr 2026 (GlobalData, 3,268 US adults) | observed | **The thesis line.** The market leader says the bottleneck is selling. That is what secondhand fixes. |
| Sellers would pay someone to do it | 20% "definitely" and 36% "probably" would pay for a service that handles all of reselling. Of those, 68% would pay up to 20% of earnings | Morning Consult, 24 Sep 2024 (2,204 US adults; 1,136 sellers) | observed (2024: over two years old) | **Demand and willingness to pay** for a "second hand" |
| Selling is work | 26% of US adults sold something secondhand in the past 3 months. Sellers say organizing and photographing is "another feat unto itself", and some wonder if donating is a better use of time | Morning Consult, 2024 | observed | The friction we remove |
| Clutter overwhelms people | 50.5% of people with stored belongings say sorting it "feels overwhelming"; 60% of stored items would leave storage if sorted, "but the sort never happens" | Talker Research for CubeSmart, 30 Mar 2026 (2,000 US adults who have moved out; not general population) | observed | The emotional hook: "the sort never happens" |
| Sellable stuff per home | "$3,000 to $4,000" of sellable items in an average household | eBay CEO Jamie Iannone on a podcast, via Entrepreneur, 10 Sep 2025 | asserted (CEO estimate, no study) | A big number to use carefully, labeled as eBay's estimate |
| Buyers don't trust condition | 38% who don't buy secondhand online don't trust items arrive "in their promised condition"; 31% don't trust returns | Morning Consult, 2024 | observed | **Why measured, honest cards matter** (and fewer returns) |
| The market is growing fast | US secondhand apparel is expected to reach $78.8B by 2030 (~7.3%/yr). In 2025 it grew nearly 4x faster than retail clothing. Global: $393B by 2030 | ThredUp / Retail Dive, 2–3 Apr 2026 | observed | Market size slide |
| People already accept AI here | 48% use AI shopping tools when shopping secondhand; 63% are comfortable with agentic buying | ThredUp / Retail Dive, Apr 2026 | observed | AI agents are wanted, not feared, so the open question is trust |
| Scams are the risk of DIY selling | Americans lost $2.1B to social media scams in 2025. Shopping scams were the most reported type, and Facebook had the most losses | FTC via TechCrunch, 27 Apr 2026 | observed (not marketplace-specific) | Why the human stays in the loop, and why scam warnings exist |
| AI listing done badly backfires | eBay forced AI listing: complaints rose from 0.6% to 6.1% of negative reviews | [direct-references](direct-references.md) | asserted | Why our AI is optional, labeled and editable |

**Gaps (not found):** a current figure on the share of people who mean to sell but don't, and a 2026 figure on time per listing. ThredUp's full report PDF was not opened. *Inferred* next step: open the ThredUp PDF and Morning Consult's charts for the seller-difficulty percentages.

## The name: two meanings Ben gave (19:15)

1. **Your second hand.** An extra hand that does the selling and buying work for you, the way an AI agent does things.
2. **The second hand of the clock.** It's fast, so you only have to focus on the seconds.

*Agent proposal*, taglines that hold both meanings:
- "secondhand: a second pair of hands for your secondhand."
- "Sell it in seconds. We'll handle the rest."
- "Your stuff is worth $3,000. Getting it sold takes a second hand." (only with the eBay estimate labeled)

## Pitch spine (agent proposal)

1. **Problem:** the bottleneck is selling. That's from ThredUp, not us. Sorting "never happens", and 56% would pay someone to handle it.
2. **Why existing tools fail:** crosslisters need a desktop left on and miss delists. Forced AI listing angered eBay sellers. Buyers distrust condition.
3. **What we do:** guided shots, then a measured, honest card, then every platform. The agent handles the routine, and only decisions reach you.
4. **Trust:** you approve price, condition, address and pickup. Everything else is labeled and undoable.
5. **Data:** every sale teaches the price model, on Databricks.
