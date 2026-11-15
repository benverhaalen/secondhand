#!/bin/zsh
# Cold start x7 (signed in) and search x5 (five different live queries) on the walk device; prints each sample in ms.
here=${0:A:h}; out=${1:-~/sh-walks/timing-$(date +%H%M)}
for n in 1 2 3 4 5 6 7; do node $here/drive.mjs $here/t-cold.json $out/cold-$n >/dev/null 2>&1
  python3 -c "import json;m=json.load(open('$out/cold-$n/report.json'))['marks'];print('cold',$n,m['first_screen']-m['launch'])"; done
n=0; for q in "patagonia better sweater" "nike dunk low" "kitchenaid stand mixer" "levis trucker jacket" "le creuset dutch oven"; do n=$((n+1))
  node $here/drive.mjs $here/t-search.json $out/search-$n "Q=$q" >/dev/null 2>&1
  python3 -c "import json;r=json.load(open('$out/search-$n/report.json'));m=r['marks'];print('search',$n,repr('$q'),m.get('first_frame',0)-m.get('tap_search',0),m.get('settled',0)-m.get('tap_search',0),'passed' if r['passed'] else 'FAILED')"; done
echo $out
