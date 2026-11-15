# Pitch video

A plan, script and shot list for the submission video, and how to make it in about two hours. Written 2026-11-15 from Ben's ask ("in the plans before its over we should create a pitch video", [words](words.md#2026-11-15-who-judges-it-guarantees-the-buyer-side-messages-you-approve-meetups-audit-every-site-and-no-fixed-pickup-schedule)). The story follows [pitch.md](pitch.md); every claim in it must pass the honesty gate in [qa.md](qa.md#before-you-say-it-the-honesty-gate). *Agent proposal* until Ben picks.

## Constraints

- **Deadline:** submissions close Nov 15, 1:00 pm EST ([judging evidence](../research/data/ben/databricks-judging-evidence.md#madhacks-2026-itself-observed-2026-11-14)). Start the video by 9:00 am EST at the latest, so it is never what makes the submission late.
- **Length:** aim for 1:45. Check the MadHacks Devpost page for a cap; most Devpost hackathons ask for under 3 minutes (*inferred*, not checked for MadHacks).
- **Real over pretty.** The video argues that our photos and claims are honest, so every screen in it is the real app or a real recording. A designed screen that doesn't run yet is labeled "design" on screen. No AI-generated footage of the product or of people using it.
- **Sound off works.** Burned-in captions, because judges often watch muted in a list.

## The script

About 250 words of voice-over at a calm pace is 1:45. Read it once out loud with a timer and cut, don't speed up.

| # | Time | Voice-over | On screen | Source |
|---|---|---|---|---|
| 1 | 0:00 | "Most of what we own and don't use never gets sold." | a real closet or a corner of things, one slow push in | phone footage |
| 2 | 0:05 | "Hand it to a consignment store and a twenty-dollar shirt pays you three dollars. Sell it yourself and you keep about seventeen, if you can face five apps, thirty messages, and the pickup." | the $3 against $17 card, then five app icons stacking up with message badges | brand card |
| 3 | 0:18 | "So it sits in the closet. secondhand is your second hand." | the wordmark; the o's second hand ticks once | brand motion |
| 4 | 0:24 | "Take a few photos. It works out what the thing is, measures it, and finds what it really sells for." | the guided camera on a real item: shot list, the found pop-up, measurements | screen recording, `camera-flow.mp4` if the app isn't ready |
| 5 | 0:38 | "It picks the sites where it will sell, writes a listing for each site's buyers, and shows what you keep on each." | the plan: sites with best and avoid, "you keep" per site; a sofa marked avoid on Depop | screen recording |
| 6 | 0:52 | "One tap and it's live." | post preview, the tap, each site ticking to live; a small on-screen timer | screen recording of a real post |
| 7 | 1:00 | "It answers buyers with facts from your item, handles offers inside the minimum you set, and asks you about everything else. You can approve every reply word for word." | the chat icon with a count; a reply card with fact chips; a held reply showing its unbacked claim | screen recording |
| 8 | 1:15 | "When it sells on one site, it comes down everywhere else, checked one by one." | Today: "Sold on Depop. Taking it down elsewhere." Tiles go to gone | screen recording or recorded run |
| 9 | 1:23 | "For a meetup, tap when you're free and where. You see who's coming before you say yes, and your address never goes out unless you tap." | the day and time picker, the who-is-coming card, Add to Calendar, the locked address row | screen recording |
| 10 | 1:31 | "And you can see why it did anything: where every fact came from, and the original behind every edited photo." | Why? on a price with its sales; the photo side by side with the slider | screen recording, benchmark side by side |
| 11 | 1:39 | "Built on Databricks, so every sale makes the next price better." | one beat: the architecture line or the table growing | the Databricks diagram from the website |
| 12 | 1:43 | "secondhand. Your second hand." | wordmark, URL | brand card |

If the Databricks judges see this too, add one sentence at step 11 from [pitch.md, the most impressive explanation](pitch.md#the-most-impressive-explanation), point 7, and let the video run to 2:00.

## Shot list

Record these in this order; each is short.

1. **Phone footage (10 min).** Closet push-in (5 s). Hands photographing one real item on the floor (10 s). Ben's real tee, hoodie and work pants from the website thread are the items, so the video, site and demo match.
2. **Screen recordings (30 min).** The iPhone's own screen recording on the real app, or the web build in a phone-sized browser window. One take per step 4 to 10. Turn on Do Not Disturb, set the clock to 9:41, use the demo account's data ([demo worlds](../app/README.md)).
3. **Brand cards (15 min).** The $3 against $17 card, the wordmark, the end card, from the brand system's tokens. The website thread's renders can be reused as stills.
4. **Voice-over (15 min).** Record the script in one quiet room on a phone held 20 cm away, in two takes. A real voice from a founder reads as more honest than a synthetic one.

## Assembling it fast

1. **Edit (40 min).** CapCut or iMovie: drop the voice-over first, then lay each shot under its line. Cuts on the words, no transitions besides a straight cut. Auto captions, then fix brand and site names by hand (secondhand lowercase, Depop, Poshmark).
2. **Music.** One quiet track from the editor's free library at about -24 dB under the voice, or none.
3. **Export** 1080 by 1920 if the demo is phone-first, or 1920 by 1080 with the phone centered for Devpost. Devpost embeds YouTube or Vimeo: upload as unlisted.
4. **Check** muted, on a phone, once. Every claim on screen matches the honesty gate.

Total: about 2 hours with one person, less with two (one records screens while the other edits).

## If there's no time

Fallback in 30 minutes: a screen recording of one item going from camera to live, with the 30-second pitch from [pitch.md](pitch.md#the-simplest-pitch) read over it and captions on. One continuous real take beats a polished montage of mockups.

## What an agent can do for it

An agent can assemble a draft cut from the web build: drive the screens with Playwright at phone size, record them, lay captions and the brand cards with ffmpeg, and leave the voice-over track for Ben to record. Ask for it in this thread with the screens that run.
