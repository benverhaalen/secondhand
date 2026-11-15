# Run trace: sd-1
Researched 2026-11-15 by Nate (original agent not recorded).

*Observed in the recorded local run:* Logs: sd-1-run.jsonl. 5 lines, 1 session(s), first line 2026-11-15T03:59:47.418Z.
Total: 449 ms.

## Steps

| session seq | event | detail | since previous |
|---|---|---|---|
| s_mwhb31eitsv0fq 0 | session.start | level=info | +0 ms |
| s_mwhb31eitsv0fq 1 | call.start | kind=http name=public.listing level=info call=c1 | +2 ms |
| s_mwhb31eitsv0fq 2 | call.end | ok=true level=info ms=444 call=c1 | +444 ms |
| s_mwhb31eitsv0fq 3 | note | state=sold level=info ms=1 | +1 ms |
| s_mwhb31eitsv0fq 4 | session.end | level=info | +2 ms |

## Fields against the spec

- session.start x1: spec needs build, seed; 0 line(s) short
- call.start x1: spec needs call, kind, name; 0 line(s) short
- call.end x1: spec needs call, ok, ms; 0 line(s) short
- note x1: spec needs msg; 0 line(s) short
- session.end x1: spec needs (unknown event); 0 line(s) short

## Missing

- nothing

## Contract problems and warnings

- none
