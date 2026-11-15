# What do the round 11 answers rest on?
Researched 2026-11-15 by Ben (Claude Code agent, brand thread). Feature: cross-cutting (brand).

Ben's [round 10 notes](../../../product/words.md#2026-11-15-round-10-picks) and his [questions on black, the outline and the gray box](../../../product/words.md#2026-11-15-a-constitution-with-little-wiggle-room-the-heavy-black-the-black-outline-and-the-gray-box) asked for seven things that rest on facts. This note holds the facts. The answers are proposals in [brand/constitution.md](../../../brand/constitution.md) and open rows in [brand/ledger.md](../../../brand/ledger.md). Pages were read through a fetch helper on 2026-11-15, which returns a paraphrase, so a quote here is short. Marks: *observed* (read on the page or measured), *asserted* (a source says so and we did not check it), *inferred* (our reasoning), *not read*.

## 1. The heavy black, the black outline and the gray box

Ben: "the only really heavy black use in light mode also how buttons either are black or have black outline and essentially nothing else from what im seeing has that black outline and how it feels to me like the gray background on say the nike dunk lows in that one image doesn't feel as separate."

Measured from [brand/tokens.css](../../../brand/tokens.css) and the [round 10 render of Today](../../../brand/explore/round-10/renders/today-base.jpg) (*observed*):

| Thing | Against white |
|---|---|
| The black pill and the outline, `--ink` | 19.8:1 |
| The pressed gray, `--gray-press` | 1.27:1 |
| A hairline, `--rule` | 1.19:1 |
| The gray box, `--gray` | 1.13:1, and .043 away in Oklab |

| Source | What it says | Mark |
|---|---|---|
| [Apple HIG, Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons) | "Keep the number of prominent buttons to one or two per view." Give the most likely action the prominent style, and mark the preferred option by style, not size. A hit region of at least 44 by 44 pt. The page describes no outline style, and for visionOS prefers a button with a background shape and a fill | observed |
| UIKit's button styles are filled, tinted, gray and plain, with no outline among them | From memory of `UIButton.Configuration`; the HIG page read does not name them | asserted |
| [Apple HIG, Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Prefer filled symbols. Nothing on the weight of a tab's label. Badges are for critical information | observed |
| [Apple HIG, Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Groups are set apart with headers, footers and space. Nothing on separators between rows | observed |

What follows (*inferred*):
- The gray box is weaker than a hairline. In [round 10](brand-round-10.md) the floor of .04 was set on the guess that Ben read gray on white as separate. He does not, so .04 holds for a small control and not for a box that holds content.
- The round 10 mock also drifted from L16, "Feeds are ruled rows". Rows on white bring it back, and leave the box one job: this needs you.
- Today showed two black pills. The isolation effect ([round 10 note](brand-round-10.md), section 3) works for one loud thing. Tying the pill to the box on the field gives one per view with nothing to judge.
- The outline is the only line in the system at full black. Every other line is `--rule`, at 8%.

## 2. How the two faces sit in a line

Ben: "tailor the little things in the font and set it and all. like they seem not centered."

Read from the font files on Ben's Mac with fontTools (*observed*):

| | PP Neue Montreal Book | PP Neue Montreal Medium | Clofie SemiBold |
|---|---|---|---|
| Units per em | 1000 | 1000 | 1000 |
| Ascent, descent, line gap | 958, −242, 0 | 958, −242, 0 | 750, −250, 100 |
| Cap height, x height | 715, 510 | 715, 510 | 725, 500 |
| The dollar sign, bottom to top | −101 to 770 | −101 to 770 | −25 to 750 |
| Tabular zero | 670 wide | 723 wide | none |
| Features | case, frac, tnum, zero, ss01, ss02 and others; kern | the same | ordn; kern |
| Has ’ × − ½ … – — · → | all | all | ’ only |
| Has ″ and ′ | no | no | no |

Measured in Chrome on the same Mac, at the sizes the app uses. "High" is how far the ink sits above the middle of its box (*observed*):

| Label | Box | High by |
|---|---|---|
| Book 13/18, "Listed at $45" | 18 | 0.65 px |
| Book 15/20, "Carhartt Detroit jacket" | 20 | 0.35 px |
| Medium 15/20, "Accept $38" in a 44 button | 44 | 0.35 px |
| Medium 13, "Live" in a 24 tag | 24 | 0.65 px |
| Book 18/24, "Offered $38" | 24 | 0.45 px |
| Book 50/57, "$36.81" | 57 | 0.4 px |
| Clofie 21, "secondhand" in a 44 bar, by x height | 44 | 0.2 px low |
| Clofie 36/1.125, "Today" | 40.5 | 4.3 px |

With `text-box-trim: trim-both` and `text-box-edge: cap alphabetic` on the label, "Accept $38" and "Live" measure 0.0 px off. Chrome on Ben's Mac supports both properties (*observed*).

What follows (*inferred*):
- PP Neue Montreal is close to centered already: its ascent leaves 243 units above the cap height and its descent is 242. What Ben saw is under a pixel of it, plus the dollar sign, which reaches 101 units under the baseline, plus Clofie.
- Clofie is the face that is off: .12 em high at 36, because of its line gap of 100.
- Trimming is exact on the web. React Native cannot trim, so Clofie takes a fixed offset there. That offset is worked out from these numbers and has not been checked on a phone.
- Clofie has no digit forms with one width and none of the marks, so a Clofie string holds letters and an apostrophe.

## 3. Which color for which state

Ben: "sold mint, live as in blue like twitch kinda, needs you yellow or lime as in like a warning. and shipping im not sure. whatever people associate with shipping."

| Claim | Mark |
|---|---|
| Yellow for a warning and green for a safe condition are in ISO 3864 ([round 10 note](brand-round-10.md), section 3) | asserted |
| Shipping has no one color people share. Carriers and tracking apps use brown, purple and orange, blue, and purple | inferred, from memory of UPS, FedEx, USPS and Shop; no page was read |
| With sky as live, the ring colors left for shipping are lilac, pink and peach. Peach sits .036 from marigold, under the floor in L40 | observed, from the round 10 measurements |
| Black on lilac is 13.5:1, on pink 13.4:1, on peach 13.6:1. White on brick is 5.6:1 | observed |

What follows (*inferred*): live, sold and needs you are Ben's. Shipping is lilac in the mocks because it is the only one of the three that is far from every color that already means something and is not pink, which is the one category color left. The Home field is sky, mint and lime, which are now live, sold and paid: the gradient reads as the path of an item.

## 4. A main color

Ben: "we have yet to pick a central color or standalone main colors for it. yes we have a bunch of colors, but does expert ui ux research suggest for branding purposes choosing carefully."

| Source | What it says | Mark |
|---|---|---|
| [Ehrenberg-Bass, Brand Identity Q&A](https://assets.marketingscience.info/Brand-Identity-QA.pdf) | An asset is graded on fame and uniqueness, and the aim is 100% on both. "A colour combination" is given as an asset. Any type of asset can be strong; how it is carried out decides | observed |
| [Mark Ritson, on a palette of codes](https://minimba.com/articles/distinctive-brands-paint-with-a-palette-of-codes-says-mark-ritson) | Three, four or at most five codes. Fame is the share who name the brand from the asset; uniqueness is the share who name only that brand. Sephora has four: a logo, a wave, a black and white stripe and a touch of red | observed |
| [Blauw, on colors as brand assets](https://www.blauw.com/en/blog/colors-you-can-t-claim-as-brand-assets-or-can-you) | Colors score 30 to 40 on its scale of 0 to 100, and are among the weakest assets with fonts and taglines. One color or a combination can both be recognized; IKEA and Google are combinations | asserted (an agency's own benchmark) |
| [Science Says, on which elements make a brand unique](https://app.sciencesays.com/p/which-brand-elements-make-you-unique) | People were more than twice as likely to link a character or a logo to the right brand than a color. Paywalled: only the summary was read | asserted |
| [NN/g, on color in an interface](https://www.nngroup.com/articles/color-enhance-design/) | Keep to three colors. 60% dominant, 30% secondary, 10% accent, with the first two close to neutral. The accent is for what should stand out most. One color means one thing throughout | observed |
| [Wikipedia, Color psychology](https://en.wikipedia.org/wiki/Color_psychology) | Findings on color differ by culture and are not universal. The line that color lifts recognition by 80% is not on the page | observed |

What follows (*inferred*):
- No source read says a brand needs one color. A combination in a fixed order counts, and we have one: sky to lime, which Ben called the heart of the brand (L1).
- Color alone is a weak asset next to a mark or a character. So the gap that matters more is the hand (R35), not a main color.
- In the app, white and black are the 60 and the 30, and the field is the 10. That already matches NN/g's split.

## 5. The snap

Ben: "the central sound for it should be a snap sound. find and research packages or libraries and find very satisfying snap sounds. because its a hand yk."

| Source | What it says | Mark |
|---|---|---|
| [Apple HIG, Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) | Use system haptics for their documented meaning. Keep cause and effect clear. Match a haptic's intensity and sharpness to the animation it goes with. Do not overuse. Success is for "a task or action has completed"; Rigid is a collision between hard objects | observed |
| [Apple, AHAP files](https://developer.apple.com/documentation/corehaptics/representing-haptic-patterns-in-ahap-files) | A pattern holds events: HapticTransient, HapticContinuous, AudioCustom. Intensity and sharpness run from 0 to 1. An audio event names a file in the bundle | observed |
| [Apple HIG, Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio) | With the silent switch on, sound effects are silenced; only sound a person starts is played. System volume governs | observed |
| [WWDC 2019, session 810](https://developer.apple.com/videos/play/wwdc2019/810) | Three principles: causality (it is clear what caused it), harmony (it feels the way it looks and sounds, in sync), utility (only where it adds value) | observed |
| [Expo haptics](https://docs.expo.dev/versions/latest/sdk/haptics/) | `impactAsync` takes Light, Medium, Heavy, Rigid or Soft; `notificationAsync` takes Success, Warning or Error. Nothing plays in Low Power Mode, with the camera active or during dictation | observed |
| [Expo audio](https://docs.expo.dev/versions/latest/sdk/audio/) | `useAudioPlayer(require(file))` then `player.play()`. `playsInSilentMode` is a setting | observed |
| [tiks](https://www.cssscript.com/ui-sound-effects-tiks/) | MIT. Ten sounds made at run time with the Web Audio API, no files. Has a click, a pop and a toggle it calls a "pitch snap" | observed |
| [snd-lib](https://github.com/snd-lib/snd-lib) | MIT code, three kits. Has a tap; no snap | observed |
| [uisfx](https://github.com/romainsimon/uisfx) | MIT code, CC0 audio, 78 cues in 12 packs. No snap named | observed |
| [soundcn](https://www.mintlify.com/kapishdima/soundcn/introduction) | Over 700 sounds, mostly CC0 from Kenney. Clicks; no snap named | observed |
| Freesound, two finger snaps by Jackie4Ever ([one](https://freesound.org/people/Jackie4Ever/sounds/116861/)) | Both are a snap put through a delay, not a clean snap. One is CC BY 3.0 | observed |
| Freesound's search for CC0 finger snaps, and Wikimedia Commons | The pages did not load | not read |
| [Pixabay, finger snap sounds](https://pixabay.com/sound-effects/search/finger%20snap/) | 803 results. Among the first: "Finger Snap Sound" and "Snap Sound" by SoundReality, one second each. The [licence summary](https://pixabay.com/service/license-summary/) allows use in a commercial app with no credit, and forbids passing a file on by itself or making it part of a trademark | observed |
| [Kenney, Interface Sounds](https://kenney.nl/assets/interface-sounds) and [UI Audio](https://kenney.nl/assets/ui-audio) | CC0, 100 and 50 files, tagged click, button and switch. File names are not shown, so a snap could not be confirmed | observed |

What follows (*inferred*):
- No UI sound library read ships a finger snap. Pixabay has recorded ones that may ship in an app, but its licence does not let a sound be part of a trademark, so a Pixabay snap could not become the brand's own sound mark. A snap Ben records once with his phone has no such limit, and is his own hand.
- The app is Expo, so the sale plays one bundled file with `expo-audio` and one haptic with `expo-haptics` in the same call. A snap is a hard, short hit, so the haptic is Rigid, then Success as the gradient fills.
- With the silent switch on, the haptic carries it alone. That is what Apple's page asks for.

## 6. Hands that already exist

Ben: "there could be hand models out there or different animations or sprites or svg. research them and find them rather than making your own for the time being."

| Source | What it has | Licence | Mark |
|---|---|---|---|
| Hugeicons, the set the app already uses | In the free package, read from its files: a hand, a helping hand, a hand holding a platter, a hand with coins, a grabbing hand, a handshake, an OK sign, pointing hands, a waving hand, a finger heart. No snap | MIT | observed |
| [OpenMoji](https://github.com/hfg-gmuend/openmoji) | Forty hand gestures by name, among them a palm up, a rightwards hand, a handshake and pinched fingers. No snap | CC BY-SA 4.0: any change must be shared under the same licence | observed |
| [LottieFiles](https://lottiefiles.com/page/license) | Many free hand animations; none on the page read is named a snap | Lottie Simple License: commercial use and changes allowed, no credit needed | observed |
| [lottie-web](https://github.com/airbnb/lottie-web) | Plays an After Effects animation saved as JSON | MIT | observed |
| [MediaPipe hand landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker) | 21 points for a hand: the wrist and four joints per finger. Runs in a web page | Apache 2.0 for the samples | observed |
| Phosphor, Tabler, Rive, SVG Repo | The pages did not show their icons to the fetch helper | not read |

What follows (*inferred*):
- Nothing found is a snap, and nothing found is ours. The quickest honest start is the hands in the icon set we already ship, used as a sketch for Ben's own drawing.
- "Moldable" has a known shape: a hand as 21 points. A pose is then a small list of numbers, and moving between two poses is an animation. The snap, the hand-off and a resting hand are three poses of one hand.

## Color blindness

Ben is color blind ([his words](../../../product/words.md#2026-11-15-dark-mode-approved-the-size-system-everywhere-clickability-money-and-countdowns-color-blind-checks): "im color blind so i want to make sure that the ship the nike dunks thing is green not brown"). He did not say which kind. Red-green kinds (protan and deutan) are the common ones, so the rule is built on those two (asserted, from memory of the usual figures; not read today).

Method (observed, computed here on 2026-11-15): each fill in `brand/tokens.css` was converted to linear RGB, passed through the Machado, Oliveira and Fernandes 2009 matrices at severity 1.0, and the distance between two results was taken in Oklab. The matrices are written from memory of the published table and were not re-read today (asserted); the dark mode thread ran its own simulation and got .068 to .071 for mint against marigold, where this one gets .069 and .072.

| Pair | Full color | Protan | Deutan | Tritan |
|---|---|---|---|---|
| sky, mint | .083 | .078 | .075 | .016 |
| sky, marigold | .152 | .136 | .146 | .158 |
| sky, lime | .175 | .168 | .181 | .128 |
| mint, marigold | .116 | .069 | .072 | .151 |
| mint, lime | .112 | .091 | .111 | .119 |
| marigold, lime | .082 | .077 | .056 | .071 |

What follows (inferred):

- The four state fills hold. The closest pair under red-green vision is marigold and lime at .056.
- No fifth hue on the ring holds. Under deutan vision lilac is .004 from sky and pink .005 from mint. Peach is .022 to .036 from marigold and aqua .011 to .042 from mint or sky.
- Sky and mint are .016 apart under tritan vision, the rare kind. They are told apart by icon and word, which every state already has.
- So shipping takes no color of its own. Ben's word is that it is green, so it is mint with the parcel icon (ledger L45), and the check `picks:A10` fails when two state fills come closer than .05 under protan or deutan vision.
- A dark yellow reads as brown. That is why lime and marigold are never a dark ground (constitution Art. 5, Dark mode, line 5).

## The weight of the text

Ben, 2026-11-15 02:46 UTC, on the Today render: "i feel like the fonts are a bit lighter idrc. like a middle ground would be good."

Measured on Ben's Mac on 2026-11-15 from the outlines of each file, in font units of 1000 (observed):

| File | Stroke of the l | Stroke of the I | Weight class | Glyphs |
|---|---|---|---|---|
| PP Neue Montreal 2.6 Book | 65 | 73 | 400 | 742 |
| Neue Montreal 1.0 Regular | 80 | 90 | 400 | 363 |
| PP Neue Montreal 2.6 Medium | 98 | 110 | 500 | 742 |
| Neue Montreal 1.0 Medium | 106 | 119 | 500 | 363 |

- The Mac holds PP 2.6 in Thin, Book, Italic, Medium, SemiBold Italic and Bold, and 1.0 in Light, Regular, Medium and Bold with italics. None is a variable font (observed).
- The x-height is 510 in both versions (observed), so the 1.0 Regular can stand in for the Book without moving a line.
- The 1.0 Regular sits almost halfway between the PP Book and the PP Medium (inferred from the table: 80 against 65 and 98).
- The 1.0 file has no ½ and no fractions, and its fixed-width digits come from the font-tnum patch (observed, and in [neue-montreal-file.md](neue-montreal-file.md)).
- The paid PP Neue Montreal family has a Regular between Book and Medium (asserted, from memory; not read today).

Open as R42 in the [ledger](../../../brand/ledger.md).
