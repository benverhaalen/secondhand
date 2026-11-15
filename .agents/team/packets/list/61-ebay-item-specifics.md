# 61 — eBay item specifics from the Taxonomy API

Updated: November 15, 2026. Owner: Ben. Agent: Claude Code (project thread "Cross-list Depop listings and price with quant"). Branch: main. Status: built and tested on a made-up reply; no eBay call has run.

## What changed

- `app/src/engines/listing/aspects.ts`:
  - `aspectRows(kind, reply)` turns one `getItemAspectsForCategory` reply into requirement rows under eBay's own aspect names. `buildListing` reads them unchanged.
  - `aspectGaps(item, rows)` lists three things: required aspects missing (these block the draft), recommended aspects missing (these become questions), and values outside a fixed list.
- Research and eBay's terms: [listing-help-apis.md](../../../../research/list/ben/listing-help-apis.md).

## For Nate

- A nightly job could load every category's aspects at once with `fetchItemAspects`. It returns one gzipped JSON of over 100 MB, read with an application token.
  - Store it by `categoryTreeVersion`.
  - Re-fetch only when that version changes.
  - Keep it no more than 24 hours old, per eBay's terms.
- It fits `nightly_fits` or a sibling task. Nothing reads it yet. The app would read one category's rows from that table.
- eBay's terms keep this data to eBay listings. Don't join it into other sites' requirement rows.

## Next action

- Ben: no applications to eBay or other sites yet, Buyer Demand Data included ([words](../../../../product/words.md#2026-11-15-no-applications-to-marketplaces-yet)). Questions are ordered required first, then recommended.
- Nate: whether the aspects load belongs in the Databricks bundle, and under which table name.
