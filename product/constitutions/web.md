# The website constitution

What the public site must do, for whom, and how signed-in web relates to the app. How any screen is decided is the [UI constitution](../ui-constitution.md); how it looks is the [brand constitution](../../brand/constitution.md); the page map is [spec/pages.md §6.17](../../spec/pages.md#617-the-website); the hero work so far is in [brand/explore/web-home/](../../brand/explore/web-home/). Reasons and numbers follow [evidence.md](evidence.md). *Agent proposal*; the public-site rules retire after judging, the signed-in rules stay.

## The problem

Two people read the site, and neither is using the product yet. A **judge** after the table wants to know whether what they saw is real and how deep it goes. A **stranger** has never heard of secondhand, is wary of an app that signs in to their marketplace accounts and changes their photos, and gives the page a few seconds. The site has to make the idea knowable from one line, answer the worries that a new and odd product raises (accounts, honest photos, money, safety), prove itself with working demos and real numbers, and show where it goes at scale. It has to be fast, alive, and plainly the same brand as the app without looking like the app ([04:07](../words.md#2026-11-15-one-place-makes-the-ui-every-correction-becomes-a-check-emils-skills-vet-every-page-and-the-system-designs-any-new-page): "the website cant look like the app"). Signed in, the site is the app laid out for a mouse and a big screen, not a second product.

**Success, checkably:** a stranger shown the hero for five seconds can say what it does; every worry in [faq.md](../faq.md) has a page or answer reachable in two clicks; every number on the site carries its proof mark; the page passes break-ui at phone, tablet and desktop sizes.

## Ends

| End | Test | Why it matters |
|---|---|---|
| The idea lands in one line | The five-second test above | A stranger can decide whether to keep reading. |
| Every worry has an answer | FAQ and the small pages exist, written from [qa.md](../qa.md), not invented | Unresolved account or money concerns can stop someone trying the product. |
| It proves, not claims | Each feature section shows a demo of the real app or a measured number | A visitor can inspect behavior or evidence before trusting the promise. |
| It feels alive and ours | Motion on first load and first scroll; no section reads as a template | Purposeful motion directs attention without hiding the explanation. |

## Rules

**W1. Explain the job before the first scroll.** The photo wall and lowercase secondhand wordmark introduce the site. The line below names what you can check, prepare or find. “See how it works” takes you to the first walkthrough. The shared header uses the app’s paired tags.

**W2. Use motion without delaying the next action.** The photo wall drifts behind the hero. Section fields move slowly through the secondhand palette. Text stays still and actions respond immediately.

**W3. Show the real app.** A recording can show a transition or decision that a still cannot. Use full screenshots for an interface someone needs time to inspect. Both come from the app build and use demo data that the site identifies.

**W4. Impressive gets space, housekeeping folds.** The sites we connect to and what we do on them get a section; connecting them does not. *Why:* Space spent on setup pushes the useful outcome farther down the page. Giving the connected sites and their actions space helps a stranger decide whether the product does work they need. Source: ([05:32](../words.md#2026-11-15-the-visitors-path-the-first-scroll-demos-driven-on-mock-data-impressive-versus-housekeeping-show-versus-tell)).

**W5. The small pages exist.** How it works, sites and fees, the data and Databricks, FAQ, privacy, pricing, status, about and what's next. *Why:* Account access, money and photo changes raise different questions. Separate reachable answers let a stranger resolve the concern that would otherwise stop them trying the app. Source: "have those little pages most vibecoded sites disregard"; "with such a new and oddly constructed and worrysome product... a lot of concerns across the board". *Why:* Account access, money and photo changes raise different questions. Separate reachable answers let a stranger resolve the concern that would otherwise stop them trying the app. Source: ([05:05](../words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all)); ([05:28](../words.md#2026-11-15-the-public-site-one-section-at-a-time-its-purposes-the-worries-and-the-future)).

**W6. Honest numbers and honest photos.** Every figure carries its mark from [features-proof.md](../features-proof.md#how-to-read-the-proof-marks). About photos the site says "every AI photo is measured against your tape before it posts", never that the AI is accurate. The prior report describes a raw tee redraw about 2 inches too narrow before correction. *Why:* An AI photo can change an item's shape, and a figure can imply stronger proof than exists. Showing the measurement check and evidence mark lets the seller or stranger judge what is actually supported. Source: (*asserted* here from [the photo proof](../features-proof.md#selling), not remeasured in this review).

**W7. Story general enough to see yourself in.** No single persona carries the site; the future and scale get their own section: monitoring and managing markets for you, an intelligence engine, pricing anything you own. *Why:* A single persona can make another visitor assume the product is not for them. A broader story shows the shared job, while a separate future section lets the judge distinguish ambition from current capability. Source: ([05:32](../words.md#2026-11-15-the-visitors-path-the-first-scroll-demos-driven-on-mock-data-impressive-versus-housekeeping-show-versus-tell), [06:01](../words.md#2026-11-15-show-the-magic-clips-basement-demos-faster-loops-and-the-intelligence-engine)).

**W8. Cleo's style, adapted to how the app looks.** Use Cleo to study section pacing and scale. Express the secondhand palette, controls and typography in the site, so the site and the app read as one family. Shorter than Cleo's page, and dark by default. *Why:* a stranger who meets the site and then the app should see one brand, not two products. A site that looks borrowed from someone else breaks that trust right when they decide whether to sign in. Source: ([09:23](../words.md#2026-11-15-five-reasons-answered-cleos-style-in-the-apps-family-and-site-images-through-codex); earlier [05:05](../words.md#2026-11-15-edge-cases-from-a-mentor-site-audiences-two-kinds-of-photo-enhancement-and-measuring-it-all), [05:49](../words.md#2026-11-15-the-hero-the-line-alone-ambient-clothing-motion-dark-by-default-the-hands-and-the-wordmark-face-on-words)).

**W9. Built one section at a time with Ben, then faster.** Each ambiguous section gets a board of options like the dark-mode previews; once the primitives are set, the rest goes quickly. *Why:* An ambiguous section can carry the wrong story through the whole site. Comparing options with Ben before repeating its primitives lets the stranger receive one coherent explanation. Source: ([05:28](../words.md#2026-11-15-the-public-site-one-section-at-a-time-its-purposes-the-worries-and-the-future)).

**W10. Every screen size is broken on purpose.** Phone (with a menu), tablet and desktop pass break-ui; store logos are rounded like the app; say "App Store coming soon". *Why:* Clipped text or an unreachable menu can hide the only route to an answer. Testing each screen size lets a stranger reach the same information on their device. Coming-soon wording avoids promising an unavailable download. The store download badges are rounded like the app icon, so the one place where the site hands off to the app looks like the app (*inferred*; Ben kept the rule at [09:23](../words.md#2026-11-15-five-reasons-answered-cleos-style-in-the-apps-family-and-site-images-through-codex)). This covers the store badges only. Marketplace logos keep their own corners ([brand R26](../../brand/constitution.md)). Source: ([07:09](../words.md#2026-11-15-the-hero-on-every-screen-one-baseline-for-both-faces-no-period-a-menu-on-phones-rounded-store-logos-the-hand-options)); ([05:41](../words.md#2026-11-15-a-demo-that-stuns-science-fair-judging-and-claims-that-change-how-judges-see-it)).

**W11. Rules are scoped to a surface.** A rule written for the app binds the web only if the web has the same problem; mouse and touch differ. *Why:* Touch and a mouse offer different ways to reach and act on information. Copying a rule without its cause can leave a web visitor unable to find or use a control. Source: ([03:42](../words.md#2026-11-15-rules-per-surface-and-research-per-surface-in-the-loop)); ([pointer-and-touch.md](../../research/cross-cutting/ben/website/pointer-and-touch.md)).

**W12. Signed-in web loses nothing the app has, except the camera.** Photos are uploaded instead of shot; the camera hands off to the phone. The web adds what a big screen is good at: bulk actions, folder drops, label printing. *Why:* People moving to a larger screen still need their existing tasks. Preserving them avoids forcing a seller back to the phone, while bulk actions reduce repeated work across items. Source: ([20:45](../words.md#2026-11-14-app-first-and-ui-factory-after-the-brand)).

**W13. Item examples and app captures.** Use the complete screen from the current app build with nonpersonal sample data. The Carhartt and Kindle examples use items from the [demo collection](../../assets/demo-items/README.md). Label them as samples. Preserve the source, capture build and fixture details in [image sources](../../web/public/marketing/SOURCES.md). Design images can explore composition. Site screenshots must come from the app itself.

**W14. One header, a different opening for each job.** Use the same [header and footer](../../web/components/marketing/chrome.tsx) across public pages. Use the same sized pill for a primary action and an underlined link for evidence or a related page. Clofie appears in the lowercase secondhand wordmark and in each public entry page’s largest headline. Use PP Neue Montreal elsewhere. The paired tags and wordmark align visually at every width.

| Page | What the visitor came to learn | Opening and color |
|---|---|---|
| Home | What can secondhand help me do? | Photo wall, one-line explanation and a link to the walkthrough |
| How It Works | What happens from my first photo or search? | Selling and buying paths, evergreen field, one jacket shown through preparation |
| Features | What decisions make this product work? | Review screen and decision index, violet field, comparisons alongside their sources |
| Data Use | Where do the numbers come from and where do they fail? | Data flow and blue field, then a chart with its method |
| FAQ | What happens when I give it access or a sale goes wrong? | Quiet plum opening, linked question groups, answers visible in place |
| What’s Next | What would you build and how would you prove it? | Warm field, sample item and questions, followed by measurement and business plans |

Use a single [shared atmosphere](../../web/app/marketing.css), with a dark fade holding text contrast and a slow transform carrying the color. Reduced motion shows the still field. Use the page’s purpose to choose the composition before choosing color.

For new sections, make a full-page composition at desktop scale before refining individual panels. Use the approved landing page and Cleo to judge rhythm and the newest app capture to judge identity. Stitch the panels with layout tooling at their intended scale. Build charts, navigation and controls in code. Compare the rendered page against the composition at desktop and phone widths. Check the first decision, source links, keyboard focus, header position, reduced motion and font fallback.

## Open

- The hand pick (the thread recommends C in sky and mint), and whether the hero's wordmark-face "secondhand" may break the clear-space rule: asked in [Design the secondhand website with me](https://claude.ai/code/project/chan_01S64oRNV6rfAyD7NMnErjQP?thread=cmsg_01S64oRNV6rfAyD7NMnErjQP176zy6xJgoD6nQMvTouBQ3).
- Where Nate's buy/sell toggle lives, and whether people may appear in the site's scene photos: both asked there, unanswered.
- The public pages and desktop workspace are implemented. Live marketplace publishing and some shipment actions still depend on backend integration.
