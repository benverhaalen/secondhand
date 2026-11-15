# 72: capture asks once for the studio, and gives it each dimension with its source

Updated: November 15, 2026. Owner: Nate. For: Ben. Agent: Claude Code, the capture team lead. Status: built and merged on main (engine 91162d28, routes 9b3b7023); not yet joined to the studio job. Answers [packet 55](55-slides-backend-for-nate.md) "Capture and the decision queue should surface `asks`".

## What capture does with the studio's asks

The studio's `plan.asks` in `manifest.json` (from `plan.py` `_ask()`, with each ask's type and fields) are not a list shown beside capture's questions. They enter the one question plan ([capture engine §11](../../../../spec/engines/capture.md#2-the-plan), "Studio asks"). So the person is asked once, in the order that unblocks the most, and a measurement capture already holds is never asked again by the studio.

- They count only after the person taps Generate (`studio.requested`). Retouch stays off unless they ask.
- Then the studio is one more target after the linked sites, with the same contract as every other question: field, kind, options, why, what it unlocks.
- A `measure` ask is capture's one dimensions question. Its parts are the class's plus those your kind names in `slides.json` (pants: waist, inseam, rise, leg opening).
- Every other ask (`cover`, `back`, `tag`, `graphic`, `flaw`) is a shot question, with your ask's text verbatim as its words and the zone or flaw kind carried in `shot`. These are never cut by the three-question cap.

## Dimensions: no tape requirement

Nate corrected the reading that a redraw needs a tape measurement: "So bens request wasn't to require that we rely on tape measurement, it was misinterpreted so please don't change that. Its only sensible to first rely on the published dimensions, if it was reliably identified, now too tables can be similar with a slight variation, but our system is built accurate enough to assess what certainty it is in each and intelligent generate ui inputs to clarify" (Nate, 2026-11-15, relayed by the orchestrator).

A render needs the item's dimensions, and capture fills them like any other field, in order:
1. the identified product's published dimensions, with the identity's confidence;
2. a depth reading or a scan;
3. asking.

When identity returns close variants (two tables of one line in two sizes), capture weighs each one. A variant at 0.9 or more is used as is. Otherwise a good depth reading that matches exactly one variant settles it silently. Otherwise capture asks exactly one question: a pick between the variants, with a typed measurement offered as one way to answer, never demanded.

## What you get

Your check can read each dimension from the capture record as `fields[]` in the plan (`GET /v1/captures/:id`): `{field, state, value, source, auto_accepted, required_by, recommended_by}`. The source is one of `lookup`, `measured`, `seen`, `label` or `you_said`, and the state is `known`, `proposed`, `waiting`, `missing`, `unobtainable` or `refused`. How the 8% band in `check.py` uses that source and confidence is your code; nothing changed from our side. `features-proof` #3 still says 20%, so that mismatch is yours to settle.

## Next action

- Ours: join the studio job to the capture state, so `manifest.json` `plan.asks` reaches the plan through the capture route. Not built yet.
- Yours: say whether the studio check should treat a `lookup` dimension differently from a `measured` one.

## Evidence

- Walks G1 and G2 in `app/src/engines/capture/walks.ts`: a table with two close variants asks 1 question with a depth reading and 2 without.
- Studio tests: Generate off leaves every walk identical; with it on, a flaw ask becomes one shot with your text. Command: `node --test --test-concurrency=1 app/src/engines/capture/plan.test.ts`, which passes (42 tests, 2026-11-15).
