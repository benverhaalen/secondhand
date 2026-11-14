# Which references should set how secondhand's frontend is built, judged and animated?
Researched 2026-11-14 by Ben (Claude Code agent, concept thread). Feature: cross-cutting.

Feeds [product/frontend-standard.md](../../../product/frontend-standard.md) and [product/copy.md](../../../product/copy.md). Method: it-already-exists RDD. Each reference has a job, a status (candidate / adopted / challenger / deferred / contradicted) and a transfer contract (keep, change, check). Every claim is marked *observed*, *asserted* or *inferred*.

## References

| Reference | Job | What we take | Status | Mark |
|---|---|---|---|---|
| Ben's harness `writing` skill (`references/app-copy.md`, `scripts/lint.py`, `hooks/reply_check.py`), read on his Mac 2026-11-14 | Expert judgment for words | C1 to C12 tells, "never invent a number", the "would a person say it across a table" test, and lint as candidates rather than verdicts. Ported to `scripts/copy-lint.mjs` | adopted | observed |
| Ben's `ui-factory` skill (`SKILL.md`, `references/check.md`) | Build and audit process | Light vs full size; the four screen lines; the door-check transitions table; break-ui worst-case data; the scripted checks; the critic is never the builder; "scripts can't prove it looks good" | adopted | observed |
| it-already-exists `ui-continuity.md`, `expert-processes.md` | Method | Two contracts (competence and character); real shipped screens as anchors; image ideation before freezing a system; side-by-side mismatch classes; motion review that first asks whether motion serves the task | adopted | observed |
| [Apple HIG, Motion](https://developer.apple.com/design/human-interface-guidelines/motion) (change log to Sep 2025) | Motion rules for the platform | "Add motion purposefully"; make motion optional and supplement with haptics; avoid motion on frequent interactions; let people cancel motion; feedback that follows the gesture | adopted | observed |
| [NN/g, animation duration](https://www.nngroup.com/articles/animation-duration/) | Evidence for timing | 100 to 500 ms by size and distance; about 100 ms for simple feedback; 200 to 300 ms for a modal; 500 ms "feel like a real drag"; entering a bit longer than exiting; ease-out for entering; more frequent means shorter | adopted | observed (via fetch) |
| [Emil Kowalski, Great Animations](https://emilkowal.ski/ui/great-animations) and his review-animations skill | Expert judgment for motion | Ease-out; usually under 300 ms; never animate keyboard-initiated actions; transform and opacity only; interruptible; no scale(0), start at 0.9 to 0.97; origin from the trigger; 30 to 80 ms stagger; no ease-in on UI; fix order delete, reduce, ease, origin | adopted | observed (via fetch); STANDARDS.md not read here, though it is vendored on Ben's Mac |
| [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) | Implementation checks | Honor reduced motion; never `transition: all`; correct transform origin; loading show delay of 150 to 300 ms and minimum time of 300 to 500 ms; skeletons mirror content; design empty, sparse, dense and error states; confirm or undo destructive actions; 16 px inputs; 44 px mobile targets | adopted (copy section excluded: its Title Case and voice rules are Vercel's house style and contradict Ben's labels) | observed (via fetch) |
| [Laws of UX](https://lawsofux.com/) | Vocabulary for principles | Jakob, Hick, Fitts, Von Restorff, Proximity, Similarity, Common region, Goal gradient, Peak-end, Doherty | candidate: names only, weighted by the evidence in [psychology.md](psychology.md) | observed (via fetch) |
| [psychology.md](psychology.md) (this repo) | Robustness filter | Choice overload is conditional; goal gradient is for light use; defaults work but must be transparent; no variable rewards; automation-bias guardrails | adopted as the correction to the Laws of UX | observed |
| Material 3 motion tokens | Second motion system | Not read: the page needs JavaScript to render | deferred. Revisit if iOS and Emil's values leave a gap | none |
| WCAG 2.2 AA | Access floor | 4.5:1 text and 3:1 for UI and large text; target size. Vercel prefers APCA, so this is a challenger | adopted (WCAG); APCA is a challenger | asserted |

## Transfer contracts that shaped the standard

| Property | From | Keep | Change (the 3%) | Check |
|---|---|---|---|---|
| Motion budget by frequency | Emil, HIG, NN/g | Frequent actions get no custom motion | Mapped to secondhand's frequencies: tabs constant, approvals many per day, a sale rare | Motion table in the standard §3 lists a frequency for each moment |
| Peak moment | Peak-end; brand C6 | The end of the experience is designed | No confetti. The peak is the amount you keep, a highlight and a haptic | No celebratory particles or counters in the Sold state |
| Undo over confirm | Gmail "Undo"; Vercel guidelines | Fast action with a safe window | Never-alone actions (address, pickup, payment) still need a tap and get no undo shortcut | Each destructive or outward action has a confirm or an undo |
| Loading as progress | Vercel skeletons; live build logs | Show real structure, not a spinner | The Researching state fills the draft field by field | No spinner visible after 1 s on Researching |
| Copy lint | Ben's writing skill | Same rules and ids | Added S1 (no exclamation marks) and ported to Node so Nate's agent can run it | `node scripts/copy-lint.mjs` flags the C4/C7/C10/O13 test strings and passes clean labels (run 2026-11-14) |

## Limits

- Emil's STANDARDS.md, his break-ui CATALOG.md and Jakub Krehel's lenses were not read in this session. They are vendored or linked from ui-factory on Ben's Mac.
- The "borrowed from" app column in the motion table is from product knowledge (*asserted*). The apps were not reopened this session.
- None of this has been tested on a real secondhand screen yet. The first screen built under it is the test.
