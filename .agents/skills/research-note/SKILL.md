---
name: research-note
description: Use in secondhand when an answer rests on a fact that could have changed (versions, APIs, prices, platform rules, model names, recent launches), on a reference or prior work you don't hold from a primary source, and before writing anything into research/. Produces a note with every claim marked observed, asserted or inferred.
---

# research-note

The failure this prevents: relying on pretraining or another model's summary, and turning a narrow search into "nothing exists".

1. Write the question, the decision it feeds, and your draft answer from memory.
2. Search both for the draft and against it. Say whether the draft changed.
3. Use the rawest source: code, docs, changelog, paper, the product itself, the author's own post. A listicle or another model's answer only points you to a source. Open the source at the line you cite. Check the date, since this field moves monthly.
4. Mark every claim:
   - *observed*: you read it in the source, or ran it.
   - *asserted*: the source says it without showing it, or you're going from memory.
   - *inferred*: your own reasoning.
   Add the model and date for any claim about model behavior.
5. Give each reference a job, and say what to take from it, what to change, and why the reference is good, not just popular.
6. Save the note as `research/<slug>/<person>/<topic>.md`, where `<person>` is your human. The header and format are in `research/README.md`. Add a one-line summary with a link on `features/<slug>/README.md`. If the note bears on a choice in `spec/features/<slug>.md`, link it from that row, or add the disagreement to the spec's Open section. Until the spec cites it, `node scripts/evidence.mjs <slug>` lists the note as research the spec has not caught up with.
7. Say what you searched and what you couldn't reach. A limited search doesn't show that something doesn't exist.

Run `node .agents/check.mjs`. It fails a note that has no header or no evidence marks.
