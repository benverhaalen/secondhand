# Post to Grailed and OfferUp

Raised by Ben, 22:09: "plan them but dont do anything yet. things if we have time" ([words](../product/words.md#2026-11-14-grailed-and-offerup-posting-planned-not-built)). Today both sites are search and price only ([decision](../product/decisions.md#2026-11-14-the-platform-list-is-set)).

**Waits on:** posting working on eBay, Facebook Marketplace, Depop, Poshmark and Mercari.

## The plan

*Agent proposal*, moved here from [platform-fit.md](../research/list/ben/platform-fit.md).

| Step | Grailed | OfferUp |
|---|---|---|
| Why add it | the best market for streetwear and designer menswear | a second local audience for furniture, appliances, tools and bikes |
| Gate | only fashion whose brand maps to a Grailed designer; warn under $33 | only product types marked best or good; stay inside the monthly free listing caps |
| Route | a Browser Use draft the person taps to post, like Facebook. Grailed's terms ban third-party tools without written consent, so the person presses every button that changes the listing: post, bump, price drop, offer | a Browser Use draft the person taps to post. Local pickup only, so there is no checkout, label or payout to handle |
| Listing rules | [grailed.md section 15](../research/list/ben/platforms/grailed.md#15-adapter-rules-agent-proposal): 7-word title, one designer, 6 to 9 photos with tag shots, list at target divided by 0.85, mind the $120 fee step | [offerup.md section 15](../research/list/ben/platforms/offerup.md#15-adapter-rules-agent-proposal): plain title, 8 photos, list 10 to 15% over target |
| After posting | remind the person to bump every 7 days; offers bind, so every accept is a tap; listing shows "in review" until Grailed publishes it | chat is the sale: reply fast, agree a meetup, the person confirms the handoff |
| Sold | delist on the sale signal from the other sites; a Grailed sale is read from email or a poll | the person marks it sold |
| Build order | after Poshmark and Mercari, since it reuses the same draft-and-tap harness | after Facebook, since it reuses the local conversation flow |

## First step

[platform-fit.json](../research/list/ben/platforms/platform-fit.json) already carries both sites with `role: "search"`. Change one to `post` and build its harness the same way as the five core sites.
