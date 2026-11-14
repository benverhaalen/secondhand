# What did Ben's earlier depop-plus attempt teach, and which past hackathon projects did something similar?
Researched 2026-11-14 by Ben (Claude Code agent via Remote Control on Ben's Mac, read only). Feature: cross-cutting.

Ben, 19:16: "can look at depop plus repo i gave you too as i sorta attempted this" ([words](../../../product/words.md#2026-11-14-pitch-and-structure)). The GitHub repo holds only a README. The work is local and uncommitted (Apr to Jun 2026), so this note summarizes it and does not copy it.

## What it was (observed, local files)

- A Python command-line tool for one Depop seller, not a crosslister. It used SQLite, pydantic and typer, Claude for vision, and Chrome driven through CDP.
- **Intake worked.** It grouped photos into garments, tagged each photo's role (front, back, label, detail, flaw), extracted attributes with a confidence per field, matched brands by fuzzy name, and wrote a listing folder per item. It produced 99 listings from 524 photos, mostly at high confidence.
- **Publishing was the bottleneck.** 95 of the 99 items never got past NEW. The Depop Partner API is B2B only: it "cannot search, view likes, follow, message, or pull analytics". Playwright was blocked "within a few clicks", and the Chrome/CDP driver kept failing to connect.
- It had no messages, offers, delisting or second platform.

## Lessons for secondhand (inferred)

| # | Lesson | Where it lands |
|---|---|---|
| 1 | Access differs per platform and decides the architecture. Stealth automation broke and risks bans. Use official APIs where they exist (eBay), and a draft plus a user tap to post elsewhere. Treat each platform as an adapter with its own risk level. | connect, list |
| 2 | Photo grouping plus a confidence per field plus a review gate worked. Low confidence becomes "needs you". | capture, identify, today |
| 3 | Photo roles are the shot list. The label shot gave brand, size, material and era, and the flaw shots made descriptions honest. This confirms that shots serve both the listing and the AI. | capture |
| 4 | Keep rules deterministic and tested (title format, tags, pricing math, floors, offer percentages). The model does perception and prose only. | price, list |
| 5 | The pricing engine was ready, but no source of sold prices was ever wired, so prices were model guesses. Getting sold prices is the real work. | price, data |
| 6 | The item has to outlive any one listing: one item, many listings, and a sale that delists everywhere and then verifies. depop-plus was keyed per Depop SKU. | item-card, sold |
| 7 | Check new photos against what is already listed or sold, to stop double listing. | capture |
| 8 | Offers were the biggest lever ("40%+ of all Depop sales go through offers", per Ben's own playbook notes) and never got built. Plan approval cards early, with each platform's offer rules (Depop: offers expire in 24h and can't be cancelled). | messages, today |
| 9 | Give each action a class (read, write or destructive), with a denylist. Writes need a confirm. This is the Rule and Decision split in [primitives](../../../product/primitives.md). | today |
| 10 | Decide up front how long original photos are kept. Originals were deleted to save 4.9 GB, which lost resolution and metadata. | capture, data |

Its lifecycle had **WARM / COLD / STALE** states driven by engagement. That backs the Stale and Markdown states in [functions.md](../../../product/functions.md).

## Past hackathon projects in the same space (observed in Ben's local gallery scrapes)

These are other teams' projects, so they are competitive prior art for judging:
- **traid**: eBay first, with plans to expand to Facebook Marketplace and Depop and to add buying on top of selling.
- **swarmsell**: a live grid of agent browser windows posting across eBay, Facebook and Depop.
- **marco-polo**: fixing chat and offer chaos across marketplaces.
- **thrifty, sift**: photo or sentence search across Depop, eBay and Poshmark.
- **thrift-tinder**.

*Inferred:* judges may have seen "AI crosslister" and "agents posting in browsers" before. Our differences are measured, honest items, the human-in-the-loop decision design, appraisal built into both sides, and a data loop on Databricks.
