#!/bin/zsh
# usage: mac-worker.sh <name> <brief file>. Starts one Codex build worker in its own git worktree, detached, with a process cap.
# Rules for its use: .agents/team/packets/team/55-team-leads-and-mac-workers.md
name=$1; brief=$2; main=~/dev/projects/secondhand; wt=~/dev/projects/secondhand-wt/$name
[ -n "$name" ] && [ -f "$brief" ] || { echo "usage: mac-worker.sh <name> <brief file>"; exit 2; }
[ -d $wt ] && { echo "worktree $name exists: pick a new name"; exit 1; }
[ "$(pgrep -f 'codex exec' | wc -l | tr -d ' ')" -ge 8 ] && { echo "8 workers already running: not starting $name"; exit 1; }
cd $main && git pull -q --no-rebase || { echo "PULL FAILED: not starting $name"; exit 1; }
git worktree add -q -b w/$name $wt main || exit 1
ln -sfn $main/.venv $wt/.venv; ln -sfn $main/app/node_modules $wt/app/node_modules; ln -sfn $main/db/node_modules $wt/db/node_modules
cd $wt; ulimit -u 1500
CODEX_HOME=$HOME/.codex-worker nohup codex exec -s workspace-write -C $wt --skip-git-repo-check "$(cat $brief)" </dev/null > /tmp/worker-$name.log 2>&1 &
echo "started $name pid $! in $wt"
