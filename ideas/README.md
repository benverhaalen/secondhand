# Ideas

Things Ben or Nate want that wait until the product works. One file per idea. Ben's rule for all of them: "we need the product first before we optimize" ([words](../product/words.md#2026-11-14-ideas-board-and-treg-on-databricks-after-the-product)).

## The board

Sorted by what to pick up first once the demo works: the ones that reuse the most of what we are already building come first. The order is an *agent proposal*; Ben or Nate reorder it by moving rows.

| # | Idea | Raised by | Waits on |
|---|---|---|---|
| 1 | [Post to Grailed and OfferUp](post-to-grailed-and-offerup.md) | Ben | The five posting harnesses working |
| 2 | [The website](website.md) | Ben | The phone app working end to end |
| 3 | [Our own page monitor](own-page-monitor.md) | Ben | Watch alerts working on the bought services |
| 4 | [Treg rebuilt on Databricks](treg-on-databricks.md) | Nate | Price and watch working through Treg |
| 5 | [More marketplaces](more-marketplaces.md) | Ben | The five core sites working |
| 6 | [Dark mode](dark-mode.md) | Ben | The brand ratified in light, and the main screens existing |
| 7 | [Hot items and a pricing model that learns from signals](hot-items-and-learned-pricing.md) | Ben | Signals logged per site, and a few hundred finished listings |
| 8 | [A public launch](public-launch.md) | Ben and Nate | The hackathon ending |
| 9 | [Video capture](video-capture.md) | Ben | Manual photo capture working end to end |

## Adding or taking an idea

- When Ben or Nate says something is for later, out of scope for now, or "if we have time": quote them in [words.md](../product/words.md), add a file here with a row above, and leave a one-line pointer where it used to be written.
- Each file says who raised it, what it waits on, what already exists and the first step.
- When someone picks an idea up, move what it says into `features/<slug>/` and delete the file here. Git keeps the history.
