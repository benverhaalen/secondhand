# Codex prompt: how resale platforms suggest prices, and where ours differs

Written 2026-11-15 by the benchmark thread for Ben's 09:31 message. Run from the repo root with web search on and `-s workspace-write`. Research and one note only; no code.

---

You are working in the secondhand repo. Read `AGENTS.md`, `.agents/skills/research-note/SKILL.md`, `.agents/skills/writing/SKILL.md` and `research/README.md` and follow them exactly. Plain full sentences, no em dashes.

## The question

Ben, 2026-11-15 09:31: "i know depop does price estimates in there app, research that and similar reselling platforms that share similar features"

Question: what do resale platforms and cross-listing tools show a seller when they suggest a price, what data do they use, and where does our pricing do better or worse? Decision it feeds: how our pricing modes (`spec/plans/backtest/pricing-modes.md`) and the "Why?" taps on a price should be framed and what they must beat.

## Step 0: record Ben's words

Append to `product/words.md` (append only, never edit an existing line) a block in the format of the blocks above it, headed `## 2026-11-15 ben research how depop and other resale apps estimate prices`, with: "Ben, project chat, 2026-11-15 09:31 UTC." and the quote verbatim:

> i know depop does price estimates in there app, research that and similar reselling platforms that share similar features

Link that block from the note's header.

## Step 1: write your draft first

Before searching, write in the note under **Draft** what you believe from memory about each product below. Then search both for and against each draft line, and say under **What changed** which lines held and which were wrong.

## Step 2: products to cover

Depop (in-app price suggestion when listing), Poshmark (any suggested or "similar sold" pricing), Mercari (suggested price and Smart Pricing / auto price drops), eBay (price guidance when listing, "sold similar", Terapeak in Seller Hub), Vinted (suggested price when uploading), Grailed (price suggestions or sold comps), Vestiaire Collective (price recommendation or authentication-linked pricing), ThredUp (payout estimates for Clean Out kits), and the cross-listers Vendoo, List Perfectly and Flyp (any pricing or sold-comps features). Add any other resale app you find with a comparable feature, and say how you found it.

For each, find and mark *observed* / *asserted* / *inferred* with source and date:
1. What the seller sees: one number, a range, comparable sold items, a time to sell, an auto-drop schedule. Quote the help page or press wording.
2. What data it likely uses (own sold listings, category, brand, condition, photos), and whether the platform says so.
3. Whether it explains its reasoning, shows a range, or says how long the item will take to sell at that price.
4. How sellers rate its accuracy: Reddit seller communities, reviews, forums, press. Quote at least two sellers per major platform where they exist, with the date, and say if feedback is thin. Separate complaints about the price being low (platform wants fast sales) from complaints about it being wrong.
5. The incentive: the platform earns a fee share and a faster sale; say where that could bias the suggestion low, as *inferred*, unless a source shows it.
6. Where we beat it and where we do not, against what our code and spec actually do: read `spec/plans/backtest/pricing-modes.md`, `spec/plans/backtest/how-we-price.md` §2, `spec/plans/backtest/claims.md` and `spec/engines/valuation.md` "The price slider". Be honest: we have no live sold comps flowing yet, no sale-speed curve, and our only scored accuracy is on StockX. Do not claim what those files do not support.

## Rules

- Public sources only: help centres, official blogs, app store listings and screenshots in press, Reddit and forum posts, reviews, press. Never sign in to any account, and never use Ben's personal Depop account or any of his accounts.
- Use the rawest source. A listicle only points you to the platform's own page. Open the page you cite and record its date or the date you read it.
- Say what you searched and what you could not reach (for example, help pages that need an app or a login). A search that found nothing does not show the feature does not exist.

## Output

Write `research/price/ben/platform-price-suggestions.md` with the header `research/README.md` requires, then: Draft; What changed; one table (product, what the seller sees, data used, explains why / range / time to sell, seller-rated accuracy, incentive, where we beat it, where we do not); a short section per product with the quotes; **How our modes and the "Why?" taps differ**, in at most eight sentences; and **The sharpest one-line differentiator**, which must be true today or say "once X ships". Then what you searched and could not reach.

Add a one-line summary with a link to `features/price/README.md` (create the bullet in its research list). Run `node .agents/check.mjs` and fix anything your note causes. Commit only those three paths (the note, the README line, words.md) with `docs(research): how resale platforms suggest prices` and a `Rests-on: product/words.md (Ben 09:31)` trailer; pull with `--no-rebase` and push to main. Print the one-line differentiator and the table.
