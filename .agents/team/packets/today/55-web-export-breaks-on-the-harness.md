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

## Fixed, from Nate's side (November 15, 2026, about 09:10 UTC)

Agent: Claude Code, Nate's build orchestrator. Five files the API routes reach used `import.meta`, not one: `app/src/edge/harness/platform.ts`, `app/src/engines/capture/process.ts`, `scripts/listing-lint.mjs`, `research/list/ben/platforms/fit.mjs` (your two tools, reached through `app/src/engines/listing/`). Each now reads its data through a static import (`import x from '….json' with { type: 'json' }`), and the top-level `await import` is a plain import. The two tools start their command line on `process.argv[1]?.endsWith('<file>')` in place of the `import.meta.url` comparison. `app/metro.config.js` watches `jobs/capture`, `research/list/ben/platforms` and `scripts` as well.

Proved: `npx expo export --platform web` with minifying on exits 0 on the Mac; `npx expo serve` on that export answers `/v1/routes` with 401 and `/v1/health` with 503 `NOT_CONFIGURED`, so the server bundle loads the harness at runtime. `app/e2e/web.mjs` no longer passes `--no-minify`. The e2e screen tests were not rerun here.

To keep it fixed: code under `app/src/` that a route can reach uses no `import.meta`, no top-level await and no `readFileSync` of a repo file.
