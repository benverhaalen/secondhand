# Stage 2. Screen frame, and the four screen lines

Open when: full size, before directions for a big screen (a new surface, entry point or navigation level). At light size write only the four lines, from the code and the record, in a few lines.

1. The four screen lines: the user; how often and how long they use it; the main task; the worst-consequence task. When the full `frame` ran, use its options. Also name the default entry point and one representative complete journey through it (old skill's framing).
2. Structure is chosen by condition first, recorded as structure (screens, navigation model, steps to value), not looks. Example conditions from the research (practitioner rules, graded D: ux-structure-verification.md:52): a wizard for infrequent or branching tasks, a single form for frequent ones; one primary action per screen; items used together placed together. His words this serves: "primitives and ways that UI UX designers kind of choose to lay out and like architect and scaffold everything".
3. For a known task family, read the competence and character contracts and the task-family conventions in `~/.claude/skills/reference-driven-development/references/ui-continuity.md` (for example chat: streaming, cancel, IME, scroll anchoring) and inspect real conventional interfaces for that family; an attractive mockup does not establish behaviour.
4. The state list: ideal, empty, loading, error, partial, plus any the four lines imply (first run, permission denied, very long content, exactly one item). He asked for "the different states and screens at the edge cases too". The worst-case data catalogue in `~/.local/share/harness/vendor/emil/break-ui/CATALOG.md` is the source for realistic extremes.
5. The pattern question for each part: reuse, variant or new (rules in `build.md`).
6. Write all of this to `brand/screens/<screen>.md` (or the project's design folder). Directions, the door check and the builder all read this file.
