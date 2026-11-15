# 41 — For Nate: Bruce Liu's "Beyond Taking Turns" posts, the three UI examples in detail

Updated: November 15, 2026. Owner: Ben. For: Nate. Agent: Claude Code (project thread "Brief Garlic on the X posts"). Branch: main. Status: information only; nothing here is decided or built.

## Why you're getting this

Ben sent eight X posts and asked for the information itself, not the links, with the three UI ideas in the video described in detail and a short note on each original post. His words: "he wants to know about the 3 ui ideas in the video and the features need to be very well described for him. also links back to the original posts with short notes for each" (project thread, 2026-11-14 23:31 UTC).

How it was read: all eight posts through the public fxtwitter and vxtwitter JSON (logged out), all 152 replies, the demo site, and the thesis page. The one video was downloaded (720x720, 58 s), checked for speech (there is none, it's a silent screen recording), and read frame by frame twice: every 2 s, then every 0.5 s with close-ups around each picker. The live demo site was then opened and its CSS, JS and recorded replays read. The thesis PDF sits behind a bot check and was not read; only its abstract was.

## The short version

Bruce Liu (Research Scientist at Adobe Research, HCI + AI PhD) argues that chat with AI is still a walkie-talkie: you talk, it talks, and a misunderstanding costs a whole extra turn. He shows two ways for each side to act inside the other's turn:

- **Feedforward**: while you type, the AI marks the words it has made a guess about and lets you change each guess before you send.
- **Leaving Blanks**: when the AI reaches something only you know, it leaves a blank in its answer, stops, and goes on in the same message once you fill it.

The video shows three examples: Feedforward on a trip plan, Feedforward on poster generation, and Leaving Blanks on a birthday dinner. So it's two ideas, shown three ways. The posts got about 245k views, 3.5k likes and 3k bookmarks in two days.

## Things all three share

- **A word is the handle.** The AI's guesses are attached to the exact words they came from. Resting the pointer on a word for 110 ms opens its picker; a click pins it open. On touch, a tap opens it. (The author: "It's actually a hover".)
- **A picker is a small white card** with a soft shadow, anchored under the word (it flips above when there's no room). It fades in from a blur over about half a second and blurs out when it closes.
- **Every picker ends with "+ Something else"**, which turns into a text field. What you type there becomes a new selected chip.
- **Selected means black.** Chips go solid black with white text; image and layout cards get a thick black outline instead.
- **The picker fits the question.** The AI chooses the control type per decision: list of chips, map, date picker, single slider, range slider, colour swatches, image thumbnails, typeface previews, layout wireframes, or a 2D pad with a sample for each cell. The Japan map is generated, not hand-built ("it's actually genui so it works for anywhere"): the model emits each region with its latitude and longitude, and the map is laid out from those.

## UI 1: Feedforward on a trip plan (video 0 to 18 s)

**The screen.** A light grey page titled "Feedforward". A centred composer pill: "+" (add pictures) on the left, placeholder "Ask anything", a mic and a round send button on the right. The send button is light grey when empty and black once there's text. Under it, a small grey caption: "Feedforward: before you send, the AI shows what it is about to decide for you."

**Typing.** You type "Plan a week in Japan with my kids." As you type, a fine dotted underline appears under words the AI has made a decision about: "Japan" first (about 2 s in), then "a week" and "kids". The dots are tiny grey dots tiled along the baseline. Your text is never rewritten.

**The interpretation line.** At 3 s a grey line fades in above the composer, outside it: "🗺️ You want a day-by-day plan.", with "a day-by-day plan" dotted. This line holds the decisions that aren't tied to one of your words (the goal, the focus, the context). Then the composer and the line glide up together from the middle of the page to the upper third.

**Picker on "kids"** (4 to 7.5 s). The word gets a light grey highlight and a card opens:
- "How old are they?" with the current value "3–15" in bold on the right.
- A two-thumb range slider with five stops (3, 6, 9, 12, 15). The right thumb is dragged to the middle stop; the value reads "3–9" and the track between the thumbs turns black.
- "What do they enjoy?" with a grey "Pick any" (multi-select).
- Emoji chips: "theme parks" (🎢, preselected), "animals" (🦌), "anime and games" (🎮), "food" (🍜), "nature" (🌲), "+ Something else". The user deselects theme parks and selects animals.

**Picker on "Japan"** (8 to 10.5 s). The kids card blurs out as the Japan card blurs in:
- "Which part?" with "Pick any".
- Region chips laid out in the rough shape of Japan on a faint dot grid with faint connecting lines, top right to bottom left: "Hokkaido", "Tokyo area", "Kansai", then "Kyushu" and "Tokyo & Kyoto" on one row, then "Okinawa". "Tokyo & Kyoto" is preselected. The user adds Hokkaido and removes Tokyo & Kyoto.

**What changes when you pick.** Nothing in your sentence changes. When a picker closes after you changed its value, that word's underline goes from dotted to a thin solid grey line: it now reads as "you decided this". Words you never touched ("a week") stay dotted, meaning "the AI's default, and you saw it".

**Send** (11 to 18 s). The sent text appears as a grey bubble that settles top right. Under it, before the answer, the AI lists every decision as one line each, grey text with the value in black, entering one by one from a blur:
- 🗺️ You want a day-by-day plan.
- 📅 You're going in spring cherry blossom season.
- 🗾 The trip centers on Hokkaido.
- 🧒 The kids are 3–9.
- 🦌 They enjoy animals.

Then a thin divider and the answer streams in: "7 Days in Hokkaido", "Best timing: late April to early May…", "Day 1: Arrive and settle in Sapporo…", "Day 2: Maruyama Zoo and blossoms…". The cherry blossom decision was never opened on screen; it was a default the user saw and kept.

## UI 2: Feedforward on poster generation (video 18 to 38 s)

Same page and composer. This one adds tool settings as decisions, image pickers, and a decision the AI takes back.

**The composer grows a tool row.** As you type "Make two posters for our lab's open house next Friday. Something clean, with a pop of color and the title somewhere it really stands out.", the pill becomes a two-row card. The second row shows the AI's own settings: a blue picture icon and "Create image" (dotted blue: it chose the image tool), "3:4" (dotted: it chose the aspect ratio), and "×2". These are pickers too. "Create image" opens "How to answer": Chat ("an answer in words, from what the model knows"), Search ("it needs fresh facts, so look on the web first"), Create image ("they want a picture made", ticked). On hover its icon turns into an ⓧ to remove the tool. "3:4" opens "Aspect ratio": 1:1, 3:4 (ticked), 9:16, 4:3, 16:9.

**Underlines appear** on "lab's", "clean", "pop" and "color". For colour decisions the dots take the colour of the current default: orange dots under "pop", blue dots under "color". The interpretation line reads "🖼️ The two posters differ by two style options."

**A decision taken back.** The AI had two guesses on "pop" (which colour; and "A pop of what?": bright color, a bold shape, playful humor, big typography). Once typing stops it drops both, and the dots under "pop" disappear while you watch (about 25 s). The colour decision stays on "color".

**The pickers:**
- **On the interpretation line, "two style options"**: a narrow dropdown. Grey header "How should they differ?", then "two style options" with a ✓, "different audiences", "different content", and a text field "Something else...". Opened and left unchanged in the video.
- **"lab's"**: "What kind of lab?" Icon chips, single choice: biology (DNA), physics (atom), computer science (laptop), chemistry (test tube, preselected), engineering (gear), "+ Something else". The user picks computer science.
- **"color"**: "Which color?" Five round swatches (blue with a ring as the default, coral, lime, magenta, yellow). The colour's name shows under the row ("electric blue", then "coral orange"). The user picks coral; after the card closes, "color" gets a solid coral underline, 2 px instead of 1.
- **"clean"**: "Clean in what way?" Four square image thumbnails with short captions ("minimal a…", preselected with a black outline; "modern a…", a geometric poster reading "STRUCT URE"; "crisp and…"; "flat and c…", a colourful poster reading "MAKE IDEAS VISIBLE"). Clicking "modern" closes the card and the thumbnail **flies into the composer** and sits at its top left as an attached reference image. This is the only case where a choice changes the composer's content.

**Send and result** (33.5 to 38 s). The sent bubble carries the thumbnail above the text. The decision list: 🖼️ two style options · 🔬 "The lab works in computer science." · ✨ "The look should be modern and geometric." · 🎨 "The pop of color is coral orange." Two grey loading cards, then two images, each holding a light and a dark "Open House" poster: network-graph drawings for computer science, geometric shapes, coral accents. Every decision is visible in the output.

## UI 3: Leaving Blanks on a birthday dinner (video 38 to 58 s)

This flips who acts in whose turn: you act during the AI's answer.

**Setup.** The page title rolls up to "Leaving Blanks". The user's message is already sent: "Plan my dad's 60th birthday dinner at home: a menu, a shopping list, and a short toast I can give. It should sound like me, not like a card." A grey "Thinking" with a shimmer.

**The answer stops at three blanks.** It streams: "Happy 60th to your dad! I'll build everything around three things: the dinner is for [how many], he'd be happiest eating [his food], and your toast should sound like [your voice]." Each blank is grey placeholder text with a thin solid grey underline (not dotted, which tells blanks apart from Feedforward guesses). A light highlight sweeps over the blanks one after another, and they keep a slow pulse (2.4 s loop) while unfilled. Under the paragraph, a small grey hint: "Fill in the three blanks and I'll go on." The answer then waits. While a blank is still streaming in, a grey skeleton pill holds its place.

**Nothing is preselected.** This is the core difference from Feedforward: the AI doesn't guess, because these are things only you know.

**Blank 1, "how many"**: "How many guests?" Chips "4 people", "6 people", "8 people", "12 people", "16 people", "+ Something else". One click commits and closes. The blank becomes black "6 people" in place. The hint becomes "Two more blanks and I'll go on."

**Blank 2, "his food"**: "What does your dad love to eat?" Emoji chips 🥩 steakhouse classics, 🍝 Italian, 🍗 Southern comfort food, 🌮 Mexican, 🍖 barbecue, 🐟 seafood, "+ Something else". The blank becomes "🍝 Italian". Hint: "One more blank and I'll go on."

**Blank 3, "your voice"**: "How should your toast sound?" A square 2D pad split into four by a dashed cross, axis labels outside it: short (top), longer (bottom), teasing (left), heartfelt (right). One dot per quadrant. Below it, a grey preview box. Resting on a quadrant fills the preview with a sample line in that voice (for short and teasing, a one-line joke about Dad and the grill). Clicking commits; the blank becomes "short and teasing".

**It goes on in the same message.** The hint is replaced by a shimmering "Continuing", and the same message keeps streaming below the paragraph, no new bubble: "Menu (for 6 people)", Starter (burrata, olives and prosciutto), Main (beef ragù over pappardelle, arugula salad), Dessert (tiramisu made the day before, espresso and a candle for the 60). Filled values come back underlined where they're reused, like "6 people" in the heading. The video ends before the shopping list and toast.

**What the live demo adds beyond the video:**
- A new blank can appear later, mid-sentence: the toast stops at "…raise a glass to the man who [his quirk]" with "Fill in the blank and I'll go on." Its picker, "What's Dad's famous quirk?", offers four sentence-length chips.
- You can reopen a filled blank and change it. Dragging a slider previews the new value in the sentence live, but nothing changes until you commit. Changing an earlier blank marks everything after it stale and the status reads "Rewriting".
- The composer stays docked at the bottom, and its send button becomes a stop button while the answer streams.
- Hint strings: "Fill in the blank and I'll go on." / "Fill in the {n} blanks and I'll go on." / "{N} more blank(s) and I'll go on."

## How the three compare

| | Trip (Feedforward) | Posters (Feedforward) | Dinner (Leaving Blanks) |
|---|---|---|---|
| Whose turn | Yours, while typing | Yours, while typing | The AI's, mid-answer |
| Where the AI's choices show | Dotted words, plus one line above the composer | The same, plus the tool row (tool, aspect ratio) | Grey blanks inside the AI's sentence |
| Default | A guess is preselected | A guess is preselected | No guess; it stops and waits |
| Controls | Range slider, multi-select emoji chips, map | Dropdown with a text field, icon chips, named swatches, image thumbnails that attach as a reference | Count chips, emoji chips, 2D pad with a live sample |
| Progress cue | Dotted to solid when the picker closes | The same; colour words take the chosen colour | Hint counts down, then "Continuing" |
| After | Decisions listed above the answer, then the answer | Same list, then two images | Same message continues; values reused and underlined |

## How it works underneath (from the demo site's code)

Useful if we build anything like it:

- **The editor** is TipTap/ProseMirror. Each marked word is a span with a decision key (`data-mark="ph:kids:0"`). States: ghost (dotted), solid, tinted (colour decisions, 2 px), open (7% tint behind the word), pending (the dots march sideways while the AI is still thinking about that word).
- **Feedforward streams decisions as operations.** `define` creates one with: key, the word it's attached to (`quote`), kind (word, goal, focus, context, voice), why (scaffolding, disambiguation, interpretation, association, reference), emoji, a sentence template ("The kids are {}."), the question, options, control type, single or multi, and scope (this message or the whole conversation). `score` updates how likely each option is, how much it matters, and how likely you already said it. `signal` estimates whether you'll keep typing. `drop` retracts a decision. Decisions with no word attached become the interpretation line.
- **On send, decisions go to the answer model in three groups**: "they chose this", "as their own words say", and "your default; they saw it and kept it".
- **Leaving Blanks** streams blanks inline as `<blank>{"key":"guests","ask":"How many guests?","kind":"only_you","ui":"slider","options":[…],"placeholder":"how many","wait":true}</blank>`. Kinds: only_you, unsure, yours. To resume, the next call gets the answer so far with fills written in as `[[guests: 8 people]]`, and the continuation can reuse a value as `[[guests]]`.
- **The public site plays recorded examples.** Your own text needs your OpenRouter key. The live examples are a newer build than the video (the trip prompt adds a budget, trains and a Search tool; the map regions differ). Other examples: a pricing section for a React page (typeface picker, two-colour brand swatches, layout wireframes, "I'll assume styling with Tailwind CSS."), a letter to a landlord (polite/firm by short/detailed pad, a date picker), a factoring tutor, a long weekend, and a bakery website.

## What people pushed back on (from the 152 replies)

- "Am I crazy for still feeling that this is turn based?" (60 likes, the top reply). The author agrees there's always a smaller turn; the point is breaking up the long ones.
- Small hover targets and lots of clicking may annoy people or not suit every user.
- The suggestions miss sometimes, so you need an easy "something else" (the demo has one).
- Why not a generated form for the blanks instead of one picker per blank? The author: he didn't want to break the text-answer form factor yet.
- Expand a word into cards instead (Japan becomes city cards). The author liked it.
- Let people mark a word themselves when the AI didn't pick it up, e.g. by wrapping it in `[[ ]]`.
- What should a blank do when nobody's around to fill it, like an agent running overnight?
- Does seeing the AI's guess make people correct the model, or quietly bend their own idea to fit it?
- "The hard design question becomes which uncertainty can safely remain a blank."
- The author on what helped most in his own use: it scaffolds things he hadn't thought of or left vague without noticing.

## Where this could touch secondhand (*agent proposal*, not decided)

- **Item card and listing draft (Feedforward).** After capture, the agent's guesses (brand, size, condition, category, price, which sites) could sit on the words of the draft with dotted underlines, each opening a fitted control: a condition scale, a size chip row, a price slider tied to sold comps. Defaults the seller saw and kept are logged differently from ones they chose, which is the same split our tiers that learn need.
- **Facts only the seller knows (Leaving Blanks).** Flaws, smoke-free home, original receipt, pickup hours: a blank instead of a made-up claim fits `claim_check` and "never invent a fact" ([today.md](../../../../spec/features/today.md), [messages.md](../../../../spec/features/messages.md)).
- **The overnight problem** raised in the replies is ours too: an agent waiting on a blank while the seller sleeps. Today's deadline cards are one answer.

## Limits

- The video is a silent screen recording; times are ±0.5 s. Hover timing comes from the site's code; the browser tool could not fully exercise hover.
- The thesis PDF was not read (bot check). Its abstract covers three other systems (Visual Captions, Inner Thoughts, Doki) and doesn't name Feedforward or Leaving Blanks.
- No live model was run on the demo; only recorded examples.
- Raw files (post JSON, the video, 33 frames, the replies, the demo replays) are on Ben's Mac in `secondhand/.transcribe/x-posts/`, git-excluded, not pushed.

## The original posts

1. [Bruce Liu, the video](https://x.com/liu_xingyu/status/2121015724374397183), Nov 12. Opens the thread: AI interfaces are still turn-based; one answer is intra-turn interaction. Holds the 58 s video with all three examples.
2. [Bruce Liu, the diagram](https://x.com/liu_xingyu/status/2121015726802960637), Nov 12. Why turns hurt: the AI's reading stays hidden until it answers, so fixing it costs a turn. A timeline diagram compares Today (two sends, a wrong guess), Feedforward (the AI glances while you type, right the first time) and Leaving Blanks (you click three times inside its turn).
3. [Bruce Liu, the links](https://x.com/liu_xingyu/status/2121015728623231448), Nov 12. The demo site, demos.liubruce.me/intra-turn, and his thesis "Beyond Taking Turns in Human-AI Interaction" (UC eScholarship, 2026).
4. [Saud, reply](https://x.com/bysaudrahman/status/2121149156194755047), Nov 13. Suggests expanding a word into cards, like Japan into city cards, since selecting beats typing. The author wants to prototype it.
5. [Yousif Alnajjar, reply](https://x.com/YousieGoosie/status/2121083479710716395), Nov 13. Asks why each blank is its own click instead of one generated form.
6. [Bruce Liu, answer to 5](https://x.com/liu_xingyu/status/2121086404793098601), Nov 13. It's a hover, not a click; he didn't want to change the text-answer form factor too much yet.
7. [Joey Dafforn, reply](https://x.com/vltg__/status/2121094154826748159), Nov 13. Asks what this changes in behaviour: less load from breaking big decisions up?
8. [Bruce Liu, answer to 7](https://x.com/liu_xingyu/status/2121102259375440256), Nov 13. The biggest help was scaffolding what he hadn't thought of or had left vague without noticing; wants user studies.
