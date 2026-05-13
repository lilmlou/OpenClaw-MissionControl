#!/usr/bin/env bash
# Start the live Mission Control backend ports from source checkouts.
# - FastAPI MissionControl: http://127.0.0.1:8765
# - Express AgentRuntime: http://127.0.0.1:7801
#
# Safe to re-run: existing listeners on these ports are stopped before restart.
set -euo pipefail

MC_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FASTAPI_DIR="$MC_ROOT/MissionControl/backend"
EXPRESS_DIR="$MC_ROOT/AgentRuntime"
FASTAPI_LOG="${FASTAPI_LOG:-/tmp/mc_fastapi_8765.log}"
EXPRESS_LOG="${EXPRESS_LOG:-/tmp/mc_agentruntime_7801.log}"

stop_port() {
  local port="$1"
  local pid
  pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    return 0
  fi
  echo "[run_live_ports] stopping port $port pid(s): $pid"
  kill $pid 2>/dev/null || true
  for _ in {1..30}; do
    if ! lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.1
  done
  pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "$pid" ]]; then
    echo "[run_live_ports] SIGKILL port $port pid(s): $pid"
    kill -9 $pid 2>/dev/null || true
  fi
}

wait_http() {
  local url="$1"
  local name="$2"
  for _ in {1..150}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[run_live_ports] $name ready: $url"
      return 0
    fi
    sleep 0.1
  done
  echo "[run_live_ports] ERROR: $name did not become ready: $url" >&2
  return 1
}

if [[ ! -x "$FASTAPI_DIR/venv/bin/python" ]]; then
  echo "[run_live_ports] ERROR: missing FastAPI venv at $FASTAPI_DIR/venv" >&2
  exit 1
fi
if [[ ! -d "$EXPRESS_DIR/node_modules" ]]; then
  echo "[run_live_ports] ERROR: missing AgentRuntime node_modules at $EXPRESS_DIR/node_modules" >&2
  exit 1
fi

stop_port 8765
stop_port 7801

cd "$FASTAPI_DIR"
./venv/bin/python -m compileall -q server.py app
nohup ./venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8765 --loop asyncio --http h11 >"$FASTAPI_LOG" 2>&1 &
FASTAPI_PID=$!

cd "$EXPRESS_DIR"
npx tsc
nohup node dist/gateway.js >"$EXPRESS_LOG" 2>&1 &
EXPRESS_PID=$!

wait_http http://127.0.0.1:8765/api/v2/config FastAPI
wait_http http://127.0.0.1:7801/api/v2/threads AgentRuntime

echo "[run_live_ports] FastAPI pid=$FASTAPI_PID log=$FASTAPI_LOG"
echo "[run_live_ports] AgentRuntime pid=$EXPRESS_PID log=$EXPRESS_LOG"
