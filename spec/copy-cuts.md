# Copy cuts

agent proposal, written by Codex 2026-11-15 at Ben's ask, from the clean-copy skill (.agents/vendor/clean-copy/SKILL.md)

Reviewed the local source at revision 00830874 on 2026-11-15. This is a source audit of the iPhone app, not a rendered-screen or VoiceOver test. No app files were edited. Line numbers locate the source as read; another session is changing screens.

The ladder was applied in order. Each row names the first failing rung, or the stricter repo rule where the string survives the ladder. A mixed string can keep its useful clause while losing the clause that fails. A cut means remove the text element or prop, not leave an empty caption. A conditional rewrite that leaves no text also removes its element in that state.

Counts are manual source-occurrence tallies. A complete message template counts once, including nested interpolations. Separate conditional alternatives and repeated authored occurrences count separately. Imported definitions count once at their source. Static supplied content was checked too. Forwarded runtime values, possible generated amounts, punctuation-only joiners, routes, identifiers, logging fields, comments and styles are not extra strings. API route files under app/src/app/v1 contain protocol responses rather than screen copy; they were not treated as iPhone screens. Shared fixture fields and dormant alternatives were read along with their consumers.

Ran `node scripts/copy-lint.mjs` with explicit files. With no arguments the script reads stdin, so an empty-input clean result is not an app audit. The explicit scan covered app/src/app, ui/parts, today, demo, buy, you, item, sell and capture, excluding tests and API route files. It reported 15 candidates: S1 in Sell:139, messages/index:47, demo/format:84, demo/rooms:150, clearing:181 and :182, flipper:80, item/model:428 three times, you/dashboard:84 and :101, you/money-steps:84 twice; C2 in ui/parts/time-span:2. All 15 are TypeScript non-null assertions or a code comment containing “intuitive”, not displayed exclamations or adjectives. No displayed-copy lint hit remains to turn into a finding. The tables contain the contextual findings the pattern scan cannot detect.

Accessibility names stay when they identify a control or visual state with no visible text. This includes Back, Close, New, shutter and photo-search controls, platform-logo names, Guess.name on value-only fields, ChoiceChips group names, slider labels and chart values. A nearby caption does not make a separate accessible control nameless. The redundant Chosen label on an already selected parent is the exception listed below.

## Today

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/(tabs)/index.tsx:190 | `"Due first, ${when(new Date(leadCard.due).toISOString(), w.now)}"` | `"Due first"` | 2 | Keep the priority explanation Ben asked for; the card already shows the timestamp. |
| app/src/app/(tabs)/index.tsx:283 | `"Everything it did"` | `"View activity"` | product/copy.md buttons | Name the destination of the activity link. |

Passed: 32 strings

## Today card copy and sheets

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/today/cards.ts:128 | `"Offer waiting"` | cut | 2 | Fallback fact repeats the Offer state tag without adding an amount. |
| app/src/today/cards.ts:177 | `"Own label"` | `"Use own label"` | product/copy.md buttons | The shipping action needs a verb. |
| app/src/today/cards.ts:188 | `"Another price"` | `"Set price"` | product/copy.md buttons | Name the action that opens the price editor. |
| app/src/today/cards.ts:281 | `"Ship ${n}"` | cut | 2 | The same batch card is titled ${n} to ship. Remove the duplicate state tag text. |
| app/src/today/cards.ts:405 | `"Start here"` | cut | 2 | The adjacent See what your things are worth action supplies the next step. |
| app/src/today/cards.ts:427 | `"turned down ${n === 1 ? 'a lowball' : `${n} lowballs`}"` | `"turned down ${n === 1 ? 'a low offer' : `${n} low offers`}"` | product/ui-constitution.md Article 5 | Use ordinary words in the activity summary. |
| app/src/today/cards.ts:430 | `"pushed ${n === 1 ? 'an edit' : `${n} edits`}"` | `"updated ${n === 1 ? 'a listing' : `${n} listings`}"` | product/ui-constitution.md Article 5 | Say what changed instead of using push as technical shorthand. |
| app/src/today/cards.ts:437 | `"did ${m === 1 ? 'a thing' : `${m} things`}"` | cut | 1 | Unknown actions do not earn a vague count. Omit this fallback from the summary; retain the named activity entries. |

Passed: 183 strings

## Shared demo content and formatters

Reviewed the shared copy and supplied content in demo/world.ts, demo/format.ts, demo/sites.ts, demo/build.ts, demo/edges.ts, demo/worlds/{new,stage,buyer,clearing,flipper}.ts and today/stops.ts. Item names, locations, attributes, quoted messages, units, rule conditions, source facts and meaningful state text survive. Source definitions are counted here once, not again in each screen that renders them.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/demo/worlds/clearing.ts:191 | `"Posted at $110 after you tapped Post"` | `"Posted at $110"` | 2 | The activity entry needs the action and price, not a recap of the person’s tap. |
| app/src/demo/worlds/flipper.ts:86 | `"Search order on one site changed this week. Visibility numbers are hidden there until it settles."` | `"View counts are unavailable while this site’s search order changes."` | product/ui-constitution.md Article 5 | Keep why counts are unavailable; replace the internal visibility description with ordinary words. |
| app/src/demo/worlds/flipper.ts:87 | `"Countered on the price path, above your lowest"` | `"Sent a counteroffer above your lowest price"` | product/ui-constitution.md Article 5 | Price path is internal language in an activity entry. |
| app/src/demo/worlds/flipper.ts:89 | `"counter on the price path"` | `"counter with the planned price"` | product/ui-constitution.md Article 5 | The Rules page inserts this phrase into its rule sentence. |

Passed: 429 strings

## Root error screen and layouts

Reviewed app/_layout.tsx, app/(tabs)/_layout.tsx, app/item/[id]/_layout.tsx and the imported crash boundary. Navigator names and presentation settings are not display copy.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/log/boundary.tsx:17 | `"Something went wrong"` | `"This screen stopped working"` | product/copy.md C4 | Name the screen failure. Keep the adjacent Try again button. |

Passed: 1 strings

## Development parts screen and example sheet

Reviewed all of dev/parts.tsx, including BuySide and WantByTouch. Variant headings and explanatory captions survive for the developer using this catalog. They identify test cases, not production instructions. Static example amounts, dates, sizes, titles and message spans were checked as example content.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/dev/parts.tsx:78 | `"Lower to"` | cut | 2 | The same example card’s primary action says Lower to $52. Remove this duplicate fact label and its amount, keep the action. |
| app/src/app/dev/parts.tsx:146 | `"Handled 6 things today"` | `"6 actions today"` | product/ui-constitution.md Article 5 | Handled is an unexplained internal term even in this example Notice. |
| app/src/app/dev/parts.tsx:260 | `"Next step"` | cut | 2 | Connect a site already names the next step in the same top slot. |

Passed: 444 strings

## Development crashes screen

Reviewed dev/crashes.tsx. Diagnostic names, timestamps, error text and stack fields belong in this deliberately opened developer view. Runtime diagnostic payloads are forwarded data, not fixed copy.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 5 strings

## Development health screen

Reviewed dev/health.tsx. The developer came here to check connectivity; the Databricks state and identity are the task, not consumer-facing status chatter.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 5 strings

## Sell, including pause and end sheets

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/(tabs)/sell.tsx:243 | `"Away for a while"` | cut | 2 | Pause selling already names the purpose of this sheet. |

Passed: 75 strings

## New item chooser

Includes the imported CHOICES and priceAsk copy. The choice labels, text-entry prompt and accessible controls pass.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 12 strings

## Camera, including photo choices and uncertain identification

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/camera.tsx:191 | `"Allow it in Settings, or choose photos you already have."` | cut | 2 | Camera is off names the problem; Open Settings and Choose photos already name both exits. |
| app/src/app/camera.tsx:269 | `"${LAMP.candidates.length} kinds look like this"` | cut | 2 | Which one is it and the candidate rows already show the alternatives. |
| app/src/demo/capture.ts:112 | `"Matching against ${new Intl.NumberFormat('en-US').format(n)} sold ${word}"` | cut | product/copy.md C7; Article 5 | This completed-capture instruction narrates matching and shows a sample size instead of the result. |
| app/src/demo/capture-edges.ts:70 | `"Shape and shade clip, 2 checks"` | `"Shape and shade clip"` | 1 | Keep the visual evidence; omit the internal check count. |
| app/src/demo/capture-edges.ts:72 | `"Arm, 2 checks"` | `"Arm"` | 1 | Keep the observed part; omit the internal check count. |

Passed: 101 strings

## Worth, including sales and model correction sheets

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/worth.tsx:205 | `"Have a price in mind?"` | `"Set your price"` | product/copy.md buttons | Name the action that opens the price field. |
| app/src/app/worth.tsx:206 | `"Not this one? Type the model number"` | `"Type the model number"` | 2 | The model correction action needs no extra question before it. |

Passed: 66 strings

## Gone by, including room and item sheets

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/gone-by.tsx:141 | `"The camera found nothing in this room to sell or give away."` | cut | 2 | Nothing to clear here and Scan the room already explain the blank state and next step. |

Passed: 108 strings

## Item screen

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/item/[id]/index.tsx:62 | `"It was deleted, or it didn’t load."` | `"${state === 'failed' ? 'This item didn’t load' : 'This item is no longer available'}"` | product/copy.md C4 | Separate the known failed-load branch from the missing-item branch instead of guessing deletion. |
| app/src/app/item/[id]/index.tsx:298 | `"Finding out what it is"` | cut | 2 | The stage rows already show progress; remove this extra researching heading. |
| app/src/app/item/[id]/index.tsx:360 | `"Every question answered. Ready to plan"` | `"Ready to plan"` | 2 | Keep readiness; the completed question state already shows that the questions are finished. |
| app/src/app/item/[id]/index.tsx:360 | `"Steps 1 to ${done} of ${t.steps.length} done. Ready to plan"` | `"Ready to plan"` | 1 | Once planning is available, completed implementation steps add no choice. |

Passed: 107 strings

## Item field sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 4 strings

## Item sum sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 4 strings

## Item offers sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 5 strings

## Item sold elsewhere sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 7 strings

## Item delete sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 4 strings

## Item photos sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/item/[id]/index.tsx:603 | `"Redraws light and background, then checks it against yours and the scan. Marked as AI."` | `"Redraws light and background, marked as AI"` | 1 | Keep edit scope and AI disclosure; omit narration of the checking process. |

Passed: 21 strings

## Item Why sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 8 strings

## Item split sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 5 strings

## Item plan sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/item/[id]/plan.tsx:62 | `"It was deleted, or it didn’t load."` | `"${state === 'failed' ? 'This item didn’t load' : 'This item is no longer available'}"` | product/copy.md C4 | Use the failed-load branch for the load error and the missing-item branch for absence. |
| app/src/app/item/[id]/plan.tsx:129 | `"Waits for your price. No drops, never marked slow."` | `"Waits for your price without price drops"` | 1 | Keep the price policy; omit an internal Slow classification promise. |
| app/src/app/item/[id]/plan.tsx:156 | `"What do you want?"` | cut | 1 | The choices name the actual selling intents without a generic prompt. |
| app/src/app/item/[id]/plan.tsx:185 | `"Similar ones sold for ${range(v)}. List at ${usd(price!)}?"` | `"List at ${usd(price!)}?"` | 2 | The sales values are immediately above; keep the listing-price confirmation. |
| app/src/app/item/[id]/plan.tsx:243 | `"Stays at its price until you change it"` | cut | 2 | Price drops is already off; this caption repeats that policy. |

Passed: 59 strings

## Post sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/item/[id]/post.tsx:55 | `"It was deleted, or it didn’t load."` | `"${state === 'failed' ? 'This item didn’t load' : 'This item is no longer available'}"` | product/copy.md C4 | Separate the failed-load and missing-item branches instead of speculating about deletion. |
| app/src/app/item/[id]/post.tsx:65 | `"It sold, so there is nothing to post."` | cut | 2 | Sold. Nothing to post already says this in the title. |
| app/src/app/item/[id]/post.tsx:166 | `"Redrawn, then checked against your photos and scan"` | `"Redrawn"` | 1 | Keep the redraw disclosure; omit the internal verification narration. |
| app/src/app/item/[id]/post.tsx:201 | `"Opens the site to post it there"` | cut | 2 | Post it myself beside the site preview already names the action and destination. |

Passed: 40 strings

## Pickup and its scheduling, address and safety sheets

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/item/[id]/pickup.tsx:69 | `"This item has no buyer coming to collect it."` | cut | 2 | No pickup here already states the blank condition. |
| app/src/app/item/[id]/pickup.tsx:160 | `"A place you picked"` | cut | 2 | The chosen place is already shown directly above. |
| app/src/app/item/[id]/pickup.tsx:235 | `"Only you can send this. ${buyer} gets it in the chat on the site."` | `"${buyer} gets your address in the chat on the site"` | 3 | Remove the permission slip; keep the recipient and delivery destination before address approval. |
| app/src/app/item/[id]/pickup.tsx:317 | `"Tap the days that work. The agent writes to ${buyer} from them."` | cut | 2 | Days that work labels tappable days, and the resulting draft appears after selection. |

Passed: 112 strings

## Shipping, including label, tracking and cancellation sheets

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/item/[id]/ship.tsx:85 | `"This item has no sale waiting for a label."` | cut | 2 | Nothing to ship already states the blank condition. |

Passed: 88 strings

## Shared item copy, field reasons and listing previews

Includes item/model.ts, item/field-why.ts, demo/listing-forms.ts and engines/listing/spreads.ts. Shared definitions are counted once here. Production audience captions fail even where identical text is useful as a labeled developer example in ItemParts.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/item/field-why.ts:28 | `"${f.from}, so it’s yours to fill."` | `"${f.from}"` | 2 | Keep the missing-value reason; the editable blank already offers filling it. |
| app/src/item/field-why.ts:29 | `"You changed it to ${now}."` | `"You changed it."` | 2 | The title repeats the current value, but not who supplied it. Keep authorship, omit the repeated value. |
| app/src/item/field-why.ts:64 | `"Written from the details below, with the flaw named so a buyer isn’t surprised."` | `"Written from the details below"` | 1 | Keep the source; omit the rationale for describing a flaw. |
| app/src/item/model.ts:383 | `"${n} like it sold lately on ${sites} ${sites === 1 ? 'site' : 'sites'}, most between ${usd(v.range.low)} and ${usd(v.range.high)}. Each site takes a fee from the price, so you get a little less."` | `"Similar ones sold for ${usd(v.range.low)} to ${usd(v.range.high)} lately"` | product/ui-constitution.md Article 5; product/copy.md body text | Remove sample sizes and repeated fee explanation; per-site fee rows retain deductions. |
| app/src/item/model.ts:392 | `"Reach"` | `"More buyers"` | product/ui-constitution.md Article 5 | Use words a first-time seller can understand for the site-selection reason. |
| app/src/demo/listing-forms.ts:43 | `"Searched by model: specs in the title"` | cut | 1 | The seller can inspect the tailored title in this production preview. |
| app/src/demo/listing-forms.ts:44 | `"Young, shops a look: size up front"` | cut | 1 | The buyer stereotype does not help approve the visible listing. |
| app/src/demo/listing-forms.ts:45 | `"Shops brand and size: both first"` | cut | 1 | The preview already exposes brand and size order; buyer rationale adds no decision fact. |
| app/src/demo/listing-forms.ts:46 | `"Wants a deal, shipped: a sharp price"` | cut | 1 | Generic buyer rationale adds no concrete listing term. |
| app/src/demo/listing-forms.ts:47 | `"Nearby, picks up today: pickup price"` | cut | 1 | This audience description adds no concrete pickup agreement. |
| app/src/engines/listing/spreads.ts:20 | `"Every site shows one price, so buyers who look around see the same thing. You get less where fees are higher."` | `"Every site shows one price; you get less where fees are higher"` | 2 | The buyer observation repeats same price; keep the fee consequence. |

Passed: 196 strings

## Buy

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/(tabs)/buy.tsx:91 | `"Search five sites at once"` | `"Nothing on your list"` | product/copy.md C7 and C11 | Name the empty list; the search field already supplies the action. |

Passed: 33 strings

## Shared Buy loading, error and offline states

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/buy/states.tsx:24 | `"Nothing changed. Try again in a moment."` | cut | 1 | A failed read does not introduce a change; the adjacent Try again button gives recovery. |
| app/src/buy/states.tsx:30 | `"Waiting for signal. This is the last copy."` | `"Waiting for signal; showing saved results."` | product/ui-constitution.md Article 5; product/copy.md body text | Explain stale results in plain words and one sentence. |

Passed: 2 strings

## Search

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/search.tsx:35 | `"Type what you want, paste a link, or take a photo. It looks on five sites at once."` | `"Search five sites at once."` | 2 | The field names typing and pasting and has a camera control; retain the hidden search scope. |

Passed: 13 strings

## Want, including filters, quiet hours and offer sheet

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/want.tsx:135 | `"Watching. You can leave and come back."` | `"Watching"` | 3 | Keep the state; omit permission to leave an ordinary screen. |
| app/src/app/want.tsx:154 | `"Each dot is a sale of the same one: ${dots.length} sold"` | `"Each dot is a sale of the same item"` | product/ui-constitution.md Article 5 | Keep the dot legend; remove the sample size. |
| app/src/app/want.tsx:179 | `"Cut"` | `"Fit"` | product/ui-constitution.md Article 5 | This visible heading names Men’s, Women’s and Youth choices. |
| app/src/app/want.tsx:180 | `"Cut"` | `"Fit"` | product/ui-constitution.md Article 5 | Match the filter’s accessible group name to its visible Fit heading. |
| app/src/app/want.tsx:203 | `"Quiet"` | `"${x.quiet_hours ? 'Quiet hours' : ''}"` | 2 | No quiet hours already labels the blank branch; keep Quiet hours beside a set bare time span. Remove the caption element when blank. |

Passed: 56 strings

## Shared Buy and Want copy modules

Reviewed buy/read.ts (43 strings), buy/colours.json (9 color names) and buy/stage.ts (4 strings). Delivery, protection limits, condition choices, sizes, offer errors, color names and elapsed-time units survive.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 56 strings

## Listing and offer handoff

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/listing/[id].tsx:95 | `"Ready to send"` | cut | 2 | Your offer, its editable amount and the Send action already show readiness. |
| app/src/app/listing/[id].tsx:103 | `"They ask ${usd(m.price_cents)}.${want?.max_total_cents ? ` Your most is ${usd(want.max_total_cents)} delivered.` : ''}"` | `"${want?.max_total_cents ? `Your most is ${usd(want.max_total_cents)} delivered.` : ''}"` | 2 | The delivered-price block already gives the asking price. Keep the person’s limit; remove the element if no limit remains. |

Passed: 30 strings

## Product

Keep the used-price trend summaries: PriceChart exposes individual month amounts to VoiceOver but does not state the overall direction. The summary saves the person from having to reconstruct that conclusion. The used-price source, new-price comparison and buying consequences also survive.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 25 strings

## Shared market content

Reviewed the emitted fixture titles, brands, models, variants, store names, sizes, conditions and pickup distance in demo/market.ts. Unrendered fixture queries and unused metadata are not additional UI copy.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 22 strings

## Messages list, including reply queue

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/messages/index.tsx:112 | `"${sentForYou} sent for you this week"` | cut | 1 | The weekly activity count does not help open or answer a conversation; Activity has the history. |
| app/src/app/messages/index.tsx:112 | `"Draft for me is on"` | `"Reply settings"` | product/copy.md buttons; Article 5 | Name the settings destination instead of announcing a mode. The existing /you/messages route is unrecognized; fix that separately before relying on this link. |

Passed: 22 strings

## Shared inbox and draft content

Reviewed demo/inbox.ts. Drafted message spans are proposed messages; their fact/source pairs are evidence before sending, not screen narration.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 31 strings

## Message thread and its More, takeover and rule sheets

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/messages/[id].tsx:142 | `"You answer here. Offers still follow your Plan"` | `"Offers still follow your Plan"` | 2 | The composer already offers answering; keep the separate offer-permission scope. |

Passed: 52 strings

## You dashboard

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/(tabs)/you.tsx:55 | `"In your bank or your hand"` | cut | 2 | Paid out states that money arrived; Payouts shows each destination. |
| app/src/app/(tabs)/you.tsx:112 | `"${auto} on their own"` | cut | 1 | A count does not identify the permissions; Rules and limits lists them. |

Passed: 30 strings

## Shared dashboard copy

Reviewed you/dashboard.ts. Metric nouns, comparison words, month labels and generated VoiceOver descriptions explain otherwise visual marks.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 35 strings

## Shared You page error and offline states

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/page-status.tsx:13 | `"The site didn’t answer. Nothing changed."` | `"The site didn’t answer."` | 3 | Keep the failed-read cause; omit reassurance about a change the read never proposed. |
| app/src/you/page-status.tsx:19 | `"This is the last copy. A change is sent when it’s back"` | `"Showing saved data; changes send when the signal returns"` | product/ui-constitution.md Article 5 | Keep stale-data and queued-change scope; name what returns instead of the unclear copy and it. |

Passed: 3 strings

## You page not found

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 1 strings

## Payouts and payout details

Includes you/payouts.tsx and you/money-steps.ts. Destination, delay, free-wait option, instant payout fee and held-payment facts survive.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 33 strings

## By site

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/by-site.tsx:41 | `"Linked, no sale to measure yet"` | cut | 2 | The row already says Nothing sold yet and shows no sale time. |

Passed: 27 strings

## Records and export

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/records.tsx:60 | `"Each sale shows here with its fees, ready for tax time."` | `"Each sale shows here with its fees."` | 4 | Keep what fills the blank state; remove the unsupported tax-readiness promise. |

Passed: 13 strings

## Rules and limits, including price thresholds

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/rules.tsx:52 | `"Approved ${PROMOTE_AT} times without a change. Turn on to let it run"` | `"Approved ${PROMOTE_AT} times without a change"` | 2 | Keep why the switch became available; its control already offers enabling. |
| app/src/you/rules.tsx:64 | `"What it does with Undo, what always asks, and what it never does"` | cut | 2 | The Permissions destination supplies these choices; remove this extra destination summary. |
| app/src/you/rules.tsx:81 | `"An offer this high is taken without asking"` | cut | 2 | Accept at once at already names the threshold’s behavior. |
| app/src/you/rules.tsx:83 | `"The accept line can’t be under your lowest."` | `"Accept-at-once price must be at least your lowest price."` | product/ui-constitution.md Article 5 | Name the two conflicting amounts instead of an internal visual line. |

Passed: 25 strings

## Your sites and shared link rows

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/sites.tsx:23 | `"Post, answer buyers and end listings here"` | cut | 1 | Repeating the app’s job under every unlinked site adds no site-specific choice. |

Passed: 19 strings

## Individual site and audit details

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/site-audit.ts:34 | `"We ended it, and the site still shows it"` | `"Recorded as ended; still listed on the site"` | 4 | Keep both sides of the mismatch without saying removal is complete. |
| app/src/you/site-audit.ts:34 | `"We posted it, and the site doesn’t show it"` | `"Recorded as posted; missing from the site"` | 4 | Keep both sides of the mismatch without saying posting is complete. |

Passed: 32 strings

One additional string is listed under Rare state only.

## Sign-in, email and code screens

Keep “We send a 6-digit code. No password.” Before email entry this describes the authentication scope; the code field is on the next screen, not a neighboring duplicate.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/sign-in.tsx:46 | `"Check your connection, then try again."` | cut | 2 | The same failure view serves a wrong code as well as network errors; Try again already offers recovery. |
| app/src/you/sign-in.tsx:65 | `"Continue"` | `"Sign in"` | product/copy.md buttons | The code-verification action signs the person in. |
| app/src/you/sign-in.tsx:78 | `"Welcome"` | `"Sign in"` | product/copy.md C7 | Replace the greeting with the task. |
| app/src/you/sign-in.tsx:81 | `"secondhand lists your things on the sites, answers buyers and gets them sent."` | cut | 1 | The sign-in task does not need a paragraph explaining the app. |

Passed: 20 strings

## Onboarding sites

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/onboarding.tsx:95 | `"${plural(linked, 'site', 'sites')} linked. Add the rest now or later."` | cut | 2 | The rows show linked sites; Link and Continue already offer the remaining choices. |

Passed: 10 strings

## Onboarding pickup

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/onboarding.tsx:57 | `"Optional. Where you’d meet a buyer. You pick days and times when one asks, never from your calendar."` | `"Pick days and times when a buyer asks."` | 2 | Skip makes this optional; Pickup spot and A public place explain the location. Keep that scheduling happens later. |

Passed: 6 strings

## Onboarding photo

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/app/onboarding.tsx:75 | `"Point the camera at something you want gone. One photo is enough to start the listing."` | `"One photo starts the listing."` | 2 | Take a photo already names the action; keep the hidden minimum needed to start. |

Passed: 4 strings

## App defaults and its site and pricing sheets

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/defaults.tsx:76 | `"Off: photos are never redrawn"` | cut | 2 | Enhance with AI is already off; this repeats the choice. |
| app/src/you/defaults.tsx:78 | `"Your photos go up as you took them"` | cut | 2 | Never suggest photo edits is on in this branch; this repeats the choice. |
| app/src/you/defaults.tsx:115 | `"Only linked sites can be defaults. Each listing can still skip one."` | `"Each listing can skip a default site."` | 2 | Only linked sites are listed; keep the hidden per-listing override. |

Passed: 64 strings

## Notifications, including quiet hours and preview controls

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/notifications.tsx:68 | `"Grouping"` | cut | 2 | The only row in the group is already labeled Group by item. |
| app/src/you/notifications.tsx:76 | `"Quiet hours"` | cut | 2 | The first row repeats Quiet hours; retain that row and its switch name. |

Passed: 60 strings

## Permissions

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/permissions.tsx:63 | `"Always asks"` | cut | 2 | These rows are already under Always asks you; retain each action’s name. |
| app/src/you/permissions.tsx:59 | `"On its own: it does it and shows it in Activity, with Undo where the site allows."` | `"Shown in Activity, with Undo where the site allows."` | 2 | Remove the mode’s repeated definition; retain the hidden Activity and site-limited Undo facts. |

Passed: 31 strings

## Settings, including sign-out and deletion

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/settings.tsx:46 | `"On its own, asks first, or never, for each kind of step"` | cut | 2 | Permissions already names this destination; keep the actual settings choices on that page. |

Passed: 25 strings

## Kit parts

Reviewed all 53 files in ui/parts, plus imported ui/states.ts. This includes components with no locally authored copy and default copy hidden behind props. Forwarded caller text is counted at its source, not again in each kit component. Developer-only ItemParts captions identify example variants and survive.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/ui/parts/cards.tsx:146 | `"This did not go through"` | `"Could not ${p.primary.label.toLowerCase()}"` | product/copy.md C4 | Name the failed action; keep Retry. |
| app/src/ui/parts/listing-preview.tsx:54 | `"Not posting here"` | cut | 2 | The adjacent preview switch is off; keep its Post here accessibility name and state. |
| app/src/ui/parts/listing-preview.tsx:54 | `"Ready"` | cut | 2 | Post here is on and no missing field is shown; the extra caption repeats readiness. |
| app/src/ui/parts/overlays.tsx:94 | `"Loading"` | `"Loading ${of === 'card-decision' ? 'decision' : 'item'}"` | product/copy.md C10 | Keep the VoiceOver state and name what is loading. |
| app/src/ui/parts/pick.tsx:74 | `"Chosen"` | cut | 2 | The parent choice already exposes selected state. Remove this tick icon’s accessible label, keep the tick. |
| app/src/ui/parts/question-card.tsx:30 | `"Nothing left to ask"` | cut | 2 | The caller’s where caption already reports completion and readiness in this null-question state. |
| app/src/ui/parts/site-link.tsx:59 | `"The next time the agent reads it there, it saves the site’s own picture here, with the time."` | `"No screenshot saved"` | 4 | Keep why the screenshot is blank; remove process narration. Open on the site already offers recovery. |
| app/src/ui/parts/site-strip.tsx:48 | `"Behind"` | `"Retrying search"` | product/ui-constitution.md Article 5 | Name the failed-check retry state in ordinary words. |
| app/src/ui/parts/tile.tsx:113 | `"Loading"` | `"Loading item"` | product/copy.md C10 | VoiceOver needs both the loading state and its object. |
| app/src/ui/parts/worth.tsx:41 | `"Loading"` | `"Loading value"` | product/copy.md C10 | VoiceOver needs to know the value is loading. |

Passed: 191 strings

## Activity

Reviewed you/activity.tsx. The empty-state explanation, Undo, Undone, global-event fallback and failed-load subject survive; imported event descriptions are counted at their shared sources.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|

Passed: 6 strings

## Shared You sign-in reminder

Reviewed you/sign-in-row.tsx. The signed-out consequence, recovery controls and sign-in states survive. The imported spread-example module emits numeric rows and identifiers, with no additional authored prose. The connection route re-exports SitePage without adding copy.

| file:line | current string (exact, quoted) | verdict | rung it failed | why |
|---|---|---|---|---|
| app/src/you/sign-in-row.tsx:14 | `"Finish on ${name}’s own page"` | `"Finish on the site’s sign-in page"` | 2 | The adjacent logo identifies the site; keep the external sign-in destination. |

Passed: 9 strings

## Rare state only

| file:line | current string (exact, quoted) | which state |
|---|---|---|
| app/src/you/site.tsx:43 | `"Unlinking left your listings up"` | After this person actually unlinks this site. Do not show it for a site that has never been linked. Keep the consequence after unlinking. |

This wording is load-bearing after unlinking and is retained. This is a move, not a cut. Keep notifications.tsx:65 in notification settings: its automatic delivery-change policy is hidden scope the person needs before alerts move, not only afterward. An affected-kind notice can supplement that disclosure.

## Rules disagree

There is no direct contradiction between the skill’s exceptions and the repo’s safety rules. There are places where the repo requires copy the ladder alone would not demand, or imposes a stricter form on useful copy. Followed the repo at each place below.

| file:line | difference | followed |
|---|---|---|
| app/src/ui/parts/chrome.tsx:64 | The repeated secondhand wordmark is not needed to operate each screen; brand/coder-card.md C1 requires it on main screens. | Keep the wordmark. It is included among passed strings. |
| app/src/app/(tabs)/index.tsx:283, `"Everything it did"` | The ladder can keep this meaningful label; the repo also requires an action name. | Use `"View activity"`. |
| app/src/today/cards.ts:177, `"Own label"` | The ladder can keep this meaningful label; the repo also requires an action name. | Use `"Use own label"`. |
| app/src/today/cards.ts:188, `"Another price"` | The ladder can keep this meaningful label; the repo also requires an action name. | Use `"Set price"`. |
| app/src/today/cards.ts:427, `"turned down ${n === 1 ? 'a lowball' : `${n} lowballs`}"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"turned down ${n === 1 ? 'a low offer' : `${n} low offers`}"`. |
| app/src/today/cards.ts:430, `"pushed ${n === 1 ? 'an edit' : `${n} edits`}"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"updated ${n === 1 ? 'a listing' : `${n} listings`}"`. |
| app/src/demo/worlds/flipper.ts:86, `"Search order on one site changed this week. Visibility numbers are hidden there until it settles."` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"View counts are unavailable while this site’s search order changes."`. |
| app/src/demo/worlds/flipper.ts:87, `"Countered on the price path, above your lowest"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"Sent a counteroffer above your lowest price"`. |
| app/src/demo/worlds/flipper.ts:89, `"counter on the price path"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"counter with the planned price"`. |
| app/src/log/boundary.tsx:17, `"Something went wrong"` | The ladder keeps a real failure; repo C4 also requires it to identify what failed. | Use `"This screen stopped working"`. |
| app/src/app/dev/parts.tsx:146, `"Handled 6 things today"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"6 actions today"`. |
| app/src/demo/capture.ts:112, `"Matching against ${new Intl.NumberFormat('en-US').format(n)} sold ${word}"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Cut as listed. |
| app/src/app/worth.tsx:205, `"Have a price in mind?"` | The ladder can keep this meaningful label; the repo also requires an action name. | Use `"Set your price"`. |
| app/src/app/item/[id]/index.tsx:62, `"It was deleted, or it didn’t load."` | The ladder keeps a real failure; repo C4 also requires it to identify what failed. | Use `"${state === 'failed' ? 'This item didn’t load' : 'This item is no longer available'}"`. |
| app/src/app/item/[id]/plan.tsx:62, `"It was deleted, or it didn’t load."` | The ladder keeps a real failure; repo C4 also requires it to identify what failed. | Use `"${state === 'failed' ? 'This item didn’t load' : 'This item is no longer available'}"`. |
| app/src/app/item/[id]/post.tsx:55, `"It was deleted, or it didn’t load."` | The ladder keeps a real failure; repo C4 also requires it to identify what failed. | Use `"${state === 'failed' ? 'This item didn’t load' : 'This item is no longer available'}"`. |
| app/src/item/model.ts:383, `"${n} like it sold lately on ${sites} ${sites === 1 ? 'site' : 'sites'}, most between ${usd(v.range.low)} and ${usd(v.range.high)}. Each site takes a fee from the price, so you get a little less."` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"Similar ones sold for ${usd(v.range.low)} to ${usd(v.range.high)} lately"`. |
| app/src/item/model.ts:392, `"Reach"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"More buyers"`. |
| app/src/app/(tabs)/buy.tsx:91, `"Search five sites at once"` | The skill could treat this as orientation or progress; repo C7 rejects app explanation and status narration. | Use `"Nothing on your list"`. |
| app/src/buy/states.tsx:30, `"Waiting for signal. This is the last copy."` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"Waiting for signal; showing saved results."`. |
| app/src/app/want.tsx:154, `"Each dot is a sale of the same one: ${dots.length} sold"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"Each dot is a sale of the same item"`. |
| app/src/app/want.tsx:179, `"Cut"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"Fit"`. |
| app/src/app/want.tsx:180, `"Cut"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"Fit"`. |
| app/src/app/messages/index.tsx:112, `"Draft for me is on"` | The ladder can keep this meaningful label; the repo also requires an action name. | Use `"Reply settings"`. |
| app/src/you/page-status.tsx:19, `"This is the last copy. A change is sent when it’s back"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"Showing saved data; changes send when the signal returns"`. |
| app/src/you/rules.tsx:83, `"The accept line can’t be under your lowest."` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"Accept-at-once price must be at least your lowest price."`. |
| app/src/you/sign-in.tsx:65, `"Continue"` | The ladder can keep this meaningful label; the repo also requires an action name. | Use `"Sign in"`. |
| app/src/you/sign-in.tsx:78, `"Welcome"` | The skill could treat this as orientation or progress; repo C7 rejects app explanation and status narration. | Use `"Sign in"`. |
| app/src/ui/parts/cards.tsx:146, `"This did not go through"` | The ladder keeps a real failure; repo C4 also requires it to identify what failed. | Use `"Could not ${p.primary.label.toLowerCase()}"`. |
| app/src/ui/parts/overlays.tsx:94, `"Loading"` | The ladder keeps an accessible loading state; repo C10 asks what is loading. | Use `"Loading ${of === 'card-decision' ? 'decision' : 'item'}"`. |
| app/src/ui/parts/site-strip.tsx:48, `"Behind"` | The ladder permits needed information; the repo also requires plain terms and forbids sample-size notation. | Use `"Retrying search"`. |
| app/src/ui/parts/tile.tsx:113, `"Loading"` | The ladder keeps an accessible loading state; repo C10 asks what is loading. | Use `"Loading item"`. |
| app/src/ui/parts/worth.tsx:41, `"Loading"` | The ladder keeps an accessible loading state; repo C10 asks what is loading. | Use `"Loading value"`. |

The scope exception settles several apparent conflicts in favor of keeping the text: password destination at onboarding.tsx:99 and you/sites.tsx:43; cleanup and redraw scope at you/defaults.tsx:74 and :78, item/[id]/index.tsx:599 and post.tsx:162; payment protection in buy/read.ts; the locked-action reasons in you/permissions.tsx:31, :32 and :67; reversibility in Sell’s end-listings sheet; and auto-resumption in worth.tsx:89. These are facts needed at the decision, not captions defending a fixed bug.

Keep “Due first” at app/(tabs)/index.tsx:190 because it answers Ben’s question about the card’s priority and color, recorded directly above its source. Only the repeated timestamp fails rung 2. Keep the notification delivery rule in settings before it changes what arrives. Keep current-value authorship in the field Why sheet. A repeated value is dispensable; its source is not.

Likewise, two useful sentences in a sheet are not automatically a violation of the repo’s one-sentence-per-card rule. Kept the fee explanation in the kit’s Why example, the offer failure’s no-send consequence, the prepaid label’s source and payment facts, delivery and warranty terms, and settings’ deletion and external-retention consequences. The safety exception preserves real consequences. No row changes them merely to replace a period with a semicolon.

Developer catalog captions in dev/parts.tsx and ui/parts/item-parts-sheet.tsx have a different job from production audience captions in demo/listing-forms.ts. They name the variants a developer is checking. Kept those catalog annotations; cut the production buyer stereotypes. Both judgments follow the ladder in their actual context.

## Summary

Total strings checked: 3218

Total cut: 47

Total rewritten: 63

Total moved to a rare state: 1

Total passed unchanged: 3107

Checked = passed + cut + rewritten + moved. Moves are counted once, separately from cuts and rewrites. These counts describe the source audit above; they do not claim every runtime data value was exercised on a phone.

