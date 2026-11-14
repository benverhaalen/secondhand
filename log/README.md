# Logging

Every secondhand program writes the same kind of line through this folder: the app, the server, each cloud job and each agent loop. Ben asked for this in [his words](../product/words.md#2026-11-14-logging-of-everything). The rule is the one in his harness's `build` skill:

- The log is append-only, with a session id and a sequence number on every line.
- It holds every input, every state change, and every outside call with its result.
- It holds the build version and the random seed.
- Personal data is masked by default.
- The test: could you replay what the person saw from the log alone?

The same log is what agents grep to debug, what `spec/replay.mjs` checks against the lifecycle spec, what the "why?" timeline shows, and what a hill-climb measures.

## What is set up, and what waits for code

| Part | State | Where |
|---|---|---|
| The contract: every event and its fields, what gets masked | Done | [spec/events.json](../spec/events.json) |
| JS logger for the app, the server and Node jobs | Done, tested | [index.js](index.js), [node.js](node.js) |
| Python logger for cloud jobs, image loops and Browser Use harnesses | Done, tested against the JS one | [secondhand_log.py](secondhand_log.py) |
| Checker: contract, order, unfinished calls, leaks, replay, the numbers | Done | `node spec/log.mjs <file...>` |
| Repo check: no prints in app code, no raw logs in git | Done | `node .agents/check.mjs` |
| A worked session with every event | Done | `node log/example.mjs` |
| The app, the server, the jobs, the Swift camera, the `events` table, MLflow | No code yet | [Wire a new program](#wire-a-new-program) |

## Use it

Start one log per process, then call a method at each moment in the table below. Every method writes one line.

```js
import { createLog, httpSink } from '../log/index.js';
const log = createLog({ src: 'app', build: `${version}+${commit}`, sink: httpSink(`${API}/api/log`) });

log.show('today', { state: 'card', decision: 'dc_1' });
log.input('today', 'card.option', { decision: 'dc_1', value: 'post' });
const out = await log.call('model', 'gpt-6-luna', input, () => judge(input), o => ({ model: o.model, cost_usd: o.cost, result: { label: o.label, p: o.p } }));
```

```python
import sys; sys.path.insert(0, 'log')   # or run with PYTHONPATH=log
from secondhand_log import create_log, file_sink, stdout_sink, tee_sink
log = create_log('job.relight', build, tee_sink(stdout_sink, file_sink(path)), origin=started_by).child(item=item, job=job)

run = log.agent('studio.relight', goal='a studio render that keeps the real logo')
run.step(action='render', why='no candidate yet')
out = run.call('model', 'seedream-5', {'scene': 'studio'}, lambda: render(), lambda o: {'cost_usd': o.usd, 'result': {'image': o.id}})
run.end(ok=True, result={'kept': out.id})
```

The table shows the JS calls. Python has the same methods with the extras as keyword arguments: `log.show('today', state='card')`, `log.child(item=item)`, `log.job(job, 'relight', 'failed', error=...)`. Two names differ: `create_log(..., origin=...)` for JS `createLog({ from })`, and `log.acall` for an async call.

| When this happens | Call | Event |
|---|---|---|
| The program starts or stops | `createLog({ src, build, sink, config })`, `log.end()` | `session.start`, `session.end` |
| The app comes to the front or leaves it | `log.event('app.state', { state })` | `app.state` |
| The person sees a screen or a new state of it | `log.show(screen, { state, ids })` | `ui.show` |
| The person taps, picks or types | `log.input(screen, control, { value })`; typed words go in `text` | `user.input` |
| The server receives a request or a webhook | `app.use(requestLogger(log))` after the body parser, then `req.log` in the handler. The query and body are logged as the input. | `request.start`, `request.end` |
| Anything leaves the process: HTTP, a model, a tool, a browser run, the database, a native module | `await log.call(kind, name, input, fn, describe)` | `call.start`, `call.end` |
| An agent loop runs | `run = log.agent(name, { goal })`, `run.step({ action, why })`, `run.call(...)`, `run.end({ ok })` | `agent.start`, `agent.step`, `agent.end` |
| A Job changes state or makes progress | `log.job(job, kind, state)`, `log.stage(job, stage, { state })` | `job.state`, `job.stage` |
| Something needs the person, and they answer or it lapses | `log.ask(decision, kind, tier)`, `log.answer(decision, option, { edited, card_ms })`, `log.close(decision, reason)` | `decision.open`, `decision.answer`, `decision.close` |
| A step in an item's life (names from [lifecycle.mjs](../spec/lifecycle.mjs)) | `log.action(item, action, actor, { site, price, floor })` | `item.action` |
| Another primitive changes state | `log.change(entity, id, to, { was })` | `state.change` |
| Something fails outside a call | `log.error(where, e)` | `error` |
| Nothing above fits | `log.note(msg)`, or add an event to the contract | `note` |

More that the logger does for you:

- **It never throws.** A value it cannot read becomes `[unreadable]`, a broken sink is skipped, and the call you wrapped still returns its result.
- **Ids on every line.** `log.child({ item, job, trace })` returns a logger that adds those ids to each line it writes. One `grep it_1` then shows an item's whole story across programs.
- **Links between programs.** `log.call` hands `fn` one argument, `{ call, from }`. Send `from` (`session#seq`) as the `x-secondhand-from` header, or give it to the job you start as `createLog({ from })` (Python: `origin=`), and the other side's line points back at the line that caused it. In Python, a `fn` that takes one argument gets the same dict.
- **Replayable randomness.** Use `log.random()` (Python: `log.random.random()`), never `Math.random()`. The seed is in `session.start`. Put model names, prompt versions and flags in `config` so the run's setup is in the log too.

## What the logger will not let through

A value under a key that names personal data or a secret is replaced with `{"masked":"key"}`. The words are in `maskWords` in [spec/events.json](../spec/events.json): `text`, `message`, `body`, `content`, `prompt`, `address`, `email`, `phone`, `username`, `token`, `secret`, `password`, `authorization`, `cookie`, `apikey`, `card` and a few more, alone, plural or inside a longer key such as `shippingAddress` or `x-api-key`. A key that ends in `id`, `count`, `type`, `ms`, `in`, `out` or `hash` describes the thing without holding it, so `message_id` and `tokens_in` stay.

An email address, phone number, street address, card number or key inside any other string is replaced in place: `call [phone] at [address]`.

A value over 2,000 characters is cut from the line, which keeps its size and first 200 characters. Pass `blob(id, json)` to `createLog` to store the whole value somewhere.

So log ids, labels, numbers and choices. Full model prompts and outputs live in the MLflow trace, and the line carries its id in `trace`. The checker fails a log that still leaks, so a line written around the logger is caught too.

What it cannot catch: a person's name under a key like `name` or `title`, a phone number written as ten bare digits, and typed words you put in `value`. Typed words go in `text`. Log a buyer's id, never their name.

## Wire a new program

Each program is done when you have run its main flow once, `node spec/log.mjs <its log>` prints `log follows the contract`, and the lines alone tell you what happened. None of this exists yet, so these are the steps for whoever builds each part.

**A. The app (Expo).**
1. Make `app/log.ts` with the `createLog` call above and export `log`. Import the logger by relative path. If Metro refuses a file outside the app folder, add the repo root to `watchFolders` in `metro.config.js` (*asserted*, from memory).
2. Call `log.show` from the navigation state listener and whenever a screen's state changes (a card arrives, a pill changes, a loading stage advances).
3. Route every tap through one `onPress` helper that calls `log.input` first.
4. Route every request through one `api()` helper that wraps `fetch` in `log.call('http', ...)` and sends `from` as `x-secondhand-from`. A `fetch` response has no fields to log, so give `call` a describe function: `r => ({ status: r.status })`, plus the ids from the parsed body.
5. Set the global error handler to call `log.error('app', e)` and then `sink.flush()`. Call `sink.flush()` when the app goes to the background too. The sink sends every 2 seconds, so without the flush the last lines before a crash stay on the phone.
6. Log `app.state` when the app comes to the front or leaves it, and system prompts (a permission, a push) with `log.show('system', ...)` and `log.input('system', ...)`.

**B. The Swift camera module.** Swift writes no log lines. JS wraps each native function in `log.child({}, 'app.capture').call('native', 'CaptureKit.takePhoto', ...)`. For things that start in Swift (tracking state, a live shot check), the module sends an event to JS with `{ event, fields }` and JS logs it with the same child logger. One writer per session keeps the sequence whole.

**C. The server (Node).**
1. `createLog({ src: 'server', build, sink: teeSink(consoleSink, eventsTable) })`, then `app.use(requestLogger(log))`. Handlers use `req.log`. `eventsTable` is a sink you write: a function that takes one line and inserts it into the table in D. It queues the line and returns; a failed insert is its own to retry.
2. Add `POST /api/log`: it takes the app's newline-delimited lines and inserts them. A batch can arrive twice, so insert with `on conflict do nothing`.
3. Wrap every model call, site call and query in `req.log.call`. Log each Decision with `ask`, `answer` and `close`, each Job with `job`, and each item step with `action`.
4. On `uncaughtException` and `unhandledRejection`, call `log.error` and then exit.

**D. The `events` table (Lakebase).** *Agent proposal.* One table holds every line. The "why?" timeline is `where item = $1 order by ts`, and the build plan's `action_log` is `where event = 'item.action'`.

```sql
create table events (
  session text not null, seq int not null, ts timestamptz not null,
  src text not null, level text not null, event text not null,
  item text, job text, run text, decision text, trace text,
  line jsonb not null,
  primary key (session, seq)
);
create index on events (item, ts);
create index on events (event, ts);
```

**E. Cloud jobs and agent loops (Python or Node).** One `create_log` per job process, with `origin` set to the `from` of the line that queued it. Log `log.job(job, kind, 'running')`, a `log.stage(job, stage, state=...)` each time a loading stage the app shows changes state (`started`, `running`, `arrived`, `failed`, the four in the [frontend standard](../product/frontend-standard.md)), and `log.job(job, kind, 'done')` or `log.job(job, kind, 'failed', error=...)`. Threads in one process can share one log. An agent loop is one `agent` run with a `step` per turn. A Browser Use harness function (post, delist, read the inbox) is one `call('browser', 'depop.post', ...)`; keep the Browser Use run id and live view URL in its result.

**F. MLflow.** Put the trace id on the logger once per request or job with `log.child({ trace })`. The packages are named in the [build plan](../research/cross-cutting/ben/build-plan-posting-messages-ui.md#2-what-runs-where). How to read the active trace id in each language was not checked for this note; look it up in the MLflow tracing docs when wiring.

## Read a log

```sh
node log/example.mjs                                  # writes a sample session to logs/
node spec/log.mjs logs/*.jsonl --sites ebay,depop     # contract, leaks, replay, then the numbers; give it every program's file at once
grep '"item":"it_1"' logs/*.jsonl                     # one item's story across programs
grep '"level":"error"' logs/*.jsonl                   # every failure
```

The checker's warnings name each call, request and agent run that never finished in a session with no `session.end`. That is the first place to look after a crash or a hang.

The numbers it prints are lines, errors, failed jobs, open Decisions, cost, and count, failures and p50 and p95 time per call. To improve one of them, keep the command and the input fixed, make one change, measure again, and keep or revert. Write each attempt as a row in `logs/decision.tsv`. Before trusting a number, say what else it could be counting: errors, skipped work, cached work. The numbers count log lines, so work that was never logged is not in them.

## What the log does not hold

- What a model would say on a second run. The seed covers our own random numbers, not model sampling, so replay a model call from its logged result or its MLflow trace.
- The pixels. `ui.show` holds the screen, its state and the ids on it, which is enough to rebuild the screen from the data, not to prove what was drawn.
- Anything masked. A masked value is gone on purpose.

## Rules

- No `console.log`, `print`, `logging.info` or `NSLog` in app, server or job code. `node .agents/check.mjs` fails on them, and warns on an outside call with no `log.call` and on `Math.random()`.
- A new kind of event goes into [spec/events.json](../spec/events.json) and [example.mjs](example.mjs) first. The checker rejects names it does not know.
- Logs stay in `logs/`, which git ignores. This repo is public, and raw logs are never committed.
- Agents working on this repo keep large command output in `.harness/logs/` (also ignored). Session transcripts are kept by each person's own setup, outside git.

Retire this page's wiring steps as each program lands and its own code becomes the example.
