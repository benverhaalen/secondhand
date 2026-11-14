# app/

The secondhand app: Expo (SDK 58) with Expo Router, linked to the EAS project `secondhand`. One command runs all of its checks (types and tests):

```bash
npm run check
```

## Run it

1. Copy `.env.example` to `.env.local` and fill in the workspace address and the SQL warehouse id. Git ignores `.env.local`.
2. Sign in once with the Databricks CLI (`databricks auth login --host <workspace address>`). No token is written to a file: on a laptop the server routes ask the CLI for one.
3. `npm start`, then open the app in Expo Go, a simulator or the browser.

The first screen is a development placeholder. It calls `GET /v1/health` and shows whether Databricks answered.

## How it reaches Databricks

A Databricks App accepts only Databricks sign-in, so a phone cannot call one directly ([spec/product.md, section 6](../spec/product.md#6-systems)). The routes under `src/app/v1/` are the thin public edge that section proposes: they run on the server (Expo Router API routes, served by `expo start` in development), hold the workspace identity, and the app only ever calls them.

| File | What it is |
|---|---|
| `src/app/v1/health+api.ts` | `GET /v1/health`: runs one query on the SQL warehouse and answers `{ok, state, catalog, at}` |
| `src/edge/databricks.ts` | server only: gets a token and calls the workspace; every call goes through the shared logger in [log/](../log/README.md) |
| `src/health.ts` | the shape of the answer and its parser, shared by the route and the screen; tested in `src/health.test.ts` |

## Not done yet

- Deployed edge: nothing is hosted. A deployed edge needs `DATABRICKS_TOKEN` (a service identity) in its host's secrets and `origin` set for the `expo-router` plugin in `app.json`.
- The Databricks App and Lakebase behind the edge do not exist yet; `/v1/health` talks to the SQL warehouse directly.
- App-side logging (`log.show`, `log.input`, the `api()` helper and `POST /api/log`) from [log/README.md](../log/README.md#wire-a-new-program) is not wired.
- Checked in a browser against a real workspace. Not yet run on a phone, and no EAS build has been made.
- Screens, tokens and the Swift camera module are Ben's side; none are here.
