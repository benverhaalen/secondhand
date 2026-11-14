# How should an app that has captured an item and searched for it in the background ask the person the few things it still needs, so it is fast, hard to get wrong, and the answers improve the system (as of November 2026)?
Researched 2026-11-14 by Nate (Claude Code retriever, Sonnet 5.5). Feature: identify.

Evidence caveat: no page below was read in full. Every "observed" claim rests on a search-result excerpt of the named URL (the page's date is given). Treat "observed (excerpt)" as one step below a full read. Exact figures should be re-checked on the page before they go into a spec.

Existing notes read first: [build-plan](../ben/build-plan.md), [generative-ui](../../today/ben/generative-ui.md), [psychology](../../cross-cutting/ben/psychology.md), [identify spec](../../../spec/features/identify.md), [capture spec](../../../spec/features/capture.md), [ui-constitution](../../../product/ui-constitution.md). Psychology on defaults (d=0.68 and the Maier 2022 correction), choice overload (Vohs 2021, d=0.06), explicit-anchor anchoring and click-through approval is not repeated here.

## 1. Shipped flows

- Mercari AI Listing Support: photo, then category, then check and edit, "in as few as three taps"; rolled out default-on; footnote says suggestions may be inaccurate. *observed (excerpt)*, https://about.mercari.com/en/press/news/articles/20240910_aisupport/ (2024-09-10).
- Mercari Japan help: the category step is a question ("こちらのカテゴリーですか？") with a "choose another category" escape; a shipping method is suggested only when the AI can. *observed (excerpt)*, https://help.jp.mercari.com/guide/articles/1867/ (undated in excerpt).
- Mercari engineers: the category was left to the user after experiments showed it balanced simplicity and accuracy; a toy car was listed as a real car; a silver laptop was tagged Apple; they built hallucination detection; the wording "Automatically fill in the item name and description" had the highest usage in A/B tests; they plan to move the cancel button (accidental cancels) and to guide photos that help the AI. *observed (excerpt)*, https://careers.mercari.com/en/mercan/articles/49770/ and https://careers.mercari.com/en/mercan/articles/49558/ (Feb 2025). Extends [build-plan lines 43-46](../ben/build-plan.md) (Mercari beta failure trace) with the reason the category stayed a user choice.
- Mercari AI project page: image-embedding similarity to past listings; seller-entered labels are noisy. *observed (excerpt)*, https://ai.mercari.com/en/projects/ai-listing/ (undated).
- Poshmark Smart List AI: wrong details are corrected by tapping them, then "Regenerate Listing" rebuilds title and description; Poshmark blames photo quality, lighting and item complexity. *observed (excerpt)*, https://blog.poshmark.com/smart-list-ai-101/ (2024-07-23).
- Poshmark upgrade: item, brand-tag and care-tag photos feed brand, category, material, size, condition, colour; testing "expected soon"; the seller stays responsible for accuracy. *observed (excerpt)*, https://blog.poshmark.com/2026/08/31/60225/ (2026-08-31) and https://www.valueaddedresource.net/poshmark-seller-tools-updates/ (2026-09-04, secondary).
- Vinted (not AI): brand chosen from a popular list, by typing with suggestions, or "Create a brand"; "No brand" exists; condition and package size are seller-chosen. *observed (excerpt)*, https://www.vinted.com/help/375 and https://www.vinted.com/help/47 (undated).
- eBay catalog match: search by name or UPC/EAN/ISBN, pick from matches; "Report missing product" is the none-of-these path; some item specifics lock after a match. *observed (excerpt)*, third-party https://support.crazylister.com/en/articles/2349307-associating-your-listings-with-the-ebay-catalog (2019) and https://crazylister.com/blog/ebay-product-based-shopping-experience/ (2018). Not eBay's own pages.
- eBay Catalog API: `GET /product_summary/search` returns candidate summaries plus `ASPECT_REFINEMENTS` (aspect values with counts); `getProduct` returns full detail. *observed (excerpt)* on a mirror, https://ebay-sdk.rat.md/reference/selling-apis/catalog-api.html (undated). Inferred: the refinement counts are a ready-made source for "which of these aspects splits the candidates" (see section 4).
- Merlin Bird ID: zoom, confirm date and location, then top choices; top choice first with "look at a few more"; then "This Is My Bird". Location frequency data feeds the model; 6,900 species, 95% average accuracy. *observed (excerpt)*, https://tech.cornell.edu/news/merlin-bird-photo-id-mobile-app-launches/ (2016-12-14), https://ebird.org/news/new-photo-id-model-in-merlin (2024-11-18), https://www.youtube.com/watch?v=xmSUOLxyatY (2022). eBird 2015: top 3 contained the right species about 90% of the time and users marked bill, eye and tail. *observed (excerpt)*, https://ebird.org/news/merlinid/. Confirms the Merlin reference at [build-plan line 98](../ben/build-plan.md).
- Third-party reseller tools tell sellers to photograph the size label so the AI reads the size, and keep a "favourites" list of recurring values. *asserted* (vendor docs, excerpt), https://controlresell.com/en/docs/automation/ai-listing-creation.

## 2. Candidate count, layout, defaults, confirm versus correct

- Conformal sets beat fixed top-k sets at equal coverage in a pre-registered randomised trial (450 participants in the main experiment, 600 across tests; 0.4 <= d <= 0.7). Smaller sets helped more: on GoEmotions an average set size of 2.49 gave 59.1% accuracy, 2.77 gave 56.9%, fixed top-3 gave 55.4%. Singleton sets signalled certainty and gave the highest accuracy. Sets did not consistently speed decisions because reading the set costs time. *observed (excerpt)*, https://proceedings.mlr.press/v235/cresswell24a.html and https://arxiv.org/abs/2401.13744 (2024-01-24). Text and emotion tasks, not product photos: transfer is *inferred*.
- Set size and singleton frequency drive downstream outcomes; equalising coverage across groups raised disparate impact while equalising set size or singleton frequency did better. *observed (excerpt)*, https://proceedings.iclr.cc/paper_files/paper/2025/file/32347ceb5729d6f50c1b16b43a8d5441-Paper-Conference.pdf (ICLR 2025).
- Adjustable recommendations raised uptake but lowered accuracy, and people intervened least on the least accurate recommendations. *observed (excerpt)*, https://pmc.ncbi.nlm.nih.gov/articles/PMC10857587/ (2024-02-09). Bears on "Looks right" with tap-to-edit fields: the cases most in need of a correction are the ones least likely to get one.
- Timing of the suggestion: advice after the person's own decision, or on demand, reduced overreliance but raised underreliance; on demand, people asked on 26.5% of trials; overall performance was not better in any paradigm. *observed (excerpt)*, https://link.springer.com/article/10.1186/s41235-026-00707-z (2026-02-05). A 2-step "decide first, then see AI" workflow did not reduce overreliance and raised it (beta=0.46, p=.001). *observed (excerpt)*, https://arxiv.org/abs/2603.05229 (2026-03-05). These two conflict; the cognitive-forcing paper says anchoring happens when the recommendation is shown before the decision. *observed (excerpt, claim only)*, https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca21trust.pdf (2021). Net: the evidence on "show the guess first or last" is mixed. Extends [psychology](../../cross-cutting/ben/psychology.md) section on automation bias, which stops at click-through approval.
- No source found on candidate count in image-grid layouts, or on image versus text candidates (see Not found).

## 3. Question selection and stopping

- Expected information gain: the best question splits the viable answers into equal parts; sample solutions, sample questions, pseudo-answers, estimate EIG, ask the best. Zero-shot LLM clarifying questions were less efficient than EIG-selected ones; open questions beat binary ones (binary carries at most 1 bit); a stopping rule was left as future work. *observed (excerpt)*, https://arxiv.org/abs/2502.04485 (2025-02-06, ICLR 2025).
- Uncertainty sampling asks about the least-confident instance. *asserted* (survey, excerpt), https://burrsettles.com/pub/settles.activelearning.pdf.
- Stopping: stop when classifier confidence drops for 3 consecutive rounds (Vlachos, *observed (excerpt)*, https://www.cl.cam.ac.uk/~av308/vlachos_active_csl07.pdf); or by query budget, accuracy plateau or uncertainty threshold (*observed (excerpt)*, https://www.mdpi.com/2227-7390/11/4/820, 2023). These are for training a model, not one person's session: transfer is *inferred*.
- Inferred: with a fixed catalog of aspects (eBay `ASPECT_REFINEMENTS` counts), EIG is a count calculation over the surviving candidates, so no LLM is needed to pick the question. The spec's "ask when / never ask when" table at [identify spec lines 41-53](../../../spec/features/identify.md) is a rule list; EIG would rank questions inside that list. Extends, does not contradict.

## 4. LLM clarifying questions and their failure modes

- Agents hallucinate missing arguments; 56.0% of imperfect instructions miss key information; some agents ask many redundant questions. *observed (excerpt)*, https://aclanthology.org/2025.emnlp-main.1104.pdf (EMNLP 2025).
- Unneeded questions cut pass@1 from 65% to 27% on clear tasks. *observed (excerpt)*, https://arxiv.org/abs/2504.16331.
- Models ask more than necessary, and several at once: https://arxiv.org/abs/2409.06097. Models give generic answers rather than asking: https://arxiv.org/abs/2502.12257. LLMs are 3 times less likely to clarify than humans: https://arxiv.org/abs/2503.13975. All *observed (excerpt)*.
- Inferred: both failures (never asking, asking too much) argue for a deterministic gate on whether to ask and the cap in section 7, with any LLM only phrasing the question. Matches Mercari's finding that the model hallucinated a brand rather than leaving it blank (section 1).

## 5. Calibration, conformal prediction, thresholds

- Conformal sets plus a cost-aware deferral threshold picked on a calibration split: grid {0.6, 0.7, 0.8, 0.85, 0.9, 0.95}, costs FN 10, FP 1, deferral 2, gave tau=0.8; error on retained cases fell 49.6% in-distribution at 80% coverage; optional rule "defer when set size is above 1". *observed (excerpt)*, https://www.nature.com/articles/s41598-026-40637-w (2026-02-20). A medical-type setting; the structure (asymmetric costs plus a deferral cost) is what carries over (*inferred*).
- Earlier multiclass learning-to-defer was not calibrated; the one-vs-all version is. *observed (excerpt)*, https://arxiv.org/abs/2202.03673; multi-expert version https://arxiv.org/abs/2210.16955 (unopened beyond excerpt).
- Confirms the shape of [build-plan lines 297-310](../ben/build-plan.md) (bands, two agreeing signals, `thresholds` table at line 395): thresholds are learned on held-out labels, not fixed. Extends it: the deferral cost is a third input next to the two error costs, and "set size above 1 means ask" is an alternative to a score cut that needs no probability to be well calibrated, only coverage.
- Inferred mapping: singleton set equals Filled/Confirm; set of 2 to 4 equals `candidate_cards`; empty or too large equals Ask or "None of these". This is an alternative reading of the bands, not a contradiction of them.

## 6. Typed generative UI catalogues

- A2UI v1.0 basic catalog: 18 components and 14 functions; input components `TextField` (shortText, longText, number, obscured), `CheckBox`, `ChoicePicker` (multipleSelection or mutuallyExclusive, `options` of {label, value}, `displayStyle` checkbox or chips, `filterable`), `Slider` (min, max, value), `DateTimeInput`; two-way binding to a data-model path. No photo-candidate picker and no "none of these". *observed (excerpt)*, https://a2ui.org/specification/v1.0-basic-catalog-implementation-guide/ and https://a2ui.org/concepts/catalogs/ (undated in excerpt).
- json-render: `defineCatalog(schema, {components, actions})` with zod props; inputs Button, TextInput, Switch, Checkbox, Slider, SearchBar; Chip, Image, Modal (bottom sheet), Pressable; `$bindState`, `$state`, `$cond`; no radio, picker or chip-group input. *observed (excerpt)*, https://json-render.dev/docs/catalog, https://json-render.dev/docs/api/react-native, https://github.com/vercel-labs/json-render/blob/main/skills/react-native/SKILL.md.
- Extends [generative-ui](../../today/ben/generative-ui.md) (about 40 registry entries, none a clarifying input) and [build-plan lines 312-327](../ben/build-plan.md): the eight decision components there (`field_row`, `chip_choice`, `candidate_cards`, `condition_slider`, `defect_pins`, `yes_no`, `genuine_flag`, `why_sheet`) must be custom entries in either library; neither ships a picker with photos, a stale-state action, or an escape row. Nothing here contradicts the json-render choice.
- Not found: AI SDK structured-UI details, and Apple or Android native generative-UI equivalents (no search made).

## 7. Access and input

- Touch targets: iOS 44x44 pt (minimum control 28x28), Android 48x48 dp, WCAG 2.2 AA 24x24 CSS px (AAA 44x44); Material chips are 32 dp high and the control most often under target. *observed (excerpt)*, https://www.appetiteui.com/blog/touch-target-size-ios-android (2026-10-08). Spacing of at least 8 dp between targets, 12 to 16 dp before destructive actions, frequent actions in the lower half: *asserted* (third-party guide, excerpt), https://motif.asv-labs.com/guides/app-touch-targets-and-spacing/. Confirms the 44 px rule in [ui-constitution](../../../product/ui-constitution.md); extends it with the chip-height trap (32 dp chips need padding to reach 44).
- Voice as an answer channel, screen-reader behaviour of custom pickers, one-handed reach studies: not found.

## 8. Design (all *inferred*)

### 8.1 Input catalogue

| Input | Returns | Use when |
|---|---|---|
| `candidate_picker` (photo cards, last card "None of these") | `{chosen_id or null, shown_ids[], rank_of_chosen}` | 2 to 4 catalog candidates survive; the question is "which product" |
| `single_choice` (chips, 44 pt high) | `{field, value, options_shown[]}` | one aspect splits the survivors (colour, size, edition); 2 to 6 values |
| `multi_choice` | `{field, values[]}` | materials, included parts |
| `size_picker` (from label photo read, then confirm) | `{field, value, source: label_ocr or typed}` | size or capacity not read with confidence |
| `condition_picker` (the existing `condition_slider`) | `{grade, anchors_shown}` | condition is never inferred alone ([build-plan line 295](../ben/build-plan.md), grade down) |
| `region_yes_no` (a pointed-at crop: "Is this scratch a defect?") | `{region_id, answer}` | one visual region decides a field; uses `defect_pins` |
| `number_with_unit` | `{field, value, unit}` | dimensions, weight, year |
| `retake_prompt` ("one more photo of the tag") | `{photo_id, target_view}` | the missing fact is visible if shot; [capture spec line 22](../../../spec/features/capture.md) more-view rule |
| `free_text` | `{field, text}` | last resort after every option above was refused |

Every input carries the escape row ("None of these", "Skip") and posts through the HMAC-signed `POST /api/decisions/:id/act` with 409 on stale ([build-plan lines 312-327](../ben/build-plan.md)).

### 8.2 Ordering and capping

- Order by expected information gain over the surviving candidates (section 3), highest first; break ties by lowest effort (tap before type).
- Cap: one question visible at a time, a small fixed budget per item, stop early when the set is a singleton or when two agreeing signals exist ([build-plan lines 297-310](../ben/build-plan.md)). The budget number is not sourced; Vlachos' "3 rounds" is a training-loop figure, not a session figure.
- Candidate sets of variable size, 1 to 4, not fixed top-k (section 2). A refusal ("None of these", skip) ends that field and does not trigger a re-ask.
- Questions arrive as the background search resolves, with a field shown filled until a question replaces it; the person never waits on a spinner for the question.

### 8.3 What gets logged so answers become labels

- Per question: `question_id`, `item_id`, input kind, `shown_options[]` with the model score of each (so selection bias is recoverable), set size, band at ask time, the model's top guess, time to first tap, answer, escape used, and whether the answer changed a previously filled field.
- Per answer: write to `answers`, then a `labels` row with kind owner statement (a plain answer) or verified correction (answer differs from the filled guess), matching [identify spec lines 102-109](../../../spec/features/identify.md); the field becomes `you_said` at 1.0.
- Missing and refused answers are logged as such; skip is not a label.
- Time to first tap under the 26.5% on-demand finding is *inferred* to be a click-through signal (very short and unchanged) and should be flagged, not trusted as a verified label.
- The `thresholds` table is refit from rows where the shown set contained, or lacked, the final chosen product (conformal calibration needs the held-out answer), so "None of these" is a first-class label, not a null.

## Not found

- Shipped-flow evidence for Depop, Facebook Marketplace, Amazon "match to existing product", Google Lens, Apple Visual Look Up, plant, coin and card identifier apps, receipt and document scanners, cheque capture (not searched in this pass).
- Studies on candidate count with images versus text, grid versus list, and progressive disclosure while background work runs.
- Voice as an answer channel; screen-reader and one-handed evidence for custom pickers.
- AI SDK structured UI; Apple and Android native generative-UI equivalents.
- Any source for a per-item question budget.
- eBay's own documentation of the catalog-match flow (only third-party mirrors reached).

## Searched / could not reach

- Web search excerpts for: Mercari, Poshmark, Vinted, eBay catalog, Merlin, conformal sets, learning to defer, active-task disambiguation, active-learning stopping, LLM clarification failures, automation bias, A2UI, json-render, touch targets.
- Poshmark support page https://support.poshmark.com/s/article/Smart-List-AI returned an error shell; the blog was used.
- No full-page fetch was done for any source; every figure is excerpt-level.

## Sources fetched

None fetched in full. Opened as search excerpts only, all URLs cited inline above (Mercari press and engineering pages, Poshmark blog, Vinted help, Crazylister, eBay API mirror, Cornell Tech, eBird, arXiv 2401.13744, 2502.04485, 2504.16331, 2409.06097, 2502.12257, 2503.13975, 2603.05229, 2202.03673, 2210.16955, PMC10857587, Springer s41235-026-00707-z, Nature s41598-026-40637-w, ICLR 2025 paper, A2UI, json-render, appetiteui, Motif). Unopened beyond title: the Buçinca PDF body, Settles survey body.
