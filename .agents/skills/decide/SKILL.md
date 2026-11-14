---
name: decide
description: Use in secondhand before any consequential choice (a feature's behavior, a screen's structure, a model, API or library, a data design, a pitch claim), anything that shapes what gets built next or is hard to undo. Produces a decision brief with options, evidence and a recommendation, decides the means yourself, and routes taste, direction and scope to Ben or Nate.
---

# decide

The failure this prevents: the most common answer instead of the right one, an idea that only sounds good, or a call made for Ben and Nate that was theirs.

**Who decides.** Ben and Nate hold direction, taste, scope and anything not undoable, public or billed. You hold the means: make technical calls yourself, write down why, and move on. If a cheap run could answer the question, run it instead of asking.

0. **Weigh it.** Check the tier and problem type in `.agents/thinking.md`. A Tier 1 change gets every step below plus a fresh review.
1. **Frame.** Write the outcome, who it serves, and what someone will be able to see or do when it's done. Check `product/vision.md`, the feature page and `product/decisions.md` first, because it may already be decided. Search `product/words.md` for what Ben or Nate said about it.
2. **Name the common answer.** Write the answer a model with no context would give. Keep it only if you can say why it's right here.
3. **Find what exists.** Look for direct references and for problems with the same structure in other fields. Give each reference a job: evidence, interaction, visual, mechanism or a weak preference signal. Any fact that could have changed goes through the `research-note` skill. `product/decision-map.md` shows how a reference gets carried into the design (keep, change, check).
4. **Options.** Give 2 to 4 options that differ on the assumption that decides the question, not just in wording. For each, say what it rests on (linked notes with their evidence marks) and what result would show it wrong.
5. **Recommend.** Pick one, give the reason, and name the strongest rival.
6. **Route.**
   - If the choice is yours: do it, and record it in the feature page's "How it works" with its evidence.
   - If it's theirs: ask as 2 to 4 options they can tap, each with its consequence. Keep working on your recommendation while you wait, if that work can be undone. Never move a line to Decided yourself.
7. **Record once agreed.** Add a `product/decisions.md` entry with "Agreed by:" and a link to their words. Add their quote verbatim to `words.md`. Update the vision and the feature page. Then run `node .agents/check.mjs`.

Brief shape, in a feature page's Open section or in a message:

```
Question: <one line, in their words>
Decides: Ben | Nate | both | agent
Common answer: <...> kept/dropped because <...>
A: <...>. Rests on <note#line [observed]>. Wrong if <...>.
B: <...>
Recommend: <A> because <...>. Strongest rival: <B>.
```

If Ben's harness is installed, `frame`, `research` and `reference-driven-development` are the full versions of these steps. This skill is the contract their output has to meet in this repo.
