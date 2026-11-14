# Coder card (read before any UI edit)

The short form of [constitution.md](constitution.md) for anyone building a screen. If this card and the constitution disagree, the constitution wins; fix this card. Values are *agent proposals* until Ben picks in the [brand kit](https://claude.ai/artifact/NdqVRvvD43fFPnhxDFbiFZ).

Precedence: Ben's direct decisions, then the constitution, then the approved image for composition, then the code as it stands, then agent inference.

1. **Every element has a reason** (Article 1). Before a screen counts as done, write the reason ledger: each element and the end, code or rule it serves. No reason means delete it.
2. **Tokens only.** Read [tokens.css](tokens.css) first and write `var(--name)`, never raw values.
3. **Wordmark** "secondhand", lowercase, centered in the nav bar of every main screen (C1).
4. **Photos lead.** Every item shows its photo, as the largest image in its group (C3). Demo photos are in `assets/demo-items/`.
5. **One field per view** (C2): the textured sky, mint and lime gradient, behind the one thing that needs the person. Black text on it, nothing else.
6. **Color is a ground, never ink.** No colored text, lines or icons on white, except platform logos and the brick alert. State fills: mint live, lime sold or paid, marigold needs you, brick failed, gray ended, sky new.
7. **One black pill per decision** (C4), with the amount in it when there is one ("Accept $38"). The second most likely action is an outline. Everything else is named under More (···). Side actions such as Change and Message are gray fills.
8. **Type:** two weights (400; 500 only on buttons and the selected tab), sizes 13, 15, 17, 22, 34 and one 50 for a peak number. Sentence case. No mono labels, no uppercase, no bold. Inter is banned.
9. **Money** in the text face with tabular figures, always with what it is ("You keep $46.95"). One lime highlight per view.
10. **Space:** 4, 8, 12, 16, 20, 24, 32, 48, 64. Inside a card is tighter than between cards. No box in a box. 20 pt side margins.
11. **Platforms are logos** from `assets/platforms/`, with the name in the accessibility label (C5).
12. **Words:** [product/copy.md](../product/copy.md) and the [UI constitution](../product/ui-constitution.md). Plain words a person could say back. No sample sizes or stats jargon.
13. **Build, audit and motion:** [product/frontend-standard.md](../product/frontend-standard.md). Then run the brand checks in constitution Part IV.
