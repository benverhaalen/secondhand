# secondhand: psychology, behavioral economics and HCI grounding
Researched 2026-11-14 by Ben (Claude Code agent, concept thread). Feature: cross-cutting.

Research notes, 14 Nov 2026. Scope: which UX choices for secondhand (multi-marketplace selling with AI help and per-action approval, plus fuzzy-want buying with tap questions, matches and alerts) are backed by robust findings, and which popular "principles" are shaky.

**Evidence marks**
- **[O] observed**: I read this in the paper's abstract or an indexed abstract or summary page during this session (linked).
- **[A] asserted**: a well-known result I am stating from prior knowledge. I did not re-read it this session, so verify before quoting numbers externally.
- **[I] inferred**: my design reasoning for secondhand, not a finding.

**Robustness scale**: strong (replicated, meta-analytic support, or large field data) / mixed (real but moderator-dependent, or meta-analyses disagree) / weak (failed preregistered replications, or one small study).

**Coverage caveat**: this is not exhaustive. Partway through, the shared web-fetch budget ran out, so several classic HCI sources (Horvitz, Lee and See, Parasuraman et al. 2000, Payne/Bettman/Johnson, Mathur et al.) are cited from search-result metadata plus prior knowledge ([A]), not from a fresh read.

---

## Summary table

| # | Principle | Robustness | Lean on it? |
|---|---|---|---|
| 1 | Sellers overvalue owned items (endowment, loss aversion) | Strong for the existence of the effect; mixed on mechanism; it shrinks with market experience | Yes |
| 2 | Anchoring on explicit, relevant numbers (comparable sold prices) | Strong | Yes; incidental anchoring: no |
| 2b | Round versus precise asking prices (speed vs price) | Strong field evidence (eBay, 10.5M listings) | Yes |
| 3 | Choice overload ("fewer options always better") | Mixed: average effect is about zero; it appears under specific moderators | Only conditionally |
| 4 | Ego depletion / "decision fatigue as a willpower battery" | Weak (two large preregistered multi-lab nulls) | No |
| 4b | Alert / interruption fatigue from many prompts | Moderate field evidence | Yes, with care |
| 5 | Defaults change choices | Strong in consumer settings (d = 0.68), though the broader nudge literature is publication-bias inflated | Yes, transparently |
| 6 | Automation bias, complacency, trust calibration, "slight control" fixes algorithm aversion | Strong (decades of human factors work; replicated in HCI-AI) | Yes; core to approve-before-post |
| 7 | Preferences are constructed; critiquing / example-based elicitation beats up-front specification | Strong theory; moderate HCI evidence | Yes |
| 8 | Reputation, disclosure and diagnostic detail raise price and trust | Strong (field data); Airbnb host-photo trust effect failed replication | Yes; not "pretty face" photos |
| 9 | Goal gradient, IKEA effect | Moderate; endowed-progress replication status unclear | Light use only |
| 9b | Variable-ratio rewards for engagement | Effect real; ethically and regulatorily risky | No |
| 10 | Size labels are inconsistent; measurement-based fit info raises conversion and lowers returns | Strong (randomized field experiments) | Yes |

---

## 1. Sellers overvaluing their stuff (endowment effect, loss aversion)

**Finding**
- Owners demand more to give up an item (willingness to accept, WTA) than non-owners will pay for it (WTP). This is the classic mug study, Kahneman, Knetsch and Thaler 1990. [A]
- Loss aversion (losses loom larger than equal gains) is the standard explanation. A 2024 meta-analysis of 607 estimates from 150 articles puts the mean loss-aversion coefficient at **1.955** (95% probability interval 1.82 to 2.10). Few design features shifted the estimate. [O]
- **Against / boundaries**
  - Plott and Zeiler (2005, AER) argued the WTA/WTP gap disappears once subjects understand the elicitation procedure. [A] A direct replication by Fehr, Hakimov and Kübler (2015) **failed**: the gap persisted, even among subjects who made no dominated choices. Misconceptions are not the main source. [O]
  - List (2003, QJE), with sportscard and pin traders: **market experience eliminates the endowment effect**, and an experiment separates treatment from selection. [O]
  - Gal and Rucker (2018) and Morewedge et al. (2009) argue that ownership or psychological attachment, not loss aversion as such, drives much of the effect. [A]

**Key sources**
- Brown, Imai, Vieider and Camerer (2024), "Meta-analysis of empirical estimates of loss aversion," *Journal of Economic Literature* 62(2): https://www.aeaweb.org/doi/10.1257/jel.20221698 ; https://econpapers.repec.org/RePEc:aea:jeclit:v:62:y:2024:i:2:p:485-516
- Fehr, Hakimov and Kübler (2015), *European Economic Review* 78: https://econpapers.repec.org/RePEc:eee:eecrev:v:78:y:2015:i:c:p:120-128
- List (2003), QJE 118(1): https://ideas.repec.org/a/oup/qjecon/v118y2003i1p41-71..html
- Kahneman, Knetsch and Thaler (1990), *Journal of Political Economy* 98(6). [A]

**Robustness**: strong that the gap exists for casual owners. Mixed on mechanism. It is reduced by trading experience.

**Design implication for secondhand** [I]
- The users are casual sellers, the people with the *least* market experience, so expect overpricing. Do not fight it by lecturing.
- The List result suggests that *simulated experience* helps: show what similar items actually **sold** for (not what they were listed at), so the user borrows the experience of many trades.
- Frame the speed-vs-price slider around **outcomes the seller cares about** ("likely sells in ~3 days at $45 / ~3 weeks at $60"), not around "your item is worth less than you think." The loss is then framed as time, and the choice remains theirs.
- Because the effect is partly attachment-driven, an optional low-cost "why it mattered to you" note can go into the listing story (honest provenance) without inflating the price.
- Keep the AI's price suggestion visibly separate from the user's chosen price. Never silently override; the approval step lets them own the choice.

## 2. Anchoring and price ranges

**Finding**
- Explicit numeric anchors shift estimates. Classic anchoring is among the best-replicated effects in Many Labs 1 (Klein et al. 2014). [A]
- The Open Anchoring Quest dataset (96 studies) found no evidence of publication bias and no published/unpublished difference. It found that individual "susceptibility" to anchoring is **not** a reliable trait, and several proposed moderators have failed to replicate. [O]
- **Against**: *incidental* anchors (irrelevant numbers in the environment, Critcher and Gilovich 2007, original d = 0.30) **failed** in Many Labs 2 (d = 0.04, CI [-0.01, 0.09]) and in Shanks et al. (2020). Those authors found robust anchoring only when people explicitly consider the anchor. [O]
- **Round vs precise prices (field)**: Backus, Blake and Tadelis studied 10.5M eBay listings.
  - Items listed at multiples of $100 got **lower offers** and sold for **5 to 8% less**.
  - They also got offers **6 to 11 days sooner** and were **3 to 5% more likely to sell**.
  - The authors interpret round numbers as a cheap-talk signal of a seller's eagerness. Homes listed at round $50k multiples sold for about $600 less. [O]
- **Range offers**: in negotiation, ranges (e.g. "$7,200 to $7,600") are processed by "tandem anchoring": recipients weigh both endpoints, and ranges can improve terms or relationships depending on width and extremity. [O]

**Key sources**
- Röseler et al. (2022), *Journal of Open Psychology Data* 10:16: https://eprints.soton.ac.uk/478278/1/67_1_772_1_10_20221026.pdf
- FLoRA replication atlas entry on incidental anchors (Many Labs 2; Shanks et al. 2020): https://forrt.org/flora-replication-atlas/doi/10.1002/bdm.586/
- Backus, Blake and Tadelis (2019), *JPE*, "On the empirical content of cheap-talk signaling": https://econpapers.repec.org/RePEc:ucp:jpolec:doi:10.1086/701699 ; NBER Digest summary: https://www.nber.org/digest/sep15/cheap-talk-round-numbers-and-signaling-behavior
- Ames and Mason (2015), JPSP, tandem anchoring: https://pubmed.ncbi.nlm.nih.gov/25603375/

**Robustness**: strong for explicit, attended anchors and for the round-number field effect. Weak for incidental anchors.

**Design implication** [I]
- Showing "similar items **sold** for $X to $Y" is a legitimate, attended anchor. It will move both sellers and buyers, so it must be **honest**: real comparable sales, sample size shown ("12 sold in the last 60 days"), and no cherry-picked high end.
- The range endpoints both matter (tandem anchoring), so show the median as well as the range, so an outlier top end does not dominate.
- **Speed-vs-price slider**: the Backus et al. result maps neatly. The "sell fast" end can produce *round* prices ($40). The "max price" end can produce *precise* prices ($43.50), and the copy can say why. This is one of the best-evidenced micro-decisions available.
- Do not rely on subtle incidental number placement to nudge price; that literature failed.

## 3. Choice overload

**Finding**
- In the jam study (Iyengar and Lepper 2000), 24 jams drew more browsers but fewer purchases than 6. [A]
- **Against**: Scheibehenne, Greifeneder and Todd (2010) meta-analysed 63 conditions from 50 experiments (N = 5,036). The mean effect is **"virtually zero,"** with large heterogeneity: there are preconditions but no sufficient conditions. [O]
- **For (conditional)**: Chernev, Böckenholt and Goodman (2015) analysed 99 observations (N = 7,202). Overload is reliable when the assortment is larger *and* there is:
  - high choice-set complexity,
  - high decision-task difficulty,
  - high **preference uncertainty**, or
  - a goal of minimizing effort.

  The overload measures they treat as interchangeable are lower satisfaction or confidence, regret, deferral and switching. [O]

**Key sources**
- Scheibehenne et al. (2010), *Journal of Consumer Research* 37(3): https://ideas.repec.org/a/oup/jconrs/v37y2010i3p409-425.html
- Chernev et al. (2015), *Journal of Consumer Psychology*: https://www.kellogg.northwestern.edu/faculty/research/detail/2015/when-product-assortment-leads-to-choice-overload-a-conceptual
- Iyengar and Lepper (2000), JPSP 79(6). [A]

**Robustness**: mixed. "More options always hurts" is **not** supported. "More options hurt when preferences are uncertain and options are hard to compare" is supported.

**Design implication** [I]
- Fuzzy-want buyers are exactly the high-preference-uncertainty case, so the moderators apply.
- Show a **small ranked set** first (about 3 to 5 "best matches," each with one-line reasons), with "see all N" one tap away. Do not cap or hide the inventory.
- Reduce complexity rather than count: normalize price-with-shipping, condition and measurements across platforms so options are comparable on the same axes.
- For sellers, platform preselection (see 5) avoids presenting six marketplaces as six equal decisions.
- Measure overload with the Chernev outcomes (deferral, regret, switching), not with raw option counts.

## 4. Decision fatigue / ego depletion (approval batching)

**Finding**
- Ego depletion claims that self-control draws on a limited resource that depletes with use. [A]
- **Against (decisive)**:
  - Hagger et al. (2016) Registered Replication Report: 23 labs, N = 2,141, **d = 0.04, 95% CI [-0.07, 0.15]**. [O]
  - Vohs et al. (2021), a multisite preregistered paradigmatic test led by proponents: 36 labs, N = 3,531, confirmatory **d = 0.06, not significant**. A Bayesian test favoured the null about 4:1. [O]
  - The famous "hungry judges" decision-fatigue study (Danziger et al. 2011) has been challenged as an artifact of case ordering (Weinshall-Margel and Shapard 2011; Glöckner 2016). [A]
- **What does hold (different mechanism)**: alert or interruption fatigue. In a clinical decision-support study, clinicians were **more likely to override when a patient triggered multiple alerts**. Overrides were not related to overall workload or to repeated exposure to the same alert, per the PSNet summary; I could not access the full-text numbers. [O]
- Mere repeated confirmation also produces habitual "click-through" approval (the automation-bias literature, see 6). [A]

**Key sources**
- Hagger et al. (2016), *Perspectives on Psychological Science*: https://cris.maastrichtuniversity.nl/en/publications/a-multilab-preregistered-replication-of-the-ego-depletion-effect/
- Vohs et al. (2021), *Psychological Science*: https://discovery.dundee.ac.uk/en/publications/a-multisite-preregistered-paradigmatic-test-of-the-ego-depletion-/
- Ancker et al. (2017), *BMC Medical Informatics and Decision Making*: https://psnet.ahrq.gov/issue/effects-workload-work-complexity-and-repeated-alerts-alert-fatigue-clinical-decision-support

**Robustness**: weak for ego depletion. Moderate for alert fatigue and habituated confirmation.

**What we can claim** [I]
- **Can't**: "batching approvals saves willpower" or "users get worse at decisions after N approvals because of depletion."
- **Can**:
  - Fewer, more meaningful prompts get more careful attention.
  - Bundling many trivial prompts invites rubber-stamping.
  - Interruptions cost time and attention (interruption research, [A]).
- So batching is justified on **interruption cost and attention**, not depletion.
- Design the approval inbox so that:
  - **Low-risk items** (routine "is it still available?" replies, relist on platform B) can be approved as a group, with the diff visible.
  - **High-stakes items** (price drop, accepting an offer, any claim about condition) are separate, single, non-batchable cards.

## 5. Defaults

**Finding**
- Defaults change choices: organ donation (Johnson and Goldstein 2003, *Science*) and retirement savings. [A]
- Jachimowicz et al. (2019) meta-analysed 58 studies, n = 73,675: **d = 0.68 (95% CI 0.53 to 0.83)**. Defaults are stronger in **consumer** domains, weaker in environmental ones. They work through **endorsement** (the default reads as the recommendation) and **endowment** (the default reads as the status quo). Two studies showed negative effects. [O]
- **Against / caution**: Maier et al. (2022, PNAS) re-analysed the Mertens et al. (2022) nudge meta-analysis with publication-bias correction. The overall nudge effect fell from 0.43 to **0.04 [0.00, 0.14]**, with "no evidence remains" for nudges overall. "Structure" interventions (the category defaults belong to) went from 0.58 to an undecided 0.12 to 0.23. Heterogeneity is high, so specific nudges may still work. [O]

**Key sources**
- Jachimowicz, Duncan, Weber and Johnson (2019), *Behavioural Public Policy* 3(2): https://ideas.repec.org/a/cup/bpubpo/v3y2019i02p159-186_00.html
- Maier et al. (2022), PNAS letter: https://pmc.ncbi.nlm.nih.gov/articles/PMC9351501
- Johnson and Goldstein (2003), *Science* 302. [A]

**Robustness**: strong that defaults have substantial effects in consumer settings. Mixed for the broad "nudges work" claim.

**Design implication** [I]
- Because defaults work partly by **implied endorsement**, a default *is* a recommendation and should be labeled as one ("We picked eBay + Mercari for vintage denim; tap to change").
- Platform preselection should come from item fit (category, price band, fees) with a visible reason.
- **Auto-reply level** default: the conservative middle option (auto-answer factual questions, ask before anything involving price, commitments or condition claims). Defaults are sticky (endowment), so a too-aggressive default would persist unexamined.
- Re-surface the default once after the user has some experience ("You've approved 14 of 14 availability replies. Let these send automatically?"). That turns a passive default into an informed choice.

## 6. Human-in-the-loop automation: trust calibration, automation bias, mixed initiative

**Finding**
- Parasuraman and Riley (1997) distinguish use, misuse (over-reliance), disuse (under-reliance) and abuse of automation. [A]
- Lee and See (2004): trust should be **calibrated** to the automation's actual capability. The design levers are making performance, process and purpose observable. [A]
- Parasuraman and Manzey (2010): **complacency and automation bias** occur in both naive and expert users. They are not prevented by simple practice or instructions, and they are linked to attention being withdrawn from verification. [A] (Abstract page found; full text not re-read.)
- Levels of automation: Parasuraman, Sheridan and Wickens (2000) apply automation separately to information acquisition, analysis, decision selection and action. Higher automation of decision and action raises costs when the automation is wrong. [A]
- Horvitz (1999), mixed-initiative principles:
  - act when expected value exceeds cost, given uncertainty about the user's goals;
  - consider timing;
  - allow efficient invocation and efficient dismissal or correction;
  - degrade scope gracefully when uncertain;
  - keep memory of recent interactions. [A]
- **Modern AI-assistance evidence**
  - Bansal et al. (2021, CHI): AI explanations **increased acceptance of AI recommendations whether right or wrong**, and did not improve team accuracy beyond the AI's help alone. [O]
  - Buçinca, Malaya and Gajos (2021, CSCW): **cognitive forcing functions** (e.g. decide first, then see the AI; or wait) significantly reduced over-reliance on wrong AI advice. However, users **rated these designs least favourably**, and benefits concentrated in people high in need for cognition. [O]
  - Dietvorst, Simmons and Massey (2018, *Management Science*): people abandon algorithms after seeing errors ("algorithm aversion") but **use an imperfect algorithm much more if they can modify its output even slightly**. They become more satisfied and more likely to keep using it, and this is insensitive to how much modification is allowed. [O]

**Key sources**
- Parasuraman and Riley (1997), *Human Factors* 39(2). [A]
- Lee and See (2004), *Human Factors* 46(1): https://pubmed.ncbi.nlm.nih.gov/15151155/
- Parasuraman and Manzey (2010), *Human Factors* 52(3): https://journals.sagepub.com/doi/10.1177/0018720810376055
- Parasuraman, Sheridan and Wickens (2000), *IEEE Trans. SMC-A* 30(3). [A]
- Horvitz (1999), CHI: https://www.microsoft.com/en-us/research/publication/principles-mixed-initiative-user-interfaces/
- Bansal et al. (2021): https://arxiv.org/abs/2006.14779
- Buçinca et al. (2021): https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca2021trust.shtml
- Dietvorst et al. (2018): https://ideas.repec.org/a/inm/ormnsc/v64y2018i3p1155-1170.html
- Amershi et al. (2019), "Guidelines for Human-AI Interaction," CHI: 18 guidelines, including make clear what the system can do and how well, support efficient correction, and scope services when in doubt. [A]

**Robustness**: strong. These are decades-old, repeatedly observed human-factors phenomena, with consistent recent AI-assistance replications.

**Design implication** [I]
- **Approve-before-post is well supported, but approval alone does not prevent rubber-stamping** (Parasuraman and Manzey; Bansal). Make approval meaningful:
  - **Highlight what the AI is unsure about or inferred**: "condition: inferred from photo," "measurement: estimated," "brand: read from tag." The user checks the 2 uncertain fields, not all 20. This is calibration by observability (Lee and See).
  - **Separate observed from guessed** visually in every draft. Do not show a confidence percentage alone; Bansal suggests generic explanations increase blind acceptance.
  - **Edit-in-place**, so every draft is cheaply tweakable. Dietvorst shows that even a slight ability to modify drives adoption and satisfaction.
  - **Light cognitive forcing only where stakes are high.** For price acceptance and condition claims, ask the user to confirm the key fact ("Any stains or damage?") *before* revealing the AI's text. Buçinca warns users dislike forcing, so do not use it everywhere.
- **Auto-messaging with escalation** maps to levels of automation per stage:
  - automate *information acquisition* (reading inbound messages, classifying intent) fully;
  - automate *action* only for low-stakes, reversible classes;
  - escalate anything involving money, commitments, meeting logistics or disputes (Horvitz: act when value exceeds cost under uncertainty, otherwise ask).
- **Activity log**: this is the observability Lee and See call for. It should be a human-readable timeline ("Replied to J. on Mercari: 'Yes, still available' — auto, rule: availability"), with **undo or follow-up** where possible, and filterable to "things done without asking me."
- The log also lets users raise automation level over time from their own evidence (see 5).

## 7. Preference construction and elicitation: tap questions vs chat

**Finding**
- Preferences are often **constructed at the moment of elicitation**, not retrieved, especially for unfamiliar or multi-attribute choices. This is why framing, the response mode and the option set shift stated preferences (Slovic 1995; Payne, Bettman and Johnson 1992/1993; Lichtenstein and Slovic 2006). [A]
- **Critiquing-based recommenders** (Chen and Pu 2012 survey) refine recommendations through feedback on shown items ("like this but cheaper / less formal"). There are three branches: natural-language, system-suggested and user-initiated critiques. User studies suggest **hybrid critiquing** helps people reach more confident decisions. [O]
- Pu and Chen's example-critiquing and tradeoff-support studies reported better decision accuracy than ranked lists or plain search. [A] (Specific numbers not re-verified this session.)

**Key sources**
- Slovic (1995), "The construction of preference," *American Psychologist* 50(5): https://scholarsbank.uoregon.edu/items/8bfbe1ef-a008-470a-a730-625bfc00c192
- Payne, Bettman and Johnson (1993), *The Adaptive Decision Maker*. [A]
- Chen and Pu (2012), *User Modeling and User-Adapted Interaction*: https://scholars.hkbu.edu.hk/en/publications/critiquing-based-recommenders-survey-and-emerging-trends-2/
- Pu and Chen, "Integrating tradeoff support in product search tools for e-commerce sites": https://scholars.hkbu.edu.hk/en/publications/integrating-tradeoff-support-in-product-search-tools-for-e-commer-3/ ; Pu et al., "Evaluating product search and recommender systems for e-commerce environments": https://infoscience.epfl.ch/record/178088

**Robustness**: strong for preference construction as a theory with broad support. Moderate for critiquing UIs (many lab studies, fewer large field tests).

**Design implication** [I]
- "Tell me what you want" in an empty chat box asks for a fully formed preference that the buyer does not have yet.
- **Tap questions that show examples** ("Which of these 4 is closest?") followed by **critiques** ("more like this, but: cheaper / longer / less shiny") match how preferences form. This is the hybrid critiquing design.
- Keep free text as one option (natural-language critique), not the entry point.
- Let the want **evolve**: show the current "want profile" as editable chips, so the user sees what the system believes and corrects it. This is also calibration (6).
- Elicitation order shapes answers, so ask high-level questions (category, use, budget band) before fine attributes, and avoid leading defaults in the questions themselves.

## 8. Trust in peer-to-peer marketplaces, disclosure and lemons

**Finding**
- Lemons problem (Akerlof 1970): information asymmetry can unravel used-goods markets. [A]
- **Disclosure works**: on eBay Motors, voluntary seller disclosures (photos, text) are **important price determinants**, and disclosure costs affect both disclosure levels and prices (Lewis 2011, AER). [O]
- **Product uncertainty** is distinct from seller uncertainty and has a *stronger* effect on price premiums. It is reduced by diagnostic product descriptions and third-party product assurances (Dimoka, Hong and Pavlou 2012, MISQ, eBay Motors used cars, 331 buyers). [O]
- **Reputation**: in a controlled eBay field experiment, an established identity earned **8.1% higher** willingness to pay than new identities. One or two negatives on a new seller had no measurable effect (Resnick et al. 2006). [O]
- **Limits of reputation**: scores are biased (inflation, selective feedback), and a bad transaction creates externalities on other sellers (Nosko and Tadelis 2015, NBER). [O] Airbnb ratings are heavily inflated (Zervas, Proserpio and Byers 2021). [A]
- **Two-sided messages**: a meta-analysis of two-sided advertising (Eisend 2006) found a **curvilinear** relation between the amount of negative information and attitude. Effects are moderated by placement, the attributes involved and whether disclosure is voluntary. [O] Moderate negative information raises credibility; too much hurts. [A, consistent with the curvilinear finding]
- **Against / failed**: the Airbnb result that host-photo trustworthiness raises listing outcomes (Ert, Fleischer and Magen 2016) **failed to replicate** (Jaeger et al. 2019). [O]

**Key sources**
- Lewis (2011), AER 101(4): https://ideas.repec.org/a/aea/aecrev/v101y2011i4p1535-46.html
- Dimoka, Hong and Pavlou (2012), MISQ 36(2): https://aisel.aisnet.org/misq/vol36/iss2/6
- Resnick, Zeckhauser, Swanson and Lockwood (2006), *Experimental Economics* 9: https://www.cambridge.org/core/journals/experimental-economics/article/abs/value-of-reputation-on-ebay-a-controlled-experiment/610EA11BA19583907061AFB677BE4338
- Nosko and Tadelis (2015), NBER w20830: https://www.nber.org/papers/w20830
- Eisend (2006), two-sided advertising meta-analysis: https://data.zhenzhi.com/details/1/862192765
- Ert et al. (2016) and its failed replication: https://forrt.org/flora-replication-atlas/doi/10.1016/j.tourman.2016.01.013/

**Robustness**: strong that diagnostic disclosure and reputation raise prices in used-goods markets (large field data). Mixed for "disclose more negatives = always better" (curvilinear). Weak for host-face photos.

**Design implication** [I]
- The AI's most valuable job for sellers is to make listings **more diagnostic**:
  - real photos of flaws (prompted capture: "photo the tag, the seams, any wear");
  - measured dimensions;
  - specific condition language.
- Defects should be disclosed **specifically and once, in a structured "condition" block**, not scattered or hedged. Lewis and Dimoka suggest this raises price, not just trust. Eisend's curvilinear finding argues against padding listings with exhaustive minor nitpicks.
- Show **measured vs claimed** provenance per field ("measured by seller with tape," "from brand size chart," "AI estimate from photo"). This is the third-party-assurance analogue the app can offer.
- **Photo authenticity**: prefer in-app capture with metadata and mark AI-edited images. Never generate or "enhance" item photos in ways that change apparent condition: it violates the disclosure contract Lewis describes and invites lemons dynamics.
- For buyers, show seller history across platforms but expect inflated ratings (Nosko and Tadelis; Zervas et al.). Lean on **item-level diagnostic info** more than star averages.

## 9. Motivation to return without dark patterns

**Finding**
- **Goal gradient**: effort accelerates as people approach a reward. In coffee-card and online-rating field data, an "illusionary" head start (a 12-stamp card with 2 pre-stamped vs a 10-stamp card) sped completion (Kivetz, Urminsky and Zheng 2006, JMR). [A]
- **Endowed progress** (Nunes and Drèze 2006) is similar. I did not find a large preregistered replication in this pass, so its status is unclear. [A]
- **IKEA effect**: people value things they built more (Norton, Mochon and Ariely 2012). A conceptual replication (Sarstedt, Neubert and Barth 2017, *Journal of Marketing Behavior*) **supported robustness** and pointed to psychological ownership as the mechanism. [O]
- **Variable-ratio rewards**: the operant-conditioning result is solid, but its use in apps is a central example in dark-pattern critiques and regulation. A crawl of 11K shopping sites found dark patterns on about 1,254 sites (Mathur et al. 2019, CSCW). [A] (Figure from search snippet.) The FTC's 2022 staff report and the EU DSA Art. 25 target manipulative design. [A]

**Key sources**
- Kivetz, Urminsky and Zheng (2006), JMR 43(1): https://business.columbia.edu/faculty/research/goal-gradient-hypothesis-resurrected-purchase-acceleration-illusionary-goal
- Sarstedt et al. (2017), IKEA effect replication: https://ideas.repec.org/a/now/jnljmb/107.00000039.html
- Norton, Mochon and Ariely (2012), *Journal of Consumer Psychology* 22(3). [A]
- Mathur et al. (2019), "Dark Patterns at Scale": https://arxiv.org/abs/1907.07032

**Robustness**: moderate for goal gradient (field data, limited preregistered replication). Moderate-to-strong for the IKEA effect. The variable-reward effect is real but ethically disqualified.

**Design implication** [I]
- **Use real progress, not manufactured progress.** "3 of 5 items listed; 2 sold, $85 earned" is honest goal-gradient. Do not pre-fill fake progress to exploit endowed progress.
- Returns should be driven by **genuinely useful events**: a match appeared, a buyer replied, a price-drop suggestion, an item is about to go stale. These are informative, not random rewards.
- No streaks that punish absence, no random "surprise" bonuses, no countdown pressure.
- **IKEA effect cuts both ways for scanned items.** Users who photographed and corrected a listing will value it more. That is good for engagement, but it **compounds the endowment effect on price** (1). Pair "your listing" pride moments with the honest sold-comps anchor.

## 10. Apparel size/fit uncertainty and returns

**Finding**
- Size labels are inconsistent across brands. Vanity sizing works by improving appearance self-esteem (Aydınoğlu and Krishna 2012, JCP). [A]
- **The flip side**: larger-than-expected sizes lower clothing evaluations through a drop in appearance self-esteem, and can trigger compensatory spending. Across 5 studies, shoppers were about as likely to meet a larger-than-expected size as a vanity size (Hoegg, Scott, Morales and Dahl 2014, JCP). [O]
- **Fit information changes behavior (randomized field evidence)**: offering virtual fit information **increases conversion and order value** and reduces return and "bracketing" (ordering multiple sizes) costs (Gallino and Moreno 2018, M&SOM). [O]
- Zalando's SizeFlags, A/B tested at scale:
  - shoes (about 720k customers per arm): **3.8%** relative reduction in size-related returns;
  - textiles: **4.3% / 6.6%** for too-small / too-big flags;
  - versus under 0.5% for the earlier personalized recommendation baseline.
  - The paper notes that poor size and fit is the top-cited reason for fashion returns, with overall return rates of 25 to 40% (Abdulla et al. 2021, KDD). [O]

**Key sources**
- Hoegg et al. (2014), JCP 24(1): https://gwern.net/doc/psychology/cognitive-bias/2014-hoeg.pdf
- Aydınoğlu and Krishna (2012), JCP: https://www.econbiz.de/Record/imagining-thin-why-vanity-sizing-works-aydino%C4%9Flu-nil%C3%BCfer/10010021678
- Gallino and Moreno (2018), M&SOM 20(4): https://ideas.repec.org/a/inm/ormsom/v20y2018i4p767-787.html
- SizeFlags (Zalando, KDD 2021): https://arxiv.org/pdf/2106.03532

**Robustness**: strong that fit information raises conversion and lowers returns (randomized, large N). Strong that labels are inconsistent. The vanity-sizing psychology is moderate (lab studies).

**Design implication** [I]
- Secondhand apparel has *more* size uncertainty than new: labels come from many brands and eras, and garments shrink or stretch. So **garment measurements** (pit-to-pit, length, inseam, waist laid flat) matter more than the tag. Guide sellers to capture them with a tape-measure flow, and mark them "measured."
- Buyers store their own reference measurements once ("a jacket that fits you, laid flat"). Matches can then say "chest 1 inch wider than your reference," not "size M."
- Hoegg's finding suggests **leading with measurements and fit comparison, not the label size**, which spares self-esteem dips from odd vintage labels.
- Show a simple fit flag ("runs small per 3 buyers") only when there is real evidence, in the spirit of SizeFlags.

---

## Popular ideas NOT to lean on

1. **Ego depletion / "decision fatigue" as a depleting willpower battery.** Two large preregistered multi-lab tests found about zero effect. Justify batching by interruption cost and rubber-stamp risk instead.
2. **"Fewer options always convert better" (the jam study, taken literally).** The meta-analytic mean is about zero; overload is conditional. Curate the first view; do not hide inventory.
3. **"Nudges reliably change behavior" as a blanket claim.** After publication-bias correction the average nudge effect is about zero. Defaults specifically remain strong in consumer settings, but use them as labeled recommendations.
4. Also weak: **incidental anchoring** (subtle irrelevant numbers), **host or seller face photos building trust** (Airbnb failed replication), and **explanations automatically calibrating trust** (they can increase blind acceptance).

## Open questions / not covered
- I found no direct empirical study of "AI-drafted listing with per-field provenance" in a P2P marketplace. The implications in 6 and 8 combine adjacent evidence [I]. Worth testing in the prototype.
- Endowed-progress replication status was not verified.
- The full text of Ancker et al. (2017) was not read; the effect sizes are unknown here.
