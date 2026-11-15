# The website constitution

What the public site must do, for whom, and how signed-in web relates to the app. How any screen is decided is the [UI constitution](../ui-constitution.md); how it looks is the [brand constitution](../../brand/constitution.md); the page map is [spec/pages.md §6.17](../../spec/pages.md#617-the-website); the hero work so far is in [brand/explore/web-home/](../../brand/explore/web-home/). *Agent proposal*; the public-site rules retire after judging, the signed-in rules stay.

## The problem

Two people read the site, and neither is using the product yet. A **judge** after the table wants to know whether what they saw is real and how deep it goes. A **stranger** has never heard of secondhand, is wary of an app that signs in to their marketplace accounts and changes their photos, and gives the page a few seconds. The site has to make the idea knowable from one line, answer the worries that a new and odd product raises (accounts, honest photos, money, safety), prove itself with working demos and real numbers, and show where it goes at scale. It has to be fast, alive, and plainly the same brand as the app without looking like the app ([04:07](../words.md#2026-11-15-one-place-makes-the-ui-every-correction-becomes-a-check-emils-skills-vet-every-page-and-the-system-designs-any-new-page): "the website cant look like the app"). Signed in, the site is the app laid out for a mouse and a big screen, not a second product.

**Success, checkably:** a stranger shown the hero for five seconds can say what it does; every worry in [faq.md](../faq.md) has a page or answer reachable in two clicks; every number on the site carries its proof mark; the page passes break-ui at phone, tablet and desktop sizes.

## Ends

| End | Test |
|---|---|
| The idea lands in one line | The five-second test above |
| Every worry has an answer | FAQ and the small pages exist, written from [qa.md](../qa.md), not invented |
| It proves, not claims | Each feature section shows a demo of the real app or a measured number |
| It feels alive and ours | Motion on first load and first scroll; no section reads as a template |

## Rules

**W1. One line, then "See how it works".** The line alone carries the hero; no period; the second "secondhand" in the wordmark face; hands sized to the wordmark ([07:07](../words.md#2026-11-15-the-hero-a-blurred-wall-of-many-real-things-the-dap-that-opens-into-the-wordmark-see-how-it-works), [07:09](../words.md#2026-11-15-the-hero-on-every-screen-one-baseline-for-both-faces-no-period-a-menu-on-phones-rounded-store-logos-the-hand-options), [07:34](../words.md#2026-11-15-the-hand-glyphs-a-c-and-f-up-close-two-colors-every-position)).

**W2. Alive, and every motion has a reason.** The open is the dap into the wordmark; behind the line, a slow blurred wall of many real things, never repeating visibly; the first scroll has the strongest animation. Motion never blocks reading or loading. *Why:* "on the website i want it to be moving. feel alive ... bold moves need purpose too" ([01:11](../words.md#2026-11-15-a-brand-system-for-anything-alive-and-bold-with-purpose-code-that-knows-each-app-and-knowing-when-things-sell)); "great web design ... optimal loading and super fast stuff is important" ([04:32](../words.md#2026-11-15-the-website-references-story-photography-signed-in-web-and-the-buysell-toggle)).

**W3. Show with the real app.** Feature sections use recordings of the built app driven on demo data, the way the Magic UW demo video was made ([05:32](../words.md#2026-11-15-the-visitors-path-the-first-scroll-demos-driven-on-mock-data-impressive-versus-housekeeping-show-versus-tell)). No drawn screen stands in for one that exists.

**W4. Impressive gets space, housekeeping folds.** The sites we connect to and what we do on them get a section; connecting them does not ([05:32](../words.md#2026-11-15-the-visitors-path-the-first-scroll-demos-driven-on-mock-data-impressive-versus-housekeeping-show-versus-tell)).

**W5. The small pages exist.** How it works, sites and fees, the data and Databricks, FAQ, privacy, pricing, status, about and what's next. *Why:* "have those little pages most vibecoded sites disregard" ([05:05](../words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all)); "with such a new and oddly constructed and worrysome product ... a lot of concerns across the board" ([05:28](../words.md#2026-11-15-the-public-site-one-section-at-a-time-its-purposes-the-worries-and-the-future)).

**W6. Honest numbers and honest photos.** Every figure carries its mark from [features-proof.md](../features-proof.md#how-to-read-the-proof-marks). About photos the site says "every AI photo is measured against your tape before it posts", never that the AI is accurate (the raw redraw of the tee came out about 2 in narrow before the check reset it).

**W7. Story general enough to see yourself in.** No single persona carries the site; the future and scale get their own section: monitoring and managing markets for you, an intelligence engine, pricing anything you own ([05:32](../words.md#2026-11-15-the-visitors-path-the-first-scroll-demos-driven-on-mock-data-impressive-versus-housekeeping-show-versus-tell), [06:01](../words.md#2026-11-15-show-the-magic-clips-basement-demos-faster-loops-and-the-intelligence-engine)).

**W8. Cleo's spatial layout, shorter, dark by default.** ([05:05](../words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all), [05:49](../words.md#2026-11-15-the-hero-the-line-alone-ambient-clothing-motion-dark-by-default-the-hands-and-the-wordmark-face-on-words).)

**W9. Built one section at a time with Ben, then faster.** Each ambiguous section gets a board of options like the dark-mode previews; once the primitives are set, the rest goes quickly ([05:28](../words.md#2026-11-15-the-public-site-one-section-at-a-time-its-purposes-the-worries-and-the-future)).

**W10. Every screen size is broken on purpose.** Phone (with a menu), tablet and desktop pass break-ui; store logos are rounded like the app ([07:09](../words.md#2026-11-15-the-hero-on-every-screen-one-baseline-for-both-faces-no-period-a-menu-on-phones-rounded-store-logos-the-hand-options)); say "App Store coming soon" ([05:41](../words.md#2026-11-15-a-demo-that-stuns-science-fair-judging-and-claims-that-change-how-judges-see-it)).

**W11. Rules are scoped to a surface.** A rule written for the app binds the web only if the web has the same problem ([03:42](../words.md#2026-11-15-rules-per-surface-and-research-per-surface-in-the-loop)); mouse and touch differ ([pointer-and-touch.md](../../research/cross-cutting/ben/website/pointer-and-touch.md)).

**W12. Signed-in web loses nothing the app has, except the camera.** Photos are uploaded instead of shot; the camera hands off to the phone ([20:45](../words.md#2026-11-14-app-first-and-ui-factory-after-the-brand)). The web adds what a big screen is good at: bulk actions, folder drops, label printing.

**W13. Images.** Real photos for items. Generated images only for things that aren't the product, touched up so they don't read as AI ([22:23](../words.md#2026-11-14-the-ui-loop)), made through the OpenRouter model, not GPT image ([04:32](../words.md#2026-11-15-the-website-references-story-photography-signed-in-web-and-the-buysell-toggle)).

## Open

- The hand pick (the thread recommends C in sky and mint), and whether the hero's wordmark-face "secondhand" may break the clear-space rule: asked in [Design the secondhand website with me](https://claude.ai/code/project/chan_01S64oRNV6rfAyD7NMnErjQP?thread=cmsg_01S64oRNV6rfAyD7NMnErjQP176zy6xJgoD6nQMvTouBQ3).
- Where Nate's buy/sell toggle lives, and whether people may appear in the site's scene photos: both asked there, unanswered.
- Only the hero is built. The sections after it, the small pages and signed-in web are not started.
