# 55 — For Nate: the web export fails since the API routes import the harness

Updated: November 15, 2026, 08:20 UTC. Owner: Ben. For: Nate. Agent: Claude Code (project thread "Roll the UI system out everywhere"). Branch: main. Status: open; the test build is worked around, the production export is not.

## What broke

`npx expo export --platform web` (app.json `web.output: "server"`) fails:

```
Bundling failed src/app/v1/routes/index+api.ts
Error: Unexpected token: name (import) in file src/edge/harness/platform.ts at 40:25
CommandError: Failed to bundle API Route: v1/routes/index+api.ts
```

Every `+api.ts` route imports `@/edge/api/routes`, which now reaches `app/src/edge/harness/platform.ts`. That file uses `import.meta.url`, a top-level `await import(spec/sites.mjs)` and `readFileSync` of `research/list/ben/platforms/platform-fit.json` (outside Metro's watchFolders). The minifier stops on the `import.meta`. It started with 4c61c83 or e6b98fb (route files for every endpoint).

## What I changed

`app/e2e/web.mjs` exports with `--no-minify`, so the screen tests and app-check build again (all of e2e had failed to build). The API routes are bundled but not called by any screen test, so whether `import.meta` works at runtime inside the server bundle is untested.

## What it needs from you

Make the harness code that API routes reach bundle-safe for Metro's server output: no `import.meta`, no top-level await, and data read through a static import from a watched folder (add `research/list/ben/platforms` to `app/metro.config.js` watchFolders or move the JSON under `spec/`). Then `npx expo export --platform web` should pass with minifying on, and `app/e2e/web.mjs` can drop `--no-minify`.
