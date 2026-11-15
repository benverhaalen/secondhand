# API client

Checks, from `app/` (run each separately):

```sh
node --test --test-concurrency=1 src/api/client.test.ts
node --test --test-concurrency=1 src/api/sse.test.ts
npx tsc --noEmit -p .
```

Screens import `api` from `client.ts`. `api.call<T>('GET /v1/…')` returns JSON typed by the caller; the caller parses its shape at the boundary. `api.search(text, filters?)` posts to `/v1/search` and returns the job, with `SearchStage` imported from the server. Server imports are types only.

| File | Role |
| --- | --- |
| `origin.ts` | Web and Node: `EXPO_PUBLIC_API_ORIGIN`, otherwise the same origin (`''`). |
| `origin.native.ts` | Device: the same environment variable, otherwise `http://` plus Expo's bundle host, otherwise `null`. Set the variable for a standalone build; a missing origin fails as `unreachable`. |
| `fetch.ts` | Web and Node use `globalThis.fetch`. |
| `fetch.native.ts` | Devices use `expo/fetch` so response bodies stream. |
| `client.ts` | Owns request headers, session state, `ApiFailure`, search and job streaming. Tests inject fetch through `createClient`; callers can also supply `now` and the app's shared `log`. The default log uses the shared logger with a bounded memory sink. |
| `sse.ts` | Incremental SSE parser. Keeps partial blocks, ignores comments, accepts LF and CRLF, joins data lines and counts malformed blocks in `skipped`. |
| `client.test.ts`, `sse.test.ts` | Fake transports and the recorded search fixture test requests, parsing, resume, cancellation and origins without network access. |

`session.token` starts as `null`. Future sign-in code can assign a token there; every later request sends it as `Authorization: Bearer <token>`. This module cannot issue tokens. The server's `X-Visitor-Id` response header becomes `session.visitor` and goes on later requests, including the job stream. Both fields live in memory and disappear when the app restarts.

`api.jobFrames(jobId, { signal, onFrame })` delivers server `SseFrame` objects in order. It decodes streamed UTF-8, or reads `text()` once when the body is null. A dropped connection resumes after the last delivered id, with up to three reconnections (four connections total), then throws `ApiFailure` with code `stream_lost`. A `job.state` frame with `done` or `failed` completes the stream. Aborting ends quietly. HTTP refusals and callback errors propagate.

Platform imports in `client.ts` are extensionless so Metro can choose `.native.ts`. The Node test installs a resolver scoped to those two imports while loading the client, then removes it. No test replaces or calls `globalThis.fetch`.
