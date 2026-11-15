Read these files now, before anything else: references/every-playbook.md, references/principles/laziness-protocol.md, references/principles/exhaust-the-design-space.md.

### Prototype

**You own the design decision, not the code. The prototype is a throwaway instrument. The real build follows Feature.**

The one playbook where the "smallest change" of `references/principles/laziness-protocol.md` and the verification bar invert. Rough over polished, code quality does not matter, no planning. The rigor is in picking the right design. Propose variations the user didn't ask for, throw an approach away and try another. Test-first does not apply to the throwaway code; the observation in step 5 is the test, and the proving command runs that observation.

1. Scope the decision the prototype exists to make: which layout, which interaction, which density, or for an empirical fork which behavior, timing, or approach. No decision means no prototype. Route to Feature. State done as "he can see each variant and pick". Run `step start prototype --prove "<command that builds and opens or exercises every variant>"`.
2. Gather references when the design space is open. Search for prior art, summarize a moodboard of themes, palettes, and layouts, let the user pick directions before building. Skip when the direction is set.
3. Build throwaway in an isolated scratch dir, separate from production source. For a visual decision, vanilla HTML/CSS/JS or the lightest stack that renders the idea, CDN deps, a dev server with hot reload. For a behavioral or timing decision, the smallest script that exercises the question. No production framework, no abstractions. Log inputs and state changes to a replayable event log when the question is about behavior.
4. When comparing alternatives, build them behind one switcher (buttons or a keypress), each variant labeled. This is `references/principles/exhaust-the-design-space.md` made concrete.
5. Verify on the matching surface. For a visual decision, screenshot each variant and drive the interaction in the real UI. For a behavioral or timing decision, observe the thing you are deciding by logging the timing, printing the output, or watching the render. The observation is the test here, not an assertion.
6. Present alternatives, tradeoffs, and a recommendation. The output is the decision plus the throwaway artifact, not shippable code. Hand the chosen direction to **Feature** (or a types-and-modules sketch for the shape) for the real build. Close with `step done`.

**Reply:** the variants explored, the evidence (screenshots for a visual decision, the observed output or timing for a behavioral one), tradeoffs, your recommendation, and the scratch path. Say plainly that the prototype is throwaway.
