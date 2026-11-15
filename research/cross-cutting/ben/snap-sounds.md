# What makes a snap sound feel good, and which free recordings can we use?
Researched 2026-11-15 by Ben (Claude Code agent, brand thread). Feature: cross-cutting (brand).

Ben, [round 11](../../../product/words.md#2026-11-15-round-11-picks), asked for "actual snap assets possibly from free music packs rather than midi", then for who talks about "satisfying snaps", naming the Nintendo Switch click as the family but "too recognizable", and for free examples we can use. This note feeds open row R36 in [brand/ledger.md](../../../brand/ledger.md) and the sound section of [round 12](https://claude.ai/artifact/7a98Pc4VWDoarvKACEhvVP). Pages were read through a fetch helper on 2026-11-15, which returns a paraphrase. Marks: *observed* (read on the page, or measured here), *asserted* (a source says so and we did not check it, or from memory), *inferred* (our reasoning), *not read*.

## Draft, and what changed

Draft from memory: a satisfying snap is one sharp hit (a fast attack), gone almost at once (a short decay), with a little low body under the crack, and nothing after it. The Switch click and a Zippo lid are that shape.

What changed: no page we could read says any of this. Of the draft, the fast attack, the short decay and the single hit hold for the 12 recordings that sound crisp to us (measured below). The low body does not: the two cleanest finger snaps, snap-1 and snap-3, have almost none, so it is a choice and not a trait of the family. The draft's "3 to 6 kHz" claim on the round 12 page was also wrong and is corrected there: the snaps center at 2.5 to 4.1 kHz.

## What the sources say

| Source | What it says | Mark |
|---|---|---|
| [Wikipedia, Zippo](https://en.wikipedia.org/wiki/Zippo) | The open "clink" and close "clunk" come from a spring-loaded cam, and Zippo registered the click as a sound mark in 2018. A later lighter's lid was tuned to keep the click | asserted (read by the helper, not reopened) |
| [Wikipedia, Sound trademark](https://en.wikipedia.org/wiki/Sonic_logo) | A sound logo should be unique, memorable and relevant to the brand promise. A melody is the most memorable sequence, because the ear expects its ending | asserted (read by the helper) |
| [Nintendo Switch](https://en.wikipedia.org/wiki/Nintendo_Switch) | Nothing on the click | observed by the helper |
| [Material sound](https://m2.material.io/design/sound/about-sound.html), [Apple HIG, Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio) | Served only a script shell to the helper, so no content | not read |

What to take from them (*inferred*): the Zippo is the right model for us, a sound that comes from a real mechanism and is owned by being always the same, not by being musical. The sound-trademark article argues the other way, that a melody is remembered better than a click. We do not need a sound logo; the snap is feedback on a sale, so one short hit fits, and a melody would be a second thing to own.

## The recordings

Ten are from Pixabay and three from Kenney's Interface Sounds pack. They were downloaded on Ben's Mac (the container's proxy refused both sites), checked by sha256 on arrival, and cut to the one hit. None are in git.

| Licence | What it allows | Mark |
|---|---|---|
| [Pixabay Content License summary](https://pixabay.com/service/license-summary/) | Use without credit to the author, but not to sell or give away the content "on a Standalone basis". So the files ship inside the app and never sit in the public repo or a sound pack of ours | asserted (read by the helper; item pages not opened) |
| [Kenney, Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0 | asserted |

Measured here with ffmpeg and numpy on the trimmed files (*observed*). Onset is where the sound first reaches a tenth of its peak; "to −20 dB" is time after the peak; the band is the share of energy from 3 to 6 kHz in the first 50 ms.

| File | Title, author | Peak after onset | To −20 dB | Hits | Center | Below 500 Hz | 3–6 kHz |
|---|---|---|---|---|---|---|---|
| snap-1 | Finger snap, Natty23 | 2.0 ms | 3.3 ms | 1 | 3.2 kHz | 6% | 5% |
| snap-2 | Finger snap without reverb, ShidenBeatsMusic | 0.9 ms | 2.7 ms | 1 | 3.6 kHz | 27% | 32% |
| snap-3 | Finger snap sound, SoundReality | 1.7 ms | 5.6 ms | 1 | 3.4 kHz | 1% | 17% |
| snap-5 | Snap sound effect, RodriEffects | 38 ms | 12 ms | 1 | 2.5 kHz | 0% | 7% |
| snap-6 | Snap fingers, Mrstokes302 | 17 ms | 4.0 ms | 2 | 2.6 kHz | 0% | 6% |
| snap-7 | Finger click, sumaga123 | 2.6 ms | 6.4 ms | 1 | 4.1 kHz | 1% | 13% |
| click-1 | Crisp click, InJourney | 1.0 ms | 5.5 ms | 1 | 3.8 kHz | 47% | 11% |
| click-2 | Pop click, SoundReality | 3.4 ms | 25 ms | 1 | 0.9 kHz | 0% | 0% |
| clack-1 | Stick snap, freesound_community | 6.3 ms | 17 ms | 1 | 5.5 kHz | 15% | 30% |
| kenney tick_001 | Tick, higher | 0.5 ms | 5.1 ms | 1 | 9.6 kHz | 0% | 28% |
| kenney tick_002 | Tick | 0.5 ms | 9.7 ms | 1 | 4.0 kHz | 0% | 47% |
| kenney click_005 | Click | 0.8 ms | under 4 ms | 1 | 0.5 kHz | 54% | 1% |

Reading the numbers (*inferred*): the ones that sound like a snap to us peak within 3 ms of starting, fall 20 dB within 7 ms and hold one hit. snap-5 and snap-6 are slow to peak, and snap-6 has two hits, which is the "flam" that makes a snap sound sloppy. snap-2 is the only finger snap with both a bright crack and real weight below 500 Hz, which is why it is recommended: on a phone speaker, which cuts most of the low end, it should still sound full where snap-1 sounds thin. That last point is untested on a phone.

## Limits

No search engine was reachable (the helper's searches were refused by robots rules, and The Verge was blocked), the Material and Apple pages gave no content, and no sound designer's own writing was read. So "nothing explains why a snap feels good" means only that we found nothing, not that nothing exists. Not checked: the AirPods case, MagSafe, Apple Pay, a pen click, a mechanical keyboard. Mixkit's 56 free clicks were listed but not downloaded, and its licence was not opened.
