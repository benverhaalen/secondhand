"""The one way secondhand Python code writes a log line: cloud jobs, image loops and Browser Use harnesses.

Standard library only. It writes the same lines as log/index.js. Contract: ../spec/events.json.
Checker: node spec/log.mjs <file>. How to use it: README.md.
The MASK_ lists, MAX_INLINE and BLOB_HEAD repeat spec/events.json; spec/log.test.mjs fails if they drift.
"""
import dataclasses
import datetime as _dt
import decimal
import enum
import inspect
import json
import math
import os
import random as _random
import re
import threading
import time
import traceback

MASK_WORDS = ["token", "secret", "password", "passcode", "pwd", "authorization", "cookie", "apikey", "address", "email", "phone", "card", "cvv", "ssn", "text", "body", "content", "message", "prompt", "username", "firstname", "lastname", "fullname"]
MASK_NOT_WHEN_LAST = ["id", "ids", "count", "type", "len", "length", "at", "ms", "in", "out", "hash"]
MASK_PATTERNS = [
    ["secret", r'\b(?:sk-[A-Za-z0-9_-]{20,}|(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{24,}|dapi[0-9a-f]{32}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|xox[abprs]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})'],
    ["secret", r'\bBearer[ \t\r\n\u00a0]+[A-Za-z0-9._~+/=-]{16,}'],
    ["secret", "\\b(?:access_token|refresh_token|id_token|api_key|apikey|client_secret|password|token|secret|signature|sig)=[^&# \\t\\r\\n\\u00a0\"']{6,}"],
    ["email", r'[A-Za-z0-9._%+-]{1,64}@(?:[A-Za-z0-9-]{1,63}\.){1,8}(?!(?:png|jpe?g|gif|webp|svg|heic|pdf|js|ts|css|md|json)\b)[A-Za-z]{2,24}\b'],
    ["card", r'\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{4}\b'],
    ["phone", r'(?:\B\+\d{10,15}|(?:\+?1[ .-]?)?(?:\(\d{3}\)[ \t\r\n\u00a0]?|\b\d{3}[ .\u00a0-])\d{3}[ .\u00a0-]\d{4})\b'],
    ["address", r"\b\d{1,5}[ \t\r\n\u00a0]+(?:[A-Za-z0-9.']+[ \t\r\n\u00a0]+){1,3}(?:[Ss]treet|[Ss]t|[Aa]venue|[Aa]ve|[Rr]oad|[Rr]d|[Bb]oulevard|[Bb]lvd)\b"],
]
MAX_INLINE = 2000
BLOB_HEAD = 200
ENVELOPE = ("ts", "session", "seq", "src", "level", "event")
MAX_DEPTH = 8
_DROP = object()  # a value that is not data (a function, a module) is left out, as in the JS writer

_patterns = [(label, re.compile(source, re.ASCII)) for label, source in MASK_PATTERNS]


def _key_words(key):
    return [w for w in re.split(r"[^a-z0-9]+", re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", str(key)).lower()) if w]


def _mask_word(w):
    return w in MASK_WORDS or (w.endswith("es") and w[:-2] in MASK_WORDS) or (w.endswith("s") and w[:-1] in MASK_WORDS)


def is_masked_key(key):
    """A key is masked when one of its words, or two neighbours joined (api + key), names personal data or a secret.

    A key that ends in a word such as id, count or ms describes the thing without holding it (message_id, tokens_in, card_ms)."""
    w = _key_words(key)
    if not w or w[-1] in MASK_NOT_WHEN_LAST:
        return False
    return any(_mask_word(x) or (i > 0 and _mask_word(w[i - 1] + x)) for i, x in enumerate(w))


def mask_text(text):
    text = text.encode("utf-8", "replace").decode("utf-8")  # a lone surrogate would stop the line being written
    for label, pattern in _patterns:
        text = pattern.sub(f"[{label}]", text)
    return text


def error_of(e):
    if isinstance(e, BaseException):
        return {"type": type(e).__name__, "msg": str(e), "stack": "".join(traceback.format_exception(type(e), e, e.__traceback__))}
    return {"type": type(e).__name__, "msg": str(e)}


def mask(value, depth=0):
    """Personal data is masked by default: a value under a masked key is replaced whole, and matches inside any other string are replaced in place.

    It never raises: a value that cannot be read becomes '[unreadable]'. An object is logged as its fields, never as its repr."""
    try:
        if value is None or isinstance(value, bool):
            return value
        if isinstance(value, enum.Enum):
            return mask(value.value, depth)
        if isinstance(value, str):
            return mask_text(value)
        if isinstance(value, int):
            return value
        if isinstance(value, float):
            return value if math.isfinite(value) else None
        if isinstance(value, decimal.Decimal):
            return (int(value) if value == value.to_integral_value() else float(value)) if value.is_finite() else None
        if isinstance(value, (_dt.datetime, _dt.date)):
            return value.isoformat()
        if isinstance(value, BaseException):
            return mask(error_of(value), depth)
        if isinstance(value, (bytes, bytearray, memoryview)):
            return {"bytes": len(value)}
        if isinstance(value, os.PathLike) or type(value).__name__ == "UUID":
            return mask_text(str(value))
        if depth >= MAX_DEPTH:
            return "[deep]"
        if isinstance(value, (list, tuple, set, frozenset)):
            return [None if (m := mask(v, depth + 1)) is _DROP else m for v in value]
        if dataclasses.is_dataclass(value) and not isinstance(value, type):
            value = {f.name: getattr(value, f.name) for f in dataclasses.fields(value)}
        elif callable(getattr(value, "model_dump", None)):  # a pydantic model
            value = value.model_dump()
        elif callable(value) or inspect.ismodule(value):
            return _DROP
        elif not isinstance(value, dict):
            fields = getattr(value, "__dict__", None)
            if not isinstance(fields, dict):
                return f"<{type(value).__name__}>"
            value = {k: v for k, v in fields.items() if not str(k).startswith("_")}
        out = {}
        for k, v in value.items():
            m = {"masked": "key"} if is_masked_key(k) and v is not None else mask(v, depth + 1)
            if m is not _DROP:
                out[mask_text(str(k))] = m
        return out
    except Exception:
        return "[unreadable]"


def _join(named, extra):
    """The named fields win over the caller's extras."""
    return {**named, **{k: v for k, v in (extra or {}).items() if k not in named}}


def _dumps(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def _now():
    return _dt.datetime.now(_dt.timezone.utc)


class Log:
    """create_log(src, build, sink) starts a session and writes session.start. Every method writes one line and returns it. No method raises."""

    def __init__(self, state, bound, src):
        self._state, self._bound, self._src = state, bound, src
        self.session, self.seed, self.random = state["session"], state["seed"], state["random"]

    def event(self, name, fields=None, level="info"):
        s = self._state
        try:
            masked, problem = mask(_join(self._bound, fields if isinstance(fields, dict) else {})), None
        except Exception as e:
            masked, problem = {}, e
        with s["lock"]:  # one writer at a time, so threads cannot swap or repeat a sequence number
            try:
                ts = s["now"]().astimezone(_dt.timezone.utc)
            except Exception:
                ts = _now()
            line = {"ts": ts.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ts.microsecond // 1000:03d}Z", "session": s["session"], "seq": s["seq"], "src": self._src, "level": level, "event": name}
            try:
                if problem is not None:
                    raise problem
                for k, v in masked.items():
                    if k in ENVELOPE:
                        continue  # a field can never overwrite the envelope
                    text = _dumps(v)
                    if len(text) <= MAX_INLINE:
                        line[k] = v
                        continue
                    blob_id = f"{s['session']}-{line['seq']}-{k}"
                    try:
                        if s["blob"]:
                            s["blob"](blob_id, text)
                    except Exception:
                        pass  # the line still holds the start of the value
                    line[k] = {"blob": blob_id, "chars": len(text), "head": text[:BLOB_HEAD]}
            except Exception as e:
                line["log_error"] = {"type": type(e).__name__, "msg": mask_text(str(e))}
            s["seq"] += 1  # taken only now, so a line that could not be built leaves no gap
            try:
                s["sink"](_dumps(line))
            except Exception:
                pass  # logging never breaks the program; the missing seq shows the loss
        return line

    def show(self, screen, **fields):
        return self.event("ui.show", _join({"screen": screen}, fields))

    def input(self, screen, control, **fields):
        return self.event("user.input", _join({"screen": screen, "control": control}, fields))

    def change(self, entity, id, to, **fields):
        return self.event("state.change", _join({"entity": entity, "id": id, "to": to}, fields))

    def action(self, item, action, actor, **fields):
        return self.event("item.action", _join({"item": item, "action": action, "actor": actor}, fields))

    def job(self, job, kind, state, **fields):
        return self.event("job.state", _join({"job": job, "kind": kind, "state": state}, fields), "error" if state == "failed" else "info")

    def stage(self, job, stage, **fields):
        return self.event("job.stage", _join({"job": job, "stage": stage}, fields))

    def ask(self, decision, kind, tier, **fields):
        return self.event("decision.open", _join({"decision": decision, "kind": kind, "tier": tier}, fields))

    def answer(self, decision, option, **fields):
        return self.event("decision.answer", _join({"decision": decision, "option": option}, fields))

    def close(self, decision, reason, **fields):
        return self.event("decision.close", _join({"decision": decision, "reason": reason}, fields))

    def error(self, where, e, **fields):
        return self.event("error", _join({"where": where, "error": error_of(e)}, fields), "error")

    def note(self, msg, level="debug", **fields):
        return self.event("note", _join({"msg": msg}, fields), level)

    def _start(self, kind, name, input, fn):
        with self._state["lock"]:
            self._state["calls"] += 1
            call = f"c{self._state['calls']}"
        start = self.event("call.start", {"call": call, "kind": kind, "name": name, "input": input})
        try:  # a fn that takes one argument gets {call, from}, as in the JS writer
            wants = any(p.default is p.empty and p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD) for p in inspect.signature(fn).parameters.values())
        except (TypeError, ValueError):
            wants = False
        return call, time.monotonic(), ({"call": call, "from": f"{self.session}#{start['seq']}"},) if wants else ()

    def _finish(self, call, t0, out, describe):
        try:
            kept = describe(out) if describe else {"result": out}
        except Exception as e:
            kept = {"describe_error": error_of(e)}
        if not isinstance(kept, dict):
            kept = {"result": kept}
        self.event("call.end", _join({"call": call, "ok": True, "ms": round((time.monotonic() - t0) * 1000)}, kept))

    def _fail(self, call, t0, e):
        self.event("call.end", {"call": call, "ok": False, "ms": round((time.monotonic() - t0) * 1000), "error": error_of(e)}, "error")

    def call(self, kind, name, input, fn, describe=None):
        """Wrap every outside call: out = log.call('model', 'seedream-5', input, lambda: call_it(), lambda out: {'result': {...}, 'cost_usd': 0.04}).

        describe picks what to keep from the result. Without it the whole result is logged, masked, and cut to its start if large.
        A fn that takes one argument gets {'call', 'from'}: send from as the x-secondhand-from header so the other side's log links back to this line."""
        call, t0, args = self._start(kind, name, input, fn)
        try:
            out = fn(*args)
        except BaseException as e:
            self._fail(call, t0, e)
            raise
        self._finish(call, t0, out, describe)
        return out

    async def acall(self, kind, name, input, fn, describe=None):
        """The same for an async call: out = await log.acall('browser', 'depop.post', input, lambda: client.run(...))."""
        call, t0, args = self._start(kind, name, input, fn)
        try:
            out = await fn(*args)
        except BaseException as e:
            self._fail(call, t0, e)
            raise
        self._finish(call, t0, out, describe)
        return out

    def timed(self, name, fn, **fields):
        """Time work that stays inside the process: out = log.timed('photo.score', lambda: score(shots))."""
        t0 = time.monotonic()
        try:
            out = fn()
        except BaseException as e:
            self.event("timing", _join({"name": name, "ok": False, "ms": round((time.monotonic() - t0) * 1000), "error": error_of(e)}, fields), "error")
            raise
        self.event("timing", _join({"name": name, "ok": True, "ms": round((time.monotonic() - t0) * 1000)}, fields))
        return out

    async def atimed(self, name, fn, **fields):
        """The same for async work: out = await log.atimed('capture.process', lambda: process(item))."""
        t0 = time.monotonic()
        try:
            out = await fn()
        except BaseException as e:
            self.event("timing", _join({"name": name, "ok": False, "ms": round((time.monotonic() - t0) * 1000), "error": error_of(e)}, fields), "error")
            raise
        self.event("timing", _join({"name": name, "ok": True, "ms": round((time.monotonic() - t0) * 1000)}, fields))
        return out

    def agent(self, agent, **fields):
        """run = log.agent('studio.repair', item=item, goal='...'); run.step(action=..., why=...); run.call('tool', ...); run.end(ok=True, result=...)."""
        with self._state["lock"]:
            self._state["runs"] += 1
            run = f"r{self._state['runs']}"
        return Run(Log(self._state, {**self._bound, "run": run}, self._src), agent, fields)

    def child(self, src=None, **ids):
        """Bind ids to every later line: log.child(item=item, job=job, trace=trace). A new src names a part of the program: log.child('job.relight.gate')."""
        if isinstance(src, dict):  # log.child({'item': item}) works too, as in the JS writer
            ids, src = {**src, **ids}, None
        return Log(self._state, {**self._bound, **ids}, src if isinstance(src, str) and src else self._src)

    def end(self, **fields):
        return self.event("session.end", fields)


class Run:
    def __init__(self, log, agent, fields):
        self.log, self.run, self._n, self._t0 = log, log._bound["run"], 0, time.monotonic()
        self.call, self.acall = log.call, log.acall
        log.event("agent.start", _join({"agent": agent}, fields))

    def step(self, **fields):
        self._n += 1
        return self.log.event("agent.step", _join({"n": self._n}, fields))

    def end(self, ok=True, **fields):
        ok = ok is not False
        return self.log.event("agent.end", _join({"ok": ok, "steps": self._n, "ms": round((time.monotonic() - self._t0) * 1000)}, fields), "info" if ok else "error")


def create_log(src, build, sink, seed=None, session=None, origin=None, platform=None, config=None, now=_now, blob=None):
    """src: which program this is ('job.relight', 'agent.list.depop'). build: version plus commit. sink: a function that takes one JSON line.

    origin: the "session#seq" of the line that started this program, written as the `from` field (from is a Python keyword).
    config: flags, model names and prompt versions, anything else that changes behavior.
    blob(id, json): where a value too large for a line goes; without it the line keeps only the start of the value."""
    if not isinstance(src, str) or not src or not isinstance(build, str) or not build or not callable(sink):
        raise ValueError("create_log needs src, build and sink (see log/README.md)")
    if not isinstance(seed, int) or isinstance(seed, bool):
        seed = _random.SystemRandom().randrange(2**32)
    if not isinstance(session, str) or not session:
        session = f"s_{int(time.time() * 1000):x}{_random.SystemRandom().randrange(16**6):06x}"
    # log.random is a random.Random seeded for this session: use it instead of the random module so a run can be replayed from its seed
    state = {"seq": 0, "calls": 0, "runs": 0, "session": session, "seed": seed, "sink": sink, "now": now, "blob": blob, "random": _random.Random(seed), "lock": threading.RLock()}
    log = Log(state, {}, src)
    start = {"build": build, "seed": seed, "platform": platform, "from": origin, "config": config}
    log.event("session.start", {k: v for k, v in start.items() if v is not None})
    return log


# Sinks. A sink is a function that takes one JSON line.
def file_sink(path):
    """One JSON-lines file per session under logs/, which git ignores. Each line is appended at once, so a crash loses nothing already logged."""
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
