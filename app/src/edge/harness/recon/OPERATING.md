# Recon: how it operates

`recordVerb({page, site, verb, url, account, nate_go})` in recon.ts. It opens one page from the pool and records what the site's own client did. Captured: the JSON the client fetched (fetch and xhr only, redacted by primitives.redact), the state embedded in the page (`__NEXT_DATA__`, ld+json, `window.__INITIAL_STATE__`-style blobs, redacted) and the controls on the page (minus every control primitives.isForbidden names). The bundle goes to the adapter author (author/).

- **Accounts.** `public` (signed out) and `test` run freely. `live` (a person's account) is refused unless `nate_go` is set for that site.
- **A check page** ("Just a moment...", "verify you are human") pauses recon and asks the person, who clears it in the live browser. Nothing solves or skips it.
- **A login wall** on a signed-in recon asks for a relink.
- **Headed sites.** Depop and Mercari run in a real window (platform.ts `headed`).

### post
| Opens | Records | Hands the author |
|---|---|---|
| the listing form, filled with a test listing on the test account; the save request is recorded, never sent live | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### revise
| Opens | Records | Hands the author |
|---|---|---|
| the edit form of a test listing | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### end
| Opens | Records | Hands the author |
|---|---|---|
| the end or delete control of a test listing (recorded, not clicked on a live account) | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### relist
| Opens | Records | Hands the author |
|---|---|---|
| the relist control of an ended test listing | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### read_listings
| Opens | Records | Hands the author |
|---|---|---|
| the seller's own listings page | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### read_inbox
| Opens | Records | Hands the author |
|---|---|---|
| the inbox page and one thread | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### send_message
| Opens | Records | Hands the author |
|---|---|---|
| the reply box of a test thread (the send request is recorded on the test account only) | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### read_offers
| Opens | Records | Hands the author |
|---|---|---|
| the offers page | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### answer_offer
| Opens | Records | Hands the author |
|---|---|---|
| an offer's accept, counter and decline controls (recorded, not clicked live) | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### make_offer
| Opens | Records | Hands the author |
|---|---|---|
| the offer-to-likers or make-offer form | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### read_orders
| Opens | Records | Hands the author |
|---|---|---|
| the sold or orders page | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### read_stats
| Opens | Records | Hands the author |
|---|---|---|
| a listing's stats panel | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### read_storefront
| Opens | Records | Hands the author |
|---|---|---|
| the shop dashboard or public profile page | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### search
| Opens | Records | Hands the author |
|---|---|---|
| a public search page, signed out | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |

### save
| Opens | Records | Hands the author |
|---|---|---|
| the like or save control on a listing | client JSON calls, embedded state, allowed controls | the endpoint (COOKIE strategy) if one returned the fields, else the selectors and embedded paths (page recipe) |
