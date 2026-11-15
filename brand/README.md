# brand/

The secondhand brand. Status: in progress. Ben picks by looking at image boards; nothing is final until it is Locked in the ledger.

- [constitution.md](constitution.md): how anything secondhand makes looks and sounds, in any medium and language. Start here.
- [ledger.md](ledger.md): what Ben locked, what agents decided, and what is still open.
- [tokens.css](tokens.css): the only place values live.
- [coder-card.md](coder-card.md): read before any UI edit.
- `explore/`: each round's images, inputs and lineage. Round 6 is the decision boards.

Images are made with the [image-gen skill](../.agents/skills/image-gen/SKILL.md). This is a hackathon demo ([Ben](../product/words.md#2026-11-14-demo-not-production)): the app ships Neue Montreal and Clofie, loaded at build time from a local folder. Font files are gitignored and never committed to this public repo. Neue Montreal has no tabular figures, so run `python3 scripts/font-tnum.py <file in> <file out>` on each of its files once and load the output; after that `tabular-nums` works (constitution Art. 6, rule 7).
