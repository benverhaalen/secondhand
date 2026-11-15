#!/bin/zsh
# Runs walks in order on the walk device. usage: walk.sh <run dir> <walk> [walk ...]   (EMAIL and Q may be set in the env)
here=${0:A:h}; run=$1; shift; C=$(cat /tmp/sh-walk-devcode)
for w in "$@"; do
  echo "== $w"
  node $here/drive.mjs $here/$w.json $run/$w EMAIL=${EMAIL:-walk@example.com} CODE=$C "Q=${Q:-carhartt detroit jacket}" 2>&1 | grep -E "FAIL|skip|wait|gone"
done
