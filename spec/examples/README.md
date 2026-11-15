# Contract examples

One request and response per `/v1` endpoint in [product.md §7](../product.md#7-contract-conventions), the stream frames of a job, and every error code. Ben's screens mock from these files; the edge (`app/src/edge/api/`) serves an endpoint from its example until the engine behind it lands, through the same handler, so the swap is one line.

Each file is `{ "examples": [ ... ] }`. An example:

| Field | Meaning |
|---|---|
| `name` | unique, used by `MOCK=<names>` and by the edge's example fallback |
| `endpoint` | `METHOD /v1/path` with `:params`, exactly as §7 writes it |
| `path` | a concrete path with query |
| `auth` | `user` (Bearer from sign-in, the default), `visitor` (no token, rate limited) or `none` |
| `request` | `{headers?, body?}`; every POST that creates or acts carries `Idempotency-Key` |
| `status`, `response` | what comes back; a list example sets `list: true` and answers `{data, next_cursor}` |

`jobs.json` also holds `streams`: the SSE frames of `GET /v1/jobs/:id/events` and `GET /v1/stream`, each `{id, event, data}` so `Last-Event-ID` resumes. `errors.json` has one example per error code.

Rows marked `"proposed": true` are packet 47's asks that are not in the canon yet (*agent proposal*); they leave that mark when product.md §7 carries them. `node --test spec/examples.test.mjs` checks coverage, cents, id prefixes, UTC times, idempotency keys, the error table and the stage frames.
