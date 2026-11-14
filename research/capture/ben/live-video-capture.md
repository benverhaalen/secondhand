# How do we build a live video capture mode where the model watches, talks, asks for better views and remembers what the seller says?
Researched 2026-11-14 by Ben (Claude Code). Feature: capture.

Extends [build-plan.md](build-plan.md) (the guided shot list) and joins [seeing-the-item-pipeline.md](../../cross-cutting/ben/seeing-the-item-pipeline.md). The app is the Expo app with a Swift camera module ([decision](../../../product/decisions.md#2026-11-14-the-app-is-an-expo-app-with-a-native-swift-camera-module)). Everything proposed here is an *agent proposal*. Per Ben's standing rules ([demo, not production](../../../product/words.md#2026-11-14-demo-not-production), [paid APIs are fine](../../../product/words.md#2026-11-14-paid-apis-are-fine)) nothing is cut for cost, terms or polish; a risk is listed only when it could break the demo on stage, with a backup path.

## 1. The question and Ben's goal

Ben, project chat, 2026-11-14 21:22 UTC (to be appended to [words.md](../../../product/words.md) by the parent session; this note writes one file only):

> another feature to think about - rather than having in the camera part of listing something only the camera thing you could have an interactive video where you can then talk to the model about the product and it videos it and then from those videos the model could like talk to you 'can i get a better look at the graphic there' 'is there any way you could get better lighting' like in real time it gives super easy hints to the person about how to get it better context on an item and it can listen to what the user is saying and they can talk about say a defect or something and it remembers it and effectively compiles it in creating listings.

The question: which realtime model, how it runs inside an app whose camera is already owned by ARKit, what the model is allowed to do, how its output becomes the same Item the guided shot list produces, and what happens when the room, the wifi or the model misbehaves.

Problem type ([thinking.md](../../../.agents/thinking.md)): **Seeing the item**. Every field keeps its source (*measured*, *estimated*, *you said*) and a confidence, and the proof is a scripted run on real items with an error per field.

**The answer in short.** The live session is a director, not the recorder. The Swift module keeps doing what it does today: ARKit session, full-resolution stills, live gates. On top, it streams one small frame per second plus the microphone to **Gemini 3.8 Live** over a WebSocket and plays the model's voice back. The model never produces photos or listing text. It calls six tools (`take_still`, `request_view`, `note_flaw`, `note_fact`, `mark_done`, `finish`) against the same shot-list state the guided mode uses. The app, not the model, is the clock that makes it speak up. After `finish()` the recorded video goes through a strong video model to catch what live missed, and the person approves a "Heard / Saw" review screen before anything reaches the item card.

## 2. Seeded research log

Method: RDD with IAE and looped seeded research. Four loops; each changed a decision. Draft answer from memory before searching: "OpenAI Realtime over WebRTC, model speaks when it sees something". Both halves changed.

### Loop 1: which realtime model takes live video, talks, and calls tools mid-conversation?

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| Gemini Live capabilities guide (ai.google.dev/gemini-api/docs/live-api/capabilities) | Primary docs | Models: `gemini-3.8-live` ("Default option for most low-latency voice agent experiences"), `gemini-3.8-live-extended-thinking`, legacy `gemini-3.1-flash-live-preview`. "Video frames are sent as individual images (e.g., JPEG or PNG) at a specific frame rate (max 1 frame per second)." Input audio 16-bit PCM 16 kHz, output 24 kHz. Automatic VAD with barge-in: "the ongoing generation is canceled and discarded". Input and output transcription, with a `custom_vocabulary` of up to 1,000 terms. `mediaResolution` sets tokens per frame. Context 128k for native audio models. *observed* | Video is a first-class stream here. 1 fps is the ceiling, which is enough for a director and far too little for a recorder. Brand names go into `custom_vocabulary`. |
| Gemini 3.8 Live model page (last updated 2026-10-29) | Primary docs | Stable. Inputs text, images, audio; outputs text, audio. 131,072 tokens in. Function calling is `NON_BLOCKING` by default, with scheduling `SILENT`, `WHEN_IDLE`, `INTERRUPT`. "Proactive audio is permanently enabled." Affective dialog removed. Turn coverage defaults to `TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO`. `thinkingLevel` must be omitted. *observed* | The model can keep talking while a tool runs, and a tool result can be delivered silently. No affective-dialog switch to plan for. |
| Gemini Live session management guide | Primary docs | "Without compression, audio-only sessions are limited to 15 minutes, and audio-video sessions are limited to 2 minutes." Connection lifetime "around 10 minutes". Context window compression (`slidingWindow`) can "extend sessions to an unlimited amount of time". Session resumption handles valid 2 hours. A `GoAway` message carries `timeLeft`. *observed* | The 2-minute video limit is the main design constraint. See loop 2 for why we don't simply switch compression on. |
| Google blog, Gemini 3.8 Live launch (2026-09-15) | Primary announcement | "processes visual inputs in near real-time"; runs tools in the background while it keeps talking; 97 languages; no latency numbers published. Platforms named: LiveKit, Pipecat, Vision Agents, Agora. *observed* (quality rankings *asserted* by Google) | No published latency: measure on day one. |
| OpenAI "Introducing gpt-realtime" (2025-08-28) | Primary announcement | Image input exists, but: "Instead of treating an image like a live video stream ... the system treats it more like adding a picture into the conversation." Sent as `conversation.item.create` with an `input_image` part (base64 data URI). Async function calls native. *observed* | OpenAI Realtime has no video stream. The app chooses which stills to show it. Workable for a director, but less natural for "watching". |
| OpenAI developer notes on the Realtime API (2025-09-12) and the Realtime conversations guide (opened today) | Primary docs | Guide examples use `gpt-realtime-2.1`; "The maximum duration of a Realtime session is **60 minutes**"; `semantic_vad`; WebRTC, WebSocket and SIP; sideband connections; "the Realtime API allows clients to continue a session while a function call is pending"; `idle_timeout_ms` can make the model speak after silence. *observed* | OpenAI's strengths are session length and an idle prompt. It becomes the backup. |
| OpenAI "Advancing voice intelligence" (page dated 2026-05-07) and a dev.to explainer (metadata 2026-11-12) | Primary plus secondary | GPT-Realtime-2: reasoning effort minimal to xhigh, parallel tool calls, spoken preambles, context 32k to 128k. The dev.to post says it shipped 2026-11-06 and "image input ... new for this model"; that conflicts with OpenAI's own page date and with the 2025 image launch. *observed* (OpenAI page), *asserted* (dev.to) | Use the ID the official guide uses today, `gpt-realtime-2.1`. The dev.to dates are not trusted. |
| LiveKit xAI plugin page | Primary integration doc | Grok voice model `grok-voice-think-fast-1.0`; the page describes voice only and says nothing of image or video input. *observed* | xAI is out for this job unless its own docs say otherwise (not opened). |

Frontier after loop 1:
- Changed: Gemini 3.8 Live is the only one of the three with a real video stream; OpenAI is picture-by-picture; xAI is voice only as far as I could see.
- New lead: does the model actually speak up on a visual change, with nobody talking?
- Next action: practitioner threads and framework READMEs on proactivity and on what breaks. Bound: 6 sources.
- Contrary/neglected lead: OpenAI's "pictures, not a stream" may be the better fit, because the app already knows which frames matter (gates, coverage). Kept: it is the backup's design.
- Unresolved: latency; the 2-minute limit in practice.

### Loop 2: proactivity, and what breaks in practice

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| Google AI forum, "During live stream, the model can only be initiated with text or voice" (2024-12-30, reply 2025-07-21) | Failure trace | Screen share with an instruction to speak up on a behaviour: "it seems Gemini was not able to *proactively* speaks back, unless I ask it explicitly via voice or text." A reply: "It only reacts when you actually say or type something." *observed* (old models) | Video alone did not trigger speech. |
| Stream Vision Agents README (Apache-2.0, PyPI `vision-agents` 0.6.9) | Inspectable framework | Supports OpenAI Realtime and Gemini Live; video processors (YOLO, Roboflow) run beside the model; and it states: "Real-time models require audio/text to trigger responses". A text back-channel sends silent messages to the agent. *observed* | A second, independent source for the same limit, and the standard fix: send text to trigger a turn. |
| LiveKit community, "Building a Real-Time Vision Agent (Continuous Feedback)" (2026-06-01) | Practitioner discussion | The Gemini vision recipe "alone doesnt give realtime feedback"; a reply says `proactivity=True` "is what gives you agent-initiated speech on visual changes"; default prompts "tend to over-talk for guidance UX"; suggestion to send only changed frames. *observed* (the thread), *asserted* (the proactivity claim; nobody showed it working) | Conflicting evidence on proactivity, on a 2.5 model. Don't build on it. Do write the prompt to say little. |
| LiveKit Agents video docs and Gemini vision recipe (`livekit-agents` 1.8.12 on PyPI) | Primary framework docs | Live video only with Gemini Live or the OpenAI plugin, Python only. Default sampling: 1 fps while the user speaks, 1 frame per 3 s otherwise, 1024x1024 JPEG. "Video is passive and has no effect on turn detection. Agents can use manual turn control to trigger responses on a timer." *observed* | The framework that ships this says it plainly: use a timer. |
| Google blog, "Guided Vision in Gemini Live" (2026-10-01) | Shipped product from the model's maker | In a Live camera session Gemini gives "proactive verbal cues": if the camera is "pointed too high, too close, or slightly off to the side" it asks the user to "pan slowly to the right", "tilt downward" or "step back" to get "the clear visual context needed". "can make mistakes." *observed* | Proof the exact behaviour Ben describes ships on this model family, within a conversation. It is our interaction reference. |
| Google AI forum, "Hard-Won Patterns for Building Voice Apps with Gemini Live (March 2026)" | Failure trace with counts over 40+ runs | "Any sendClientContent with turnComplete: true while the model is speaking interrupts it." Buffer context until the turn and the audio playback both end. `SILENT` scheduling "is silently stripped by the Vertex protobuf". Rates on that author's app: malformed function call in about 30% of sessions, duplicate tool calls about 20%, the model narrating a tool call about 40% without client-side audio gating, the model answering for the user about 50%. An echo gate ("block audio during agent speech") was the stable fix for echo. *observed* (the post); rates are *asserted* by its author, on models before 3.8 | Four design rules: only inject text when the model is silent; use the Gemini Developer API, not Vertex; dedupe and validate every tool call on the device; never depend on a tool call alone for a fact. |
| Google AI forum, audio+video sessions die with 1011 at about 2 minutes (2026-07-18, staff replies 07-28 and 07-31) | Failure trace with staff confirmation | `gemini-3.1-flash-live-preview`, 1 fps JPEG at 640 to 768 px with compression on: sessions closed at 90 to 120 s; resumed sessions died within 0.5 s. Staff: "This issue is being investigated internally", "disabling compression" is a workaround, a partial fix "soon". Not stated for 3.8. A separate thread title reports 3.8 sessions closing at exactly 58:00. *observed* | Don't bet the demo on compression. Design each item's live session to finish inside 2 minutes, and cycle sessions if it runs long. |

Frontier after loop 2:
- Changed: **the app is the clock.** The model is given a turn by short text "ticks" built from on-device state; it may answer aloud or stay quiet. Tool calls are fire-and-forget where possible, deduped and validated. One live session per item, under 2 minutes, no compression by default.
- New lead: how audio, ARKit and a WebSocket live together in the Swift module.
- Next action: Apple docs and forums on ARKit audio, voice processing and haptics; npm versions; ephemeral tokens. Bound: primary docs plus two failure threads.
- Contrary/neglected lead: **skip the realtime model for the hints.** A fast vision model looks at one frame every 2 s and returns a structured "what is missing from this view"; a normal speech-to-text plus text model plus text-to-speech chain talks. Fully deterministic turn-taking. Evaluated in section 4, step 9: it is the second backup, and its watcher half is folded into the main design.
- Unresolved: whether 3.8 Live speaks on a tick reliably and stays quiet when told to. Day-one test.

### Loop 3: running it inside the Expo app that already owns the camera

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| Gemini ephemeral tokens guide | Primary docs | Preview, Live API only, `v1beta`. Defaults: 1 minute to start a session, 30 minutes to send messages, 1 use. Passed as an `access_token` query parameter or `Authorization: Token`. `liveConnectConstraints` can lock the model and config "so system instructions stay on the server". *observed* | The phone connects straight to Gemini with a token the Databricks App mints. No relay server in the audio path. |
| Apple docs, `ARConfiguration.providesAudioData` | Primary docs | "A Boolean value that specifies whether to capture audio during the AR session." *observed*. Default off (*asserted*, from memory) | ARKit leaves the microphone alone unless asked. We leave it off and own the mic ourselves, so there is no fight over the audio session. |
| Apple forum thread 672371 (2021) | Failure trace with an explanation | Haptics stop while audio is being captured; the fix is `AVAudioSession.setAllowHapticsAndSystemSoundsDuringRecording(true)`, which can't be applied to ARKit's internal capture session. *observed* | Because we own the audio session, we can set that flag and keep the shutter haptic. (*inferred*; test in hour 1.) |
| Apple forum thread 829771 (2026-06-09) | Failure trace | `.playAndRecord`, mode `.voiceChat`, `setVoiceProcessingEnabled(true)`: echo cancellation "mostly works", but "the initial few hundred milliseconds of the greeting are being captured by the `inputNode`". Their workaround: stop capture while playing. The accepted answer sits in a duplicate thread I did not open. *observed* | Mute the uplink for the first 400 ms of every model utterance. Keep a full half-duplex gate as the stage fallback. |
| `@livekit/react-native` README and npm | Primary package docs | `@livekit/react-native` 3.1.0, `@livekit/react-native-webrtc` 150.1.1, `@livekit/react-native-expo-plugin` 1.1.0 (all Oct 2026); dev builds only, not Expo Go; `AudioSession.configureAudio`; no mention of custom video sources in the README. `react-native-webrtc` 155.0.1. *observed* | WebRTC in React Native expects to open the camera itself. Our frames already exist in Swift as `ARFrame.capturedImage`. Feeding them into a WebRTC track is extra native work with no gain at 1 fps. |
| OpenAI community thread on realtime image input (2025-09-01) | Failure trace | "my WebRTC channel is unable to send the full base64-sized image properly"; the working example was over a WebSocket. *observed* | For the OpenAI backup, use a WebSocket too (or a sideband connection), not the WebRTC data channel, for images. |
| npm and PyPI today | Registry | `expo` 58.0.25, `@google/genai` 3.3.0, `google-genai` 3.3.0, `@json-render/react-native` 0.22.0, `pipecat-ai` 1.16.0. *observed* | Versions for section 4. |

Frontier after loop 3:
- Changed: **no WebRTC and no media server.** One Swift class opens a WebSocket from the phone to Gemini, sends PCM and JPEG frames, and plays PCM back through a voice-processing audio engine. React Native only renders the pill, captions and review screens.
- New lead: what shipped products teach about the review step and about doing it after the fact.
- Next action: reseller and live-selling apps that list from video or voice; assistive camera products. Bound: 5 products.
- Contrary/neglected lead: put everything in a LiveKit room (WebRTC copes with bad wifi better than a raw WebSocket, and brings echo cancellation). Kept as the backup transport if the Swift audio path is not solid by hour 4.
- Unresolved: writing the video file from ARKit frames while everything else runs (believed fine; *asserted* from memory).

### Loop 4: who already lists from video or voice, and the post-hoc counter-design

| Seed | Quality cue | What inspection showed | What it changed |
|---|---|---|---|
| Tilt "Snap" launch post (2026-04-27) | Shipped product, the closest match | "automatically creates product listings from live video in under one second ... By watching and listening to streams in real time"; fills title, description, category, price; scope is trading cards; a 47% sales lift in early tests. No review or edit step is described. *observed* (the post), *asserted* (its numbers) | Watch-and-listen-to-list ships in live selling. It is one-way: the seller talks, the model never asks. Ben's idea adds the asking. We also add the review step Tilt doesn't describe. |
| Hero Stuff, App Store page (2026) | Shipped reseller app | "Record video or use audio to describe items"; listings created "from your voice"; 4.7 from 1.8K ratings. *observed* | The post-hoc version of this idea already sells. It is our fallback and our complement, not our headline. |
| AppleVis thread on Be My Eyes live video (2025-04) | Practitioner and user discussion | The live feature demoed with OpenAI was still unreleased a year on; a user describes ChatGPT's live mode as "takes a pic, answers questions, waits for another"; another: "the image descriptions contain so many factual errors". *observed* | Two lessons: live video descriptions state wrong things with confidence, so nothing the model "saw" becomes a flaw without a yes; and a famous live demo slipped a year, so rehearse the fallback. |
| CCC First Look (already in [build-plan.md](build-plan.md)) | Shipped insurance flow | Fixed photos first, then an optional 20 s video. *observed* there | Video as an optional extra after stills is the established order. We invert it only for people who choose to talk. |

Final frontier:
- Changed: a mandatory review screen; a post-hoc video pass that runs every time; transcript fact extraction as a second net under `note_fact`.
- Contrary lead kept: post-hoc only (record, then process). Honest evaluation in step 8.
- Open, for day one: Gemini 3.8 Live latency and tick behaviour; the 2-minute limit with and without compression; echo on the demo phone at stage volume; tool-call error rates on 3.8.

## 3. What exists

| Reference | Job | What we take | What we change | Evidence |
|---|---|---|---|---|
| Gemini Live "Guided Vision" (Oct 2026) | Interaction | Short spoken reframing cues, given only when the view is not good enough to answer | Ours works from a shot list and takes the still itself when the view is good | observed (Google blog) |
| Gemini 3.8 Live API | Mechanism | 1 fps video in, native audio both ways, barge-in, non-blocking tools, transcripts | The app supplies the ticks; sessions are per item | observed (docs) |
| OpenAI Realtime, `gpt-realtime-2.1` | Mechanism (backup) | 60-minute sessions, pictures as conversation items, semantic VAD, idle prompt | The app picks which frame to show: one on each tick | observed (docs) |
| ChatGPT voice with video | Interaction, failure evidence | People already know "hold it up and talk" | A user reports it behaves as picture-by-picture; we do the same on purpose and say what we need | asserted (AppleVis user); help page not reached |
| Be My Eyes / Be My AI | Failure evidence | Wrong descriptions are common enough that users distrust them | Model-seen flaws are proposals with a yes or no | observed (user thread); the product itself not opened |
| Tilt Snap | Interaction, evidence it sells | Listing fields from watching and listening, no typing | Two-way; any category; human review | observed |
| Hero Stuff | Mechanism (post-hoc) | Record a video or speak, get a listing | Used as fallback and as the after-pass | observed (store page) |
| LiveKit Agents, Pipecat, Vision Agents | Mechanism, failure evidence | Timer-driven turns; text back-channel; frame sampling 1 fps talking, 1 per 3 s idle | Not used in the main path (no server in the middle); LiveKit is the backup transport | observed (LiveKit, Vision Agents); Pipecat docs not opened |
| Onfido glare study (in [build-plan.md](build-plan.md)) | Interaction evidence | One short text instruction beats overlays | The same instruction is also spoken | observed there |
| CCC First Look, Hover, Tractable, Snapsheet | Structure (distant analogy) | Stills first, video as context | Video and voice drive the stills | CCC observed in the earlier note; Hover page failed to load; Tractable and Snapsheet not opened |
| Apple Visual Intelligence, Ray-Ban Meta live AI, Project Astra, telehealth "show me" flows, Whatnot | Weak preference signals | Camera-plus-voice is becoming a known pattern | none | asserted from memory; not opened today. The Whatnot search found no voice-to-listing feature, which does not show there is none |

## 4. The build plan

Three layers answer "who notices what", because no single one is reliable alone:

| Layer | Notices | Speed | Where |
|---|---|---|---|
| Device gates (already built for guided mode) | too dark, blurry, too close, moving, no item in view | 5 Hz, no network | Swift, Vision on ARKit frames |
| Live model | what the seller said; which part of the item it wants to see; small talk | about 1 s (unmeasured) | Gemini 3.8 Live |
| After-pass | anything in the full video or transcript that live missed | 20 to 60 s after `finish()` (unmeasured) | backend |

### Step 1. Session start (device, then backend for a token)
- Stack: the existing `CaptureKit` Swift module (Expo Modules API, `expo` 58.0.25). New class `LiveDirector`. The Databricks App mints a Gemini ephemeral token (`v1beta` `auth_tokens`, `uses: 1`, constraints locking model `gemini-3.8-live`, the system prompt and the tools), so the prompt never ships in the app.
- `LiveDirector` opens `URLSessionWebSocketTask` to the Live endpoint with the token and sends `setup`: `responseModalities: [AUDIO]`, `inputAudioTranscription` with `custom_vocabulary` (brand list from the demo rack), `outputAudioTranscription`, `mediaResolution: MEDIA_RESOLUTION_LOW` to start, `sessionResumption: {}`, tools from step 4, VAD `silenceDurationMs: 700` (docs suggest 500 to 800). No `contextWindowCompression` unless the day-one test passes (step 7).
- Human moment: one mic permission prompt the first time. The screen is the same camera screen as guided mode, with a small voice mark where the instruction line sits.
- Edge: token or socket fails within 2 s: stay in guided mode, no error screen; the voice mark shows as off.

### Step 2. Audio (device)
- `AVAudioSession`: category `.playAndRecord`, mode `.voiceChat`, options `.defaultToSpeaker`, `.allowBluetoothHFP`; `setAllowHapticsAndSystemSoundsDuringRecording(true)` so the shutter haptic survives.
- One `AVAudioEngine` with `setVoiceProcessingEnabled(true)` on the input and output nodes (Apple's echo canceller). Input tap converts to 16 kHz mono PCM16 and sends 40 ms chunks as `realtimeInput.audio`. Model audio (24 kHz PCM) plays through an `AVAudioPlayerNode` on the same engine.
- ARKit keeps `providesAudioData = false`, so it never opens the mic.
- Barge-in: on the server's `interrupted` message, stop and flush the player node at once.
- Echo guard: drop uplink audio for the first 400 ms of each model utterance (the forum trace). Stage fallback: full half-duplex (no uplink while the model speaks), switched from a hidden debug toggle.
- Evidence: session and engine setup is the pattern in Apple forum thread 829771 (*observed* as code in a bug report, not as Apple guidance); ARKit coexisting with our own engine is *inferred*. Prototype in hour 1.

### Step 3. Video: three consumers of one ARKit stream (device)
| Consumer | What it gets | How |
|---|---|---|
| Live model | 1 frame per second, 768 px long side, JPEG q70 (the forum trace used 640 to 768 px, 60 to 150 KB) | every 30th `ARFrame.capturedImage`, downscaled with vImage; skipped when the frame is near-identical to the last one sent and nobody is speaking |
| Stills | full resolution with intrinsics, pose, floor plane, depth | `ARSession.captureHighResolutionFrame`, exactly as guided mode |
| The recording | the whole session as H.264/HEVC with the mic track | `AVAssetWriter` fed with `capturedImage` buffers and the engine's input tap (*asserted* from memory; prototype) |

- A ring buffer keeps the last 10 s of video-resolution frames with timestamps, so a tool call can be tied to the frame that was on screen when the model or the seller spoke (the tool call's arrival time minus measured latency).
- Every frame sent to the model is logged as `frame_ref = t<seconds since start>`.

### Step 4. The tools (the contract between model and app)
Gemini function declarations. All are `NON_BLOCKING`. The device validates arguments, drops a duplicate of the same tool and arguments within 3 s, and answers with the new coverage state. `note_*` results use scheduling `SILENT`; a failed `take_still` uses `WHEN_IDLE`.

```json
[
  {"name": "take_still",
   "description": "Ask the app to take a full-quality photo now because the current view is good for this role. The app takes it when the phone is steady. SILENT EXECUTION.",
   "behavior": "NON_BLOCKING",
   "parameters": {"type": "object", "required": ["role"], "properties": {
     "role": {"type": "string", "enum": ["front","back","tag","care_label","fabric","flaw","side","inside","sole","detail"]},
     "flaw_id": {"type": "string", "description": "Set when role is flaw."}}}},
  {"name": "request_view",
   "description": "Show one short hint on screen. Say the same thing aloud in one short sentence.",
   "behavior": "NON_BLOCKING",
   "parameters": {"type": "object", "required": ["what","hint"], "properties": {
     "what": {"type": "string", "description": "What you need to see, e.g. 'the chest graphic'."},
     "hint": {"type": "string", "description": "On-screen text, 4 words or fewer, e.g. 'Closer on the graphic'."},
     "why": {"type": "string", "enum": ["too_dark","too_far","blurry","hidden","needed_for_listing","check_flaw"]},
     "role": {"type": "string", "description": "Shot-list role this serves, if any."}}}},
  {"name": "note_flaw",
   "description": "Record a flaw you saw or the seller mentioned. Never state a flaw as fact; the seller confirms it later. SILENT EXECUTION.",
   "behavior": "NON_BLOCKING",
   "parameters": {"type": "object", "required": ["description","origin"], "properties": {
     "description": {"type": "string"},
     "label": {"type": "string", "enum": ["stain","hole","tear","pilling","fading","missing_button","broken_zip","scuff","crack","other"]},
     "where": {"type": "string", "description": "Plain words, e.g. 'left cuff'."},
     "severity": {"type": "string", "enum": ["barely_visible","minor","noticeable","major"]},
     "origin": {"type": "string", "enum": ["seller_said","model_saw"]},
     "seen_now": {"type": "boolean", "description": "True if it is in view right now."}}}},
  {"name": "note_fact",
   "description": "Record something the seller said about the item. Use their words. SILENT EXECUTION.",
   "behavior": "NON_BLOCKING",
   "parameters": {"type": "object", "required": ["field","value","quote"], "properties": {
     "field": {"type": "string", "enum": ["brand","size","fit","year_bought","price_paid","times_worn","material","color","model_name","reason_selling","care","included","story","other"]},
     "value": {"type": "string"},
     "quote": {"type": "string", "description": "The seller's words, verbatim."}}}},
  {"name": "mark_done",
   "description": "Mark a shot-list role as covered or skipped.",
   "behavior": "NON_BLOCKING",
   "parameters": {"type": "object", "required": ["role","how"], "properties": {
     "role": {"type": "string"},
     "how": {"type": "string", "enum": ["covered","seller_skipped","not_applicable"]}}}},
  {"name": "finish",
   "description": "End the session when every required role is covered or skipped, or the seller says they are done.",
   "behavior": "NON_BLOCKING",
   "parameters": {"type": "object", "properties": {"reason": {"type": "string", "enum": ["complete","seller_done","time"]}}}}
]
```

The device adds what the model cannot know: `frame_ref`, the transcript timestamp, the still's id, and gate values. `take_still` is a request, not a shutter: the app fires `captureHighResolutionFrame` at the first moment within 1.5 s when the blur and stability gates pass, and replies `{taken: true, photo_id}` or `{taken: false, reason: "moving"}`. The model decides intent; the device decides the instant.

### Step 5. Ticks: how the model speaks up on its own (device)
Evidence says video alone does not reliably trigger speech (loop 2), so the app gives the model a turn:
- A tick is one line of text sent as client content, for example `[state] covered: front. missing: back, tag, fabric. view: steady, dim. flaws: 1 unseen ("hole under left arm"). last hint 9 s ago. seconds left 70.`
- Sent only when all are true: the seller is not speaking (VAD), the model is not speaking and its audio has finished playing, and either 4 s have passed since the last tick or an event happened (still taken, a gate changed state, coverage changed, 8 s with no progress).
- The prompt tells the model that after a tick it may say one short thing, call tools, or produce nothing. Proactive audio (always on in 3.8) is what allows "nothing".
- The watcher (adopted from the contrary lead): every 2 s the backend sends the latest frame to Gemini 3.8 Flash with a JSON schema `{visible_roles[], best_role_now, problem: none|dark|far|blurry|folded|cropped, suggestion}` and the result is folded into the next tick. This makes "what's in view" a typed fact instead of something the live model must infer at low resolution. *inferred* benefit; A/B on day one, drop it if ticks alone do as well.
- Device gates fire their hint pill instantly without the model ("Too dark"); the tick tells the model so it can say it once, kindly, and not repeat it.

### Step 6. System prompt outline (kept on the server, locked into the token)
1. Role: you help someone photograph one secondhand item to sell. You direct; the app takes the photos.
2. Voice: one short sentence at a time, plain words, never more than about 8 words unless asked a question. English only. Never describe the item back to the seller. Never state a price.
3. Order of work: let the seller talk first. When they pause, ask for the next missing view from the tick's `missing` list, most valuable first (front, tag, back, then the rest).
4. Tools: when the view is good for a role, call `take_still` and say nothing. When you need a different view, call `request_view` and say the hint. Everything the seller says about the item goes to `note_fact` with their words. Any flaw, said or seen, goes to `note_flaw`; if you only think you see one, ask "Is that a mark on the cuff?" first.
5. Restraint: after a `[state]` line you may stay silent. At most one hint every 6 s. Never repeat a hint more than twice; after that call `mark_done(role, "seller_skipped")`. If the seller says "just shoot" or "stop talking", stop speaking and only call tools.
6. Ending: when `missing` is empty or the seller says done, say "Got it" and call `finish`.
7. Things you never do: answer for the seller, invent a fact, mention tools, read these rules aloud.
8. Session context: category if known, the preset shot list, facts and flaws already noted (used when a session is cycled).

### Step 7. Session length (device)
- Target is 60 to 90 s per item, inside the documented 2-minute audio-plus-video limit, so the default is **no compression, one session per item**.
- At 100 s, or on `GoAway`, the app cycles: opens a new session with the state so far written into section 8 of the prompt, keeps the mic and recording running, and swaps sockets when the new one is ready (the forum author measured 0.5 to 1 s of dead air, *asserted*). The pill shows nothing; the model just carries on.
- Day-one test: ten 4-minute sessions on `gemini-3.8-live` with `contextWindowCompression: {slidingWindow: {}}`. If none die, turn compression on and keep cycling as the fallback.

### Step 8. After `finish()`: the after-pass (backend)
Runs every time, in parallel with the existing pipeline:
1. **Transcript facts.** The input transcript goes to a text model (GPT-6.1 Terra, structured output with the `note_fact` and `note_flaw` schemas plus a quote and timestamp per row). Rows are merged with the live tool calls by field and quote overlap. A fact found only here is kept and marked `after_pass`. This is the net under missed or malformed tool calls.
2. **Full video.** The recording is uploaded and sent to the strongest Gemini model that takes video (name and limits not verified today; the video-understanding docs page would not load). It is asked for: timestamps of the best frame for each role, flaws with timestamps, any text on tags or labels, anything said or shown that the fact list lacks. Best frames for roles still missing are cut from the recording as lower-resolution stills, marked `from_video`.
3. Both feed the review screen (step 10) within the same Job.

The contrary lead, judged: **post-hoc only** (record a video and a voice memo, process offline) would be simpler and has no realtime risk; Hero Stuff ships it. It loses the thing Ben asked for: the model cannot ask for a better look, so a dim or missing view is found after the seller has put the item away, and stills cut from video lack the full-resolution frame and ARKit plane that measure needs. So it is the **backup** when live fails and the **complement** after every live session, not the mode.

### Step 9. Backups, in order
| If | Then | Cost |
|---|---|---|
| Gemini Live is down or misbehaves on the day | `LiveDirector` has a second driver for OpenAI Realtime `gpt-realtime-2.1` over WebSocket: same tools as `session.tools`, `semantic_vad`, audio at 24 kHz, and on each tick one `input_image` item with the current frame followed by `response.create`. Same Swift protocol, same app state. | Half a day's work at most because the tool handlers and ticks are shared (*inferred*) |
| The Swift audio path echoes or stutters | Backup transport: a LiveKit room (`@livekit/react-native` 3.1.0, Expo plugin 1.1.0, `livekit-agents` 1.8.12 in Python with `video_input=True`), which brings WebRTC echo cancellation and jitter handling. Frames reach the agent by publishing a track from the Swift module or, simpler, by uploading the 1 fps JPEGs to the agent over its data channel. | A Python agent to host; more moving parts |
| No realtime model works | Cascade: on-device speech recognition for the seller, the watcher (step 5) for views, a text model choosing the next hint, on-device speech for the voice. Turn-taking is fully ours. Sounds less natural. | Lower "wow", highest reliability |
| No network | Guided shot list as today, recording on; after-pass runs when the network returns | None; already built |

Combining is better than choosing: Gemini Live for the conversation, device gates for instant hints, a fast vision model as watcher, a big video model after, Decisions to score flaw crops. That is five model calls per item, which Ben's rule allows.

### Step 10. Joining the existing pipeline
| Existing step | What live mode feeds it |
|---|---|
| Measure | The `front` still must still be the flat-lay with the floor plane. The model asks for it in words ("Lay it flat for one shot"); the same tilt and distance gates decide when `take_still("front")` fires. If the seller only holds the item up, `front` is covered for the listing but `measure_ready=false`, and the review screen shows one MissingShots slot. |
| Identify | Stills by role as before, plus `note_fact` rows for brand, size, model as *you said*. A spoken brand that disagrees with the tag read drops the field to one-tap confirm. |
| Flaws | Three proposers now feed the same chips: the box models on the stills (as before), `note_flaw(origin=model_saw)`, and `note_flaw(origin=seller_said)`. For a spoken flaw the box model is run on the nearest still with the description as a hint, so the chip still has a region. Seller-said flaws arrive pre-ticked; model-saw ones are "maybe". Decisions scores each crop as before. |
| Seedream | Same reference set, chosen from the stills by role. Frames cut from video are never used as references when a full-resolution still of that role exists. |
| Listing text | Facts with their quotes go to the writer as "the seller said". The description can use the seller's phrasing ("worn twice"), which reads as a person, not a template. |
| Why panel | The transcript, each tool call and each tick are MLflow spans on the item's trace. |

### Step 11. The review screen (human approval, json-render React Native)
After `finish()` the item goes to "Researching" as usual, and the first card is the recap. New catalog components, alongside the capture plan's catalog:

| Component | Used when | Props (short) | Actions |
|---|---|---|---|
| LiveHintPill | During live capture, one at a time | text (4 words or fewer), kind (model, gate), thumbnail region (optional) | none |
| VoiceMark | During live capture | state (listening, speaking, muted, off) | `toggle_mute` |
| CaptionLine | Captions on (noisy room, or accessibility) | speaker, text | none |
| HeardFacts | Review | rows of field, value, quote, play-clip time | `edit_fact`, `remove_fact`, `add_fact` |
| MomentStrip | Review | transcript moments, each with a thumbnail, a time and what it produced (photo, fact, flaw) | `open_moment` |
| ModeSwitch | Camera screen | mode (talk, shoot) | `set_mode` |

Reused unchanged: ShotStrip (coverage), PhotoWithRegions with the flaw chips, MissingShots, ChoiceChips, WhyBar, ItemSummary. The recap is two short sections, "Heard" (HeardFacts, each row tappable to hear the 3 s clip it came from) and "Saw" (ShotStrip and flaw chips), and one primary action, "Looks right". Every edit, removal and yes or no is a Decision row and a label.

## 5. What the seller sees and hears

- **Screen.** The camera, full bleed. Bottom: the shot strip filling in as stills land (the same strip as guided mode). Top: one pill, only while a hint is live. A small voice mark that pulses when the model is listening and fills when it speaks. Nothing else. No transcript on screen by default ([show, don't say](../../../product/words.md#2026-11-14-show-not-say)).
- **Sound.** A soft shutter tick and haptic on each still, so the seller learns that talking and turning the item is enough. The model's lines are short: "Can I see the tag?", "A bit more light?", "Closer on the graphic.", "Got it."
- **Not nagging.** The model waits for a pause (VAD plus the tick rules), gives at most one hint per 6 s, repeats a hint at most twice, then skips it. The seller can talk over it at any time and it stops. Device-gate hints and model hints share the one pill, so there are never two.
- **"Just shoot".** The ModeSwitch (and the spoken phrase) mutes the voice and returns the instruction line of the guided shot list. Both modes read and write the same shot-list state, so switching mid-item loses nothing: covered roles stay covered, and the recording continues.
- **Noisy room.** If input transcription confidence is low or the VAD fires constantly for 5 s, the app switches itself to push-to-talk (hold the voice mark) and turns captions on. The model's hints still appear as pills, so the flow works with the sound off.
- **Who speaks first.** The model, once: "Show me what you're selling." Then it listens. (Decision 3 below.)

### Stage script, about 75 seconds
1. (0 s) Presenter taps the plus, holds up a Carhartt jacket. Model: "Show me what you're selling."
2. (5 s) Presenter, while turning it: "Carhartt Detroit jacket, bought it in 2019, worn maybe a dozen times, runs a little big." Three small fact chips slide into the corner one after another; two shutter ticks as front and back land in the strip.
3. (20 s) Model: "Can I see the tag?" Pill: "Show the tag". Presenter flips the collar; tick.
4. (28 s) Presenter: "There's a small paint mark on the left sleeve." Model: "Show me?" Presenter points the phone; tick; a flaw chip appears.
5. (38 s) Presenter steps into shadow. Pill: "Too dark" (instant, from the device). Model: "A bit more light?" Presenter steps back.
6. (45 s) Model: "Lay it flat for one last shot." Tick as the gates pass. Model: "Got it."
7. (55 s) The recap: "Heard" with four facts and their quotes, "Saw" with five photos and one flaw. Presenter taps the play mark on "worn a dozen times" (the room hears the clip), changes "runs big" to "runs a little big", taps yes on the paint mark, then "Looks right".
8. (75 s) The item card fills in, measurements on the flat photo.

A recorded run of this exact script is kept on the phone. If the venue network fails, the presenter says so and plays it, then does the guided shot list live.

## 6. Failures and edge cases

| Case | What happens | Backup |
|---|---|---|
| Venue wifi drops mid-session | Socket closes; voice mark turns off; guided instruction line appears in under 1 s; recording continues | Session resumption if the network is back within seconds; otherwise finish in guided mode and run the after-pass on the recording. Bring a phone hotspot as the primary network. |
| Model mishears a fact ("2019" as "2090", a brand name) | The fact row carries the seller's quote and a clip; implausible values (year in the future) are flagged for edit first | Brand list in `custom_vocabulary`; the after-pass re-transcribes the recording with a second model and flags disagreements |
| Model hallucinates a flaw | It is only ever a "maybe" chip with a frame; Decisions scores the crop; no is one tap and becomes a negative label | Prompt rule: ask before noting an unseen flaw |
| Model misses a spoken flaw or fact | The transcript pass in step 8 finds it | The recap has "Add" |
| Malformed or duplicate tool calls | Schema validation and 3 s dedupe on device; a malformed call is dropped and the next tick restates the state | The after-pass rebuilds facts from the transcript |
| Model narrates a tool call ("I'm taking a photo now") | "SILENT EXECUTION" in the descriptions and prompt | If still above 1 in 10 on day one, gate playback after a tool call until the turn ends (the forum author's fix) |
| Session limit (2 minutes with video) | Cycle at 100 s (step 7) | Compression, if it passes the day-one test |
| Latency spike | Stills and gate hints don't depend on the model; if no model audio arrives 4 s after a tick, the pill shows the next missing shot from the shot list | Switch to "shoot" mode automatically after two such gaps |
| Echo: the model hears itself and answers itself | Voice processing, the 400 ms uplink mute | Half-duplex toggle; or a wired lapel mic into the phone with the phone's speaker audio going to the room |
| Seller says nothing | The model asks for views from the missing list; it works as a spoken shot list | none needed |
| Seller talks about something else, or a judge shouts | Prompt: only the item. Off-topic speech produces no tool calls | Push-to-talk |
| Two items in view, or a person's face | Device gate "One item at a time", as guided mode. Frames are of the item; the recording stays on the item's record and is not posted | none |

## 7. Data contract additions

Added to the capture plan's contract. The *you said* source now has evidence behind it: a quote, a time and a frame.

| Primitive.field | Value | Source | Confidence |
|---|---|---|---|
| Item.capture_session | id, mode (`talk`, `shoot`, mixed), start, end, model ids, session count (cycles), recording_uri, transcript_uri | device | n/a |
| Item.transcript[] | t_start, t_end, speaker (`seller`, `model`), text, frame_ref | Gemini input/output transcription (`estimated`) | none given by the API; disagreements with the after-pass transcript are flagged |
| Item.heard_facts[] | field, value, quote, t, frame_ref, clip range, origin (`live_tool`, `after_pass`), human (`kept`, `edited`, `removed`, `added`) | `you_said` | 1.0 once the person keeps or edits it on the recap; before that, `heard` with 0.9 when live and after-pass agree, 0.6 when only one has it (start values) |
| Item.<field>.source | existing per-field source gains `you_said` with a pointer to the heard_fact id | as above | as above |
| Item.flaws[].origin | `box_model`, `model_saw`, `seller_said`, `after_pass`, `added` | Gemini Live, person, backend | proposer has none; `decisions_prob` as before; 1.0 once confirmed |
| Item.flaws[].said | quote, t (when the seller described it) | `you_said` | 1.0 for the words; the region is still `estimated` |
| Photo.trigger | `auto_gate`, `manual`, `model_take_still`, `from_video` | device or backend | n/a |
| Photo.frame_ref, Photo.t | time in the session; the low-res frame the model saw | device | n/a |
| Photo.measure_ready | true only for a full-resolution still with a floor plane and passing tilt and distance gates | device (`measured`) | n/a |
| Item.hints[] | t, text, why, origin (`model`, `gate`), outcome (`followed` if a still of that role lands within 10 s, `ignored`, `skipped`) | device | n/a; this is the label for hint usefulness |
| Job (kind `live_session`, `after_pass`) | state, progress | system | n/a |
| Decision (kind `confirm_heard`, plus the existing `confirm_flaw`, `missing_shot`) | options, suggested option, why (quote and clip) | Jobs | per the Decision primitive |

## 8. How to prove it works before the demo

Ten real items (4 tops, 2 pants, 1 jacket, 1 pair of shoes, 1 bag, 1 rigid object), each with a written script: 6 facts to say, 1 real flaw to mention, 1 real flaw to stay silent about, and one planned bad moment (shadow, too close, or tag hidden). Three runs each, by two different speakers, one run in a noisy room. Record everything; report raw counts.

| Measure | How | Target (start values) |
|---|---|---|
| Facts captured vs said | heard_facts after the recap vs the script, per field | 55 of 60 before edits; 0 invented |
| Fact accuracy | value matches what was said | at most 2 wrong values in 60 |
| Flaws: said | the mentioned flaw appears as a chip with a usable frame | 9 of 10 |
| Flaws: unsaid | the silent flaw is proposed by any layer | 6 of 10 (the chips and "Add" cover the rest) |
| False flaws | chips for flaws that don't exist | at most 1 per item, all dismissible |
| Hint usefulness | share of hints followed within 10 s; hints per item; repeats | 70% followed; at most 5 hints per item |
| Talking over the seller | model audio starting while the seller is mid-sentence | at most 1 per run |
| Coverage | required roles covered at `finish()` without touching the screen | 9 of 10 items |
| Measure-ready still | flat `front` still with plane captured in talk mode | 9 of 10 clothing items |
| Latency | seller stops speaking to first model audio; tick to hint; `take_still` call to shutter | p50 and p95 reported; under 1.5 s p50 hoped, unmeasured today |
| Stability | sessions ended by error; tool calls malformed or duplicated | counts per 30 runs |
| Time | first frame to `finish()` vs guided mode on the same items | within 20 s of guided mode |

First hour: the Swift audio loop with ARKit running (echo, haptics), one tick producing speech, one `take_still` producing a photo. If those three work, the rest is plumbing.

## 9. Decisions for Ben

1. **Is talking the default way to capture, or a mode you switch into?** (direction)
   - A. Guided shot list by default; a voice mark on the camera screen starts talk mode. **Recommended**: the guided flow works in any room and with no network, and talk mode is the showpiece you choose to turn on.
   - B. Talk mode by default, "just shoot" as the switch. Strongest first impression; a noisy venue or bad wifi is felt on the first tap.
   - C. Ask once on first launch ("Talk me through it" or "Just shoot") and remember.
2. **Does the voice have a persona?** (taste)
   - A. No name, no personality; a calm, brief voice that only asks for views and says "Got it". **Recommended**: fits "show, don't say" and keeps attention on the item.
   - B. A named helper with a little warmth ("Nice jacket"). More memorable on stage; more talking, and more chances to say something wrong about the item.
   - C. No voice at all by default: the model listens and shows pills; voice is opt-in.
3. **Who speaks first?** (taste)
   - A. The model, one line ("Show me what you're selling"), then it listens. **Recommended**: tells the seller it can hear without any on-screen text.
   - B. The seller; the model stays quiet until the first pause.
4. **How much does the recap ask?** (scope, human in the loop)
   - A. One "Heard / Saw" screen: every fact is kept unless edited, every flaw needs a yes or no, one "Looks right". **Recommended**: a visible human moment without making the seller re-confirm what they just said.
   - B. Every heard fact needs its own tap. Most visible approval; slow.
   - C. No recap; facts go straight to the item card with a "you said" mark. Fastest; a misheard fact is easier to miss.
5. **Is the recording kept as part of the listing?** (scope)
   - A. Kept privately on the item as evidence and for the after-pass only. **Recommended.**
   - B. Also offered as a short clip for the listing on sites that take video.

## 10. Limits

- Opened today: Gemini Live capabilities, session management, tools, ephemeral tokens and the 3.8 Live model page; Google's 3.8 Live and Guided Vision blog posts; OpenAI's gpt-realtime announcement, Realtime developer notes, Realtime conversations guide (first 100k characters and the tail, which did not include the image section) and the GPT-Realtime-2 post; a dev.to explainer; LiveKit docs (video input, Gemini recipe, OpenAI and xAI plugins) and a LiveKit community thread; the Vision Agents README; three Google AI forum threads and one OpenAI community thread; Apple docs for `providesAudioData` and two Apple forum threads; the `@livekit/react-native` README; Tilt's Snap post; the Hero Stuff store page; an AppleVis thread; a secondary article on Guided Vision; npm and PyPI for versions.
- Could not read: OpenAI's ChatGPT voice help page and Hover's press release (fetch failed); Gemini's video-understanding docs (redirected to an empty page), so the after-pass model name and video limits are unverified; the Vertex Live API page (only navigation came back).
- Not opened: Pipecat, Daily, Hume and ElevenLabs docs (ElevenLabs' vision support was seen only as search-result titles), xAI's own docs, Tractable, Snapsheet, Apple Visual Intelligence, Ray-Ban Meta, Project Astra, any telehealth flow, Whatnot's own pages, the duplicate Apple thread with the echo-cancellation answer, the Hayes Raffle gist. A narrow search does not show these lack what we need.
- From memory, not re-checked: `AVAssetWriter` from ARKit frames, `URLSessionWebSocketTask`, `AVAudioEngine` voice-processing details, the default of `providesAudioData`, that only one capture session can own the camera.
- The practitioner failure rates (malformed calls, narration, echo) are one author's counts on Gemini Live models before 3.8. No latency figure for either vendor's current model was found. Nothing in this note has been run; section 8 is the test.
- Date conflict left open: OpenAI's page for GPT-Realtime-2 is dated May 7, 2026, a secondary source says November 6, 2026, and the official guide's examples use `gpt-realtime-2.1`.
