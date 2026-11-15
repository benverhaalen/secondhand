# Codex brief: why companies pay for affiliate links, and a reason for every bound in the money model
Researched 2026-11-15 by Ben (Claude, the brief only; Codex does the research). Feature: cross-cutting.

Written by the Claude thread that owns [roi.md](../../../product/roi.md), for one `codex exec` run on Ben's Mac. Ben, 09:09: "make whatever numbers you come up with have a reason. a specific reason why you chose those bounds ... also understand why companies pay for affiliate links." Kept in the repo so the prompt is inspectable.

---

You are doing research for secondhand, an app that helps people sell one item on several resale sites and helps buyers find used items, earning a referral commission when a buyer it sent chooses to buy. Today is 2026-11-15. You have web access: use it for every fact that could have changed. Nothing in this brief is a fact you may cite; open the source.

## Read first

1. `AGENTS.md`, `.agents/skills/research-note/SKILL.md`, `research/README.md`, `.agents/skills/writing/SKILL.md`.
2. `scripts/bench/roi.mjs` (every input and the three scenarios in `SCENARIOS`), `product/roi.md`, `research/cross-cutting/ben/revenue-market.md` (already researched today: program rates, Honey, Flyp and Vendoo prices, market sizes; build on it, never redo or contradict it silently), `research/watch/nate/buyer-side-actions-and-affiliate.md`, `product/business.md`.

## Part 1: why a company pays for an affiliate link, and what that means for who would pay us

Answer from the advertiser's side, with numbers.

1. **Pay on a sale versus pay for attention.** What an advertiser pays per acquired customer or per order through affiliates (cost per acquisition, as a share of the order) against paid search, paid social and display, for retail and for marketplaces. Find published benchmarks with their method and year; say who funded each.
2. **Incrementality.** The evidence on how many affiliate or coupon-site sales would have happened anyway, and why advertisers discount or exclude coupon and cashback partners. Look for academic work (for example Blake, Nosko and Tadelis 2015 on eBay's paid search is the closest ad analogue; Edelman and Brandi 2015 on affiliate fraud and attribution at a large retailer; any study on coupon or browser-extension incrementality) and practitioner holdout tests. Say what an advertiser would believe about traffic from an app like ours, where the person searched for an item and then clicked through.
3. **Attribution windows and last click.** The window and model of each program we would use (eBay Partner Network, Amazon Associates, Rakuten for Etsy, Skimlinks or Sovrn, Impact or CJ where a resale site runs one), and what last-click means when the person also arrives through another link. Tie this to the Honey case already in revenue-market.md §7.
4. **Why a marketplace can afford a rate.** A two-sided marketplace earns a take rate on what sells (fees plus payments plus ads). Find each one's take rate from filings or fee pages: eBay, Etsy (and Depop inside it), Poshmark (last filing and any later disclosure), Mercari US, Grailed, Vinted, ThredUp, The RealReal. The ceiling on what it can pay per referred order is about take rate × the share of that order it believes is new demand. Show the arithmetic per marketplace, and compare with the rate each one publishes or is reported to pay.
5. **So who would pay us, and at what rate.** For each marketplace above: does a program exist that a small new app can join (observed, with the page), its rate and window, the approval gate, and your reasoned estimate of the rate we would actually earn, with a low and high bound and the reason for each bound. Also say what we would have to show an advertiser to get a better rate (incrementality evidence, new buyers, order value).

## Part 2: a reason for every bound in the money model

Ben wants each number to have "a specific reason why you chose those bounds". For every input marked `assumption` in `INPUTS`, and every value in `SCENARIOS` (conservative, base, flattering), write:

- the value now, and whether the research supports it, moves it, or cannot say;
- the reason for the low bound and for the high bound, each tied to a source or a stated piece of arithmetic (for example a published conversion rate, a crosslister's disclosed listings per user, a measured photo-upgrade attach rate in another app, a cloud bill from a comparable startup);
- where no evidence exists, say so and give the narrowest defensible range with the reasoning, marked *assumption*.

Inputs that need this most: `purchases_per_mau` (0.05 / 0.2 / 0.5), `items_per_mau` (1.0 / 1.5 / 2.0), `studio_attach` (5 / 10 / 15%), `plan_share` (1 / 2 / 3%), `searches_per_mau` (3 / 5 / 8), `depop_account_days_per_mau` (30% of people with a Depop listing live 20 or 15 days), `mix`, `network_merchant_rate` (3%), `platform_fixed` ($1,500 a month), `platform_per_mau` ($0.02), `studio_price` ($0.99), `plan_price` ($9.99), `judge_read` ($0.005).

## What to write (the only file you create; change nothing else)

`research/cross-cutting/ben/affiliate-economics.md`, a research note: an Answer section first (why companies pay, in five sentences or fewer, then the table of who would pay us and at what rate with bounds), then Part 1, then Part 2 as a table with one row per input: input, value now, low bound and its reason, high bound and its reason, source, verdict (keep, move to X, unknown).

## Rules

- Mark every claim *observed* (you read it on the source; give the URL and date read), *asserted* (a source says it without showing it), *inferred* (your arithmetic; show it) or *assumption*. A vendor benchmark is *asserted*; a filing or a program's own terms page is *observed*.
- Rawest source first: filings, program terms, papers. A listicle only points you to a source.
- Say what you searched and could not reach. A thin search does not show that something does not exist.
- No invented numbers. No secrets or personal data. Do not run git commands that write. Do not edit any other file. Do not run `.agents/check.mjs`.
- When finished, write `WORKER_REPORT.md` in the folder root: the file, the three facts you are least sure of, and anything not done with the reason.
