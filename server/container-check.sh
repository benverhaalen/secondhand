#!/usr/bin/env bash
# Run from the repository root: bash server/container-check.sh
set +x
set -euo pipefail

container=''
refusal=''
data_dir=''
check='build image'
fail() { printf 'fail %s\n' "$*" >&2; exit 1; }
ok() { printf 'ok %s\n' "$*"; }
cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n "$container" ]]; then
    docker rm -f "$container" >/dev/null || { printf 'fail remove container\n' >&2; status=1; }
  fi
  if [[ -n "$refusal" ]]; then
    docker rm -f "$refusal" >/dev/null || { printf 'fail remove refusal container\n' >&2; status=1; }
  fi
  if [[ -n "$data_dir" ]]; then
    rm -rf "$data_dir" || { printf 'fail remove temporary data\n' >&2; status=1; }
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'fail "$check"' ERR
trap 'fail interrupted' INT TERM

docker build -t secondhand-api:check .
ok "$check"

check='prepare temporary data and throwaway keys'
data_dir=$(mktemp -d)
# A host bind mount hides the image's node-owned /data. Only this disposable
# directory is made writable across the host and container UID boundary.
chmod 0777 "$data_dir"
export DECISION_SIGNING_KEY SECONDHAND_VISITOR_KEY SECONDHAND_VAULT_KEY
DECISION_SIGNING_KEY=$(openssl rand -hex 32)
SECONDHAND_VISITOR_KEY=$(openssl rand -hex 32)
SECONDHAND_VAULT_KEY=$(openssl rand -hex 32)
args=(--env NODE_ENV=production --env SECONDHAND_DATA_DIR=/data
  --env SECONDHAND_PEER_HEADER=Fly-Client-IP --env SECONDHAND_TICK_S=2
  --env SECONDHAND_VISITOR_KEY --env SECONDHAND_VAULT_KEY
  --mount "type=bind,source=$data_dir,target=/data" --publish 127.0.0.1::8080)

check='start production container'
container=$(docker run -d "${args[@]}" --env DECISION_SIGNING_KEY secondhand-api:check)
# Docker reserves an ephemeral host port, avoiding a find-then-bind race.
address=$(docker port "$container" 8080/tcp)
[[ "$address" =~ ^127\.0\.0\.1:[0-9]+$ ]] || fail 'resolve local container port'
base="http://$address"

check='GET /healthz returns 200 within 60s'
deadline=$((SECONDS + 60))
healthy=false
while (( SECONDS < deadline )); do
  if status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 1 "$base/healthz") && [[ "$status" == 200 ]]; then
    healthy=true
    break
  fi
  [[ $(docker inspect --format '{{.State.Running}}' "$container") == true ]] || fail "$check (container exited)"
  sleep 1
done
[[ "$healthy" == true ]] || fail "$check"
ok "$check"

check='GET /v1/routes is served and asks for a sign-in (401 unauthenticated)'
body=$(curl --silent --max-time 5 --write-out ' %{http_code}' "$base/v1/routes")
[[ "$body" == *'"code":"unauthenticated"'*' 401' ]] || fail "$check"
ok "$check"

check='watch.tick appears within 60s'
deadline=$((SECONDS + 60))
ticked=false
while (( SECONDS < deadline )); do
  logs=$(docker logs "$container" 2>&1)
  if grep -Fq 'watch.tick' <<< "$logs"; then ticked=true; break; fi
  [[ $(docker inspect --format '{{.State.Running}}' "$container") == true ]] || fail "$check (container exited)"
  sleep 1
done
[[ "$ticked" == true ]] || fail "$check"
ok "$check"

check='SIGTERM exits 0 within kill_timeout (30s)'
started=$SECONDS
# Docker's default stop signal is SIGTERM; this image does not override it.
docker stop --time 30 "$container" >/dev/null
(( SECONDS - started <= 30 )) || fail "$check"
[[ $(docker inspect --format '{{.State.Running}} {{.State.ExitCode}}' "$container") == 'false 0' ]] || fail "$check"
ok "$check"

check='/data holds secondhand.db after shutdown'
[[ -f "$data_dir/secondhand.db" ]] || fail "$check"
ok "$check"

check='missing DECISION_SIGNING_KEY refuses startup within 10s and names the variable'
unset DECISION_SIGNING_KEY
refusal=$(docker run -d "${args[@]}" secondhand-api:check)
deadline=$((SECONDS + 10))
while [[ $(docker inspect --format '{{.State.Running}}' "$refusal") == true ]]; do
  (( SECONDS < deadline )) || fail "$check"
  sleep 1
done
[[ $(docker inspect --format '{{.State.ExitCode}}' "$refusal") != 0 ]] || fail "$check (exit was 0)"
logs=$(docker logs "$refusal" 2>&1)
grep -Fq 'DECISION_SIGNING_KEY' <<< "$logs" || fail "$check"
ok "$check"
