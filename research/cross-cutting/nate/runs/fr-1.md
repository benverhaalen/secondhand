# Run trace: fr-1

Logs: fr1.jsonl, fr1b.jsonl. 89 lines, 3 session(s), first line 2026-11-15T03:57:08.565Z.
Total: 260629 ms.

## Steps

| session seq | event | detail | since previous |
|---|---|---|---|
| s_mwhazmtw7nxeo0 0 | session.start | level=info | +0 ms |
| s_mwhazmtw7nxeo0 1 | call.start | kind=http name=fetch.plain level=info call=c1 | +4 ms |
| s_mwhazmtw7nxeo0 2 | call.end | ok=true level=info ms=416 call=c1 | +416 ms |
| s_mwhazmtw7nxeo0 3 | note | level=warn | +0 ms |
| s_mwhazmtw7nxeo0 4 | note | level=debug | +1502 ms |
| s_mwhazmtw7nxeo0 5 | call.start | kind=http name=fetch.plain level=info call=c2 | +490 ms |
| s_mwhazmtw7nxeo0 6 | call.end | ok=true level=info ms=218 call=c2 | +218 ms |
| s_mwhazmtw7nxeo0 7 | note | level=warn | +0 ms |
| s_mwhazmtw7nxeo0 8 | call.start | kind=http name=fetch.plain level=info call=c3 | +1 ms |
| s_mwhazmtw7nxeo0 9 | call.end | ok=true level=info ms=976 call=c3 | +976 ms |
| s_mwhazmtw7nxeo0 10 | call.start | kind=http name=fetch.plain level=info call=c4 | +168 ms |
| s_mwhazmtw7nxeo0 11 | call.end | ok=true level=info ms=733 call=c4 | +733 ms |
| s_mwhazmtw7nxeo0 12 | call.start | kind=http name=fetch.plain level=info call=c5 | +2 ms |
| s_mwhazmtw7nxeo0 13 | call.end | ok=true level=info ms=113 call=c5 | +113 ms |
| s_mwhazmtw7nxeo0 14 | note | level=warn | +1 ms |
| s_mwhazmtw7nxeo0 15 | note | level=debug | +1509 ms |
| s_mwhazmtw7nxeo0 16 | call.start | kind=http name=fetch.plain level=info call=c6 | +538 ms |
| s_mwhazmtw7nxeo0 17 | call.end | ok=true level=info ms=63 call=c6 | +63 ms |
| s_mwhazmtw7nxeo0 18 | note | level=warn | +0 ms |
| s_mwhazmtw7nxeo0 19 | call.start | kind=http name=fetch.plain level=info call=c7 | +0 ms |
| s_mwhazmtw7nxeo0 20 | call.end | ok=true level=info ms=105 call=c7 | +105 ms |
| s_mwhazmtw7nxeo0 21 | note | level=warn | +1 ms |
| s_mwhazmtw7nxeo0 22 | call.start | kind=http name=fetch.plain level=info call=c8 | +0 ms |
| s_mwhazmtw7nxeo0 23 | call.end | ok=true level=info ms=99 call=c8 | +99 ms |
| s_mwhazmtw7nxeo0 24 | note | level=warn | +0 ms |
| s_mwhazmtw7nxeo0 25 | call.start | kind=http name=fetch.plain level=info call=c9 | +1 ms |
| s_mwhazmtw7nxeo0 26 | call.end | ok=true level=info ms=666 call=c9 | +666 ms |
| s_mwhazmtw7nxeo0 27 | call.start | kind=http name=fetch.plain level=info call=c10 | +1 ms |
| s_mwhazmtw7nxeo0 28 | call.end | ok=true level=info ms=591 call=c10 | +591 ms |
| s_mwhazmtw7nxeo0 29 | call.start | kind=http name=fetch.plain level=info call=c11 | +1 ms |
| s_mwhazmtw7nxeo0 30 | call.end | ok=true level=info ms=147 call=c11 | +147 ms |
| s_mwhazmtw7nxeo0 31 | note | level=warn | +40 ms |
| s_mwhazmtw7nxeo0 32 | call.start | kind=http name=fetch.plain level=info call=c12 | +1 ms |
| s_mwhazmtw7nxeo0 33 | call.end | ok=true level=info ms=96 call=c12 | +96 ms |
| s_mwhazmtw7nxeo0 34 | note | level=warn | +13 ms |
| s_mwhazmtw7nxeo0 35 | session.end | level=info | +1 ms |
| s_mwhb07ds6mn60k 0 | session.start | level=info | +0 ms |
| s_mwhb07ds6mn60k 1 | call.start | kind=http name=fetch.plain level=info call=c1 | +3 ms |
| s_mwhb07ds6mn60k 2 | call.end | ok=true level=info ms=482 call=c1 | +482 ms |
| s_mwhb07ds6mn60k 3 | call.start | kind=browser name=fetch.render level=info call=c2 | +843 ms |
| s_mwhb07ds6mn60k 4 | call.end | ok=false level=error ms=19925 call=c2 | +19926 ms |
| s_mwhb07ds6mn60k 5 | call.start | kind=http name=fetch.plain level=info call=c3 | +1 ms |
| s_mwhb07ds6mn60k 6 | call.end | ok=true level=info ms=153 call=c3 | +153 ms |
| s_mwhb07ds6mn60k 7 | call.start | kind=browser name=fetch.render level=info call=c4 | +1266 ms |
| s_mwhb07ds6mn60k 8 | call.end | ok=false level=error ms=20435 call=c4 | +20435 ms |
| s_mwhb07ds6mn60k 9 | call.start | kind=http name=fetch.plain level=info call=c5 | +77 ms |
| s_mwhb07ds6mn60k 10 | call.end | ok=true level=info ms=160 call=c5 | +160 ms |
| s_mwhb07ds6mn60k 11 | call.start | kind=browser name=fetch.render level=info call=c6 | +2167 ms |
| s_mwhb07ds6mn60k 12 | call.end | ok=false level=error ms=20220 call=c6 | +20220 ms |
| s_mwhb07ds6mn60k 13 | call.start | kind=http name=fetch.plain level=info call=c7 | +2 ms |
| s_mwhb07ds6mn60k 14 | call.end | ok=true level=info ms=79 call=c7 | +79 ms |
| s_mwhb07ds6mn60k 15 | note | level=warn | +0 ms |
| s_mwhb07ds6mn60k 16 | call.start | kind=http name=fetch.plain level=info call=c8 | +1 ms |
| s_mwhb07ds6mn60k 17 | call.end | ok=true level=info ms=503 call=c8 | +503 ms |
| s_mwhb07ds6mn60k 18 | call.start | kind=http name=fetch.plain level=info call=c9 | +2 ms |
| s_mwhb07ds6mn60k 19 | note | level=debug | +1499 ms |
| s_mwhb07ds6mn60k 20 | call.end | ok=true level=info ms=1549 call=c9 | +50 ms |
| s_mwhb07ds6mn60k 21 | call.start | kind=http name=fetch.plain level=info call=c10 | +3 ms |
| s_mwhb07ds6mn60k 22 | call.end | ok=true level=info ms=72 call=c10 | +72 ms |
| s_mwhb07ds6mn60k 23 | note | level=warn | +0 ms |
| s_mwhb07ds6mn60k 24 | call.start | kind=http name=fetch.plain level=info call=c11 | +0 ms |
| s_mwhb07ds6mn60k 25 | call.end | ok=true level=info ms=611 call=c11 | +611 ms |
| s_mwhb07ds6mn60k 26 | session.end | level=info | +0 ms |
| s_mwhb4u164wamao 0 | session.start | level=info | +0 ms |
| s_mwhb4u164wamao 1 | call.start | kind=http name=fetch.plain level=info call=c1 | +5 ms |
| s_mwhb4u164wamao 2 | call.end | ok=true level=info ms=200 call=c1 | +200 ms |
| s_mwhb4u164wamao 3 | call.start | kind=browser name=fetch.render level=info call=c2 | +1374 ms |
| s_mwhb4u164wamao 4 | call.end | ok=true level=info ms=3822 call=c2 | +3822 ms |
| s_mwhb4u164wamao 5 | call.start | kind=http name=fetch.plain level=info call=c3 | +1 ms |
| s_mwhb4u164wamao 6 | call.end | ok=true level=info ms=133 call=c3 | +133 ms |
| s_mwhb4u164wamao 7 | call.start | kind=browser name=fetch.render level=info call=c4 | +1295 ms |
| s_mwhb4u164wamao 8 | call.end | ok=true level=info ms=3710 call=c4 | +3710 ms |
| s_mwhb4u164wamao 9 | call.start | kind=http name=fetch.plain level=info call=c5 | +1 ms |
| s_mwhb4u164wamao 10 | call.end | ok=true level=info ms=132 call=c5 | +132 ms |
| s_mwhb4u164wamao 11 | call.start | kind=browser name=fetch.render level=info call=c6 | +1600 ms |
| s_mwhb4u164wamao 12 | call.end | ok=true level=info ms=2977 call=c6 | +2977 ms |
| s_mwhb4u164wamao 13 | call.start | kind=http name=fetch.plain level=info call=c7 | +0 ms |
| s_mwhb4u164wamao 14 | call.end | ok=true level=info ms=216 call=c7 | +216 ms |
| s_mwhb4u164wamao 15 | note | level=warn | +1 ms |
| s_mwhb4u164wamao 16 | call.start | kind=http name=fetch.plain level=info call=c8 | +0 ms |
| s_mwhb4u164wamao 17 | call.end | ok=true level=info ms=465 call=c8 | +465 ms |
| s_mwhb4u164wamao 18 | call.start | kind=http name=fetch.plain level=info call=c9 | +1 ms |
| s_mwhb4u164wamao 19 | call.end | ok=true level=info ms=1389 call=c9 | +1389 ms |
| s_mwhb4u164wamao 20 | call.start | kind=http name=fetch.plain level=info call=c10 | +4 ms |
| s_mwhb4u164wamao 21 | call.end | ok=true level=info ms=54 call=c10 | +54 ms |
| s_mwhb4u164wamao 22 | note | level=warn | +0 ms |
| s_mwhb4u164wamao 23 | call.start | kind=http name=fetch.plain level=info call=c11 | +0 ms |
| s_mwhb4u164wamao 24 | call.end | ok=true level=info ms=635 call=c11 | +635 ms |
| s_mwhb4u164wamao 25 | session.end | level=info | +1 ms |

## Fields against the spec

- session.start x3: spec needs build, seed; 0 line(s) short
- call.start x34: spec needs call, kind, name; 0 line(s) short
- call.end x34: spec needs call, ok, ms; 0 line(s) short
- note x15: spec needs msg; 0 line(s) short
- session.end x3: spec needs (unknown event); 0 line(s) short

## Missing

- nothing

## Contract problems and warnings

- none
