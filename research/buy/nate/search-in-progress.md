# How professional products show a many-source search while it runs, and what makes it read as credible
Researched 2026-11-15 by Nate (Claude Code, the app-wiring lead, Opus 5.5; a Sonnet retriever searched the web and Exa and fetched the pages marked observed). Feature: buy, for Nate's ask that every search show its reach while it loads ([words](../../../product/words.md#2026-11-15-nate-every-search-shows-how-far-it-reaches-while-it-loads-scaffold-the-screens-with-everything-wired-so-design-can-pass-over)).

Marks: *observed* (the page was opened and says it), *asserted* (a search snippet or a third party says it, or memory), *inferred* (ours).

## The draft, and what changed

Draft from memory: travel metasearch shows "searching N sites" with a bar that fills, answer engines show "Reading N sources" with chips, and showing more work always reads as better.

What changed:
- No travel vendor documents a per-provider counter. What is on record is a per-price spinner (Skyscanner), one spinner that shrinks once there are enough results (Momondo), and a thin line that is easy to miss (Kayak). The record is a 2016 blog, *observed* ([Bodonyi](https://martsie.github.io/2016/07/20/progress-indication-on-flight-metasearch-websites/)). The draft's counter is ours to build, not a copied convention.
- Material 3 says "Don't show the progress of each activity in a group" (*observed*, [M3](https://m3.material.io/components/progress-indicators/guidelines)). So we show each source's outcome and counts, never a progress bar per source.
- More work on screen is not always better. NN/g warns that step-by-step views can be "rationalizations generated after the fact" (*observed*, [Explainable AI, 2025-12-12](https://www.nngroup.com/articles/explainable-ai/)). The labor illusion holds only when the work is real (inferred from the next table).

## References, each with a job

| Reference | Job | What it shows or says | Take | Mark |
|---|---|---|---|---|
| OpenAI deep research ([launch](https://openai.com/index/introducing-deep-research/), [help](https://help.openai.com/en/articles/10500283-deep-research)) | interaction | a sidebar "with a summary of the steps taken and sources used", progress you can follow and interrupt, and an activity history kept on the finished report | keep the record of what was searched after the answer lands | observed |
| ChatGPT agent, as NN/g saw it ([2025-08-08](https://www.nngroup.com/articles/impressions-chatgpt-agent/)) | evidence | the live view gave counts and time: 10 web searches, 96 sources, 6 minutes | counts and elapsed time are what a reviewer repeats back | asserted (snippet) |
| Gemini Deep Research ([launch](https://blog.google/products/gemini/google-gemini-deep-research/), [overview](https://gemini.google/overview/deep-research/)) | interaction | a plan you approve, "a thinking panel for users to follow", "browse up to hundreds of websites" | name the reach before it starts: the sources asked are listed at once | observed |
| Momondo ([company page](https://www.momondo.com.au/company)); Going on Momondo ([2026-10-14](https://www.going.com/guides/how-to-use-momondo)) | evidence | searches "hundreds of ... sites at once"; done when the wheel stops; filters work once the search has begun | the list is usable while it fills | observed |
| Defera's flight-search timing ([2026-10-20](https://defera.app/guides/fastest-flight-search-engines)), a rival's own test | evidence | "the fastest engines showed the first flights as soon as they had them"; Google Flights first fares about 0.8 s | the first source that lands shows its rows at once | observed |
| NN/g, long waits ([2021-09-05](https://www.nngroup.com/articles/designing-for-waits-and-interruptions/)) | mechanism | where a percent is unreliable, "provide a list of completed and remaining steps" | sources done and sources still asked, not a percent | observed |
| NN/g, progress indicators ([2014-10-26](https://www.nngroup.com/articles/progress-indicators/)) | mechanism | a looped indicator for 2 to 9 s, percent-done from 10 s; a wrong estimate costs credibility | no time estimate we cannot back; our searches settle in about 1.4 s on the dev server (measured below) | observed |
| Material 3 ([guidelines](https://m3.material.io/components/progress-indicators/guidelines)) | mechanism | "the indicator must accurately represent the progress"; switch from indeterminate to determinate as information arrives | "4 of 6 answered" appears only when frames say so | observed |
| Jakob Nielsen, "Slow AI" ([2025-10-13](https://jakobnielsenphd.substack.com/p/slow-ai)) | mechanism | label partial results as incomplete | rows before the settled answer are marked as so far | observed |
| Buell and Norton, "The Labor Illusion" ([Management Science 57(9), 2011](https://www.hbs.edu/faculty/Pages/item.aspx?num=40158)) | evidence | people "can actually prefer websites with longer waits" when the work is shown; tested on travel and dating sites | showing the work raises the answer's value, so we never hide it, and never pad it | observed (abstract) |

## What makes it read as credible instead of decorative (inferred)

1. Every figure has a source the person could check: a named site, a count of listings read, a time. "Searching..." with a spinner is decoration. "Poshmark: 48 read, 47 kept, 1.2 s" is evidence.
2. Failures are shown. A source that refused, ran late or needs an account says so in its row. A view where every source succeeds every time reads as staged.
3. The view keeps nothing invented. It does not count up to a number it already has, show a percent it cannot compute, or slow an animation to fill a wait. Motion marks a real change of state, once.
4. The record stays after the answer. What was searched is still there to open once the results are in.

## The four patterns we take

1. **Every source asked is a row from the first frame**, named, in the order asked, with its state. It resolves in place as its frame lands: arrived with read, kept and dropped-and-why; late; failed with the server's reason; needs your account; saved copy, checking again. Source: the 202's stages and each `job.stage`.
2. **Counts, not percents.** "4 of 6 answered", listings read, kept, time to first and full answer, each a field of a frame (`found`, `answer.ms`, `searched[].ms`). No bar per source (Material 3).
3. **Rows usable before the end, marked as so far**, from each source's `answer.partial`. They are replaced by the ranked list at `answer.settled`.
4. **The record stays.** After settle, the per-source rows fold under the results as what we searched, and still open.

The build is the view model `app/src/buy/reach.ts` (every field above comes from a frame) and the search screen scaffolded on it.

## Our own number

A visitor search for "levi 501" on the dev server, 2026-11-15 05:50 Central: six sources asked. Four failed with `no_route`, because the dev server has no harness or Apify lane. Dupe read 40, kept 22 and dropped 18 duplicates. Poshmark read 48 and kept 47. First rows came at 1.0 s and the settled answer at 1.4 s (`app/src/buy/fixtures/search-live-levi.json`, *observed*).

## Limits

- Not reached: help or engineering pages for Google Flights, Kayak and Skyscanner on their loading view; a primary page for Perplexity's in-progress view; Exa, You.com, Browserbase and Firecrawl pages; the Apple HIG text, which rendered only its title.
- No marketing animation of a many-source search was found on a primary page. That does not show none exist.
- Consensus and Elicit appeared only in snippets and changelogs (*asserted*), so they are left out of the patterns.
