# How should talk mode speak and caption, what makes a frame read well to the Decisions API, how do we frame like Ben's Depop photos and hand studio an item sheet, and where do measuring, skipping and video storage fit?
Researched 2026-11-14 by Ben (Claude Code). Feature: capture.

**This note amends [decision-tree-capture.md](decision-tree-capture.md).** It does not replace it: the tree runner, the question rules and the tick loop stand. Section 12 lists the exact sections of that note this one changes. It also builds on the guided list's device gates ([build-plan.md](build-plan.md)), what the measuring shot needs ([measure build plan](../../measure/ben/build-plan.md)), and studio's touch-up rule and photo score ([studio build plan](../../studio/ben/build-plan.md), [photo-score.md](../../studio/ben/photo-score.md)), which studio owns and this note only feeds. The app is the Expo app with a Swift camera module; capture opens on the guided list and a voice button starts talk mode (both [decided](../../../product/decisions.md)). Everything proposed here is an *agent proposal*. Ben's standing rules apply ([demo, not production](../../../product/words.md#2026-11-14-demo-not-production), [paid APIs are fine](../../../product/words.md#2026-11-14-paid-apis-are-fine)): ideas are built, not cut, and a risk is named only when it could break the demo, with a backup.

Evidence marks: *observed* (I opened the source today, or measured the file), *asserted* (the source claims it without showing it, or I'm going from memory), *inferred* (my reasoning).

## 1. The question and Ben's words

Ben, project chat, 2026-11-14 23:01 UTC ([words](../../../product/words.md#2026-11-14-capture-voice-frame-quality-measuring-skipping-and-video-storage) and [the template part](../../../product/words.md#2026-11-14-garment-templates-a-reference-set-and-reading-c2pa)):

> the sentences should be said on screen as well with a voice. not super short. they should sound human and friendly. Better lighting, better video quality, figure out the different levers that affect how an image is ingested by our decision api. to improve it. like you know how someone in good lighting at the gym looks way different and better than not. but essentially the video type thing should frame photos super similar to my depop ones. like we should have templates that are there to give to the image model and have some way to screenshot the best most useful things to get a 'character' like how those ai influencers give seedance 2.5 a photo of a person far away, close up, at different angles etc to try to get it to conceptualize a person well. similar principle with images. have blank templates that work for any pants, shirt, sweatshirt. that present the clothes super well and flattering without changing anything about them. [...] it shouldnt change anything in reality except maybe how things are flattened etc. also the measurement part could be a part of this. also ensure the human could skip some parts. also consider the cost of storing big videos like that too.

Problem type ([thinking.md](../../../.agents/thinking.md)): **Seeing the item**. Every field keeps a source and a confidence, and the proof is labelled real items.

**The answers in short.**

1. **Voice and captions.** Every line is a full friendly sentence, spoken and shown as a caption with the current word lit. A line is one or two sentences, each 84 characters or fewer, 22 words at most, about 7 seconds at most. The camera keeps checking while the voice talks, and a line fades out mid-sentence the moment the seller has done what it asks. The whole library is rendered ahead of time with ElevenLabs `eleven_v4` and its character timings; a line with the item's own words in it is rendered in the background as soon as the words are known, so nothing waits on a voice service.
2. **Levers.** What the model needs most is enough pixels on the thing it is asked about, and a sharp frame. Published tests say darkness and JPEG quality on their own barely move a vision model, while blur and resampling move it a lot. So the camera sends a second image, a tight crop at the sensor's own pixels, for any question about text or a mark; it never enlarges a small crop; and "good gym lighting" is mostly for the buyer, the colour and the image model. An experiment on Ben's three items (section 5.4) replaces this ranking with measured curves.
3. **Framing.** Ben's photos follow one grammar: square, shot straight down on plain concrete in soft daylight, the garment filling 80 to 90% of its long side, then angled detail shots with the garment running off two edges, then the tag with a coin, then tape shots, then the back. Section 6 turns that into shot lists for tee, hoodie and pants with accept tests. The on-screen outline is studio's template, and because studio's model must not re-lay a garment, the seller is coached to lay it straight inside the outline, checked by mask overlap on the phone. Capture hands studio an **item sheet**: six to eight separate, role-named frames in a fixed order plus one contact-sheet grid, with untouched originals beside them.
4. **Measuring** is a step inside the front flat node. When the garment is flat and whole, the lines for chest and length draw themselves on the live picture and the still is taken. A tape laid across the chest is an optional cross-check and a listing photo.
5. **Skipping.** Every node can be skipped by voice, by a button, or by the tree after three tries. A skip writes a gap with a reason. One photo of the whole item is the only thing a listing needs.
6. **Storage.** A 75 second session is about 75 MB at 1080p and about 210 MB at 4K (Apple's per-minute figures). Storing even the 4K video for 1,000 items costs about $5 a month, so money is not the reason to tier. Upload time and the seller's room and voice on tape are. Plan: the full video never leaves the phone, a small 720p copy is kept 30 days, and stills and tick frames are kept.

## 2. Seeded research log

Method: RDD with IAE and looped seeded research. Three loops; each changed a decision. Draft answer from memory before searching: "longer lines are fine if they are under 3 seconds; ElevenLabs v3 for the voice; light is the top lever for the model; crop and upscale the tag before sending; send the image model as many reference frames as it accepts; video storage is a real cost so compress hard." Five of those six changed.

### Loop 1: how does a frame reach the model, and what hurts it?

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| OpenAI "Images and vision" guide (developers.openai.com/api/docs/guides/images-vision, the `.md`) | Primary docs | `detail` is `low`, `high`, `original` or `auto`. For `gpt-5.6-luna`, low "fits within 512 × 512 pixels" and high fits 2048 × 2048 and 2,500 patches of 32 px. `gpt-6-luna` is not in the sizing table. Limits list: "Enlarge text within the image to improve readability"; "The model may misinterpret rotated or upside-down text and images"; approximate counting; weak precise localisation. *observed* (through a summarising fetch) | The 768 px tick frame sent at `detail: "low"` is probably cut to 512 px before the model sees it (*inferred* from the 5.6 row). Text questions need their own crop |
| OpenAI Decisions guide (`.md`) | Primary docs for Ben's named API | Images go in as `input_image` with a URL or base64. The guide says nothing about `detail`, image size, image count or image latency. Score levels use `label` and `description`. "Question images share the request's image limits with images in `input`." $0.10 per 1M uncached input tokens. *observed* | Whether Decisions accepts `detail` at all is unknown. We size images ourselves so the answer doesn't matter. The earlier note wrote score levels with `value`; the guide says `label` |
| VLM-RobustBench (arXiv 2603.06148, ICML 2026) | Benchmark with numbers: 11 open models, 49 corruptions, 133 settings, MMBench and MMMU-Pro | "the largest drops arise from resampling and geometric distortions". Upsampling at high severity: 26 to 34 points lost. Glass blur at low severity: about 8 points. Zoom blur: 10 to 16. Downsample: 5 to 10. Shot noise: 5 (Qwen) to 13 (Gemma). Brightness cut at high severity: about 1.6. JPEG at high severity: 0.3 to 0.6. Vertical flip: 10.3. Rotation: 1.5 to 3.4. Glare not tested. "semantically strong but spatially fragile". *observed* (summary of the paper; open models, not Luna) | Reordered the levers: pixels and sharpness first, brightness and JPEG last. Dropped "crop and upscale": a crop is sent at native pixels |
| EasyRPA OCR tuning guide | Practitioner numbers for text size | x-height 20 to 30 px recommended; "Below an x-height of 10 pixels, you have very little chance of accurate results". *observed* (written for Tesseract, not a vision model) | A working rule for text: 16 px letter height in what the model sees, 10 px as the floor |
| Regula document reader, image quality page | Shipped ID-capture checks | Checks: resolution, focus, glare, perspective angle, bounds, brightness, occlusion, colour. No thresholds published. *observed* | Confirms the check list; gives no numbers to borrow |
| Apple forum thread on macro with `AVCaptureDevice` (iOS 18.3) | Apple engineer answer plus a developer doing label OCR | Close focus comes from virtual devices that include the ultra-wide (`builtInTripleCamera`, `builtInDualWideCamera`), which switch lens by themselves; the default device did not switch. *observed* | ARKit drives one camera, so the tag shot can't lean on the macro switch. Keep the phone back and crop |

Frontier after loop 1:
- Changed: two images per tick when text or a mark is in question (whole frame small, crop at native pixels). No enlarging. JPEG quality is not worth bytes.
- New lead: if longer sentences are spoken, what is the rhythm, and which voice gives word timings?
- Next action: ElevenLabs, Cartesia, OpenAI and Hume docs, a latency board, a caption standard. Bound: 6 pages.
- Contrary lead: "better lighting" may matter little to the model itself. Kept: it matters through blur and noise, and to the buyer and studio. Section 5 separates the two.

### Loop 2: a voice that sounds like a person, with captions

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| ElevenLabs models page | Primary docs | Flagships: `eleven_v4` "Our most emotive, high quality speech synthesis model" (10,000 characters); `eleven_v4_turbo` "most emotive, real-time" (about 100 ms model time); `eleven_v3`; `eleven_flash_v2_5` (about 100 ms). *observed* | v4 for the library, v4 Turbo for the few live lines. The earlier note's v3 and Flash v2.5 are a generation behind |
| ElevenLabs "convert with timestamps" reference | Primary docs | Returns audio plus `alignment` with `characters`, `character_start_times_seconds`, `character_end_times_seconds`. Which models support it is not stated. *observed* | Word-timed captions come free with the render. First-hour check: does `eleven_v4` return alignment |
| Coval's TTS board (article dated 2026-10-28) | Third-party board, 30 days of runs | Time to first audio, average / P95: Eleven v4 Turbo 194 / 242 ms; Flash v2.5 198 / 259; Cartesia Sonic 3.6 292 / 374, "the clearest voice on our board"; Inworld TTS-2 Flash 81 / 102; Deepgram Aura-2 299 / 526. OpenAI not measured. *observed* (the article), *asserted* (its numbers) | Any of the fast ones would do for a live line; staying on one vendor keeps one voice |
| Cartesia timestamp example | Primary docs | `sonic-3.6`, `add_timestamps: true`, returns `words`, `start`, `end`. *observed* | The fallback voice also gives word timings |
| OpenAI text-to-speech guide | Primary docs | `gpt-4o-mini-tts` takes `instructions` for tone; no timestamps mentioned; "deprecated and will shut down on January 6, 2027"; the replacement is a Realtime model that the speech endpoint doesn't serve. *observed* | Out, for a second reason beyond latency |
| Netflix English timed text style guide | The caption standard most people have read | "42 characters per line", "Maximum two lines", "Up to 20 characters per second". *observed* | The caption box: two lines of 42. One sentence per card, 84 characters |
| Hume Octave docs | Primary docs | Both pages I fetched returned Hume's Audio Decisions API instead. Not read. | Octave is compared from memory only, marked so |

Frontier after loop 2:
- Changed: sentence and caption limits; the voice model; captions timed by word.
- New lead: Hume now has a decisions API for audio. It could check each rendered clip ("does the speaker sound warm", "is every word of the script spoken") before a person listens. Not explored further.
- Next action: Ben's photos, how reference sets are fed to image models, storage prices. Bound: 8 sources.
- Contrary lead: a 6 second line could make the tree feel slow. Answered by design, not by shortening: checks keep running under the voice, and a line stops when it is no longer true (section 4.2).

### Loop 3: framing, the item sheet, and what video costs

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| Ben's 19 listing photos in `assets/demo-items/real/` | The target itself; opened one by one, brightness measured with a script | Section 6.1. Mean brightness 0.27 to 0.51 on a 0 to 1 scale; under 1% of pixels blown out in every photo. *observed* | The templates are his grammar, not a generic guide |
| Studio thread's templates and re-lay test (relayed by the coordinator at the end of this session) | Our own prototype result | Templates exist for shirt, sweatshirt and pants. Re-laying a tee with the image model redrew the neck tag. *asserted* (relayed; files not in my checkout) | Capture uses studio's outlines, adds an alignment test and layout coaching, and the item sheet follows studio's picker |
| Higgsfield's `character-sheet` workflow (the instructions an AI-influencer tool ships) | Inspectable practitioner recipe | Default sheet: a full-body view and a tight close-up side by side; a turnaround is front, three-quarter, side, back. "Consistent lighting + seamless background are what make it read as a *sheet*, not a photo." "Consistency is the product." *observed* | The item sheet is far plus close, on one ground, in one light. Exposure and white balance are locked for the session |
| invideo, "how many angles should a character reference sheet have" (updated 2026-07-27) | Practitioner guide | "four turnaround angles" plus a face close-up and a mid close-up; "video models hallucinate whatever they cannot see"; "Generate grids, extract best panels". One team used 11 references for 4 characters and a prop. *observed* | Close-ups exist so the model does not invent detail. A grid is a way to choose, the panels are what is used |
| Seedance 2.0 character consistency guide (mootion, 2026) | Practitioner guide | "Use front, side, and three-quarter views where possible"; avoid "inconsistent lighting, or reference images that introduce different clothing and body proportions". *observed* | Same floor and light across the set |
| evolink guide to Seedream 5.0 Pro multi-reference (2026-07-08) | API guide | "up to 10 reference images per request"; order subject, then material and detail, then style, then background; "refer to images by position"; "the model can only preserve what it can see". *observed* (5.0 Pro; studio's note holds the 5.5 limit) | The order of the item sheet |
| MultiBanana (arXiv 2511.22989) | Benchmark, 3,769 sets, 1 to 8 references | "a general trend of decreasing Total Score as the number of references increases"; lower scores when references differ in scale or viewpoint. Nano Banana: 7.8 with one reference, 4.9 with two. *observed* (summary; tasks are mostly multi-subject, not one object from many views) | Send fewer references, each with a named role. Not "as many as it accepts" |
| LTX help page on reference counts | Vendor table | GPT Image 2 and Nano Banana 2 or Pro take 14, Z-Image 10, Flux 2 Pro 8. *observed* | Eight frames fit every model studio might try |
| Apple's recording sizes; egresscost.com (checked against Cloudflare's price page, Sept 2026); Databricks default storage docs | Vendor figures | HEVC: 60 MB a minute at 1080p30, 170 MB at 4K30 (*asserted*: Apple's Camera settings screen from memory, and the same numbers in a third-party table *observed* today). R2 $0.015 per GB-month, no egress fee; S3 Standard $0.023, $0.09 per GB out after 100 GB free (*observed*, secondary). Databricks' page gives no price (*observed*) | Storage is cheap; the plan is driven by upload time and privacy |

Final frontier:
- Changed: fewer, role-named references; one light and one ground for the whole set; storage tiering argued on upload and privacy.
- Contrary lead weighed: a single grid image is what many influencer workflows feed a video model. For an image model that takes several images, a grid spends pixels on borders and shrinks each view to a third. Separate frames are the hand-off; the grid is for people and for single-image models.
- Open, for day one: the experiment in 5.4; whether Decisions accepts `detail`; whether `eleven_v4` returns alignment; whether ARKit lets us lock exposure on the demo phone.

## 3. What exists

| Reference | Job | What we take | What we change | Evidence |
|---|---|---|---|---|
| Ben's Depop photos (3 items, 19 photos) | Visual direction, the target | Framing grammar, shot order, coin by the tag, tape shots | Shot 3:4 with the item inside the centred square, so every platform's crop works (studio's rule) | observed |
| OpenAI vision and Decisions guides | Mechanism | Sizing rules; "enlarge text"; upright images; per-question images | We size and crop ourselves instead of trusting `detail` | observed |
| VLM-RobustBench | Evidence | The lever ranking's starting order | Re-measured on Luna with our items (5.4) | observed, open models only |
| ID-capture SDKs (Regula today; Incode, BlinkID, Onfido in the earlier notes) | Mechanism | The check list: bounds, focus, glare, angle, brightness, occlusion; auto capture; a second reader on the kept image | Many shot roles; a spoken sentence instead of a two-word hint | observed |
| Apple Vision: `CalculateImageAestheticsScoresRequest` (iOS 18), foreground mask, text recognition, lens smudge | Mechanism, on device | Frame picking tie-break, subject box, text height, haze | Aesthetics score is logged and used to break ties, never a gate | request page observed; score range and `isUtility` asserted from memory |
| No-reference image quality scores (BRISQUE, NIQE, MUSIQ, CLIP-IQA) | Evidence, offline | Run in the experiment to see which tracks the Decisions probability | None on the phone: blur variance, clipping and ISO are cheaper | asserted from memory; not opened |
| ElevenLabs v4 with timestamps; Cartesia Sonic 3.6 | Mechanism | Pre-rendered clips with word timings | Slot lines rendered ahead, not at speak time | observed (docs) |
| Netflix timed text guide | Interaction | Two lines of 42, 20 characters a second | One sentence per card; current word lit | observed |
| Character sheets for AI influencers (Higgsfield workflow, invideo, Seedance guide) | Interaction, mechanism | Far plus close, turnaround views, one light, one ground, pick the best panels | Real frames picked from a video, not generated | observed |
| Seedream multi-reference guide; MultiBanana; LTX limits | Mechanism, evidence | Order by role, refer by position, keep the count low | Studio decides the final set; capture supplies it ranked | observed |
| FitTag width profile (in the measure plan) | Mechanism | Chest and length from the mask alone, fast enough to draw live | Runs on the phone on the Vision mask as a preview; the backend result replaces it | observed there |
| Rasa repair patterns (earlier note) | Interaction | Skip, cancel, repeat as fixed patterns | A skip always writes a reason | observed there |

## 4. Spoken lines, also on screen (item 1)

### 4.1 The tension with "show, don't say", and how it resolves

[copy.md](../../../product/copy.md) is a decision: minimal in-app writing, labels of one to three words, at most one short sentence per card. The earlier plan followed it with a pill of four words or fewer and clips under 1.5 seconds. Ben's 23:01 words are newer and specific to this surface: "the sentences should be said on screen as well with a voice. not super short. they should sound human and friendly."

Resolution (*agent proposal*): **in talk mode the caption is the voice written down, so Ben's newer words win there and only there.** A caption is speech, not interface copy. Everything else on the camera screen keeps the old rule: the shot strip is pictures, the buttons are one word, the guided list (no voice) keeps its short hints. The rest of copy.md still binds every line: no exclamation marks, no "Great!", "Oops", "Let's" or "Just", no narration of what the AI is doing, no invented claims, no em dashes.

### 4.2 Rhythm: how long a sentence can be

A long line only blocks if the loop waits for it. It doesn't.

| Rule | Value (start) | Why |
|---|---|---|
| Checks never wait for the voice | Ticks and device gates run during every line | The earlier note kept clips under 1.5 s so that nothing overlapped. With longer lines the loop is decoupled instead (*inferred*) |
| A line is cut when it stops being true | If the failing answer passes on 2 ticks while its line is playing, the voice fades over 150 ms at the next word boundary and the praise line plays | Word timings make a clean cut possible. Nothing is worse than "a little closer" after they moved |
| The ask comes early | The request is in the first sentence, or starts within 3 s | If the line is cut or half heard, the useful part was said |
| Length | One or two sentences; each sentence 84 characters or fewer; 22 words at most; about 7 s at most | 84 is two caption lines of 42 (Netflix, *observed*). Ben's own example, "That's looking good. Could you bring the tag a little closer so I can read the size?", is 17 words and its longer sentence is 63 characters |
| Speak, then wait | After a correction ends: 2.5 s of quiet before any other correction, and the same question must still fail on 2 ticks | Time to act. A person helping would wait too |
| One voice | Never two lines at once; never start while the seller is talking; if the seller starts talking during a line, fade at the next word boundary | Their words may be "skip" |
| Repeats | The second time a question fails, the other variant plays. The third time, the caption shows with no voice. Then the manual offer (section 8) | Kept from the earlier note |
| Praise | On every accept: a short line (3 to 8 words) under the shutter sound | Ben: "human and friendly". Reverses "no words on acceptance" |
| Show first, say second | A device-gate hint appears as a caption at once; the voice joins only if it still holds after 1.5 s | Gates fire five times a second; the voice shouldn't |
| Node budget | 3 corrections or 30 s, then the manual offer | Was 3 and 20 s. A correction cycle is now about 7.5 s (5 s line, 2.5 s wait) |

Listening while speaking: the earlier note paused speech recognition while a clip played. With 5 second lines that would lose a "skip" said over the voice. Recognition stays on (the audio session already uses voice processing, which removes the phone's own sound), and any transcript that matches the caption being spoken is dropped (*inferred*; check on the demo phone).

### 4.3 Captions

| Property | Choice | Reason |
|---|---|---|
| Component | `CaptionLine` (already in the catalog) becomes the main talk-mode element. `LiveHintPill` is no longer used in talk mode; the guided list keeps it | One place for words |
| Where | Lower third, above the shot strip and shutter, with side margins. Never over the middle of the picture, where the item is | The seller is looking at the item |
| Size | Two lines at most, 42 characters a line, type and colours from the [coder card](../../../brand/coder-card.md); white text on a dark scrim that fades up from the bottom edge | Readable over any floor |
| Timing | Appears 100 ms before the audio. The word being spoken is at full white and the rest at 65%. A two-sentence line shows one sentence at a time | Word timings come with the render |
| When it goes | Stays 1.5 s after the audio ends, then fades in 300 ms. Replaced at once by the next line. When a line is cut, the caption cuts with it | |
| Sound off | The caption stays for the clip's length or 1 s per 15 characters, whichever is longer, with a light haptic when it appears | The silent switch must not hide the coaching |
| Accessibility | The caption text is also posted as a VoiceOver announcement when VoiceOver is on and our voice is off | |
| Log | `caption_shown`, `line_started`, `line_cut` (with the word index), `line_finished`, each with node, question and clip id, through [log/](../../../log/README.md) | The "why?" trail shows what was said and why |

### 4.4 The voice

Compared for a friendly, natural voice, as of November 2026:

| Voice | Naturalness | Time to first audio | Word timings | Verdict |
|---|---|---|---|---|
| ElevenLabs `eleven_v4` | "most emotive, high quality" (*observed*, vendor's words); its Turbo sibling is #2 on Artificial Analysis (*asserted*, Coval) | Not a real-time model | Character timings from the `with-timestamps` endpoint (*observed*); support on v4 itself not stated | **The library.** Rendered once, so speed is irrelevant |
| ElevenLabs `eleven_v4_turbo` | Same family and the same voice id | 194 ms average, 242 ms P95 (*asserted*, Coval) | Same endpoint, streaming variant | **Lines with item words**, rendered ahead |
| Cartesia `sonic-3.6` | "the clearest voice on our board", #1 on Voice Arena (*asserted*, Coval) | 292 / 374 ms | `add_timestamps`, per word (*observed*) | Backup vendor. Clear rather than warm, by the board's own wording |
| Hume Octave | Built around acting directions for tone (*asserted*, memory) | not read | not read | Not judged: docs not reached today |
| OpenAI `gpt-4o-mini-tts` | Takes `instructions` for tone; voices `marin` and `cedar` recommended (*observed*) | not on the board; P95 3.9 s on the September board (*asserted*, earlier note) | None documented | Out: shuts down 2027-01-06 (*observed*) |
| Apple `AVSpeechSynthesizer` | Plain | On device | Word ranges from its delegate (*asserted*, memory) | Last-resort fallback with no network |

How it runs:
- **Library.** A build step renders every line and variant with one voice, saves AAC plus a word-timing list, and names the clip by a hash of text, voice and model. A changed line re-renders itself. If `eleven_v4` returns no alignment, the same text is aligned afterwards with ElevenLabs' forced-alignment endpoint (*asserted*, memory) or rendered on `eleven_v3`.
- **Lines with item words** ("Got it. Carhartt, size 38 by 36."). Rendered in the background the moment the words are known (the tag's text is read several seconds before the read-back is spoken), so the clip is on the phone when its turn comes. If it isn't, the fixed variant without the words plays. No line is ever generated at the instant it is needed.
- **Direction for the voice** (taste, Decision 2): unhurried, warm, a friend who sells clothes and is standing next to you. Audio tags are used sparingly in the render script; none are shown in captions.
- **Checking the clips.** Every clip is listened to once by a person before it ships. Stretch: Hume's audio decisions API could pre-screen ("is every word of this script spoken", "does the speaker sound rushed"); found today, not tried.

### 4.5 Tone rules

1. Warm and plain, with contractions. It talks like a person standing next to the seller.
2. Specific. It names the thing and the direction: "the tag", "a little closer", "toward the window".
3. It says why when the reason is short: "so I can read the size".
4. It never scolds. The problem belongs to the light, the camera or the picture: "The tag is in shadow", never "You're holding it wrong".
5. It asks when the seller might not be able to do it: "Is there a window nearby?"
6. It praises on accept, briefly, and says what it got.
7. No filler: no cheering, no "perfect", no "let's" or "just", no exclamation marks, no narration of what the software is doing.
8. It offers the way out before the seller has to ask for it.
9. Numbers and sizes are said the way a friend would say them.

### 4.6 The t-shirt line library

Two variants each. `{brand}`, `{size}`, `{chest}` and `{length}` are slots; a line with a slot has a fixed fallback in the next row. Checked with the repo's `writing` lint (surface `product`) and against the length rule; results in section 13.

| Key | Fires when | Variant 1 | Variant 2 |
|---|---|---|---|
| `front.ask` | Session start; front flat node opens | Lay your shirt out flat on the floor and hold the phone above it. I'll take the photos as we go. | Start with the shirt flat on the floor, front side up. I'll take each photo when it looks right. |
| `front.cut_off` | `ff_cut_off` passes or the subject box touches the edge | Almost there. Could you step back a little so the whole shirt fits, sleeves and hem too? | I'm missing the edge of the shirt. A small step back should get it all in. |
| `front.too_far` | Device fill under 60% | You can come in closer. I'd like the shirt to fill most of the picture. | There's room to spare. Bring the phone down a bit so the shirt fills the frame. |
| `front.tilt` | Device tilt over 8 degrees | Could you hold the phone level, straight above the shirt? That keeps the shape true. | Tip the phone flat, as if you were setting it on a table above the shirt. |
| `front.wrinkled` | `ff_smooth` under 1.4 | Looking good. Could you smooth out the wrinkles and pull the sleeves out to the sides? | A quick smooth with your hands would help. The shape shows better when it's flat. |
| `front.busy_floor` | `ff_plain_ground` under 0.6 (said once, never blocks) | The floor is close to the shirt's colour, so the edges are hard to see. Is there a plainer spot nearby? | A plain floor in a different colour would help me see the edges. It's fine to carry on if not. |
| `front.held_up` | `a_lying_flat` at or under 0.3 (said once) | Could you lay it flat for this one? That's how I get your measurements. | If you lay it on the floor I can measure it for you. If not, we'll carry on like this. |
| `front.find_floor` | No ARKit plane after 5 s | Point the phone at the floor near the shirt for a second so I can find the surface. | Move the phone slowly over the floor for a moment. I'm finding the surface to measure from. |
| `lay.align` | Outline overlap under the pass mark, item whole and flat | Nearly there. Could you slide the shirt so it sits inside the outline on screen? | The shirt is a little off the outline. Nudge it across, or move the phone to match. |
| `lay.turned` | Mask's long axis more than 5 degrees off the outline's | The shirt is lying at a slight angle. Could you turn it so the collar points straight up? | Straighten it up a touch so it lines up with the outline. |
| `lay.sleeves` | new `ly_sleeves_even` under 0.7 | Could you pull both sleeves out so they match? It looks neater when they're even. | One sleeve is tucked in a little. Smooth it out to the side like the other one. |
| `lay.hem` | new `ly_hem_straight` under 0.7 | The bottom edge is bunched up. Could you pull the hem straight? | Give the hem a little tug so it lies in a straight line. |
| `lay.got` | Outline matched (plays once, then the photo is taken) | That's lined up nicely. Hold it there. | That sits well in the outline. Taking it now. |
| `front.got` | Front still verified | That's the front. Nice and clear. | Got the front. |
| `measure.got` | Measure lines drawn and the still taken (slot) | Nice, that's flat. About {chest} inches across the chest and {length} long. | That's lying well. I make it {chest} across and {length} long. |
| `measure.got_plain` | Same, fixed fallback | Nice, that's flat. I've got your measurements. | That's lying well. Your measurements are on screen now. |
| `measure.missed` | Measure gates fail 3 times | I couldn't measure from this one. You can add it later, or lay a tape across the chest. | The measurements didn't come through this time. We can carry on and add them after. |
| `graphic.ask` | Graphic node opens | Now the print. Move in until it fills most of the picture. | Could you show me the graphic up close? I'd like the detail to show. |
| `graphic.small` | `gr_size_in_frame` under 1.3 | A little closer, please. I'd like the print to fill about half the picture. | Come in a bit more so the details of the print show. |
| `graphic.cut_off` | `gr_whole` at or under 0.3 | The print is running off the edge. Could you back up a touch so all of it fits? | Nearly. Pull back a little so there's some shirt showing around the print. |
| `graphic.soft` | `gr_sharp` under 1.4 or device blur fails | That one came out soft. Hold steady for a second and I'll try again. | Could you hold still for a moment? I'd like the small lettering to be sharp. |
| `graphic.fold` | `gr_wrinkle_across` at or over 0.7 | There's a fold running through the print. Could you smooth it flat? | Smooth the print out with your hand and it will show much better. |
| `graphic.got` | Graphic still verified | Got the print. It's sharp. | That's a clear one of the graphic. |
| `tag.ask` | Tag node opens | Next, the tag inside the neck. Flip the collar open so I can read the brand and size. | Could you show me the neck tag? That's where I get the brand and size. |
| `tag.not_found` | `tag_present` at or under 0.3 for 3 ticks | I can't find the tag yet. Try folding the collar back so the label faces the camera. | Is there a label inside the neck? If there isn't one, say no tag and we'll move on. |
| `tag.small` | `tag_size_in_frame` under 1.0, or text under 16 px in the crop | That's looking good. Could you bring the tag a little closer so I can read the size? | Come in closer to the tag. The writing is still too small for me to read. |
| `tag.cut_off` | `tag_whole` at or under 0.3 | I can see part of the label. Back up a little so all four edges show. | That's a bit too close. Pull back until the whole label is in the picture. |
| `tag.too_close_to_focus` | Distance under the lens's minimum focus distance | The camera can't focus that close. Pull back a hand's width and I'll zoom in from here. | Ease back a little. The lens needs some room, and I can still read it from there. |
| `tag.folded` | `tag_folded` at or over 0.7 | The tag is curling over. Could you hold it flat with a finger at the edge? | Flatten the label out if you can, so none of the writing is hidden. |
| `tag.dark` | Readability low and `g_too_dark` passes, or ISO over the limit | The tag is in shadow. Could you turn toward the window so the writing shows? | It's a little dark inside the collar. A bit more light and I'll be able to read it. |
| `tag.glare` | Readability low and `g_glare` passes, or clipped pixels on the label | There's a shine on the label. Tilt it slightly and the writing will come back. | The light is bouncing off the tag. A small tilt away from the lamp should fix it. |
| `tag.soft` | Readability low with size and light fine | Hold it there for a second. The writing is nearly sharp. | Keep the phone still for a moment so the small print comes out clear. |
| `tag.finger` | `g_hand_covers` passes on the tag crop | Your finger is over some of the writing. Could you hold the label by its edge? | I can see your thumb on the label. Slide it to the side and I'll take it. |
| `tag.got` | Tag still verified, text read (slot) | Got it. {brand}, size {size}. | That's the tag. I read {brand}, {size}. |
| `tag.got_plain` | Same, fixed fallback | Got the tag. I can read it clearly. | That's the tag, nice and sharp. |
| `tag.none` | Seller says no tag, or `tag_cut_stub` passes | No tag, no problem. I'll work out the size from the measurements. | That's fine. I'll use the measurements for the size. |
| `back.ask` | Back flat node opens | Now flip it over and lay the back out flat. | Could you turn the shirt over? Same as before, flat with the sleeves out. |
| `back.got` | Back still verified. Failures reuse the `front.*` lines | That's the back. | Got the back too. |
| `care.ask` | Care label node opens (optional) | Is there a care label on the inside seam? Show me if there is, and I'll read the fabric. | One more label if it has one. It's usually low down on the inside seam. |
| `care.got` | Care label read. Failures reuse the `tag.*` lines | Got the care label. | That's the fabric label. Thanks. |
| `fabric.ask` | Fabric node opens | Now a close look at the fabric. Hold the phone a hand's width above a plain part. | Could you show me the fabric up close, somewhere without any print? |
| `fabric.not_filled` | `fb_fills` under 0.7 | Move in until the fabric fills the whole picture. | A bit closer, please, so all I see is fabric. |
| `fabric.soft` | `fb_weave` under 1.4 | Hold still for a second so the texture comes out sharp. | Pull back a touch. The camera needs a little more room to focus. |
| `fabric.got` | Fabric still verified | That shows the texture well. | Got the fabric. |
| `sweep.ask` | Flaw sweep opens | Last part. Run the camera slowly over the shirt so I can check for marks. | Now a slow pass over the whole shirt, front and back, to show its condition. |
| `sweep.fast` | Device velocity over the limit | A little slower, please. I'm checking the fabric as you go. | Slow down a touch so I don't miss anything. |
| `sweep.far` | `fl_area_covered` failing | Come in closer for this part. About a forearm's length above the shirt works. | Bring the phone down nearer the fabric so small marks show. |
| `sweep.candidate` | Any `fl_*` at or over 0.5 on 2 ticks | I think I see a mark there. Could you hold the camera over that spot? | Is that a mark on the fabric? Hold the camera over it so I can look. |
| `sweep.clean` | Sweep done, nothing raised | I didn't spot any marks. Say so if you know of one. | It looks clean to me. Tell me if there's anything a buyer should know about. |
| `flaw.ask` | Seller mentions a flaw | Thanks for telling me. Could you show me that spot? | Good to know. Point the camera at it and I'll take a photo for the listing. |
| `flaw.speck` | `fc_size` under 0.6 | Come in closer so the mark is easy to see. | A little closer, please. I'd like it to show clearly in the photo. |
| `flaw.too_close` | `fc_size` over 1.5 | Pull back a little so it's clear where on the shirt it is. | That's very close. Back up so some of the shirt shows around it. |
| `flaw.off_centre` | `fc_centred` at or under 0.3 | Could you put the mark in the middle of the picture? | Move the phone so the mark sits in the centre. |
| `flaw.got` | Flaw close-up kept | Got it. That goes in the listing as it is. | That's clear. I've noted it for the listing. |
| `tape.ask` | Optional tape node (section 7.3) | If you have a tape measure, lay it across the chest. I'll add the photo to the listing. | Got a tape measure handy? Lay it across the chest and I'll check it against my numbers. |
| `tape.crooked` | `tp_straight` under 0.7 | Could you straighten the tape so it runs flat across the shirt? | Pull the tape straight, with its start at one armpit seam. |
| `tape.unread` | No two tape numbers read near the edge | Come in closer to where the tape meets the shirt's edge, so I can read the number. | I can't read the numbers yet. Bring the phone down over the end of the tape. |
| `tape.got_match` | Tape and camera agree within half an inch | Got the tape. It matches what I measured. | That's the tape photo, and the numbers agree. |
| `tape.got_differs` | They differ by more | The tape and my measurement differ a little. You can check both on the next screen. | Those two numbers don't quite agree. I'll show you both so you can pick. |
| `light.dark` | `g_too_dark` passes, or ISO and shutter over the limits | It's a bit dark here. Is there a window or a brighter room nearby? | More light would help the colour come out true. Could you move closer to a window? |
| `light.shadow` | `g_hard_shadow` passes | Your shadow is falling across the shirt. Try standing on the other side. | There's a hard shadow on it. Turning so the light is in front of you should clear it. |
| `light.glare` | `g_glare` passes on the whole view | There's a bright patch washing out part of the shirt. Could you move it out of the direct light? | The sun is a little strong there. Shade gives a more even photo. |
| `light.mixed` | ARKit colour temperature far from daylight, or two casts across the floor | The light here is quite yellow. If you can, switch off the lamp and use daylight. | Two kinds of light are mixing here. Daylight on its own shows the colour best. |
| `light.low_contrast` | Item and floor differ too little (dark on dark, white on white) | The shirt is close to the floor's colour. A lighter surface would help me see its edges. | I'm having trouble telling the shirt from the floor. Is there a surface in a different colour? |
| `frame.hand` | `g_hand_covers` passes | Your hand is in the picture. Could you move it away for a second? | Lift your hand clear and I'll take it. |
| `frame.two_items` | Device subject count or `g_second_garment` | I can see two items. Could you move the other one out of the picture? | One at a time works best. Slide the other piece aside for now. |
| `frame.lost` | `g_garment_in_view` failing for 5 s | I've lost the shirt. Point the camera back at it when you're ready. | Take your time. Point the phone at the shirt when you want to carry on. |
| `frame.moving` | Device stability gate | Slow down a little so the photo comes out sharp. | Hold steady for a moment. |
| `frame.smudge` | Lens smudge at or over 0.9, once | The pictures look hazy. Could you wipe the camera lens with your sleeve? | A quick wipe of the lens should sharpen things up. |
| `skip.ok` | Seller skips a node | No problem, we'll skip that one. | Sure. You can add it later from the draft. |
| `skip.offer_manual` | 3 corrections or 30 s on a node | This one's being tricky. Tap the button to take it yourself, or say skip. | I'm having trouble with this shot. You can take it by hand, or we can move on. |
| `skip.auto` | 8 s after the manual offer with no action | We'll come back to that one. It's saved as a gap in your draft. | Moving on for now. You can add that photo later. |
| `skip.jump` | Seller asks for another shot first | Sure, show me that first. | Go ahead, I'll take that one now. |
| `end.early` | Seller says they're done with nodes open | All right, we'll stop here. What's missing is marked in your draft. | That's enough to list it. You can add more photos any time. |
| `end.need_front` | Seller ends with no whole-item photo | Before we stop, could I get one photo of the whole shirt? A listing needs at least that. | One photo of the front is all I need before you go. |
| `end.resume` | Draft reopened with gaps | You left off here. Show me the next one when you're ready. | Here's the next photo that's still open. Take your time. |
| `end.done` | All nodes closed | That's everything. Have a look and tell me if it's right. | All done. Your photos and what I found are on the next screen. |
| `net.down` | Circuit breaker opens | The connection dropped, so I'm checking photos on the phone for now. Carry on. | I've lost the connection. Keep going, and I'll double-check these when it's back. |

78 keys, 156 lines. Hoodie and pants reuse all of it with the garment word swapped by a slot (`{item}`: shirt, hoodie, pants) and add about ten lines each (hood, cuffs, waistband, pocket patch, legs), written when those trees are authored.

## 5. What changes how a frame reads to the Decisions API (item 2)

### 5.1 Two different goods

"Someone in good lighting at the gym looks way different" is true for three consumers that want different things:

| Consumer | What it needs from the frame | What matters most |
|---|---|---|
| The Decisions API on a tick | To answer a narrow question correctly | Pixels on the thing, sharpness, upright, nothing covering it |
| The buyer and the photo score | To look good and honest | Soft even light, true colour, plain ground, fill and centring ([photo-score.md](../../studio/ben/photo-score.md)) |
| The image model (studio) | To keep what it sees | One light and one colour balance across the set, texture and print detail, no clipping |

The ranking below is for the first. The published evidence says light level alone is a weak lever for a vision model and a strong one for the other two.

### 5.2 The levers, ranked (starting order, to be replaced by 5.4)

| # | Lever | Evidence | Measured on the phone by | Fixed silently | Needs the seller | Line |
|---|---|---|---|---|---|---|
| 1 | **Pixels on the target** (resolution, the model's own downscale, crop) | OpenAI: low detail fits 512 px on 5.6 Luna; "Enlarge text within the image" (*observed*). Downsample 5 to 10 points, pixelate 6 to 13 (RobustBench, *observed*). OCR floor of 10 px letter height (*observed*, Tesseract guide). Arithmetic in 5.3 | Text height from Vision's text boxes; subject box size; px per mm from the ARKit distance | Send two images: the whole frame at 512 px and a crop of the subject at the sensor's own pixels. Use ARKit's 4K video format where the phone has it | Come closer, when even the native crop is too small | `tag.small`, `graphic.small` |
| 2 | **Sharpness** (motion blur, focus) | Glass blur at low severity costs about 8 points, more than most heavy corruptions; zoom blur 10 to 16 (*observed*) | Variance of Laplacian on the subject crop; exposure time and camera velocity | Pick the sharpest of the last 5 frames for the tick and for the still; cap exposure time at 1/120 s and let ISO rise; wait for the stability gate | Hold still | `tag.soft`, `frame.moving` |
| 3 | **Focus distance** | ARKit drives the wide camera only, so the automatic switch to the ultra-wide for close focus is not available in the session (*asserted*, memory; the forum thread shows the switch belongs to virtual devices, *observed*). Recent main cameras focus no closer than roughly 15 to 25 cm (*asserted*, memory) | `minimumFocusDistance` of the capture device against the ARKit distance to the plane or depth | Keep the phone at about 25 cm and crop from the 12 MP still (section 5.3). Stretch: hand the tag shot to a plain `AVCaptureSession` on `builtInTripleCamera`, which does switch | Pull back a hand's width | `tag.too_close_to_focus` |
| 4 | **Upright** (rotation, upside-down text) | "may misinterpret rotated or upside-down text" (*observed*, OpenAI). Vertical flip 10.3 points; rotation 1.5 to 3.4 (*observed*). Ben's own pants label is sideways in the photo | Device orientation; the angle of Vision's text boxes | Rotate the frame upright; rotate the text crop so its lines are level | Nothing | none |
| 5 | **Glare and blown highlights** | Not in the benchmark. Every ID SDK checks it (*observed*, Regula). Shiny woven labels and plastisol prints do it often (*inferred*) | Share of clipped pixels inside the subject or label box | Choose the least-clipped frame of the burst; pull exposure down by a third of a stop when the label clips | Tilt it away from the lamp | `tag.glare`, `light.glare` |
| 6 | **Something in the way** (finger, coin, fold) | Occlusion is a standard SDK check (*observed*). In Ben's tee tag photo the coin sits on the word "LOOM" (*observed*) | Decisions `g_hand_covers`, `tag_folded`; Vision hand pose | Nothing | Move the finger; put the coin beside the label, not on it | `tag.finger`, `tag.folded` |
| 7 | **Item against ground** (dark on dark, clutter) | FitTag lost 6 to 7 cm measuring dark jeans on a dark floor (*observed* in the measure plan). Uneven backgrounds rated worse (Ma et al., in photo-score.md). Ben's black pants on mid-grey concrete read fine by eye (*observed*) | Colour difference between the masked item and a ring of floor around it; the confidence of Vision's mask | Meter exposure on the item, not the floor | Move to a plainer or lighter spot | `light.low_contrast`, `front.busy_floor` |
| 8 | **Noise from low light** | Shot noise 5 to 13 points (*observed*). Brightness cut alone only 1.6 (*observed*): dark is harmless until it becomes noise and blur | ISO and exposure time from the frame's EXIF; ARKit's ambient intensity | Torch at low power for the tag crop only, when ISO is past the limit and the label isn't shiny. A torch on a flat-lay gives a hot spot, so never there | Move to the window; turn on a light | `light.dark`, `tag.dark` |
| 9 | **Light direction** (hard shadow, backlight) | Platforms: "harsh shadows never looks good" (Depop, in photo-score.md). Model effect not measured anywhere I found | Decisions `g_hard_shadow`; the brightness gradient across the floor | Nothing | Stand on the other side; move to shade | `light.shadow` |
| 10 | **Colour: mixed light, white balance, exposure drift** | Affects colour fields and studio far more than yes/no questions (*inferred*). Character-sheet practice: one light for the whole set (*observed*) | ARKit's ambient colour temperature; change in white-balance gains during the session | Lock white balance and exposure once the front flat is accepted, through ARKit's configurable capture device (iOS 16, *asserted*, memory). Meter on the white sheet when there is one | Switch off the lamp, use daylight | `light.mixed` |
| 11 | **Lens** (1x or 0.5x) | The ultra-wide bends straight edges near the frame border and has a smaller sensor (*asserted*, memory). Elastic distortion costs 23 to 28 points in the benchmark, though a lens bends far less (*observed*, then *inferred*) | Which camera is active | Stay on 1x; ask for a step back instead of going wide | Step back | `front.cut_off` |
| 12 | **HDR and tone mapping** | Tick frames are plain video frames. A 12 MP still can carry an HDR gain map; a model reads the base picture (*inferred*) | n/a | Send sRGB JPEG with no gain map; keep the HEIC original untouched | Nothing | none |
| 13 | **JPEG quality** | 0.3 to 0.6 points at heavy compression (*observed*) | n/a | Stay at q70; spend upload bytes on the crop instead | Nothing | none |
| 14 | **Several frames** (voting, burst) | The 2-of-3 rule already votes; RobustBench's "severity is a weak predictor" argues for looking at more than one frame (*inferred*) | n/a | Kept from the earlier note; add "sharpest of 5" | Nothing | none |
| 15 | **Hazy lens** | Apple ships a smudge detector (capture plan, *observed* there) | `DetectLensSmudgeRequest` on the first still | Nothing | Wipe the lens | `frame.smudge` |

Apple's aesthetics score (`CalculateImageAestheticsScoresRequest`, iOS 18, *observed*) is computed for every kept still and logged. It breaks ties when picking frames (section 6.5) and is never a gate: it was trained on what makes a pleasing photo, not on whether a label can be read (*inferred*).

### 5.3 How big the tag's text is, by the numbers

Assumptions (*inferred*, from a 26 mm-equivalent main camera in 4:3): at distance d the frame covers about 1.4 d on its long side. A neck label is about 5 cm wide; the size letters are about 3 mm tall and the small print about 1.5 mm. Check against Ben's tee tag photo (*observed*): the label is about 190 px wide at 1080, "XL" is about 20 px tall and "100% COTTON" about 8 px, and the small print is at the edge of readable by eye.

| What the model sees, phone 25 cm from the tag | Pixels per mm | Size letters (3 mm) | Small print (1.5 mm) |
|---|---|---|---|
| Tick frame, 768 px long side | 2.2 | 7 px | 3 px |
| The same at low detail, 512 px | 1.5 | 4 px | 2 px |
| Crop from ARKit's 1920 × 1440 frame, native | 5.5 | 16 px | 8 px |
| Crop from the 4K video format, 3840 × 2880, native | 11 | 33 px | 16 px |
| Crop from the 12 MP still, 4032 px | 11.5 | 35 px | 17 px |

So the whole frame can say whether a tag is there and whole, and cannot say whether it is readable. Changes to the tick:
- The whole frame goes at 512 px on its long side (what low detail keeps anyway), for presence, framing and light questions.
- When the active node is about text or a mark, a second image goes in the same request: a 512 px square cut from the full video frame at native pixels, centred on Vision's text boxes or the subject box, rotated level. Text and mark questions carry that crop in their own `instructions`, per the Decisions guide.
- The crop is never enlarged. If the letters are under 16 px in the native crop, the corrective is "closer", and the gate is the text height the phone measured, not the model's opinion.
- The verify step reads the 12 MP still, where even the small print is 17 px.
- Cost: a 512 px square is 256 patches of 32 px, the frame 192 (*inferred* from the patch rule). Both together are well under a tenth of a cent per hundred ticks at the listed price.

### 5.4 The experiment that ranks the levers on our items

One evening, no phone needed. It turns the starting order into thresholds in the phone's own units.

Inputs: Ben's 19 photos, each with the node's questions and a hand label for each answer (the tag photos get the tag questions, the fronts get `ff_*`, and so on).

```
scripts/lever-sweep.py                      # python3, Pillow, numpy, opencv-python, matplotlib
  load items = assets/demo-items/real/*/*.jpg, labels = research/capture/ben/lever-labels.json
  levers = {
    "downscale":   long side 1080, 768, 512, 384, 256, 192          # area resample
    "upscale":     shrink to 256 then enlarge to 512 and 1024       # tests "never enlarge"
    "crop":        whole frame vs native crop of the labelled box, at 512
    "defocus":     gaussian sigma 0, 1, 2, 3, 5, 8
    "motion":      linear kernel 0, 5, 9, 15, 25 px, two directions
    "dark":        exposure -1, -2, -3, -4 stops in linear light
    "dark_noisy":  the same plus Poisson noise scaled to the stop    # what a phone really does in the dark
    "jpeg":        q 90, 70, 50, 30, 15
    "cast":        white point 2700 K, 3500 K, 5000 K, 7500 K, green tint
    "glare":       a soft white blob over 5, 10, 20% of the labelled box
    "shadow":      a hard-edged 1.5 stop band across the item
    "rotate":      90, 180, 270 and 15 degrees
    "detail":      low vs high vs omitted, if the API accepts it
  }
  for image, lever, level:
      frame = degrade(image, lever, level)
      also record what the phone would measure on it: laplacian variance, mean luma,
          clipped share, text height in px, item-floor colour difference
      answers = decisions(frame, questions_for(image.role))          # one request, cached on the frame's hash
      rows.append(image, lever, level, device_metrics, {question: probability})
  write lever-sweep.parquet
  per question and lever: plot probability against level, one line per image
  per lever: the level where the right answer's probability first crosses 0.7 and 0.5,
      expressed in the device metric
  rank levers by the area lost under the curve
```

About 19 images by 60 settings, so roughly 1,150 requests, a few cents. Outputs: one chart per lever, a ranking, and a table of thresholds (for example "below 14 px letter height the readable score falls under 2.2") that go straight into the gates.

Limits to say up front: synthetic damage is not real damage. Real darkness comes with noise and blur together, real glare has a shape, and Ben's photos are all good to begin with. So a second pass uses 20 real pairs shot on the demo phone (the same view in good and bad light, near and far, steady and shaken), run through the same questions. The sweep sets the order and rough numbers; the pairs confirm them.

## 6. Framing like Ben's photos, and the item sheet (item 3)

### 6.1 What Ben's photos do

All 19 are 1080 px squares on bare concrete in soft daylight with no hard shadows, shot from directly above. Positions are read by eye from the files; brightness is measured (*observed*).

| Shot (file) | Camera | How much the item fills | How it is arranged | Notes |
|---|---|---|---|---|
| Tee front (`marquette-tee/01`, `02`) | Straight down from standing height, no tilt | About 91% of the width and 83% of the height; 4 to 10% of floor on each side | Collar at the top, sleeves resting out and slightly down, hem a little bunched, the whole shirt turned about 5 to 8 degrees clockwise | Not ruler-straight. `02` is the same view with the neck tag flipped out so the brand shows. Brightness 0.48 |
| Tee back (`08`) | Same | About 94% by 80% | Same pose, the bottom corner tucked | The back print is centred by the pose, not by cropping |
| Angled detail (`03`; hoodie `02`, `03`; pants `05`) | Closer, about 40 to 50 cm, frame turned 15 to 25 degrees to the garment | Garment fills 70 to 80% and runs off two edges; a wedge of floor in one corner | The detail of interest (collar plus print, cuff plus pocket, hood plus print, pocket patch) sits near a third-point | This is the "from an angle" shot. It shows the detail in context |
| Graphic, tight (tee `04`, hoodie `04`) | Straight down, close | Fabric fills 95 to 100%. The print is 31% of the width on the tee (a small chest print) and 58% on the hoodie (a large one) | Print centred or just below centre, collar or hood edge at the top | Wrinkles left as they are |
| Tag (tee `05`, hoodie `06`) | Straight down, about 25 to 30 cm | Label is 14 to 18% of the width, centred | Collar or hood opened around it; a US quarter beside the label for scale | On the tee the coin covers part of the brand name. Text is upright. Hoodie brightness 0.27, the darkest of the set |
| Tape, length (tee `06`) | Straight down, close | Shirt in the top 55%, floor below | Tape runs down the middle, numbers 22 to 30 in view, hem at about 27 | Only the reading end is shown; the start of the tape is out of frame |
| Tape, chest (tee `07`) | Straight down, close | Shirt in the left 55%, floor on the right | Tape runs across at armpit height, numbers 15 to 25 in view, the shirt's edge at about 21 | Same |
| Cuff and brand tab (hoodie `05`) | Straight down, about 25 cm | Fabric fills 85% | The small woven tab centred, cuff and pocket seam around it | A trim detail a buyer checks for |
| Hoodie front (`chico-hoodie/01`) | Straight down | 77% of the width, 89% of the height; 2% of floor above the hood | Hood up and pressed flat, sleeves bent in so the cuffs rest by the pocket | The bent sleeves are what let a hoodie fill a square. Brightness 0.42 |
| Pants front and back (`carhartt-pants/01`, `04`) | Straight down from higher up | 87% of the long side, 44% of the short side | Legs a little apart, waistband flat. In the file the waist is on the left and the hems on the right | Sideways as stored. Studio's pants template follows this |
| Waistband (pants `02`) | Close, straight down | Fabric fills 70%, floor down one side | Button, belt loops and the top of the fly | Stands in for the tag shot's "what brand of build is this" |
| Care label (pants `03`) | Close, straight down | Label about 30% of the width | Waistband opened; the label's text runs sideways in the file | Readable: Carhartt, 38 × 36, B324 BLK. Needs turning before a model reads it |

The grammar in one paragraph: one whole view that nearly fills the frame with a thin even margin; two or three angled details where the garment bleeds off the edge; the print tight; the label with a coin; the tape at the two places buyers ask about; the back last. Same floor, same light, same height for every whole view. Nothing is styled beyond a quick flatten.

### 6.2 The overlay is studio's template, and laying out happens at capture

Update from the coordinator while this note was being written (*asserted*: relayed, and the files are not in my checkout, see Limits):
- Studio has already made the garment templates: shirt, sweatshirt and pants outlines as PNG, SVG and a 1:1 crop in `research/studio/ben/templates/`, with `templates.json` holding the frame (3:4, 1200 x 1600, the item inside the centred square), the item box, and a shot list per garment type: front whole, back whole, tag, print, fabric, hems, flaws. They are sized from Ben's Depop covers and laid his way, so pants lie sideways with the waist on the left.
- Studio found that asking the image model to re-lay a tee into the template made it redraw the neck tag. So studio proposes the model only flattens in place, and **the person lays the garment out at capture, guided by the overlay**.

What that means here:
- **Capture draws no outlines of its own.** The viewfinder overlay is studio's SVG for the garment type, scaled to the 3:4 preview, and the accept tests below are written against `templates.json`'s item box and silhouette. One asset, two uses.
- **Lining up is now an accept test, not a nicety.** Ben's own covers sit 5 to 8 degrees off straight, which was fine when a model might re-lay them. It can't, so the whole views are coached straight.
- Exposure and white balance lock after the first accepted whole view, so the set reads as one sheet.

**The "aligned with outline" test** (whole front and whole back only):

| Part | How | Pass (start values) |
|---|---|---|
| Overlap, on the phone | Vision's subject mask against the template silhouette, both in frame coordinates, intersection over union. No fitting or warping first: the point is that the seller lines it up | IoU 0.75 or more on 2 of 3 checks |
| Straightness, on the phone | Angle between the mask's long axis and the template's | 5 degrees or less |
| Size and place, on the phone | Mask box against the template's item box | Centre within 4% of the frame; width and height within 10% |
| Layout, Decisions | new `ly_sleeves_even`: "Are both sleeves laid out the same way, at the same angle from the body?"; new `ly_hem_straight`: "Does the bottom hem lie in a straight line, without bunching or a turned-up corner?"; existing `ff_smooth` | 0.7, 0.7, 1.4 |
| Outline, Decisions | The same frame with the outline drawn on it, as a question image. new `ly_inside_outline`: "Does the garment fill the drawn outline, with no large part of it outside the line?" | 0.7; logged against the IoU so we learn whether the question adds anything |

The overlay gives feedback before any words: the outline is drawn at 65% white, turns full white as the IoU passes 0.6, and pulses once at the pass mark. Lines: `lay.align`, `lay.turned`, `lay.sleeves`, `lay.hem`, `lay.got`. Real garments differ in cut (a cropped tee, a long hoodie), so IoU can't reach 1; if a whole, flat, straight garment sits at 0.6 to 0.75 for 6 seconds it is accepted with `outline_fit: "loose"` in the manifest. The threshold is fitted on the three real items plus five others before the demo.

### 6.3 Capture templates

Fill is the subject box against the centred square; where `templates.json` gives an item box, that box replaces the fill numbers below. Studio's shot list (front whole, back whole, tag, print, fabric, hems, flaws) is the core of each template; the angled details, waistband and tape shots are extras from Ben's listings, taken for the listing and offered to studio as close-ups. "Gate" is a device check; "question" is a Decisions question from the earlier note's set unless marked new. Order is the default; presence questions let the seller go out of order.

**Tee** (also polos and any flat top without a hood)

| # | Shot and role | Overlay | Fill target | Camera | Device gate | Decisions accept |
|---|---|---|---|---|---|---|
| 1 | Whole front (`front`), the cover, also the measuring still | Studio's shirt outline | The template's item box (Ben's covers: long side 80 to 92%) | Straight down, tilt 8 degrees or less, 0.9 to 1.4 m, 1x | Plane, tilt, distance, one subject, sharp, stable, **outline IoU, straightness, size and place** | `ff_whole`, `ff_cut_off`, `ff_smooth`, `ff_front_up`, `ly_sleeves_even`, `ly_hem_straight`, `ly_inside_outline` |
| 2 | Angled detail, upper (`detail_upper`): collar, tag edge and print together | Corner bracket only | Garment 70 to 85%, off two edges | 40 to 50 cm, frame turned 15 to 25 degrees | Sharp, stable, distance 0.35 to 0.6 m | new `dt_two_edges`: "Does the garment run past two edges of the photo, with floor showing in one corner?"; `gr_present` or `tag_present` |
| 3 | Print, tight (`graphic`) | Rectangle | Print 30 to 60% of the width, whole | Straight down, 30 to 50 cm | Sharp, stable | `gr_whole`, `gr_size_in_frame`, `gr_sharp`, `gr_wrinkle_across` |
| 4 | Tag (`tag`) | Small rectangle with a coin circle beside it | Label 14 to 20% of the width in the frame; letters 16 px or more in the native crop | Straight down, at or beyond the minimum focus distance, about 25 cm | Text height, sharp, stable, text read | `tag_whole`, `tag_folded`, `tag_text_readable` on the crop; new `tag_coin_clear`: "Is every part of the label's text free of any object lying on it?" |
| 5 | Whole back (`back`) | Studio's shirt outline | As shot 1 | As shot 1 | As shot 1 | `bf_*`, `a_graphic_back` |
| 6 | Fabric (`fabric`) | None | Fabric fills the frame | About 20 to 25 cm, straight down | Sharp, stable | `fb_fills`, `fb_weave` |
| 6b | Hems (`hems`): bottom hem and one sleeve end | Bracket | Hem edge across the frame | 30 to 40 cm | Sharp | new `hm_hem_edge`: "Is the stitched bottom edge of the garment visible, running across the photo?" |
| 7 | Care label (`care_label`), optional | Small rectangle | As the tag | As the tag | Text read with a `%` token | `cl_whole`, `cl_text_readable` |
| 8 | Tape across the chest and down the length (`tape_chest`, `tape_length`), optional | A line where the tape goes | The reading end and the garment's edge both in frame, 25 to 35 cm | Straight down | Two tape numbers read | Section 7.3 |
| 9 | Flaws (`flaw`), as found | None | Mark clear with fabric around it | Close | Sharp | `fc_*` |

**Hoodie and sweatshirt.** As the tee, with these changes: shot 1 uses studio's sweatshirt outline (Ben's hoodie cover has the hood up and flat and the sleeves bent in to the pocket; the outline is the authority on pose). Shot 2 becomes two angled details: upper (hood and print) and lower (cuff, pocket, hem). The `hems` shot takes the cuff, the waistband rib and any brand tab together, as in Ben's `05`. The tag is inside the hood seam; the ask says so. New questions: `hd_hood_flat` ("Is the hood lying flat above the body of the garment?"), `tr_cuff_visible` ("Is the ribbed end of a sleeve visible in the photo?").

**Pants**

| # | Shot and role | Overlay | Fill target | Camera | Device gate | Decisions accept |
|---|---|---|---|---|---|---|
| 1 | Whole front (`front`), the cover, measuring still | Studio's pants outline: sideways, waist on the left, legs slightly apart | The template's item box (Ben's: 87% of the long side) | Straight down, 1.2 to 1.6 m (pants are longer than the tee range allows; measure's distance band widens for this template) | Plane, tilt, one subject, sharp, stable, outline IoU, straightness | new `pf_whole`: "Is the whole pair of trousers inside the photo, from waistband to both hems?"; `pf_legs_apart`: "Is there floor visible between the two legs?"; `ff_smooth` |
| 2 | Waistband (`waistband`) | Bracket | Button and both nearest belt loops in frame | 30 to 40 cm | Sharp | new `wb_button_visible`: "Is the waist button or clasp visible?" |
| 3 | Label (`tag`): inside the waistband, or the patch on the back | Small rectangle | As the tee tag | As the tee tag | Text read; a size pattern like 38 × 36 | `tag_*` on the crop, wording "label inside the waistband" |
| 4 | Whole back (`back`) | Studio's pants outline | As shot 1 | As shot 1 | As shot 1 | `pf_whole`, new `pb_back_up`: "Are back pockets visible on the trousers?" |
| 5 | Back pocket and patch, angled (`detail_upper`) | Corner bracket | Patch near a third-point | 40 cm, turned 15 degrees | Sharp | `dt_two_edges`; new `pp_patch`: "Is a sewn-on brand patch or label visible on a pocket?" |
| 6 | Hems (`hems`) | Bracket | Both hems in frame | 40 cm | Sharp | new `hm_hems`: "Are the bottom ends of both legs visible?" |
| 7 | Fabric, flaws, tape (waist and inseam) | As the tee | | | | |

Pants in a square fill under half of it whichever way they point. That is true of Ben's photos too and is not a fault to correct. Label crops are turned level before a model reads them, since the label's text runs sideways when the pants do.

### 6.4 The item sheet: what an image model needs to "get" a garment

The influencer recipe is far, close and angles of one person in one light, so the model stops inventing what it can't see. For a garment the equivalents are:

| Order | Role | Why the model wants it | Source |
|---|---|---|---|
| 1 | `front` whole | Shape, proportions, where everything sits. The frame studio edits in place | Still |
| 2 | `back` whole | The other side, so it isn't invented | Still |
| 3 | `graphic` tight | Print edges and lettering, exact | Still |
| 4 | `fabric` | Texture and true colour at close range | Still |
| 5 | `detail_upper` angled | How collar, print and tag relate; a second scale and viewpoint | Still or best video frame |
| 6 | `hems` or `detail_lower` | Cuffs, hem, pocket, patch | Still or best video frame |
| 7 | `tag` | Brand mark as a logo reference; kept at level 0 always | Still |
| 8 | `flaw` close-ups, up to 2 | What must not be cleaned away | Still |

This order is what studio's reference picker (`research/studio/ben/prototype/refset.py`, *asserted*: described by the coordinator, not opened) asks for: the cover first, one whole-item frame of the other side, then sharp close-ups. Close-ups are handed over ranked by sharpness within their role, and the manifest marks `cover: true` on frame 1.

Rules, from the sources in loop 3:
- **Separate images are the hand-off.** Each is its own file at full size, named by role, sent in this order, and referred to by position ("image 1 is the garment; keep its shape, print and colour"). Seedream's guide and the influencer guides agree on order and on naming roles (*observed*).
- **Fewer is better.** Studio starts with the first four and adds 5 to 8 only when the gate shows drift in what they cover. More references and mixed scales lowered scores in MultiBanana (*observed*, on multi-subject tasks; whether it holds for one garment is for studio to test).
- **One light, one ground.** Locked exposure and white balance, the same floor in every whole view.
- **A contact sheet as well**: `sheet/contact.jpg`, 2048 px square, a 3 by 3 grid of the frames above in order with thin gaps and no text on it (a model copies text it sees). It is for the review screen, the "why?" panel, and any model that takes a single image. In a grid each view is about 680 px, a third of what the separate file gives (*inferred*).
- **Flaw frames and label frames are reference only.** They tell the model what to keep and are never themselves edited.

### 6.5 Picking the best frames from the video

The stills the tree takes are the first choice for every role they cover. The video fills the roles with no still (angled details, extra texture) and replaces a still that failed its verify.

1. **Candidates.** Every tick frame carries its time, camera pose from ARKit, blur variance, clipped share and the answers it got. For each open role, take the frames where that role's presence question passed.
2. **Hard filters.** Sharp (above the session's blur threshold), under 2% clipped inside the subject, no hand, one item.
3. **Score.** Sharpness on the subject (the main term), the role's own answers ("whole", "size in frame"), exposure inside the band, then Apple's aesthetics score to break ties.
4. **Spread.** For the angled and texture roles, pick so the set differs: farthest-point choice over distance and viewing angle from the ARKit pose, and drop near-copies by Vision feature-print distance (*asserted*, memory, for the feature print). The aim is far, middle and close, not three of the same.
5. **Full size.** For each chosen moment, the frame is cut from the on-phone full-size recording, sharpest within half a second either side.
6. **A last look.** The top two per role go to one Decisions request, one question per candidate with the image in that question's `instructions` ("Is the printed design in this picture sharp and completely inside the picture?"), as the guide prescribes for comparing candidates (*observed*). Highest probability wins; both are kept in the log.

### 6.6 The contract with studio

Studio owns templates, rendering, the fidelity gate and reading C2PA from model outputs (Ben mentioned C2PA in the same message; noted here, not designed here). Capture delivers:

```
items/<item_id>/capture/<session_id>/
  manifest.json
  orig/01_front.heic            the camera's own file, never rewritten
  orig/02_back.heic  03_graphic.heic  04_fabric.heic  05_detail_upper.heic
  orig/06_hems.heic  07_tag.heic  08_flaw_1.heic  09_tape_chest.heic  ...
  sheet/01_front.jpg ...        2048 px long side, upright, sRGB, q90; resized and turned only
  sheet/contact.jpg             2048 px square grid, no text
  ticks/<ms>.jpg                the frames the model saw, with crops as <ms>_crop.jpg
  video/proxy.mp4               720p copy (section 9)
```

`manifest.json`, per frame:

| Field | Value | Source, confidence |
|---|---|---|
| `role`, `order`, `cover` | From the tables above; `cover: true` on the whole front | tree (`prompted`), or Decisions when picked from video (its probability) |
| `source` | `still`, `video_frame`, `manual` | device |
| `node`, `trigger`, `accept` | Node id and version, how it was taken, the answers at acceptance, verify result | Decisions and device; per-question probabilities, not combined |
| `sha256`, `bytes`, `width`, `height` | Of the original | device |
| `editable` | `false` for `flaw`, `tag`, `care_label`, `tape_*`; `true` otherwise | rule |
| `pose` | Distance, tilt, turn, plane anchor, intrinsics | ARKit (`measured`) |
| `exposure` | ISO, exposure time, white-balance gains, `locked` | device (`measured`) |
| `light` | Flags: `low_light`, `mixed_light`, `hard_shadow`, `glare` | device and Decisions |
| `quality` | Blur variance, clipped share, aesthetics score, text height in px | device (`measured`) |
| `boxes` | Protected regions in 0 to 1 coordinates: label, logo, each confirmed flaw | Vision, identify, the seller (`you_said`) |
| `mask` | Path to the item mask | Vision (`estimated`) |
| `feeds` | `listing`, `identify`, `measure`, `image_model` | tree |
| `template` | Studio's template id and version from `templates.json`, and `outline_fit`: IoU, axis angle, `tight` or `loose` | device (`measured`) |

**The reality rule.** Ben: "it shouldnt change anything in reality except maybe how things are flattened etc." What capture does for it:
- Originals in `orig/` are written once with their hash and never rewritten. Any fidelity check can go back to them.
- `sheet/` copies are resized, turned upright and converted to sRGB. Nothing else.
- Flaw, label and tape frames are marked `editable: false`, and every confirmed flaw has a box on the whole view so a render can be checked there.
- Laying out is the seller's job, at capture, against studio's outline (6.2), because a model asked to re-lay a garment redrew its tag. Studio's model only flattens in place.
- Flattening is asked of the seller's hands, before the photo ("Could you smooth out the wrinkles"), and the `ff_smooth` answer at capture is in the manifest, so studio knows how flat the real thing was before any "pressed" touch-up.

## 7. Measuring inside the flow (item 4)

### 7.1 The node

Measuring is a second accept rule on the front flat node, not a separate trip. The same still serves both.

| Part | Definition |
|---|---|
| Node | `front_flat`, with `feeds: ["listing", "measure", "image_model"]` and a nested `measure` step |
| Listing accept | As before: whole, front up, sharp, lit |
| Measure accept (all must hold on 2 of 3 ticks) | Gates: plane found, tilt 8 degrees or less, distance in the template's band, one subject, box inside the frame with a 3% margin, fill 60% or more, stable. Questions: `a_lying_flat` at or over 0.7; `ff_smooth` at or over 1.4; new `ms_sleeves_clear`: "Are both sleeves lying out to the sides, not folded under or across the body?" at or over 0.7; new `ms_nothing_on_it`: "Is any object, such as a hand, a tape or a coin, lying on the garment?" at or under 0.3 |
| If only the listing accept holds | The front is taken for the listing, `measure_ready=false`, and `front.wrinkled`, `front.held_up` or `front.tilt` is said once. If the seller carries on, measuring becomes a gap |
| Action | `captureHighResolutionFrame`, saved with intrinsics, camera transform, plane anchor and depth map, exactly as the [measure plan](../../measure/ben/build-plan.md) step 0 asks |
| Line | `measure.got` with the numbers when the live preview has them, else `measure.got_plain` |
| Sent to measure | The still and its metadata, the Vision mask, the template id (tee, hoodie, pants), the phone's preview lines and values, the answers above |

### 7.2 Lines that draw themselves (stretch, built)

While the measure gates hold, the phone draws chest and length on the live picture:
1. Vision's foreground mask at about 5 times a second on a 512 px frame (already running for the subject gate).
2. A width profile down the mask: the narrowest row under the sleeves gives the armpit line, the top and bottom rows on the centre line give length. This is the geometric pass the measure plan ports from FitTag, small enough for the phone (*inferred*; not timed).
3. Each end point is turned into millimetres by casting it onto the ARKit floor plane, the same maths measure uses for the still.
4. Two lines with round ends fade in over the garment, with values to the nearest half inch and the word "about".
5. When the still is taken the lines freeze on it. When the backend's checked values come back a few seconds later, the ends slide to their final places and the numbers settle. The values on the phone are marked *estimated*; the backend's are *measured*; the review screen is still where the seller approves them.

Components: measure's `MeasureOverlay` drawn in a live mode, plus `CaptionLine`. Edge cases: a hood or folded sleeve breaks the width profile, so the preview shows length only; a dark item on a dark floor gives a poor mask, so no preview and `light.low_contrast`. Backup if the live drawing is unsteady on the demo phone: draw the lines on the frozen still a second after the shutter. The line and the numbers are the same.

### 7.3 The seller's tape, as a cross-check and a photo

Ben's listings include tape shots, and they show a buyer the number on a real tape.

| Part | Definition |
|---|---|
| Node | `tape_chest` (and `tape_length`; for pants `tape_waist`, `tape_inseam`). Optional, offered after the measuring still, skippable with no gap recorded |
| Presence | new `tp_present`: "Is a measuring tape with printed numbers lying across the garment?" |
| Questions | new `tp_straight` (score): "How straight is the tape?" with levels `curved`, `nearly_straight`, `straight`; new `tp_edge_in_view`: "Can the place where the tape crosses the edge of the garment be seen?" |
| Reading | On-device text recognition reads the numbers on the tape. Code takes the two read numbers nearest the garment's edge (where the tape leaves the mask), gets pixels per inch from the gap between them, and reads the edge's position to a quarter inch. Counting and measuring stay in code, per the earlier note's rule 15 |
| Check | One Decisions choice: "Which printed number on the tape is nearest to the edge of the garment?", with the numbers the phone read as the choices, plus its companion "Is the edge of the garment next to the tape visible?" |
| Accept | Two numbers read, the edge found, `tp_straight` at or over 1.4, the choice agrees with the code's whole number |
| Cross-check | Tape against the camera's value for the same line. Within half an inch: scale confidence "high", line `tape.got_match`. Otherwise both values go to the review screen, line `tape.got_differs`, and the person picks. A tape reading can also rescale every line (measure's path C) |
| Honest limit | The start of the tape is out of frame in Ben's photos, so the photo shows where the tape ends, not where it began. The value is recorded as *you said*, with the photo as its evidence |
| Test fixtures | `marquette-tee/07.jpg` should read about 21 inches and `06.jpg` about 27 (*observed* by eye) |

Data written: `Photo.role = tape_chest`, `Item.measurements[].tape = { value_in, photo_id, numbers_read, agreed }`, source `you_said`, plus the agreement flag on measure's scale confidence.

## 8. Skipping (item 5)

### 8.1 Three ways to skip

| Way | How | What happens |
|---|---|---|
| Voice | "skip", "skip this", "next"; "no tag", "there isn't one", "it doesn't have one"; "that's all", "I'm done"; "go back", "do the back first" | The utterance questions from the earlier note sort it. "Skip" writes `seller_skipped`. "No tag" writes `not_present`. "Done" ends the session. Line: `skip.ok`, `tag.none` or `end.early` |
| Controls | A `Skip` button beside the caption, always there in talk mode. The shot strip's tiles can be tapped: an open tile jumps to that shot, a filled one offers a retake. A `Done` button top right | Same as voice. The button matters on a loud stage |
| The tree itself | After 3 corrections or 30 s: the manual offer (`skip.offer_manual`) and the shutter pulses. After 8 more seconds: `skip.auto` | Writes `could_not_get` |

Out of order needs nothing new: every open node's presence question is asked on every tick, so showing the back first is taken as the back. Saying "do the back first" moves the active node by hand. "Go back" reopens the last closed node for a retake and keeps the old photo until the new one is accepted.

### 8.2 What a skip records

`Item.gaps[]` gains a reason the seller would recognise. This extends the earlier note's list:

| Reason | Meaning | Asked again on resume? |
|---|---|---|
| `not_present` (was `not_applicable`) | The item doesn't have it: no tag, no print on the back | No |
| `seller_skipped` | The seller chose not to | Shown, not pushed |
| `could_not_get` (was `timeout`) | The tree gave up | Yes, first |
| `offline` | Checks deferred, then failed | Yes |
| `ended_early` | The session was ended with this still open | Yes |

Each gap also keeps the node id, how many tries, the last failing question, and the line last spoken.

### 8.3 What each skip costs downstream

| Skipped | What is lost | What takes its place |
|---|---|---|
| Whole front | The listing has no cover. **This is the one required shot.** A held-up front counts; `end.need_front` asks for it once | Nothing. Without it the draft stays a draft |
| Flat front (item held up instead) | Camera measurements | Tape reading, or the tagged size alone, or "not measured" |
| Tag | Brand and size from text | Size becomes *measured* (from the lines) or *you said*; brand from the print, the care label or visual search; identify's confidence is lower |
| Care label | Fibre content | "Not stated" in the listing |
| Back | Second listing photo; back flaws; the image model has no back view, so studio must not render one | The listing says front only |
| Graphic | A sharp print for buyers and for studio's detail check | The print as seen in the whole front |
| Fabric | Texture reference for studio | Studio stays at level 0 or 1 without it |
| Flaw sweep | The "looked over" record | Condition is *you said* only; the review screen asks once if there is anything to mention |
| Tape | Nothing required | Camera measurements stand alone |

### 8.4 Ending early and coming back

- Ending is always allowed once the front exists. Open nodes become `ended_early` gaps and the review screen shows them as one row of empty tiles (the existing `MissingShots`), each one tap to fill.
- The tree's state (open nodes, gaps and reasons, counters, locked exposure, template) is saved with the draft. Reopening the draft's camera starts at the first `could_not_get` or `ended_early` gap, with `end.resume`. `not_present` is never asked again.
- A resumed session takes new white-balance and exposure locks, and the manifest marks its frames `session: 2`, so studio knows the light may differ.

## 9. Video storage (item 6)

### 9.1 Sizes

Apple's figures for HEVC ("High Efficiency") recording: about 60 MB a minute at 1080p30 and 170 MB a minute at 4K30 (*asserted*: Apple's Camera settings screen, from memory; the same numbers appear in a third-party table opened today). Our recording is written by `AVAssetWriter` from ARKit's frames, so the bitrate is ours to set; these are the right order of size for the same picture quality (*inferred*).

| Piece, per item (75 s session) | Size | Basis |
|---|---|---|
| Full video, 1080p-class | 75 MB | 60 MB a minute |
| Full video, 4K | 212 MB | 170 MB a minute |
| Small copy: 960 × 720 HEVC at 1.5 Mbit/s with mono sound | 15 MB | 1.6 Mbit/s for 75 s (*inferred*) |
| Originals: about 8 stills at 12 MP HEIC | 20 MB | about 2.5 MB each (*asserted*, memory) |
| Sheet copies, 2048 px JPEG, and the contact sheet | 5 MB | about 0.6 MB each (*inferred*; Ben's 1080 px files are 0.4 to 0.6 MB, *observed*) |
| Tick frames and crops: about 90 ticks | 9 MB | about 0.1 MB a tick for both images (*inferred*) |
| Tick log rows | under 0.1 MB | text |

A 60 second session is four fifths of these numbers and a 90 second one is six fifths.

### 9.2 Prices

| Store | Per GB a month | Reading it back out | Mark |
|---|---|---|---|
| Cloudflare R2 | $0.015 | Free | *observed* on egresscost.com, which cites Cloudflare's page, September 2026 |
| AWS S3 Standard | $0.023 | $0.09 per GB after 100 GB free a month | *observed*, same page; AWS's own page not opened |
| Databricks Unity Catalog volume | Not published on the default storage page (*observed*). A volume on our own bucket costs what the bucket costs (*inferred*); S3's price is used as the stand-in | Reads from Databricks jobs in the same cloud region are not egress (*inferred*) | |

### 9.3 Options, per 1,000 items

| Option | What is kept | GB | S3-class, $ a month | R2, $ a month |
|---|---|---|---|---|
| A. Everything, 4K | Full 4K video, stills, sheet, ticks | 246 | 5.66 | 3.69 |
| B. Everything, 1080p | Full video, stills, sheet, ticks | 109 | 2.51 | 1.64 |
| C. **Tiered, first 30 days** | Small copy, stills, sheet, ticks | 49 | 1.13 | 0.74 |
| C. **Tiered, after 30 days** | Stills, sheet, ticks | 34 | 0.78 | 0.51 |
| D. Stills only | Originals and sheet | 25 | 0.58 | 0.38 |

These are for the items listed in one month; each further month of items adds the same again for as long as they are kept. Sending the small copy to a viewer costs about a tenth of a cent on S3 and nothing on R2.

**What this says.** Even option A is under $6 a month per thousand items. Money does not decide this. Two other things do:
- **Upload.** 212 MB over a 10 Mbit/s uplink is nearly 3 minutes; the 15 MB copy is 12 seconds (*inferred*). A seller should not wait on a video.
- **Privacy.** The video has the seller's room and voice in it. The stills don't.

### 9.4 The plan

| Thing | Where | Kept for | Why it is kept |
|---|---|---|---|
| Full-size video | On the phone only. Never uploaded | Until the item sheet is picked and the after-pass has run, then 24 hours, then deleted | Full-size frames for the item sheet are cut from it on the phone (6.5) |
| Small copy (720p, 1.5 Mbit/s, sound) | Made on the phone after the session with `AVAssetExportSession` or VideoToolbox; uploaded on wifi in the background | 30 days, then deleted. Clips marked as test clips are kept | The after-pass video model reads this copy (video models sample about a frame a second at low resolution anyway, *asserted*, memory). Also the replay harness |
| Tick frames, crops and the tick log | Uploaded during the session by the relay | As long as the item | They are the "why?" trail and the labels for thresholds. They are what the model saw |
| Originals and sheet | Uploaded as taken | As long as the listing, then by the account's rule | The listing and the evidence |
| The transcript and heard facts | Text | As long as the item | The sound itself goes with the small copy |

Each object carries `tier` and `delete_after` in its row, and one scheduled Databricks job deletes what is due and logs it. On the phone, a clean-up runs at app start.

**For the demo:** keep everything, 4K included. Three items are about 0.7 GB. The tiers, the `delete_after` fields and the job are still built and shown in the "why?" panel ("video: on this phone only, deleted tomorrow"), so the story told on stage is the true one. Backup if the on-phone export is slow: upload the full file on wifi for the demo and say so.

## 10. Data contract, and how to prove it

### 10.1 Fields added or changed

| Primitive.field | Value | Source | Confidence |
|---|---|---|---|
| Item.capture_session.template | Garment template id and version | tree | Decisions category probability |
| Item.capture_session.exposure_lock | White-balance gains, exposure, when locked | device (`measured`) | n/a |
| Item.item_sheet | Ordered frame ids by role, contact sheet path | picker | per frame: the score parts, not one number |
| Photo.quality | Blur variance, clipped share, aesthetics score, text height px, ISO, exposure time | device (`measured`) | raw |
| Photo.editable | Boolean by role | rule | n/a |
| Photo.crop_of | For a tick crop: the parent frame and box | device | n/a |
| Item.measurements[].preview | Phone's live value and end points | device (`estimated`) | spread over the last 5 frames |
| Item.measurements[].tape | Tape reading, photo, agreement | seller's tape (`you_said`), read by OCR and checked by Decisions | choice probability; `agreed` flag |
| Item.gaps[].reason | `not_present`, `seller_skipped`, `could_not_get`, `offline`, `ended_early`; tries, last question, last line | runner | n/a |
| Item.lines[] | Each line spoken: key, variant, clip id, cause (question and probability, or gate), cut at word, what happened next | runner | n/a; the outcome is the label |
| Object.tier, Object.delete_after | Storage tier and date | rule | n/a |

### 10.2 Proof before the demo

| What | How | Target (start) |
|---|---|---|
| Lever ranking | Section 5.4 on the 19 photos, then 20 real pairs | Charts and a threshold table exist; each gate cites its row |
| Text size rule | Tag crops at 8, 12, 16, 24 px letter height against the readable score and OCR | The 16 px rule holds or is moved |
| Lines fix the view | On the 10 recorded clips from the earlier note: after each correction, did the failing question pass within 8 s | 8 in 10 lines |
| Lines are cut in time | Count lines that kept playing more than 1 s after their question passed | None |
| Rhythm | Time from a good view to accept while a line is playing, against silence | No slower |
| Captions | Word timing error against the audio on 20 clips, by ear and waveform | Under 100 ms |
| Tone | Ben listens to the tee library in the three voices | He picks one; any line he winces at is rewritten |
| Framing match | For 5 new items shot in talk mode: outline IoU and axis angle on the whole views, and Ben's by-eye "would I post this" | IoU 0.75 or more on 9 in 10 whole views; the IoU pass mark fitted on 8 garments first |
| Item sheet | Studio renders level 1 from 4, 6 and 8 references on the three real items; gate scores compared | Tells studio which count to use |
| Frame picker | Picker's choice against a person's choice from the same 6 candidates | Same or "as good" on 8 in 10 roles |
| Live measure preview | Phone's preview against the backend's value against a tape, 5 garments | Preview within 1 inch of the backend; lines appear within 2 s of lying flat |
| Tape reading | Ben's two tape photos plus 10 new ones | Within a quarter inch on 10 of 12 |
| Skips | Scripted session: skip by voice, by button, by timeout, end early, resume | Every gap has the right reason; resume starts at the right node |
| Storage | One session measured for every row of 9.1; deletion job run with a 1 minute window | Sizes within 30% of the table; nothing left behind |

First-hour checks, added to the earlier note's three: does a Decisions request accept `detail` and two images; does `eleven_v4` return alignment; can ARKit's capture device be locked for exposure and white balance while the session runs.

## 11. Decisions for Ben

Taste, scope and direction only. Choices I made myself: two images per tick for text; no enlarging; `eleven_v4` rendered ahead with word timings; the caption limits; the frame picker; the manifest; the tiering mechanics.

1. **How much does the voice say?** (taste; this reopens Decision 1 of the earlier note, where "sparse" was recommended, because your newer words point the other way)
   - A. Full friendly sentences for every ask and every correction, and a short word of praise on every accept. **Recommended**: it is what you described, and the cut-off rule keeps it from dragging.
   - B. Full sentences for asks and corrections; on accept only the shutter sound. Quieter; loses "praises when you get it right".
   - C. A and also small talk between shots ("this is a nice one"). Warmest; most to write, and the likeliest to grate on the tenth item.
2. **Whose voice is it?** (taste; picked by ear, so I'll render the tee library three ways)
   - A. Warm and unhurried, mid-twenties, sounds like a friend who sells on Depop. **Recommended**.
   - B. Brighter and quicker, more "app". Reads as efficient; less like a person.
   - C. Low and calm. Easy to listen to for a long session; can sound flat on a stage.
3. **Tape and coin shots: part of the flow?** (scope)
   - A. Offered, never required: after the camera measures, "got a tape handy?", and a coin beside the tag if they want. **Recommended**: your listings use both, and the tape doubles as a check on our numbers.
   - B. Left out; the camera's lines drawn on the photo are the only measurement picture. Simpler; drops a photo buyers know how to read.
   - C. Asked for on every item. Most checked; slower, and many sellers have no tape.
4. **Square or 3:4 in the viewfinder?** (taste, and studio's crops depend on it)
   - A. 3:4 with the square marked and the item inside it. **Recommended**: your square look for Depop and a clean 3:4 for Poshmark from one photo.
   - B. Square only, exactly like your photos. Purest match; Poshmark's cover gets padded or cropped tight.
5. **How firmly does it ask you to line up with the outline?** (taste; your own covers sit a few degrees off straight)
   - A. Firm on the two whole views (front and back), with a looser pass after 6 seconds; details and close-ups free. **Recommended**: the cover is what studio flattens in place, so it has to be laid right, and nothing else needs to be.
   - B. Loose everywhere: whole, flat and roughly centred is enough. Fastest and closest to how you shoot now; studio's touch-up starts from a crooked garment.
   - C. Firm on every shot that has an outline. Most uniform shop; slowest, and the likeliest to feel fussy.
6. **How long is the session video kept?** (scope, privacy)
   - A. Full video stays on the phone and is deleted the next day; a small copy is kept 30 days; photos are kept. **Recommended**.
   - B. Keep everything. Best for improving the trees; the seller's room and voice sit in storage.
   - C. Keep photos only; no video leaves the phone, and the after-pass runs on the tick frames. Most private; the after-pass sees much less.

## 12. What this changes in decision-tree-capture.md

That file is not edited. These are the places it now reads differently:

| Section there | Change |
|---|---|
| 1, "The answer in short" | "one spoken correction ('Closer.', 'More light?')" becomes full sentences with captions (4.2 to 4.6 here). The tick sends two images when text is in question (5.3) |
| 4.1, type `Corrective` and `Node` | `pill` is replaced by the caption (the line's own text). `Node` gains `skippable: true`, `required: boolean` (true only for the whole front), and an optional nested `measure` accept rule. `maxCorrections: 3` stays; `timeoutS` goes from 20 to 30 |
| 4.1, the loop, steps 1 and 3 | Whole frame at 512 px, plus a native-pixel crop for text and mark questions. `detail` is not relied on. Sharpest of the last 5 frames is sent |
| 4.1, "When it speaks" | Replaced by the rhythm table in 4.2: no 4 s rule, praise on every accept, lines up to about 7 s, cut when no longer true, recognition stays on during a line. "Barge-in is not needed: clips are under 1.5 s" no longer holds |
| 4.2, sub-tree table | `whole_flat` gains the measure step and the optional tape nodes; new nodes `detail_upper`, `detail_lower`, `hems`, `waistband` |
| 4.2 and 6, flat front and back | An outline-alignment test (mask overlap, straightness, size and place) and layout questions join the accept rule; the outline is studio's template |
| 5, the tee question set | Score levels use `label`, not `value`, per the Decisions guide. Tag text questions take the crop in `instructions`. New questions listed in 6.3, 7.1 and 7.3 |
| 5, the tag policy table | The action column's short lines are replaced by the library keys in 4.6; a new row for "closer than the lens can focus" |
| 6, the "Corrective line" column | Every entry maps to a key in 4.6 |
| 7, "Voice out" and "Prompt library rules" | `eleven_v4` and `eleven_v4_turbo` in place of v3 and Flash v2.5; lines rendered ahead, not streamed at speak time; "at most 5 words, at most 1.5 s", "three variants" and "a pill of 4 words or fewer" are withdrawn in favour of 4.2, two variants, and captions. OpenAI's TTS is also out because it is being shut down |
| 8, edge cases | "Seller ignores a prompt": about 38 s per node at worst, not 28. "Dark room" and "Glare" use the new lines and the ISO and clipping measures. New rows: closer than focus, lens choice, resume |
| 9, components and data contract | `CaptionLine` is the main element; `LiveHintPill` leaves talk mode. `Item.gaps[].reason` values renamed and extended (8.2). New fields in 10.1. Storage tiers added to the stack table |
| 11, stage script | Every clip in quotes becomes its library line; the measure lines draw at step 1; a skip is shown once |
| 12, Decisions 1 and 6 | Decision 1 is reopened as Decision 1 here. Decision 6's "20 s" becomes 30 s |
| 13, Limits | The unknown "whether `detail: "low"` keeps tag text readable" is answered by arithmetic: it does not (5.3) |

Also touched, for the owning threads to pick up: the capture [build plan](build-plan.md) step 1 (the tag gate adds text height and minimum focus distance; exposure lock after the first whole view); the measure plan step 0 (a wider distance band for pants; the tape cross-check; the live preview); the studio plan 4.1 (the item sheet and manifest as its input, and `outline_fit` per whole view).

## 13. Limits

- **Not measured.** No Decisions call, no TTS render and no phone test was run today. Every threshold, the 16 px rule, the timing budgets, the on-phone width profile speed and the file sizes marked *inferred* are start values. Section 5.4 and 10.2 are how they get replaced.
- **The lever ranking rests on open models.** VLM-RobustBench tested Qwen, InternVL, Molmo and Gemma on general question sets, not `gpt-6-luna` on garment questions, and it did not test glare. I read it through a summarising fetch, not line by line.
- **`gpt-6-luna`'s image sizing is not documented.** The sizing table lists `gpt-5.6-luna`. The Decisions guide does not mention `detail`. The 512 px assumption is carried over from the 5.6 row.
- **Hume Octave was not read** (the fetches returned a different Hume product). ElevenLabs' pages do not say whether `eleven_v4` supports timestamps. Coval's numbers are a vendor-neutral board's, quoted from its article, not re-run. Artificial Analysis and Voice Arena rankings are second-hand through that article.
- **From memory, marked *asserted*:** Apple's per-minute recording sizes (the settings screen itself was not opened; a third-party table agreed); ARKit using only the wide camera; `configurableCaptureDeviceForPrimaryCamera`, the 4K video format and frame EXIF in ARKit; main-camera minimum focus distances; `isUtility` and the aesthetics score range; Vision feature prints; ElevenLabs forced alignment; HEIC still sizes; how video models sample frames.
- **Storage prices** for R2 and S3 come from one secondary page that cites the vendors (September 2026). AWS's and Cloudflare's own pages were not opened. Databricks publishes no per-GB figure on the page I read.
- **Framing numbers are by eye** from 1080 px files, to within a few percent. A script's colour-distance mask was too rough on textured concrete to use; only its brightness and clipping numbers are quoted. The files are already square crops, so I can't see how Ben framed in the camera before cropping, or whether the pants were shot sideways or turned afterwards.
- **MultiBanana's finding** (more references, lower scores) is on scenes with several subjects. Whether it holds for one garment seen from several views is studio's to test; 10.2 has the test.
- **Studio's templates and `refset.py` were not opened.** Neither `/home/user/secondhand/research/studio/ben/templates/` nor `/mnt/project-files/secondhand/research/studio/ben/templates/` exists in this session, so section 6 is written against the coordinator's description: 3:4 frame of 1200 x 1600, item inside the centred square, an item box, and the shot list. Field names in `templates.json` are not known to me; the alignment test needs only a silhouette and a box. Studio's re-lay finding is relayed, not seen.
- **Not searched:** open-source guided-capture apps for clothing, academic work on voice-coaching timing, caption research beyond the Netflix guide, Seedance 2.5's own reference documentation (the guides read were for Seedance 2.0 and Seedream 5.0 Pro), FLUX Kontext and IP-Adapter reference practice (covered only by LTX's count table). A narrow search does not show that nothing better exists.
- **The line library** was written by an agent and checked by lint and a length script (results at the end of this section), not yet heard aloud. Lines that read well can still sound wrong; Decision 2's listening pass is the real test.

Checks run on section 4.6 (*observed*): every sentence is 84 characters or fewer and every line 22 words or fewer by script; `lint.py --surface product` and `scripts/copy-lint.mjs` flag nothing on the 156 lines.
