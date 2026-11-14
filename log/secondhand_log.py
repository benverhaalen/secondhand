"""The one way secondhand Python code writes a log line: cloud jobs, image loops and Browser Use harnesses.

Standard library only. It writes the same lines as log/index.js. Contract: ../spec/events.json.
Checker: node spec/log.mjs <file>. How to use it: README.md.
MASK_WORDS, MASK_PATTERNS and MAX_INLINE repeat spec/events.json; spec/log.test.mjs fails if they drift.
"""
import datetime as _dt
import json
import math
import os
import random as _random
import re
import time
import traceback

MASK_WORDS = ["token", "secret", "password", "authorization", "cookie", "apikey", "address", "email", "phone", "card", "cvv", "text", "body", "content", "message", "username"]
MASK_PATTERNS = [
    ["secret", r"\b(?:sk-[A-Za-z0-9_-]{20,}|dapi[0-9a-f]{32}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})"],
    ["secret", r"\bBearer\s+[A-Za-z0-9._~+/=-]{16,}"],
    ["email", r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+"],
    ["phone", r"(?:\+\d{10,15}|(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})\b"],
    ["address", r"\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place)\b"],
]
MAX_INLINE = 2000
ENVELOPE = ("ts", "session", "seq", "src", "level", "event")
MAX_DEPTH = 8
_DROP = object()  # a value that is not data (a function, a module) is left out, as in the JS writer

_patterns = [(label, re.compile(source, re.ASCII)) for label, source in MASK_PATTERNS]


def _key_words(key):
    return [w for w in re.split(r"[^a-z0-9]+", re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", str(key)).lower()) if w]


def is_masked_key(key):
    return any(w in MASK_WORDS for w in _key_words(key))


def mask_text(text):
    for label, pattern in _patterns:
        text = pattern.sub(f"[{label}]", text)
    return text


def error_of(e):
    if isinstance(e, BaseException):
        return {"type": type(e).__name__, "msg": str(e), "stack": "".join(traceback.format_exception(type(e), e, e.__traceback__))}
    return {"type": type(e).__name__, "msg": str(e)}


def mask(value, depth=0):
    """Personal data is masked by default: a value under a masked key is replaced whole, and matches inside any other string are replaced in place."""
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, str):
        return mask_text(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, (_dt.datetime, _dt.date)):
        return value.isoformat()
    if isinstance(value, BaseException):
        return mask(error_of(value), depth)
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"bytes": len(value)}
    if depth >= MAX_DEPTH:
        return "[deep]"
    if isinstance(value, (list, tuple, set, frozenset)):
        return [None if (m := mask(v, depth + 1)) is _DROP else m for v in value]
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            m = {"masked": "key"} if is_masked_key(k) and v is not None else mask(v, depth + 1)
            if m is not _DROP:
                out[str(k)] = m
        return out
    if callable(value):
        return _DROP
    return mask_text(repr(value))  # an object we do not know: its repr, masked


def _dumps(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def _now():
    return _dt.datetime.now(_dt.timezone.utc)


class Log:
    """create_log(src, build, sink) starts a session and writes session.start. Every method writes one line and returns it."""

    def __init__(self, state, bound, src):
        self._state, self._bound, self._src = state, bound, src
        self.session, self.seed, self.random = state["session"], state["seed"], state["random"]

    def event(self, name, fields=None, level="info"):
        s = self._state
        ts = s["now"]().astimezone(_dt.timezone.utc)
        line = {"ts": ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z", "session": s["session"], "seq": s["seq"], "src": self._src, "level": level, "event": name}
        s["seq"] += 1
        for k, v in mask({**self._bound, **{k: v for k, v in (fields or {}).items() if v is not None or k in ("error", "result")}}).items():
            if k in ENVELOPE:
                continue  # a field can never overwrite the envelope
            text = _dumps(v)
            if len(text) > MAX_INLINE:
                blob_id = f"{s['session']}-{line['seq']}-{k}"
                try:
                    if s["blob"]:
                        s["blob"](blob_id, text)
                except Exception:
                    pass  # the line still says a blob was cut
                line[k] = {"blob": blob_id}
            else:
                line[k] = v
        try:
            s["sink"](_dumps(line))
        except Exception:
            pass  # logging never breaks the program; the missing seq shows the loss
        return line

    def show(self, screen, **fields):
        return self.event("ui.show", {"screen": screen, **fields})

    def input(self, screen, control, **fields):
        return self.event("user.input", {"screen": screen, "control": control, **fields})

    def change(self, entity, id, to, **fields):
        return self.event("state.change", {"entity": entity, "id": id, "to": to, **fields})

    def action(self, item, action, actor, **fields):
        return self.event("item.action", {"item": item, "action": action, "actor": actor, **fields})

    def job(self, job, kind, state, **fields):
        return self.event("job.state", {"job": job, "kind": kind, "state": state, **fields}, "error" if state == "failed" else "info")

    def stage(self, job, stage, **fields):
        return self.event("job.stage", {"job": job, "stage": stage, **fields})

    def ask(self, decision, kind, tier, **fields):
        return self.event("decision.open", {"decision": decision, "kind": kind, "tier": tier, **fields})

    def answer(self, decision, option, **fields):
        return self.event("decision.answer", {"decision": decision, "option": option, **fields})

    def close(self, decision, reason, **fields):
        return self.event("decision.close", {"decision": decision, "reason": reason, **fields})

    def error(self, where, e, **fields):
        return self.event("error", {"where": where, "error": error_of(e), **fields}, "error")

    def note(self, msg, level="debug", **fields):
        return self.event("note", {"msg": msg, **fields}, level)

    def _start(self, kind, name, input):
        self._state["calls"] += 1
        call = f"c{self._state['calls']}"
        start = self.event("call.start", {"call": call, "kind": kind, "name": name, "input": input})
        self.origin = f"{self.session}#{start['seq']}"  # send it as the x-secondhand-from header so the other side's log links back to this line
        return call, time.monotonic()

    def _finish(self, call, t0, out, describe):
        try:
            kept = describe(out) if describe else {"result": out}
        except Exception as e:
            kept = {"describe_error": error_of(e)}
        self.event("call.end", {"call": call, "ok": True, "ms": round((time.monotonic() - t0) * 1000), **kept})

    def _fail(self, call, t0, e):
        self.event("call.end", {"call": call, "ok": False, "ms": round((time.monotonic() - t0) * 1000), "error": error_of(e)}, "error")

    def call(self, kind, name, input, fn, describe=None):
        """Wrap every outside call: out = log.call('model', 'seedream-5', input, lambda: call_it(), lambda out: {'result': {...}, 'cost_usd': 0.04}).

        describe picks what to keep from the result; without it the whole result is logged (masked, and cut to a blob if large)."""
        call, t0 = self._start(kind, name, input)
        try:
            out = fn()
        except BaseException as e:
            self._fail(call, t0, e)
            raise
        self._finish(call, t0, out, describe)
        return out

    async def acall(self, kind, name, input, fn, describe=None):
        """The same for an async call: out = await log.acall('browser', 'depop.post', input, lambda: client.run(...))."""
        call, t0 = self._start(kind, name, input)
        try:
            out = await fn()
        except BaseException as e:
            self._fail(call, t0, e)
            raise
        self._finish(call, t0, out, describe)
        return out

    def agent(self, agent, **fields):
        """run = log.agent('studio.repair', item=item, goal='...'); run.step(action=..., why=...); run.call('tool', ...); run.end(ok=True, result=...)."""
        self._state["runs"] += 1
        return Run(Log(self._state, {**self._bound, "run": f"r{self._state['runs']}"}, self._src), agent, fields)

    def child(self, src=None, **ids):
        """Bind ids to every later line: log.child(item=item, job=job, trace=trace). A new src names a part of the program."""
        return Log(self._state, {**self._bound, **ids}, src or self._src)

    def end(self, **fields):
        return self.event("session.end", fields)


class Run:
    def __init__(self, log, agent, fields):
        self.log, self.run, self._n, self._t0 = log, log._bound["run"], 0, time.monotonic()
        self.call, self.acall = log.call, log.acall
        log.event("agent.start", {"agent": agent, **fields})

    def step(self, **fields):
        self._n += 1
        return self.log.event("agent.step", {"n": self._n, **fields})

    def end(self, ok=True, **fields):
        return self.log.event("agent.end", {"ok": ok, "steps": self._n, "ms": round((time.monotonic() - self._t0) * 1000), **fields}, "info" if ok else "error")


def create_log(src, build, sink, seed=None, session=None, origin=None, platform=None, now=_now, blob=None):
    """src: which program this is ('job.relight', 'agent.list.depop'). build: version plus commit. sink: a function that takes one JSON line.

    origin is the "session#seq" of the line that started this program; it is written as the `from` field."""
    if not src or not build or not callable(sink):
        raise ValueError("create_log needs src, build and sink (see log/README.md)")
    seed = _random.SystemRandom().randrange(2**32) if seed is None else seed
    session = session or f"s_{int(time.time() * 1000):x}{_random.SystemRandom().randrange(16**6):06x}"
    # log.random is a random.Random seeded for this session: use it instead of the random module so a run can be replayed from its seed
    state = {"seq": 0, "calls": 0, "runs": 0, "session": session, "seed": seed, "sink": sink, "now": now, "blob": blob, "random": _random.Random(seed)}
    log = Log(state, {}, src)
    log.event("session.start", {"build": build, "seed": seed, "platform": platform, "from": origin})
    return log


# Sinks. A sink is a function that takes one JSON line.
def file_sink(path):
    """One JSON-lines file per session under logs/, which git ignores. Each line is appended and flushed, so a crash loses nothing already logged."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)

    def sink(line):
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    return sink


def log_path(log, src, directory="logs"):
    return os.path.join(directory, f"{src}-{log.session}.jsonl")


def memory_sink():
    lines = []

    def sink(line):
        lines.append(line)

    sink.lines = lines
    sink.text = lambda: "".join(line + "\n" for line in lines)
    return sink


def stdout_sink(line):
    print(line, flush=True)


def tee_sink(*sinks):
    def sink(line):
        for s in sinks:
            try:
                s(line)
            except Exception:
                pass  # one broken sink does not stop the others

    return sink
