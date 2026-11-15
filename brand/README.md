# brand/

The secondhand brand. Status: in progress. Ben picks by looking at image boards; nothing is final until it is Locked in the ledger.

- [constitution.md](constitution.md): how anything secondhand makes looks and sounds, in any medium and language. Start here.
- [ledger.md](ledger.md): what Ben locked, what agents decided, and what is still open.
- [tokens.css](tokens.css): the only place values live.
- [coder-card.md](coder-card.md): read before any UI edit.
- [media.json](media.json) and [media.css](media.css): each medium's canvas, margins, sizes and layouts, as numbers the checker reads and as variables a page uses.
- [templates/](templates/): where a deck, a post and a story start. Copy one, change the words and photos, and run `node scripts/brand-check.mjs <file> --medium deck|post|story`.
- `explore/`: each round's images, inputs and lineage. Round 6 is the decision boards.

Images are made with the [image-gen skill](../.agents/skills/image-gen/SKILL.md). This is a hackathon demo ([Ben](../product/words.md#2026-11-14-demo-not-production)): the app ships PP Neue Montreal 2.6 (Book and Medium) and Clofie SemiBold, loaded at build time from a local folder. Font files are gitignored and never committed to this public repo. PP Neue Montreal 2.6 has its own tabular figures, so nothing is patched (constitution Art. 6, rule 7). `scripts/font-tnum.py` adds them to a face that lacks them, and is kept for that.
