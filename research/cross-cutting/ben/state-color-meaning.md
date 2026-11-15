# What makes a color or a gradient carry meaning a person learns?

Researched 2026-11-15 by Ben (Claude Code agent, colors thread). Feature: cross-cutting (brand).

Question: can card fields carry two kinds of meaning at once, a lifecycle state by hue (nominal) and how a live listing is doing by strength, coverage and drift (ordinal), so that people learn both without reading? Decision it feeds: the state and heat encoding on cards. Constraint: the founder is red-green color blind.

Draft answer from memory, before searching: hue for states and strength for heat is the textbook split; strength levels are few; motion is costly; color must never stand alone. The search kept the draft and changed three things: dark mode reverses one of the "more" biases, fading toward gray collides with "ended", and the current state hues are closer under deutan vision than expected.

## Bottom line for secondhand

- **The split is right.** Hue suits kinds; saturation, opacity and area suit amounts. Mackinlay ranks saturation above hue for ordinal data, and Munzner lists hue as an identity channel and saturation and luminance as magnitude channels. *observed* ([Mackinlay 1986](https://courses.ischool.berkeley.edu/i247/f05/readings/Mackinlay_APT_TOG86.pdf), [Munzner, marks](https://cs.ubc.ca/~tmm/talks/vad/VAD-marks.pdf)). Supports the proposal.
- **People already read "stronger" as "more".** Schloss's lab finds an opaque-is-more bias and a new saturated-is-more bias, the latter even with lightness held constant. *observed* ([Schoenlein, Sidibe, Schloss 2026](https://schlosslab.discovery.wisc.edu/new-publication-understanding-the-opaque%e2%80%91is%e2%80%91more-bias-and-saturated%e2%80%91is%e2%80%91more-bias-for-colormap-data-visualizations-2/)). But dark-is-more and opaque-is-more "conflict on dark backgrounds" *observed* ([Schloss et al. 2019](https://schlosslab.discovery.wisc.edu/new-publication-mapping-color-to-meaning-in-colormap-data-visualizations)). So in dark mode, vary chroma at a steady lightness and test it there. *inferred*
- **Four strength levels is the ceiling, and only with a word.** Munzner: for small separated regions, saturation or luminance gives "2 bins safest, 3-4 bins max". *observed* ([Munzner, color](https://cs.ubc.ca/~tmm/talks/vad/VAD-color.pdf)). A lone card read in a list is that case, so four bands from strength alone will not be read reliably; the band word or icon must carry it. *inferred*
- **Hot as strong and saturated has real support; stale as faded has some.** Saturation had the largest effect on felt arousal *observed* ([Wilms and Oberfeld 2018](https://www.staff.uni-mainz.de/oberfeld/downloads/Wilms-Oberfeld2018_Article_ColorAndEmotionEffectsOfHueSat.pdf)); memories are recalled as less saturated than they were *observed* ([Cooper, Kensinger, Ritchey 2019](https://neurosciencenews.com/memory-fade-over-time-11005/amp/)). Fading toward gray, though, walks a live card toward "ended", which is gray. *inferred*
- **The current state hues lean on hue the founder cannot fully see.** My simulation (Machado 2009, full severity, OKLab): under deutan vision lime and marigold differ by 0.056, mint and marigold by 0.072, sky and mint by 0.075, each with almost the same lightness. *observed (ran it)*. Sold and "needs you" are the pair that matters most. The icon and word are not a backup; for this founder they are the code. *inferred* (rule: [WCAG 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [Carbon: at least two of color, shape, symbol](https://www.carbondesignsystem.com/patterns/status-indicator-pattern)).
- **Drift works as an on/off flag, not as a level.** Motion is caught far better than color in the periphery, and small slow oscillation is the least distracting kind *observed* ([Bartram, Ware, Calvert 2003](https://www.interruptions.net/literature/Bartram-IJHCS03.pdf)). Munzner lists motion as an identity channel, not a magnitude one *observed*, and it must turn off under reduced motion ([WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)). Use drift for "hot" only. Contradicts drift as one step of the ordinal scale.
- **Learning comes from consistency, and marketplaces signal heat with words.** Consistent mappings become automatic with practice; varied ones never do *observed* ([Schneider and Shiffrin 1977, summary](https://www.jimdavies.org/summaries/schneider1977.html)). eBay shows "10 watchers", Airbnb "this is a rare find" *observed* ([LitCommerce](https://litcommerce.com/blog/what-is-a-watcher-on-ebay/), [Airbnb community](https://community.withairbnb.com/t5/Community-Cafe/Rare-find/td-p/226351)). Apple forbids changing ring colors or opacity anywhere *observed* ([HIG, Activity rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings.md)). One meaning per color, every time, plus a count or word for heat.

## A. Channels for nominal and ordinal data

- Mackinlay's ranking (Figure 15) puts, for ordinal data: position, density, color saturation, color hue, texture, then the rest; for nominal data: position, color hue, texture, connection, containment, density, with saturation low. The text says color is "a very effective way of encoding nominal sets" and "is at the bottom of the quantitative ranking." *observed*, though the figure came through as extracted text, so the exact order should be checked against the image.
- Munzner splits channels into magnitude channels for ordered data (position, length, angle, area, depth, luminance, saturation, curvature, volume) and identity channels for categories (spatial region, hue, motion, shape). *observed* ([VAD marks](https://cs.ubc.ca/~tmm/talks/vad/VAD-marks.pdf)).
- Munzner: categorical color gives "6-12 bins, including background and highlights," and people are "surprisingly bad for absolute comparisons"; saturation and luminance are not separable from each other. *observed* ([VAD color](https://cs.ubc.ca/~tmm/talks/vad/VAD-color.pdf)).
- Cleveland and McGill (1984) rank shading and saturation near the bottom for reading exact quantities. *asserted* (unopened). That matters little here: heat needs order, not exact values.
- Bertin calls hue "selective" but not "ordered", and value and saturation ordered. *asserted* (unopened).

Verdict: supports the proposal. Hue for state, strength for heat. *inferred* One caution: Munzner's point that saturation and luminance are not separable means the field's strength and its lightness should move as one designed ramp, not two knobs. *inferred*

## B. Color-concept association and semantic discriminability

- Recycling bins (Schloss, Lessard, Walmsley, Foley 2018, *Cognitive Research* 3:5): people solve a global assignment, not item-by-item. They would put an item in a weakly associated bin if the whole mapping fit better; systems were read better when the intended pairs were strong and the unintended pairs weak. *observed* ([DOAJ abstract](https://doaj.org/article/227225eecb084738b235d64542afde31)).
- Semantic discriminability (Mukherjee, Yin, Sherman, Lessard, Schloss; arXiv 2021, v4 2023): "the degree to which observers can infer a unique mapping between visual features and concepts." Capacity depends on how different the concepts' color-association distributions are, so even concepts with no strong color can be encoded if the set is chosen together. *observed* ([arXiv 2108.03685](https://arxiv.org/html/2108.03685v4)). Venue: the page carries a TVCG DOI. *asserted*
- Dark-is-more (Schloss, Gramazio, Silverman, Parker, Wang 2019, IEEE TVCG): people read colormaps better when darker means more, unless the colormap looks like it varies in opacity, then opaque-is-more applies; "These two biases work together on light backgrounds but conflict on dark backgrounds." *observed* ([lab page](https://schlosslab.discovery.wisc.edu/new-publication-mapping-color-to-meaning-in-colormap-data-visualizations)).
- Opaque-is-more and saturated-is-more (Schoenlein, Sidibe, Schloss 2026, *Attention, Perception, & Psychophysics*): opacity bias can be triggered "without substantial lightness variation" by raising saturation against the background; saturated-is-more is a new bias. *observed* ([lab page](https://schlosslab.discovery.wisc.edu/new-publication-understanding-the-opaque%e2%80%91is%e2%80%91more-bias-and-saturated%e2%80%91is%e2%80%91more-bias-for-colormap-data-visualizations-2/)). The full paper was not opened, so where the biases break is unknown.

For (1) assigning hues to states: there is no single "right" color for "sold" or "live". What makes a set readable is that each state's color fits it better than it fits the other states. Ben's picks (sold mint, live blue, needs you yellow) follow common associations; the test should be done on the whole set, not hue by hue. *inferred*

For (2) stronger is more: supported in light mode. In dark mode a stronger field may read as lighter, which pulls against dark-is-more. Hold lightness steady and move chroma, which the 2026 paper shows still triggers the bias. *inferred*

## C. Temperature, energy and age

- Red-warm and blue-cold pairings sped responses in an implicit association test and in priming with real warm and cold stimuli (Ho et al. 2014, *PLoS ONE* 9(3)). Samples were 11 to 17 people; the authors note the link may rest on "loosely held cultural norms". *observed* ([PMC3950287](https://pmc.ncbi.nlm.nih.gov/articles/PMC3950287)).
- Saturation raised felt arousal more than brightness or hue; red was more arousing than green or blue, mainly at high saturation (Wilms and Oberfeld 2018, *Psychological Research* 82). *observed*
- Memories are recalled as less saturated and less bright than they were seen, "a novel memory-fading effect" (Cooper, Kensinger, Ritchey 2019, *Psychological Science*). *observed* via a news summary, not the paper.
- "Slightly desaturated colours are most strongly associated with nostalgia" (Witzel, Wildschut, Sedikides 2021, VSS abstract, *Journal of Vision* 21(9)). *observed* ([eprint](https://eprints.soton.ac.uk/480074/)).

Verdict: hot as strong and saturated is supported. Stale as faded has indirect support: faded reads as past and as low energy. No study tested "desaturated listing = stale listing". *inferred* The proposal keeps heat off new hues, which avoids the culture-bound red-hot link and keeps red for "failed". *inferred*

## D. Learnability

- Christ's 1975 review (*Human Factors* 17(6):542-570) pooled 42 studies and found color "may be a very effective performance factor under some conditions" but "detrimental under others." *observed* ([abstract](https://scilit.com/publications/17ff1ae4b164881a6f549402f006c1b5)). That color helps search more than identification is *asserted* from memory and echoed in a NASA report: "color provides information aiding search, not identification," with hue identification "limited to 9 hues." *observed* ([O'Brien 1992, NASA CR-4445](https://ntrs.nasa.gov/api/citations/19920024935/downloads/19920024935.pdf)). The same report found no benefit of redundant color on an overlearned identification task. *observed*
- Healey (1996) found seven isoluminant colors is "the maximum we can display at one time" for fast, accurate search. *observed* ([TR-96-10](https://www.cs.ubc.ca/sites/default/files/tr/1996/TR-96-10_0.pdf)). Ware suggests about a dozen nameable colors for labels. *asserted* (book unopened).
- Consistent mapping leads to automatic detection with practice, largely unaffected by load; varied mapping does not. *observed* ([summary of Schneider and Shiffrin 1977](https://www.jimdavies.org/summaries/schneider1977.html)). The trial counts were not in the summary.
- Carbon warns that "more than five or six indicators can overwhelm users." *observed*

Secondhand has six state colors plus four heat bands, and the states sit at the edge of what people identify. Color will help people find "needs you" cards in a list fast; the word and icon will do the naming. Every reuse of a state hue for something else (a category, decoration) would break the consistent mapping. *inferred* I found no study of how fast app users learn status colors. *not found*

## E. Color vision deficiency

- Red-green deficiency is about 8% of European men and 0.4% of women, 4 to 6.5% of Chinese and Japanese men (Birch 2012, *JOSA A*). *observed* ([PubMed 22472762](https://pubmed.ncbi.nlm.nih.gov/22472762/)).
- Munzner: avoid hue alone, add luminance or shape; blue-orange stays distinct. *observed* Okabe and Ito list confusable pairs for protan and deutan viewers, including yellow-green with yellow, green with brown, red with brown, and pale low-saturation colors such as pale sky blue with pale green; when two colors share a temperature, make their brightness or saturation clearly differ. *observed* ([Color Universal Design](https://jfly.uni-koeln.de/color)).
- WCAG 1.4.1: color is not "the only visual means of conveying information"; even green-valid versus red-invalid outlines need "an additional visual indicator." *observed* Carbon asks for at least two of color, shape, symbol, and 3:1 contrast between indicators. *observed*
- GitHub split its colorblind theme into Protanopia & Deuteranopia and Tritanopia themes in 2022 *observed* ([changelog](https://github.blog/changelog/2022-04-19-protanopia-deuteranopia-colorblind-themes-beta/)); that it swaps green for blue and red for orange is *asserted*. Robinhood offers an "Accessible colors" toggle for red-green colorblindness *observed* ([support](https://www.robinhood.com/us/en/support/articles/accessibility-options/)).
- My simulation, brand hex values from `brand/constitution.md`, ended gray taken as `#EFF1F2`. Closest pairs in OKLab distance:

| Vision | Pair | Distance | Lightness gap |
|---|---|---|---|
| Typical | lime, marigold | 0.082 | 0.051 |
| Typical | sky, mint | 0.083 | 0.002 |
| Deutan | lime, marigold | 0.056 | 0.050 |
| Deutan | mint, marigold | 0.072 | 0.007 |
| Deutan | sky, mint | 0.075 | 0.007 |
| Protan | mint, gray | 0.061 | 0.051 |
| Protan | mint, marigold | 0.069 | 0.046 |
| Protan | sky, gray | 0.071 | 0.055 |

*observed (ran it)*. These pairs can be told apart side by side but are hard to name alone. *inferred* For the founder, sold mint against needs-you marigold, and sold mint against ended gray, is the risk. A stale sky card faded toward gray lands near ended under protan vision. *inferred* All four tints sit at almost the same lightness, so the one channel deutans keep (lightness) is unused. *inferred*

Verdict: supports pairing every state with icon and word, and supports heat by strength, since strength survives CVD better than hue. *inferred* It argues against "stale fades toward gray" unless ended gets a distinct icon, word and no field. *inferred*

## F. Motion

- Moving icons were detected almost every time, near or far; color errors rose from 6% to 25% in the periphery while motion stayed under 2%. Traveling motion was the most distracting and blink the least; "small, slow linear oscillations" are "excellent candidates" for notifiers. *observed* (Bartram, Ware, Calvert 2003, *IJHCS*).
- Flicker must be coherent with a cycle of 120 ms or more; velocity differences matter more than speed; small samples (8 to 10 viewers). *observed* ([Huber and Healey 2005](https://spaces-cdn.owlstown.com/blobs/ycc5w5aemx6zfp0y5nwqcgre5pul)). Ordered reading of motion was not tested. *observed*
- WCAG 2.3.3 says motion triggered by interaction can be disabled, citing vestibular "dizziness, nausea and headaches", with `prefers-reduced-motion` as a sufficient technique. *observed* WCAG 2.2.2 covers auto-starting motion that runs over five seconds. *asserted*

Verdict: motion is strong at grabbing attention and weak at saying "how much". A list where every live card drifts would compete with itself. *inferred* Drift fits one level, hot, as a slow anchored movement that stops under reduced motion, with the band still readable without it. Contradicts the proposal where drift varies by band. *inferred*

## G. Product references

| Reference | What it signals | Take | Avoid |
|---|---|---|---|
| eBay watchers | Seller sees "10 watchers" under the price *observed* | Heat as a count with a noun | Heat with no reason given |
| Airbnb rare find | "this is a rare find", "usually booked", lightbulb *observed*; criteria unknown *observed* | Heat as a short phrase plus icon | Opaque criteria hosts cannot act on |
| Depop ranking | Popularity from views, likes, adds to bag; "Newer items are slightly favoured" *observed* ([help](https://depophelp.zendesk.com/hc/en-gb/articles/9422984899985)) | Staleness is real and mild; score inputs exist | Presenting a small effect as a cliff |
| GitHub contribution graph | Darker green for more activity *asserted*; docs opened do not describe colors *observed* | Ordinal by strength of one hue | Green-only ramps for this founder |
| Apple Activity rings | Fixed RGB per ring; "Never change the colors... don't use filters or modify opacity"; "Never display Activity rings in labels or background graphics" *observed* | One meaning per color, everywhere | Reusing meaning colors as decoration |
| Linear | Default statuses Backlog, Todo, In Progress, Done, Canceled; color and name editable *observed* ([docs](https://linear.app/docs/issue-property)); icon shapes that fill with progress *asserted* | Shape carries order, color is extra | User-editable colors that break learning |
| Robinhood | "Accessible colors" toggle for red-green *observed* | Red-green gain/loss needs a fix | Making meaning depend on a setting |
| Carbon | Red error, orange serious, yellow warning, green success, blue info or progress, gray draft, purple undefined *observed* | Gray for not-started fits "draft" | Gray meaning two things |

Pattern: products signal heat with numbers and words and keep color for state. *inferred* No product found uses a background's strength for heat; the closest is the contribution graph's intensity ramp. *inferred*

## Limits

- Searched: Schloss lab pages and papers, Mackinlay, Munzner slides, Christ, Healey, Bartram, Huber and Healey, Ho et al., Wilms and Oberfeld, Cooper et al., Witzel et al., Birch, WCAG 1.4.1 and 2.3.3, Okabe-Ito, Carbon, Primer, GitHub, Robinhood, Linear, Apple HIG, Depop, eBay and Airbnb pages.
- Unopened or not reached: Bertin; Cleveland and McGill 1984; Ware's book; the full Christ paper; the full 2026 Schloss paper; Material and Atlassian status guidance (only the AUI lozenge page opened, which gives no meanings); Vinted; the GitHub colorblind palette values; Cooper et al. read via a news summary.
- Several sources are lab announcements or abstracts; small samples (Ho et al. 11 to 17; Huber and Healey 8 to 10).
- The CVD simulation is one model at full severity on screen values; real displays, anomalous trichromacy and the gradient's mix of hues will differ. Ended gray's value is assumed.
- No source tested learning speed of status colors in apps, or heat encoded by card background strength. Absence here is a limit of this search, not proof none exists.
