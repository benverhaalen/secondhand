#!/bin/zsh
# usage: [MODEL=gpt-6.1-sol] [EFFORT=medium] [AGAIN=1] zsh mac-worker.sh <name> <brief file>
# Starts one Codex build worker in its own git worktree, detached, with a process cap.
# AGAIN=1 sends a follow-up brief into a worktree that already exists (a fix to the same piece).
# Which model and effort for which piece: .agents/team/packets/team/55-team-leads-and-mac-workers.md
name=$1; brief=$2; model=${MODEL:-gpt-6.1-sol}; effort=${EFFORT:-medium}
main=~/dev/projects/secondhand; wt=~/dev/projects/secondhand-wt/$name
[ -n "$name" ] && [ -f "$brief" ] || { echo "usage: mac-worker.sh <name> <brief file>"; exit 2; }
case $effort in low|medium|high) ;; *) echo "effort $effort is not used here without a measured gain: low, medium or high"; exit 2;; esac
[ "$(pgrep -f 'codex exec' | wc -l | tr -d ' ')" -ge 12 ] && { echo "12 workers already running: not starting $name"; exit 1; }
if [ -d $wt ]; then
  [ -n "$AGAIN" ] || { echo "worktree $name exists: pick a new name, or AGAIN=1 for a follow-up to the same piece"; exit 1; }
  pgrep -f "codex exec.*-C $wt " >/dev/null && { echo "$name is still running"; exit 1; }
  rm -f $wt/WORKER_REPORT.md
else
  cd $main && git pull -q --no-rebase || { echo "PULL FAILED: not starting $name"; exit 1; }
  git worktree add -q -b w/$name $wt main || exit 1
  ln -sfn $main/.venv $wt/.venv; ln -sfn $main/app/node_modules $wt/app/node_modules; ln -sfn $main/db/node_modules $wt/db/node_modules
fi
cd $wt; ulimit -u 1500
CODEX_HOME=$HOME/.codex-worker nohup codex exec -m $model -c model_reasoning_effort=$effort -s workspace-write -C $wt --skip-git-repo-check "$(cat $brief)" </dev/null >> /tmp/worker-$name.log 2>&1 &
echo "started $name pid $! on $model at $effort in $wt"
