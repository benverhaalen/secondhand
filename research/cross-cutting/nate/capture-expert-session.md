# Capture engine: expert session
Researched 2026-11-14 by Nate (session ex-cap).

Status: *agent proposal*, research note for Nate. Written 2026-11-14 by session `ex-cap`. Read against [engines/capture](../../../spec/engines/capture.md) (§1, §3, §9), [features/capture](../../../spec/features/capture.md) (step table, processes, follow-ups, Open 2, Open 7) and [capture-shots](../../../spec/determinations/capture-shots.md#default-plans-by-kind).

The view taken: a senior computer-vision product engineer who has shipped guided capture for listings (photo-to-listing, scan coverage loops, ID-verification step capture). Marks: *observed* (read in the source linked), *asserted* (the source claims it, not checked by us), *inferred* (our reasoning from the sources linked). Every claim carries a link.

## 1. Errors inside the docs today

These are contradictions between the three docs, found by reading them (*observed*, links are to the lines' sections).

- **Picker size.** The engine says "14 families plus other ... The picker lists all 15" ([engine §3.1](../../../spec/engines/capture.md#3-the-calculation)). The feature says "the 13 families plus other" ([feature step 2](../../../spec/features/capture.md#what-the-person-does-and-sees)). [product.md](../../../spec/product.md#3-the-data-model)'s `kind family` list has 14 values *including* `other`. So the picker has 14 options; "15" is wrong.
- **The cap of 3.** Engine §3.6, §4 guard band ("at most 3 follow-ups whatever the rates say") and §9 test 5 all hold the cap; Nate answered Open 7 that a type's needed fields "get their own select type", so the cap does not bind there ([feature Open 7](../../../spec/features/capture.md#open-for-ben-and-nate)).
- **bikes_sports and baby_gear.** product.md says they "have no shot plan yet and use other's"; capture-shots gives each a `scan` then `series` plan ([capture-shots, appliances_tools](../../../spec/determinations/capture-shots.md#appliances_tools-tools)). The feature table links both to the tools anchor. One must change; capture-shots is the newer and fuller.
- **No-tap acceptance.** Open 2's answer says a confident suggestion may skip the tap and both ways are built and compared; the engine has no threshold for "accepted with no tap" and no field saying which way a session ran.

## 2. (a) What the engine must determine, against §1

§1 lists six outputs. Missing, in the order a build would hit them:

| # | Missing determination | Why it is needed | Where it would land |
|---|---|---|---|
| M1 | The confirm mode per session: `tap` or `auto` | Open 2 says both are built and compared; without the arm recorded, test 7 cannot be scored | `capture.confirm_mode`, `capture.auto_accepted` (bool) |
| M2 | The purpose: `sell`, `appraise`, `find` | the process and follow-ups differ by purpose (§5 below); today the purpose is picked only at step 8 | `capture.purpose?` |
| M3 | A frame's usability gate result, with the failing reason | §2 names gates but §1 has no output for them; `retake` needs a reason the instruction is built from | `retake {requirement, reason: blur, dark, glare, cut_off, too_far}` |
| M4 | One `fact.found` frame per attribute while the camera is open | [pages.md](../../../spec/pages.md) asks for it; packet 47 shows its shape ([packet 47](../../../.agents/team/packets/team/47-what-the-pages-need-from-the-backend.md)); the engine never emits it | the job stream, §6 below |
| M5 | Facts read from the free note, and the note's private spans removed | feature step 7a specifies it; no engine owns it | `note_fact` rows, `item.note_redacted` |
| M6 | Measurement and its uncertainty per dimension | `measured` rows move to lookup on no-LiDAR, but §1 does not say when depth is trusted on a LiDAR phone | `attribute {value, sigma, source: measured}` |
| M7 | People and faces in a kept frame | the privacy line covers rooms, not a face in a mirror or a hand; marketplaces judge photos | a mask applied before upload, `photo.masked_regions[]` |
| M8 | Whether a kept frame is a real photo of this item (not a screenshot or a stock image) | eBay bars stock photos for used items (*observed*, [eBay picture policy](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370)); `find` takes screenshots on purpose | `photo.origin: camera, screenshot, import` |
| M9 | The recall check's input fields read by capture (model, date code) | §8 says the recall lookup always runs; §1 does not list the fields capture must deliver for it | the `series` label step's `requirement` rows |

## 3. (b) The best method for each, with sources

**Suggestion (§3.1).**
- Apple's built-in classifier returns its own large taxonomy, not our 14 families, and its label set changes with each OS revision (*observed*, [Apple, classifying images](https://developer.apple.com/documentation/vision/classifying-images-for-categorization-and-search), [revision docs](https://developer.apple.com/documentation/vision/vnclassifyimagerequestrevision1)). So the 14-way `p(family)` needs either a fixed mapping from Apple labels or a small Core ML head of our own ([Apple, Vision with Core ML](https://developer.apple.com/documentation/coreml/classifying-images-with-vision-and-core-ml)). Recommend the head, trained on our frozen fixture plus confirmed types (*inferred*).
- Raw network scores are poorly calibrated; temperature scaling, one fitted parameter, is often the most effective fix (*observed*, [Guo et al. 2017](https://arxiv.org/abs/1706.04599)). Card 7's margin (0.2, top at least 0.5, [asking-and-intent card 7](../../../spec/determinations/asking-and-intent.md#7-which-option-is-preselected-and-when-none-is)) and the swap bounds 0.9/0.1 only mean what they say on calibrated numbers (*inferred*). Add a calibration step and report ECE on the 30 items.

**Frame gates (§2).**
- Blur: variance of the Laplacian is the standard cheap focus measure (*observed*, [Pech-Pacheco et al. 2000](https://bibtex.github.io/ICPR-v3-2000-Pech-PachecoCCF.html)); run it on the label region, not the whole frame, since a sharp garment with a soft tag fails the shot that matters (*inferred*).
- Apple's aesthetics request (iOS 18) returns an overall score and an `isUtility` flag (*observed*, [Apple, CalculateImageAestheticsScoresRequest](https://developer.apple.com/documentation/vision/calculateimageaestheticsscoresrequest), [isUtility](https://developer.apple.com/documentation/vision/vnimageaestheticsscoresobservation/isutility)); `isUtility` flags screenshots and documents (*asserted*, [community binding](https://docs.rs/crate/apple-vision/0.16.7/source/src/aesthetics/mod.rs)), which gives M8 a free first signal.
- Listing floor: eBay requires at least one photo of 500 px on the longest side, no added borders, text or watermarks (*observed*, [eBay picture policy](https://www.ebay.com/help/policies/listing-policies/picture-policy?id=4370)); eBay recommends 800 to 1,600 px (*asserted*, [eBay photo tips](https://www.ebay.com/sellercenter/listings/photo-tips)). Our 12 MP stills clear it; the gate matters for imports and screenshots (*inferred*).

**Scan coverage and measurement (§3.2, M6).**
- Apple's Object Capture on iOS 17 gives feedback (too fast, too close, low light), shows where more images are needed, and asks for a flip or three heights when the underside is unseen (*observed*, [ObjectCaptureSession.Feedback](https://developer.apple.com/documentation/realitykit/objectcapturesession/feedback-swift.enum), [WWDC23 10191](https://developer.apple.com/videos/play/wwdc2023/10191)). It needs LiDAR and A14 or later (*observed*, same). Use its feedback cases as our `retake` reasons rather than inventing them (*inferred*).
- iPhone 12 Pro LiDAR measured objects over 10 cm side to about ±1 cm absolute (*observed*, [Luetzenburg et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8593014)). This supports the 10 cm line in capture-shots; it was a lab test, so `sigma` should start at 1 cm and widen on low depth confidence (*inferred*).
- Furniture: RoomPlan detects objects in categories including sofa, table, chair, bed and storage, with subtypes in attributes, and objects carry dimensions as a bounding box (*observed* categories, [RoomPlan CapturedElementCategory](https://developer.apple.com/documentation/roomplan/capturedelementcategory); dimensions on `Object` *inferred* from [WWDC22 10127](https://nonstrict.eu/wwdcindex/wwdc2022/10127/) and [Kodeco](https://www.kodeco.com/41003944-augmented-reality-s-roomplan-for-ios-getting-started?page=2)). For furniture, a RoomPlan pass gives width, depth and height with no mesh to keep, which fits §8's no-room-mesh rule if only the object box is stored (*inferred*). Trial it against the scan on the 30 items.

**Text and codes.** Vision OCR and barcode are already in §2; no change. Apple's newer document-reading request (iOS 26) is noted in the Kodeco Vision path (*asserted*, [Kodeco](https://www.kodeco.com/ios/paths/apple-ai-models/49307523-vision-framework/04-unveiling-new-vision-framework-features-in-ios-18-ios-26/02)); not needed for labels.

**Recall check (M9).** CPSC publishes a keyless REST recall service at saferproducts.gov, JSON with `format=json`, searchable by product name and dates (*observed*, [CPSC Recalls API](https://www.cpsc.gov/node/5808), [programmer's guide](https://www.cpsc.gov/s3fs-public/RecallRetrievalWebServicesProgrammersGuide20180917.pdf)). Capture's job is to deliver brand, model and date code from the label still; the lookup is identify's (*inferred*).

**Speech for talk mode and the spoken note.** SpeechAnalyzer with SpeechTranscriber runs on the device on iOS 26 and replaces SFSpeechRecognizer; it has no custom vocabulary (*observed*, [Apple WWDC25 index](https://nonstrict.eu/wwdcindex/wwdc2025/277/); *asserted*, [dev write-up](https://dev.to/simple_memo/ios-26s-speechanalyzer-on-a-live-mic-the-5-things-the-docs-dont-tell-you-2ng5)). Brand names will be misheard, so a spoken fact that names a brand is matched against the label read before it confirms anything (*inferred*).

## 4. (c) Comparing the two ways of confirming the type fairly

Arm T: the suggestion is preselected and the person taps to confirm. Arm A: when the suggestion is confident, it is accepted with no tap and the process starts.

Rules for a fair test (*inferred* unless marked):
1. **Same eligibility.** Arm A only differs from T when the suggestion passes the auto threshold. Randomise only those sessions; below the threshold both arms show the same picker. Otherwise A is scored on easy items and T on all.
2. **Within-person crossover.** Each naive operator does half the 30 items in each arm, order counterbalanced, item-to-arm assignment by a fixed Latin square, so item difficulty and learning cancel.
3. **Score the final type, not the acceptance.** People accept preselected advice more under load and time pressure; this is automation bias, and confidence shown with the advice changes it (*observed*, [Goddard et al. 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3240751)). So a tap on a preselected wrong type is not a human label. Measure against the frozen confirmed type: wrong type at `judged`, swaps by `capture_judge`, `category_unsure` raised, and corrections later on the item card.
4. **Count the full cost of A's errors.** A wrong auto-accept costs the frames of the wrong process plus the swap's missing frames. Time is press to `judged`, with swap time inside it.
5. **Test Nate's claim directly.** "The tap makes it easier to identify": compare identify's `exact` match rate and follow-ups asked per item between arms.
6. **Analysis.** Paired per item: McNemar on wrong-type, Wilcoxon signed-rank on seconds. At 30 items a 1-in-30 difference is noise, so state a non-inferiority margin in advance: A ships only if it saves at least 3 s median and is not worse by more than 1 wrong final type in 30. Check the arm split for sample-ratio mismatch with a chi-square, a standard trust check (*observed*, [Kohavi, Tang, Xu](https://exp-platform.com/); [SRM](https://en.wikipedia.org/wiki/Sample_ratio_mismatch)).
7. **Record it.** `capture.confirm_mode` and `auto_accepted` on every row, so the comparison keeps running after the 30 items, through §4's per-event updates.

## 5. (c) The purpose: `sell`, `appraise`, `find`

The feature asks for the purpose at step 8, after the follow-ups ([feature step 8](../../../spec/features/capture.md#what-the-person-does-and-sees)). The purpose changes what is worth asking (*inferred*):

| Purpose | Process | Follow-ups | Stop |
|---|---|---|---|
| `sell` | the type's full plan | as the table | as §3.5 |
| `appraise` | identity frames first (label, plate, About screen); listing-photo frames optional | condition only; no handover, no box unless it moves the value | when the fair range's spread stops narrowing |
| `find` | one still or a screenshot; identity only; no flaws, no condition | none about the seller's item; ask the buyer's constraints instead ([product.md](../../../spec/product.md), `intent`) | at the first `likely_same_model` match |

Method: take the purpose from where capture was opened when known (Sell tab, a value card, Buy), else default `sell` and re-rank the remaining follow-ups at step 8. `worth` in §3.4 already uses `value_at_stake`; for `find` set listing-only rows' importance to 0.

## 6. (c) One `fact.found` frame per attribute while the camera is open

Packet 47's shape: `{"event": "fact.found", "job_id", "attribute": {"name", "value", "source"}}`, with `value: null` and `unknown_reason` for a blank (*observed*, [packet 47](../../../.agents/team/packets/team/47-what-the-pages-need-from-the-backend.md)). Rules to add (*inferred*):
- One frame the first time an attribute gets a value; a new frame only when the value changes or its source rises (seen to label to measured to asked). Never one per video frame.
- Each frame carries `photo_id` and the region (box) the fact came from, so "every fact tied to its pixels" ([feature intro](../../../spec/features/capture.md)) is checkable on screen.
- Blank frames (`not_visible`) are sent only at the stop, not while shooting, so the screen does not fill with blanks the next shot will settle.
- On-device facts (barcode, OCR on the phone) emit locally first and are re-emitted by the job with the same name; the client keeps the higher source.

## 7. (c) Reading the free note into facts, and stripping private details

**Into facts.** A text model with a fixed output schema (`note_fact {name, value, quote}`), and each fact must quote a span found verbatim in the note; a fact with no locatable span is dropped. Google's LangExtract does exactly this grounding, mapping each extraction to character offsets and leaving unlocated ones with no interval (*observed*, [Google blog](https://developers.googleblog.com/en/introducing-langextract-a-gemini-powered-information-extraction-library/), [repo](https://github.com/google/langextract)). Then compare to held facts: same value confirms (source `asked`), a different value raises a mark, a new name fills its row. Negation ("never smoked around it", "not original box") is the main error case, so the fixture needs 20 negated notes (*inferred*).

**Stripping private details, before the model and before any listing text.** Layered, cheapest first:
1. On the phone, `NSDataDetector` finds addresses, phone numbers and links (*observed*, [Apple, NSDataDetector init(types:)](https://developer.apple.com/documentation/foundation/nsdatadetector/init(types:))), so a spoken or typed address can be removed before the note leaves the phone (*inferred*).
2. In the job, Presidio's analyzer and anonymizer: `CREDIT_CARD` by pattern plus checksum, 12 to 19 digits (*observed*, [Presidio supported entities](https://microsoft.github.io/presidio/supported_entities)); `PHONE_NUMBER` through the phonenumbers library (*asserted*, [DeepWiki summary](https://deepwiki.com/microsoft/presidio/4-supported-entities)); `EMAIL_ADDRESS`, `IBAN_CODE`, `US_BANK_NUMBER` on the same page (*observed*, same).
3. Phones: libphonenumber's matcher at leniency `VALID` finds numbers that are valid and plausibly grouped; vanity numbers are not found (*observed*, [python-phonenumbers matcher](https://daviddrysdale.github.io/python-phonenumbers/phonenumbers.phonenumbermatcher.html), [PHP port docs](https://libphonenumber-for-php.readthedocs.io/en/latest/PhoneNumberMatcher/)). Also catch digits spelled out in a transcript ("five five five") by normalising words to digits first (*inferred*).
4. Cards: Luhn on any 12 to 19 digit run after removing spaces and dashes (*inferred*, matches Presidio's rule above).
5. Payment handles: Presidio has no recogniser for a Venmo `@name`, a Cash App `$cashtag` or "Zelle me"; add custom patterns keyed on those words (*inferred* from the entity list above). Why it matters: eBay bars sharing email or phone before a sale and offers to trade outside eBay (*observed*, [eBay policy](https://www.ebay.com/help/policies/payment-policies/offering-buy-sell-outside-ebay-policy?id=4272)).
6. Street addresses: Presidio's `LOCATION` comes from its NER model and covers places, not reliably a street line (*inferred*, the entity page lists no street-address recogniser); keep `NSDataDetector` as the address layer.
Stripped spans are kept only in `item.note` on the phone's owner record, never in `item.note_redacted`, the model input or any listing. Proof: a 50-note fixture with planted addresses, phones (written and spoken), card numbers that pass and fail Luhn, and handles; pass at 0 leaks into listing text and at most 2 false removals.

## 8. Other gaps an expert would flag

- **Faces and people.** Mask faces and people in kept frames before upload with Vision's face and person requests (*inferred*, [Apple Vision](https://developer.apple.com/documentation/vision)); mirrors and dark screens reflect the seller.
- **Retake loop.** §3.5 stops after two retakes per row; add a session cap (start 4 retakes) so a bad room does not trap the person (*inferred*).
- **Offline.** `process[]` from the phone's copy is in §5; the suggestion head, gates, `NSDataDetector` and SpeechAnalyzer all run offline, so only the type check and identify wait for network (*inferred* from the sources above).

## Diff against spec/engines/capture.md

- *agent proposal*: §3.1 and §6: "15" options becomes 14 (13 named families plus `other`), matching product.md.
- *agent proposal*: §1: add rows for `capture.confirm_mode` (`tap`, `auto`) and `auto_accepted`; `capture.purpose` (`sell`, `appraise`, `find`); `retake.reason`; `fact.found` frames; `note_fact` rows and `item.note_redacted`; `photo.origin`; `photo.masked_regions[]`.
- *agent proposal*: §3.1: calibrate the head by temperature scaling on the fixture before card 7's margin (0.2, top ≥ 0.5) or the 0.9/0.1 swap bounds are applied; auto-accept only when calibrated top ≥ 0.9 and margin ≥ 0.5 (start values).
- *agent proposal*: §2: the classifier is our own 14-way Core ML head over Vision features, not Apple's built-in taxonomy, which changes per OS revision.
- *agent proposal*: §3.6 and §4: drop "at most 3" as a hard cap; keep 3 for asked facts with a widget per extra field a type's process needs (Nate, Open 7); the guard band becomes "at most 3 plus the type's process fields".
- *agent proposal*: new §3.7 Purpose: the table in §5 of this note; listing-only rows' importance 0 for `find`.
- *agent proposal*: new §3.8 Note: grounded extraction with a verbatim quote per fact; private spans removed on the phone by `NSDataDetector`, then in the job by Presidio, libphonenumber `VALID`, Luhn, and custom payment-handle patterns, before any model call.
- *agent proposal*: §2 gates: variance of Laplacian on the label region; Apple's aesthetics `isUtility` as a screenshot signal; 500 px floor on imports.
- *agent proposal*: §3.2: measured dimensions carry `sigma`, start 1 cm for items over 10 cm on LiDAR, widened by depth confidence; furniture trials RoomPlan's object box against the scan.
- *agent proposal*: §6: `fact.found` emission rules from §6 of this note (first value, source rise, change; blanks only at the stop; each with `photo_id` and box).
- *agent proposal*: §8: faces and people masked before upload; payment handles and contact details never reach listing text.
- *agent proposal*: §9: test 7 rewritten as §4 of this note (same eligibility, crossover, McNemar and Wilcoxon, the 3 s / 1-in-30 bar, SRM check); new test 9 Note privacy (50 notes, 0 leaks, at most 2 false removals); new test 10 Purpose (a `find` session asks no condition and stops at the first likely match).
- *agent proposal*: product.md's line that bikes_sports and baby_gear "use other's" plan is replaced by capture-shots' scan-then-label plans; the feature table's links to them point to their own section.

## Changes to tasks' accepts and breaks

- cap-1 Process table: accepts the 14 families (not 15) and a `purpose` argument; breaks if bikes_sports or baby_gear return other's plan, or if `find` returns flaw or condition steps.
- cap-2 Suggestion: accepts calibrated probabilities and returns `preselect` and `auto_accept` separately; breaks if ECE on the fixture is not reported, if auto-accept fires below 0.9/0.5, or if `confirm_mode` is not written.
- cap-3 Type check: unchanged bounds; breaks if a swap after an auto-accept loses a frame or is not counted against arm A.
- cap-4 Next view: accepts `retake.reason` from the gate set and a session retake cap of 4; breaks if a view is asked for a listing-only row on `find`.
- cap-5 Follow-ups: accepts the type's process fields beyond 3 (Open 7); breaks if a fact the note already confirmed is asked, or `function` is preselected.
- cap-6 Learning: accepts `confirm_mode` as a scope on the confusion counts; breaks if arms are pooled.
- cap-7 (new) Note to facts and redaction: owns `jobs/capture/note.py`, `test_note.py`, the 50-note fixture; breaks on any planted address, phone, Luhn-valid card or payment handle in `note_redacted` or the model input, or any fact without a verbatim span.
