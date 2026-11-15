# Coder card (read before any UI edit)

The short form of [constitution.md](constitution.md) for anyone building a screen. If this card and the constitution disagree, the constitution wins; fix this card. Values are *agent proposals* until Ben picks; what is locked is in [ledger.md](ledger.md).

Precedence: Ben's direct decisions, then the constitution, then the approved image for composition, then the code as it stands, then agent inference.

1. **Every element has a reason** (Article 1). Before a screen counts as done, write the reason ledger: each element and the end, code or rule it serves. No reason means delete it.
2. **Tokens only.** Read [tokens.css](tokens.css) first and write `var(--name)`, never raw values.
3. **Wordmark** "secondhand", lowercase, at the left of the nav bar, paired tags to its left with an 8 pt gap, messages at the right, and the page name below at 18 (C1).
4. **Photos lead.** Every item shows its photo, as the largest image in its group (C3). Demo photos are in `assets/demo-items/`.
5. **One field per view** (C2): `background: var(--field)` (never rebuild it), behind the one thing that needs the person. Black text on it; state pills on it are white.
6. **Color is a ground, never ink.** No colored text, lines or icons on white, except platform logos and the brick alert. Every state and interaction color is in constitution Art. 5, States: use those tokens, never invent a state. Every state pill has a word or an icon.
7. **One black pill per decision** (C4), with `--pill-glow` under it and with the amount in it when there is one ("Accept $38"). The second most likely action is a light fill, never an outline (R33). Everything else is named under More (···). Side actions such as Change and Message are gray fills.
8. **Type:** pick the size by role from the table in constitution Art. 6 (13, 15, 18, 21, 36, 50). PP Neue Montreal at 500 for text roles (Art. 6.1). Weight never changes with state. Clofie SemiBold (600) sets the lowercase secondhand wordmark, app screen headings at 36, and the largest headline on each public marketing entry page. Use PP Neue Montreal in sentence case for all other text. No mono labels, no uppercase, no bold. Inter is banned.
9. **Money** in the text face, with tabular figures only where it changes in place or sits in a column, always with what it is ("You get $46.95"). No band or highlight behind an amount; it stands out by size.
10. **Space:** 4, 8, 12, 16, 20, 24, 32, 48, 64. Inside a card is tighter than between cards. No box in a box. 20 pt side margins.
11. **Platforms are logos** from `assets/platforms/`, with the name in the accessibility label (C5).
12. **Words:** [product/copy.md](../product/copy.md) and the [UI constitution](../product/ui-constitution.md). Plain words a person could say back. No sample sizes or stats jargon.
13. **Build, audit and motion:** [product/frontend-standard.md](../product/frontend-standard.md). Then run the brand checks in constitution Part IV.
