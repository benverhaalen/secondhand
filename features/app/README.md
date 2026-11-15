# app: every screen as built

The renders and the gallery that show Ben every screen of the app, in light and dark, with its check results. `node scripts/app-check.mjs` writes them; [.agents/ui-build/README.md](../../.agents/ui-build/README.md) is how a page gets built.

| File | What it is |
|---|---|
| `renders/<slug>.png`, `<slug>-dark.png` | Each route at 390 x 844, at 2x |
| `renders/<slug>.json` | The route, its screen and states, its status and its brand-check findings |
| `gallery.html` | Every screen side by side, grouped by tab, written by `scripts/app-gallery.mjs` |
