#!/bin/zsh
# The one-program server for the walks: scratch data (wiped each start), the dev code from /tmp/sh-walk-devcode, port 8790.
# usage: server.sh <worktree name>. No browser is composed, so eBay and Depop answer no_route; never point it at a local Chrome
# for those sites (both blocked the Mac on 2026-11-15), and never put a key here.
[ -f /tmp/sh-walk-server.pid ] && kill $(cat /tmp/sh-walk-server.pid) 2>/dev/null; sleep 1
rm -rf /tmp/sh-walk-data; mkdir -p /tmp/sh-walk-data
cd ~/dev/projects/secondhand-wt/$1 && NODE_ENV=development SECONDHAND_DATA_DIR=/tmp/sh-walk-data SECONDHAND_DEV_CODE=$(cat /tmp/sh-walk-devcode) PORT=8790 nohup node server/main.ts > /tmp/sh-walk-server.log 2>&1 & echo $! > /tmp/sh-walk-server.pid
sleep 5; curl -s localhost:8790/healthz; echo " server from $1"
