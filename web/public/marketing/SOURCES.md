# Landing page image sources

The wall uses a selection of the repository's existing photo-wall collection in `brand/explore/web-home/photos/wall/tiles/`. Original attribution is maintained with that collection. The selection is recorded in `web/components/marketing/wall-photos.ts`. The site keeps all 54 tiles as 288px WebP derivatives (Sharp quality 78). At narrow widths the browser skips the columns outside the viewport.

Marketplace marks are unchanged copies from `assets/platforms/square/`. The paired-tag logo is the existing `web/public/brand/mark.svg`.

The phone images show the current app routes at `22f37f6dc29e275a940e4a72357143f179d1d7fd` on November 15, 2026. The captures used isolated API fixtures and the shell frames complete app viewports.

| Asset | App scene |
| --- | --- |
| capture.png | Review after adding one photo of the sample Carhartt jacket |
| preview.png | Listing preview for the same jacket, with a copy-and-post handoff |
| plan.png | Asking price and comparable-price guidance for the jacket |
| watch.png | Saved tracking request for a Brewers jersey |
| ship.png | Sale details and marketplace handoff for a sample Kindle |

The Carhartt jacket and Kindle are nonpersonal demo items. The jacket image also appears on What’s Next. See the [demo image provenance](../../../assets/demo-items/README.md). The prices, transactions, comparable sales and shipping values are sample data. The Kindle sale is separate from the jacket example. The historical pricing chart comes from `scripts/bench/out/backtest-stockx.json`.
