# Can studio score a listing photo and tweak it, without a model, until the score stops rising?

Researched 2026-11-14 by Ben (Claude Code). Feature: studio.

Ben asked for this ([words](../../../product/words.md#2026-11-14-photo-tweaks-without-generation-and-a-photo-score)): "there are ways to tweak images that dont require generation. brightness, contrast, etc. it should be able to tweak these ... give our own rough score probably with a decision model to a photo and then can tweak until its optimal".

## Short answer

Yes, and it is built: [photo_score.py](prototype/photo_score.py) scores a photo from 0 to 100, tweaks brightness, contrast, shadows, highlights and sharpening, crops for each platform, and stops when the score stops rising. It refuses any tweak that moves the item's color. The judging prompt for the decision model is in [judge_prompt.txt](prototype/judge_prompt.txt).

Two things to know before trusting the number:

1. **No platform publishes how photos affect ranking.** They say quality matters and stop there. The score measures what the platforms and one study say a good photo looks like. It does not predict engagement, and nothing here has been checked against real sales.
2. **On Ben's own photos the tweaks barely matter**, because the photos are already good: 87 to 90 before, 88 to 90 after. On the same photos made dim and flat on purpose, the loop takes them from 73 to 78 back up to 90 to 91. The tweak loop is for the careless photo. For a careful one, the useful output is the retake advice.

## What the sources say

| Claim | Source | Mark |
|---|---|---|
| "High quality photos are key to showing up in searches on eBay and external sites like Google Shopping." | [eBay Seller Center](https://www.ebay.com/sellercenter/listings/photo-tips) | observed; eBay gives no number and no definition of quality |
| "Quality item images can help boost sales, prevent returns and improve your items placement in search results." | [eBay help](https://www.ebay.com/help/selling/listings/adding-pictures-listings?id=4148) | observed |
| "Your first photo appears in search results." Added text or graphics "can affect your listing's placement in search results." | both eBay pages | observed |
| "Center your item and fill up the frame as much as possible." "an uncluttered space, against a white/neutral background". "Make sure your photos don't appear blurry or pixelated." "Avoid using flash or adding filters." | eBay Seller Center | observed |
| "Lighting that causes harsh shadows never looks good." "direct sunlight can wash out colours" | [Depop, List like a pro](https://blog.depop.com/articles/list-like-a-pro) | observed |
| "Modelled shots tend to perform best." "Flat lays on simple backgrounds also do well." | [Depop, grow your shop](https://www.depop.com/blog/grow-your-shop/) | observed; no number given |
| "Taking up to four photos instead of one can increase your chances of selling by 20%." | Depop, List like a pro | asserted by Depop; no method given |
| "This engagement signals to Depop that listings should be put in front of more buyers" | Depop, grow your shop | observed; said of likes and saves, not of photos |
| "the first thing you want to edit is the brightness." "don't overdo it on lighting or your photos will appear grainy or overexposed." | [Poshmark photography guide](https://blog.poshmark.com/2020/01/16/the-poshmark-listing-photography-guide/) | observed |
| "Keep your Covershot product focused by using a white or simple background." | Poshmark guide | observed |
| In about 24,700 crowd-rated shoe and handbag photos from LetGo, brighter photos were rated better (both categories), as were higher contrast (handbags) and wider dynamic range (shoes). An uneven background and an off-centre item were rated worse. Resolution did not matter. | [Ma et al. 2019, arXiv 1811.10648](https://ar5iv.arxiv.org/html/1811.10648) | the feature list is observed; the coefficients come from a summary of the later sections and were not read line by line |
| On 162,000 eBay listings, a better photo-quality score went with higher odds of selling (about 1.17 for shoes, 1.25 for handbags), but added about one point of accuracy over price, views and days listed. The abstract: quality goes with "higher likelihood that an item will be sold, though other factors such as view count were better predictors." | same paper | abstract quote observed; the odds ratios from the summary |
| Good photos taken by the seller were trusted more than stock photos. | same paper, abstract | observed |
| Mercari's own photo guidance | help page returned an error | not read |

What follows from that (inferred): a good photo helps a little directly and probably more through clicks, since the cover is what a buyer sees in search. Photo count and the cover matter at least as much as polish. A seller's real photo beats a stock-looking one for trust, which fits Ben's touch-up rule.

## The score

Seven measured parts, each 0 to 1 inside a band, weighted to 100. All bands and weights are *agent proposal*.

| Part | Weight | What is measured | Why it is in | What can move it |
|---|---|---|---|---|
| Exposure | 20 | Mean brightness of the frame | Brightness was the strongest feature in Ma et al.; Poshmark edits it first | Tweak |
| Contrast | 15 | Spread from dark to light | Ma et al.; Poshmark warns against flat and washed-out | Tweak |
| Sharpness | 15 | Edge energy on the item | eBay: not "blurry or pixelated" | Tweak, slightly; mostly a retake |
| Clipping | 10 | Share of the item blown out or crushed | Poshmark: "overexposed"; Depop: "wash out colours" | Tweak |
| Fill | 15 | Item box as a share of the frame | eBay: "fill up the frame" | Crop |
| Centering | 10 | How far the item sits from the middle | eBay: "Center your item"; Ma et al. on asymmetry | Crop |
| Background | 15 | How uneven the brightness is behind the item | Every platform says simple; Ma et al. on background unevenness | Retake only |

The judged half (lines 1 to 10 in the [prompt](prototype/judge_prompt.txt)) covers what numbers cannot see: whether the whole item is shown, whether it is laid out neatly, whether the light is harsh, whether anything looks edited.

One disagreement worth knowing: Ma et al. found that items filling more of the frame were rated slightly worse, while eBay says to fill the frame. The fill band tops out at 80% of the frame, so a tight but uncut item scores full and an item touching the edges does not.

## The tweaks and the truth limit

`tweak()` changes brightness only: exposure, contrast, shadows, highlights, and a light sharpen. Every pixel keeps its red, green and blue in the same proportion, so hue and saturation are not edited. There is no saturation, vibrance, warmth or filter control, on purpose: those change what color the item appears to be. White balance stays where it is in the plan, in level 0, from a white reference.

A tweak is refused if the item's color, with brightness taken out, moves by more than 2.0 (CIEDE2000), or if it clips more of the item than the original did. The search also ignores the background part, so it cannot flatten the photo to hide an uneven floor.

`crop_for()` takes the largest 1:1, 3:4 or 4:5 crop that holds the whole item and never pads. If the item does not fit a ratio, it says so, and the fix is the capture (shoot 3:4 with the item inside the centered square, per the [platform research](../../list/ben/platform-fit.md)).

## What ran (observed, 22:50 UTC)

Ben's three real covers, 1080 px, on concrete:

| Photo | Before | After | What the loop changed | Item color moved |
|---|---|---|---|---|
| Carhartt pants | 87.6 | 88.5 | Slightly brighter | 0.56 |
| Chico hoodie | 90.1 | 90.1 | Nothing: brightening would blow out the print | 0.0 |
| Marquette tee | 87.2 | 88.0 | Highlights pulled back | 0.25 |

The same three, first made one stop darker and flatter (a seeded fault standing in for a careless photo):

| Photo | Dimmed | Recovered | Original |
|---|---|---|---|
| Carhartt pants | 73.4 | 91.1 | 87.6 |
| Marquette tee | 76.9 | 90.4 | 87.2 |
| Chico hoodie | 78.0 | 90.6 | 90.1 |

All three recovered photos passed the truth limit. Crops: all three items fit 1:1. The pants and tee do not fit 3:4 or 4:5 without cutting the item, because the source photos are square; that is a capture fix.

About 15 seconds per photo on one core, most of it finding the item's outline.

## Limits

- The bands are set from three photos and two product categories of published evidence (shoes and handbags). Clothing on a floor may want different bands.
- The judged half has not run. The prompt is written; the decision model was not reachable from here.
- Clipping counts white and black prints as blown out, so a printed tee scores lower than it should.
- The score says nothing about the things that move a listing more: price, title, photo count, and how fast the seller answers.
- A real calibration is possible: Ben's depop-plus data has a hundred listings with photos. If it also has views, likes or days to sell, the weights could be fitted to it. *Agent proposal*, not done.
