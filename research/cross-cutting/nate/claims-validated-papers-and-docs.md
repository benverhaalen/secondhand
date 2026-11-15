# Which published figures, Apple statements, marketplace figures and docs-page claims in secondhand's spec and docs are true, outdated, unsupported or unreachable?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: cross-cutting.

Scope note: second pass after [claims-validated-determinations.md](claims-validated-determinations.md). About 45 claims were reached, short of the 100 asked for. The how-we-compare.md rival figures, most other docs-page claims and the Vendoo, Poshmark 80 to 90%, minimum-discount and Depop offer-range claims were not reached (see Not found). Evidence marks: observed (source opened, URL given), asserted (source claims without showing, or secondary only), inferred (my reasoning).

## Counts

| Verdict | Count |
|---|---|
| TRUE (including TRUE with a stated caveat) | 33 |
| FALSE | 3 |
| OUTDATED | 1 |
| UNSUPPORTED | 4 |
| NOT REACHABLE | 4 |

## Wrong, outdated or unsupported claims

| File and line | Claim as written | What the source says | Corrected sentence | Method or design depends on it? |
|---|---|---|---|---|
| spec/determinations/measure.md:150 | Kim 2022 error "at most 2.08% per dimension" | Crossref abstract of Kim, Appl. Sci. 12(10):5286 (observed): "1.59% and 2.08% of the average relative error" in two environments. These are averages. The paper's tables were not opened (MDPI page NOT REACHABLE). | "Kim reports an average relative error of 1.59% and 2.08% in two environments." | Yes, the garment-measurement accuracy budget. |
| spec/determinations/measure.md:151 and seeing-the-item.md:308 | Kowaleczko 2022 "at most 4.20%" | annals-csis.org Volume_32/drp/pdf/8.pdf (observed): mean percentage error is 6.45% overall (up to 7.13% for pants) before the error-correction neural network; 4.10% for tops and 4.20% for skirts only after the network. Per-category means, not a maximum. 900 images, 76 rejected (8.4%) is true. | "Kowaleczko reports 6.45% mean percentage error, and 4.10% to 4.20% for tops and skirts after a trained correction network." | Yes, the card-marker measurement path and its stated accuracy. |
| spec/determinations/measure.md:168 and seeing-the-item.md:312 | MoGe-2 Rel 15.7 "indoors" | arXiv 2507.02546 (observed): 15.7 is the metric-depth relative error averaged over 7 mixed datasets, not an indoor-only figure. | "MoGe-2 reports a relative metric-depth error of 15.7 averaged over seven mixed datasets." | No, depth is only a cross-check. |
| spec/determinations/identify.md:120 | SigLIP 2 "R@1 near 80 on our products" | benchmark.nyris.io (observed): 80.28 R@1 on Stanford Online Products, run by a vendor whose own model scores 87.06%. The SigLIP 2 paper (arXiv 2502.14786) does not report it. Not measured on secondhand products. | "SigLIP 2 scores 80.28 R@1 on Stanford Online Products in a vendor benchmark; we have not measured it on our items." | Yes, the choice of embedding model for similar-item retrieval. |
| spec/features/assist.md:78 | Brand queries "about 2.4 words" | arXiv 2502.01555 (observed): three to four words on average. The two-stage cascade claim is true. | "Brand queries average three to four words." | No. |
| spec/features/assist.md:247 | "56% of instructions miss information (EMNLP 2025)" | arXiv 2503.13975 (observed): no 56% figure, and no EMNLP paper is named. The "3 times" figure is true. | Drop the 56% or cite its source. | No. |
| spec/determinations/market-insight.md:752 | Duke StockX model "65 to 70% accuracy on profit or not" | sites.duke.edu/djepapers/files/2020/08/matreiber-dje.pdf (observed): the figures are R-squared 0.6489 to 0.6500, not classification accuracy. 5% depreciation and about 90 days to decay are true. | "R-squared of about 0.65 on resale premium." | No, the line says the figure is not shown. |
| spec/determinations/listing-and-marketing.md:729 and docs/how-it-works/how-we-market.md:63 | Poshmark's Excessive Listing Removal policy cited as a live constraint on automation | https://blog.poshmark.com/2026/07/30/60046/ (observed, 2026-07-30): "We're removing the Excessive Listing Removal policy ... you can delete listings freely." Dated 2026-07-23 by https://www.valueaddedresource.net/poshmark-scraps-excessive-listing-removal/ (secondary). The Seller Cancellation Policy (3% of orders in a rolling 90 days, secondary) remains. OUTDATED. | "Poshmark retired its Excessive Listing Removal policy on 2026-07-23; the Seller Cancellation Policy still applies." | Yes, the delist and cross-list sync rate limits and any pacing rule written for that policy. |
| docs/how-it-works/clarifying-questions.md:62 and seeing-the-item.md:538, asking-and-intent.md:81, identify.md:122 | "65% to 27%" | arXiv 2504.16331 (observed): the Okanagan system on standard coding tasks, not e-commerce. The number is real. UNSUPPORTED as evidence for a marketplace. | "On coding tasks, asking clarifying questions raised pass rate from 27% to 65% (arXiv 2504.16331); we have not tested it on listings." | Yes, the case for asking clarifying questions. |

## TRUE claims checked

Papers (all observed)
- arXiv 1802.03050: https://arxiv.org/abs/1802.03050
- arXiv 1902.10918: https://arxiv.org/abs/1902.10918
- arXiv 1905.03222: https://arxiv.org/abs/1905.03222
- arXiv 2103.09763: https://arxiv.org/abs/2103.09763
- arXiv 2202.13415: https://arxiv.org/abs/2202.13415
- arXiv 2106.00170: https://arxiv.org/abs/2106.00170
- arXiv 2305.14251: https://arxiv.org/abs/2305.14251
- arXiv 2401.13744, Cresswell 2024: conformal sets beat fixed top-k in a pre-registered trial: https://arxiv.org/abs/2401.13744
- arXiv 2404.10774, MiniCheck-FT5 74.7%: https://arxiv.org/abs/2404.10774
- arXiv 2502.04485: https://arxiv.org/abs/2502.04485
- arXiv 2605.07087, Mercari cure model, AUC 0.5960 at c = 1 week, N = 98,258 in one T-shirt category: https://arxiv.org/abs/2605.07087
- arXiv 1811.10648, odds 1.17 shoes and 1.25 handbags: https://arxiv.org/abs/1811.10648
- arXiv 2503.13975, 3x and 16x: https://arxiv.org/abs/2503.13975
- arXiv 2504.16331, 65% and 27% figures exist (domain caveat above): https://arxiv.org/abs/2504.16331
- arXiv 2607.01530, IntentTune: gender comparison is in the table; the size F1w 0.853 versus demand is not, because demand has no size value: https://arxiv.org/abs/2607.01530
- arXiv 2502.01555, two-stage cascade: https://arxiv.org/abs/2502.01555
- Kowaleczko 2022, 900 images and 76 rejected (8.4%): https://annals-csis.org/Volume_32/drp/pdf/8.pdf
- Luetzenburg 2021, "small objects with a side length > 10 cm with an absolute accuracy of +/- 1 cm"; detection limit about 5 cm: https://doi.org/10.1038/s41598-021-01763-9
- UniDepthV2 ARel 6.8 on SUNRGBD (best of three indoor sets: 7.8 IBims-1, 22.1 TUM-RGBD): https://arxiv.org/abs/2502.20110
- DeepFashion2 landmark AP 0.563: https://arxiv.org/abs/1901.07973
- SAM 3 LVIS zero-shot mask AP 48.8 versus 38.5: https://arxiv.org/abs/2511.16719
- SigLIP 2 R@1 80.28 on SOP (vendor benchmark): https://benchmark.nyris.io
- Duke thesis, 5% depreciation and about 90 days to decay: https://sites.duke.edu/djepapers/files/2020/08/matreiber-dje.pdf
- Kim 2022, 1.59% and 2.08% average relative error exists (Crossref abstract): https://doi.org/10.3390/app12105286

Economics and behaviour (observed)
- Einav, Kuchler, Levin, Sundaresan 2015: "only 70 to 80 percent of the shipping fee is internalized in the bidding". Caveat: eBay auction data; the abstract says $0.82 per $1; the docs' 0.75 midpoint (listing-and-marketing.md:314, 318; selling-runs-itself.md:23) is the doc's own design choice, and "the only published estimate" is asserted: https://web.stanford.edu/~leinav/pubs/AEJmicro2015.pdf
- Luo et al. 2019: disclosure "reduces purchase rates by more than 79.7%" (selling-runs-itself.md:122, "about 80%"). Caveat: outbound sales calls by chatbots at a financial firm, not marketplace chat: https://pubsonline.informs.org/doi/10.1287/mksc.2019.1192

Marketplaces (observed unless marked)
- Depop, "Sundays and Mondays are the biggest days for accepting offers" (2024-01-09; also 23% average discount via offers): https://news.depop.com/company-news/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/
- Depop photos: four plus one video in the app, eight on the web (selling-runs-itself.md:22 says 8): https://depophelp.zendesk.com/hc/en-gb/articles/360032716413-How-to-list-an-item
- Depop offers last 14 days; shipping excluded from the offer: https://depophelp.zendesk.com/hc/en-gb/articles/4412315779345-Make-Offer
- Poshmark "up to 16 photos" (selling-runs-itself.md:22): https://support.poshmark.com/s/article/894455911?language=en_US ; blog 2024-03-25 adds 1 video: https://blog.poshmark.com/2024/03/25/posh-tip-how-to-list-on-poshmark/
- Mercari "up to 12 photos" (not stated in the docs): https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing/
- Poshmark retirement of Excessive Listing Removal (listed above as OUTDATED for the docs): https://blog.poshmark.com/2026/07/30/60046/
- Poshmark Seller Cancellation Policy 3% of orders in a rolling 90 days: asserted, secondary only (https://www.valueaddedresource.net/poshmark-scraps-excessive-listing-removal/, 2026-07-24).
- Mercari cancellation "up to 5%" (selling-runs-itself.md:114): asserted, secondary only (resalemargin.com 2026-11-12, fluf.io: "5% of the item price, up to $25").
- Facebook Marketplace 10% shipped fee with $0.80 minimum: asserted, secondary only (sellerfeedesk.com 2026-10-06, feebrief.com 2026-10-31, numford.com 2026-10-19, sellerfeecalc.com 2026-06-18). Sources split on per order versus per item.
- Poshmark label $6.49 flat up to 5 lb: asserted, secondary only (resalemargin.com 2026-11-12).
- Poshmark title 80 and description 1,500 characters: asserted, secondary only (fluf.io).

## Not reachable (ordinary request, no workaround tried)

- MDPI Kim 2022 article page: 410 bytes, so table-level checks of measure.md:150 were not possible.
- Apple developer pages for RealityKit Object Capture (capturing-photographs-for-realitykit-object-capture, creating-3d-objects-from-photographs): HTTP 200 but a JavaScript shell with no text. Not verified: capture-shots.md:168 (soft objects), capture.md:163 (LiDAR and iOS 17+).
- Meta Help for Marketplace fees (https://www.facebook.com/help/1889067784738765): CSS and shell, no fee text.
- Poshmark support fee page: 404. Depop help root: 403. Facebook business help URL: 404.

## Not found

- Primary source for the Facebook fee, the Poshmark $6.49 label and the Mercari cancellation fee.
- Source for "free shipping linked to about 14% higher sale likelihood" (selling-runs-itself.md:23).
- Luetzenburg "best from 20 cm to 2 m": not confirmed in the text searched.
- Not checked: Vendoo "33% more sales" (listing-and-marketing.md:738, how-we-market.md:71, asserted as a vendor claim), Poshmark 80 to 90% (516), minimum discounts (532, how-we-market.md:69), Depop offer range 5% to 95% (572), Facebook title 200/65/99 (selling-runs-itself.md:120), eBay one video and Etsy 3 to 15 s (capture-shots.md:328), 95% within 5 cm versus 60% (327), LiDAR plus or minus 1 cm (355), every rival figure in how-we-compare.md, and the remaining docs pages (how-we-price, value-and-price-history, how-we-prove-it, identify-and-similar-items, search-and-shopping) beyond the arXiv ids.

## Sources fetched

- arXiv abs pages: 1802.03050, 1902.10918, 1905.03222, 2103.09763, 2202.13415, 2106.00170, 2305.14251, 2401.13744, 2404.10774, 2502.04485, 2605.07087, 1811.10648, 2503.13975, 2504.16331, 2607.01530, 2502.01555, 2502.20110, 2507.02546, 1901.07973, 2511.16719, 2502.14786
- https://annals-csis.org/Volume_32/drp/pdf/8.pdf
- https://doi.org/10.1038/s41598-021-01763-9
- Crossref API record for the Kim 2022 DOI
- https://benchmark.nyris.io
- https://sites.duke.edu/djepapers/files/2020/08/matreiber-dje.pdf
- https://web.stanford.edu/~leinav/pubs/AEJmicro2015.pdf
- https://pubsonline.informs.org/doi/10.1287/mksc.2019.1192
- https://news.depop.com/company-news/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/
- https://depophelp.zendesk.com/hc/en-gb/articles/360032716413-How-to-list-an-item
- https://depophelp.zendesk.com/hc/en-gb/articles/4412315779345-Make-Offer
- https://support.poshmark.com/s/article/894455911?language=en_US
- https://blog.poshmark.com/2024/03/25/posh-tip-how-to-list-on-poshmark/
- https://blog.poshmark.com/2026/07/30/60046/
- https://www.mercari.com/us/help_center/topics/listing/guides/creating-a-listing/
- Secondary: valueaddedresource.net, fluf.io, resalemargin.com, sellerfeedesk.com, feebrief.com, numford.com, sellerfeecalc.com
