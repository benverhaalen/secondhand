# Fixtures

Recorded 2026-11-15, sanitized. Cut from live runs of the two actors (research/data/nate/apify-ebay-and-facebook.md).

- `ebay-search.json`: 5 of 10 items from automation-lab/ebay-scraper, query "Levi 501 jeans", US. The seller fields are blanked (they came back empty anyway). The fifth item's price is removed, so the drop count has a case.
- `facebook-search.json`: 4 of 10 items from apify/facebook-marketplace-scraper, a Chicago search for "office chair", without details. The listing ids and URLs are replaced with made-up ids. The photo URLs are replaced with a placeholder. The seller and location are removed. The fourth item's `is_sold` is set to true, so the sold flag has a case.
- `facebook-details.json`: 2 of 3 items from the same search with `includeListingDetails`. It is sanitized the same way, and the description, location text and photo list are also removed.
