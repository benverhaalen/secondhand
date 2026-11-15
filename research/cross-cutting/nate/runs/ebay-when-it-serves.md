# When eBay serves its public pages to our browsers

Run by the build orchestrator, 2026-11-15 about 07:30 Central, after the eBay page lane's first recon got a 403 on every page and Nate said he has seen eBay work ([words](../../../../product/words.md#2026-11-15-nate-ebay-does-work-in-cases)). Every line below is *observed* in these runs unless marked. One browser at a time, 3 to 4 page loads a run, nothing clicked through, no sign-in. The script is not in the repo; the eBay adapter's recon carries the method.

## What decides it

eBay refuses a page when our browser intercepts requests. It serves the same page to the same browser when nothing is intercepted.

| Browser | Requests intercepted (images, media and fonts aborted through `page.route`) | Page | Answer |
|---|---|---|---|
| local Chrome on this machine, headless | yes | home, then search by URL | 403 "Error Page \| eBay" on both |
| local Chrome, visible window | yes | home, then search by URL | 403 on both |
| local Chrome, visible window | no | search by URL, first page of the visit | 200, "Levis 501 Jeans 32x32 for sale \| eBay", 81 distinct item links, 4.2 s |
| local Chrome, visible window | no | home, then a search typed in the site's box about 3 s later | home 200; the search gave the error page (one run; pace or order may matter) |
| Browser Use Cloud browser, default US proxy | no | home, then a search typed in the site's box | home 200; search 200 with 81 item links, 9.6 s from the browser's start |
| Browser Use Cloud browser | no | the sold filter by URL (`&LH_Sold=1&LH_Complete=1`) | 200 with the title "Sign in or Register \| eBay", no item links |
| the desktop app's own browser pane on this machine | no | search by URL | 200, 85 item links |
| a plain request with no browser (the first recon) | n/a | search, sold search | 403 in about 110 ms |

## What follows

- The first recon's finding, "eBay refuses its public pages to plain and cloud browsers", was about our interception, not about eBay and browsers. The 403 is not a bot check: no challenge text appeared on any page.
- On eBay the harness intercepts nothing. That costs the images' bytes through the proxy on each load; measure it before choosing a cadence.
- Sold listings are behind eBay's sign-in. A sold search by page is a signed-in read on the person's own linked account, and without one it answers `auth_expired`. Nothing is built to see sold listings another way.
- A plain request is still refused, so eBay has no cheap no-browser route; search is a browser read (about 4 s local, under 10 s from a cold cloud browser).
- *Inferred*: intercepting requests changes how the browser's requests look to eBay's edge (it re-issues each request through the debugger), and that is what is refused. Not tested further.
- eBay's robots.txt disallows `/sch/` and its User Agreement bars automated access; Nate was shown both and ruled "read ebay pages anyway" ([protections](../../../../spec/engines/protocol-and-adapters.md#8-protections)).
