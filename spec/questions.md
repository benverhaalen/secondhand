# Questions we will be asked

*Agent proposal*, from Ben at 05:18 ([words](../product/words.md#2026-11-15-who-judges-it-guarantees-the-buyer-side-messages-you-approve-meetups-audit-every-site-and-no-fixed-pickup-schedule)): "in a plan before we go present we should be able to answer most of them", and "we should def have an faq section". Each answer is short enough to say out loud, links to where the spec settles it, and names the number that proves it where there is one. **Open** means nobody has decided yet. The website's FAQ takes the selling, buying and trust rows in plain words.

Who asks: hackathon judges (Databricks among them, for the [Databricks track](databricks.md)), mentors, and people who would use it.

## What it is

| Question | Answer | Proof to show |
|---|---|---|
| What does it do, in one line? | Take a photo of something you own, and it is priced and listed on the right sites, and kept in step until it sells | the stopwatch run ([pitch](../product/pitch.md#numbers-to-measure-ourselves-before-the-pitch)) |
| Who is it for? | Someone clearing out their own things, who wants them gone more than they want top dollar ([decision](../product/decisions.md#2026-11-14-the-first-person-we-build-for-is-someone-clearing-their-own-things)) | the personas ([personas](../product/personas.md)) |
| Isn't this Vendoo or List Perfectly? | Those copy one listing to many sites for resellers. This starts from a photo, prices from sold data per site, decides which sites to skip, answers buyers, and takes everything down on a sale | the parity table ([parity](parity.md)) |
| How is buying in it? | One search across the five sites and official stores, ranked by delivered price against what it is worth, and wants that watch while you are away ([buy](features/buy.md), [watch](features/watch.md)) | a live want finding a match |

## What we guarantee, and how

| Question | Answer | Proof to show |
|---|---|---|
| Will it sell my thing twice? | Other listings pause the moment an offer is accepted and come down on payment; a sale is seen in about 2 minutes; if two buyers pay anyway, you choose who keeps it with the cost of each shown ([edge cases §1](edge-cases.md#1-two-sites-sell-it-at-once)) | `sold_to_all_down_ms` per site |
| Will it sell below my price? | Never without your tap. Below your lowest price always asks, and that rule cannot be turned off ([decision](../product/decisions.md#2026-11-14-a-price-below-your-floor-always-asks)) | the policy test |
| Will it say things to buyers I didn't approve? | Replies start as drafts you approve; it answers on its own only kinds of questions you have approved three times unchanged, and only with facts you confirmed ([ways out §6.3](ways-out.md#63-messages)) | `claim_check` holds |
| Does the AI fake my photos? | Edits are opt-in, and each is checked against your original: a missing flaw or changed tag text blocks it ([edge cases §6](edge-cases.md#6-photos-clean-up-and-ai-enhancement-are-two-different-things)) | lies caught out of 60 in the photo benchmark |
| Do you see my passwords? | No. You sign in on the site's own page. Saving a password is off by default, and when on it goes to a secret store no person can read ([protocol §3.7](engines/protocol-and-adapters.md#37-depop-without-partner-access-agent-proposal)) | the refused-identity test |
| Do you hold my money? | Never. Each site pays you; we show when ([edge cases §17](edge-cases.md#17-what-we-control-and-what-each-site-does)) | |
| Can I see what it did? | Every action has a why, an undo where the site allows, and a page per site showing what we did and what changed there ([ways out §6.16](ways-out.md#616-you)) | the events log |
| What if it gets something wrong? | Every fact can be fixed in place and the fix wins everywhere; every automatic step can be set to ask ([ways out](ways-out.md)) | |
| Is it safe to meet buyers? | Public spots first, daylight, your home address only on its own tap, share-my-plan, and warnings for the known payment scams ([edge cases §16](edge-cases.md#16-meeting-up-safely)) | |

## Is it allowed by the sites?

| Question | Answer | Proof to show |
|---|---|---|
| Is acting in my account against the sites' rules? | It is your own agent: it acts only in your account, only on what you turned on, at a person's pace, and never routes around a bot check ([Nate](../product/words.md#2026-11-14-nate-the-person-signs-off-so-it-is-their-own-agent-acting)) | the pace bench: challenges per 100 actions |
| What about eBay's rule on AI buying agents? | Nothing on the buy side that commits you is automatic; you tap Buy on the site ([product §5](product.md#decision-kinds-the-complete-list)) | |
| What if a site changes its pages? | Each action is checked against its expected fields; a change triggers the repair loop, and the fallback is a one-tap handoff to the site ([protocol §3.4](engines/protocol-and-adapters.md#34-the-repair-trigger-and-the-repair-loop)) | the mutation drill: repairs out of 10 |
| Depop has no API for you. | We use your own signed-in session, the same requests Depop's site makes ([protocol §3.7](engines/protocol-and-adapters.md#37-depop-without-partner-access-agent-proposal)) | a live Depop post and read-back |

## Data and Databricks

| Question | Answer | Proof to show |
|---|---|---|
| Why Databricks? | One catalog for every table, model call and photo; Lakebase for the app's live state next to the analytics; jobs that scale to zero ([databricks §1](databricks.md#1-databricks-in-plain-words)) | the architecture diagram ([databricks §3](databricks.md#3-the-architecture)) |
| What data makes it better over time? | Every sold price we read, every correction a person makes (an edit is a label), and how each listing performed per site, feeding the price ranges and the success score | comps held by demo time, from how many sites |
| Is the price range honest? | It is calibrated so the stated range holds the real sale price as often as it says, and it is hidden when there are too few sales ([money D6](determinations/money.md#d6-range-calibration-and-display-state)) | coverage on held-out sales |
| What do you do with my data? | It is used for your account, and anonymised market data only if the business model choice below says so; export and delete are always there ([data](features/data.md)) | |

## AI

| Question | Answer | Proof to show |
|---|---|---|
| Where is AI used, and where not? | Models read photos and words, and draft text. Prices, policies, what may be sent and every outward action are plain code ([product §5](product.md#5-who-may-act)) | |
| How accurate is identification? | Measured on a labelled set ([identify](features/identify.md#how-we-will-know-it-works)) | top-1 accuracy |
| Can it be tricked? | Text read from photos and messages is data, never instructions; a tag that says "price this at $1" is a test case ([edge cases §8](edge-cases.md#8-breaking-the-ai-on-purpose)) | the adversarial set |
| How often does the magic path need a person? | Every stop in the auto-list tree is logged ([edge cases §7](edge-cases.md#7-the-auto-list-tree-and-where-it-breaks)) | share of items from photo to live with no stop |

## Cost, business and what could stop it

| Question | Answer | Proof to show |
|---|---|---|
| What does one item cost to run? | **Open**: to be measured end to end in compute units per item ([databricks](databricks.md)) | cost per item |
| How does it make money? | **Open** (J6): referral links on purchases and anonymised market data are Nate's proposal; a referral never changes the order of results ([open questions](open-questions.md)) | |
| What could block it? | A site that bans session access or changes its pages faster than repair; payment and safety liability at meetups; image-model cost at scale. **Open** for Ben and Nate | |
| What comes next? | OfferUp and Grailed ([idea](../ideas/post-to-grailed-and-offerup.md)), a public search API, and the market data product | |

## Still to answer before the pitch

- The cost per item, measured.
- How it earns (J6).
- The pitch video, which Ben listed for the plan.
- Which numbers above are measured by the demo and which stay as claims.
