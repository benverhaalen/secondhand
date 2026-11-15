# Run trace: in-4
Researched 2026-11-15 by Nate (original agent not recorded).

*Observed in the recorded local run:* Logs: in-4.log. 38 lines, 1 session(s), first line 2026-11-15T04:00:43.700Z.
Total: 19647 ms.

## Steps

| session seq | event | detail | since previous |
|---|---|---|---|
| s_mwhb48tvsh9xkw 0 | session.start | level=info | +0 ms |
| s_mwhb48tvsh9xkw 1 | call.start | kind=http name=fetch.plain level=info call=c1 | +4 ms |
| s_mwhb48tvsh9xkw 2 | call.end | ok=true level=info ms=179 call=c1 | +179 ms |
| s_mwhb48tvsh9xkw 3 | note | level=warn | +0 ms |
| s_mwhb48tvsh9xkw 4 | job.state | kind=gather state=started level=info job=gather | +1 ms |
| s_mwhb48tvsh9xkw 5 | call.start | kind=http name=fetch.plain level=info call=c2 | +2227 ms |
| s_mwhb48tvsh9xkw 6 | call.end | ok=true level=info ms=34 call=c2 | +34 ms |
| s_mwhb48tvsh9xkw 7 | note | level=warn | +0 ms |
| s_mwhb48tvsh9xkw 8 | call.start | kind=http name=fetch.plain level=info call=c3 | +2207 ms |
| s_mwhb48tvsh9xkw 9 | call.end | ok=true level=info ms=26 call=c3 | +26 ms |
| s_mwhb48tvsh9xkw 10 | note | level=warn | +0 ms |
| s_mwhb48tvsh9xkw 11 | job.stage | stage=gather.update level=info job=gather | +0 ms |
| s_mwhb48tvsh9xkw 12 | call.start | kind=http name=fetch.plain level=info call=c4 | +2933 ms |
| s_mwhb48tvsh9xkw 13 | call.end | ok=true level=info ms=45 call=c4 | +45 ms |
| s_mwhb48tvsh9xkw 14 | note | level=warn | +0 ms |
| s_mwhb48tvsh9xkw 15 | call.start | kind=http name=fetch.plain level=info call=c5 | +2225 ms |
| s_mwhb48tvsh9xkw 16 | call.end | ok=true level=info ms=39 call=c5 | +39 ms |
| s_mwhb48tvsh9xkw 17 | note | level=warn | +0 ms |
| s_mwhb48tvsh9xkw 18 | call.start | kind=http name=fetch.plain level=info call=c6 | +1854 ms |
| s_mwhb48tvsh9xkw 19 | call.end | ok=true level=info ms=47 call=c6 | +47 ms |
| s_mwhb48tvsh9xkw 20 | note | level=warn | +0 ms |
| s_mwhb48tvsh9xkw 21 | job.stage | stage=gather.update level=info job=gather | +0 ms |
| s_mwhb48tvsh9xkw 22 | call.start | kind=http name=fetch.plain level=info call=c7 | +1961 ms |
| s_mwhb48tvsh9xkw 23 | call.end | ok=true level=info ms=29 call=c7 | +29 ms |
| s_mwhb48tvsh9xkw 24 | note | level=warn | +0 ms |
| s_mwhb48tvsh9xkw 25 | call.start | kind=http name=fetch.plain level=info call=c8 | +1775 ms |
| s_mwhb48tvsh9xkw 26 | call.end | ok=true level=info ms=32 call=c8 | +32 ms |
| s_mwhb48tvsh9xkw 27 | note | level=warn | +0 ms |
| s_mwhb48tvsh9xkw 28 | call.start | kind=http name=fetch.plain level=info call=c9 | +1001 ms |
| s_mwhb48tvsh9xkw 29 | call.end | ok=true level=info ms=33 call=c9 | +33 ms |
| s_mwhb48tvsh9xkw 30 | note | level=warn | +0 ms |
| s_mwhb48tvsh9xkw 31 | call.start | kind=http name=fetch.plain level=info call=c10 | +2955 ms |
| s_mwhb48tvsh9xkw 32 | call.end | ok=true level=info ms=39 call=c10 | +39 ms |
| s_mwhb48tvsh9xkw 33 | note | level=warn | +0 ms |
| s_mwhb48tvsh9xkw 34 | job.stage | stage=gather.update level=info job=gather | +1 ms |
| s_mwhb48tvsh9xkw 35 | job.stage | stage=gather.update level=info job=gather | +0 ms |
| s_mwhb48tvsh9xkw 36 | job.state | kind=gather state=done level=info ms=19646 job=gather | +0 ms |
| s_mwhb48tvsh9xkw 37 | session.end | level=info | +0 ms |

## Fields against the spec

- session.start x1: spec needs build, seed; 0 line(s) short
- call.start x10: spec needs call, kind, name; 0 line(s) short
- call.end x10: spec needs call, ok, ms; 0 line(s) short
- note x10: spec needs msg; 0 line(s) short
- job.state x2: spec needs job, kind, state; 0 line(s) short
- job.stage x4: spec needs job, stage; 0 line(s) short
- session.end x1: spec needs (unknown event); 0 line(s) short

## Missing

- nothing

## Contract problems and warnings

- in-4.log:5: job.state state "started" is not one of queued, running, done, failed
