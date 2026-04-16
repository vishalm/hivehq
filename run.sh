#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# HIVE — Run Everything (No Docker)
#
# Usage:
#   ./run.sh                 Start all services (Node + Dashboard + Docs + Proxy)
#   ./run.sh --seed          Start all + seed 200 demo events
#   ./run.sh --seed 500      Start all + seed 500 demo events
#   ./run.sh --no-docs       Skip Docusaurus docs server
#   ./run.sh --no-proxy      Skip Ollama proxy
#   ./run.sh --no-dashboard  Skip Next.js dashboard
#   ./run.sh stop            Kill all HIVE background processes
#   ./run.sh status          Show running HIVE processes
#   ./run.sh logs            Tail all HIVE logs
#   ./run.sh clean           Remove build artifacts and logs
#
# Prerequisites:
#   - Node.js >= 18 (22+ recommended)
#   - npm
#   - Optionally: PostgreSQL (falls back to in-memory store)
#   - Optionally: Ollama (for local LLM + proxy telemetry)
#
# Ports:
#   3000 — Node Server (TTP ingest API)
#   3001 — Dashboard (Next.js)
#   3002 — Documentation (Docusaurus)
#  11435 — Ollama Proxy (transparent telemetry capture)
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Config ────────────────────────────────────────────────────────────────────
HIVE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$HIVE_DIR/.hive/logs"
PID_DIR="$HIVE_DIR/.hive/pids"

# Ports (override via env vars)
NODE_PORT="${NODE_PORT:-3000}"
DASHBOARD_PORT="${DASHBOARD_PORT:-3001}"
DOCS_PORT="${DOCS_PORT:-3002}"
OLLAMA_PROXY_PORT="${OLLAMA_PROXY_PORT:-11435}"

# Node server config
NODE_REGION="${NODE_REGION:-AE}"
NODE_ID="${NODE_ID:-hive-local-01}"
NODE_INGEST_TOKEN="${NODE_INGEST_TOKEN:-hive-dev-token-2026}"
NODE_DATABASE_URL="${NODE_DATABASE_URL:-}"
LOG_LEVEL="${LOG_LEVEL:-info}"

# Ollama proxy config
OLLAMA_TARGET="${OLLAMA_TARGET:-http://localhost:11434}"

# ── Helpers ───────────────────────────────────────────────────────────────────
hive_banner() {
  echo ""
  echo -e "${YELLOW}  ╦ ╦╦╦  ╦╔═╗${RESET}"
  echo -e "${YELLOW}  ╠═╣║╚╗╔╝║╣ ${RESET}  ${DIM}The Global AI Consumption Network${RESET}"
  echo -e "${YELLOW}  ╩ ╩╩ ╚╝ ╚═╝${RESET}  ${DIM}Token Economy · Token Governance · Zero Content${RESET}"
  echo ""
}

log_info()  { echo -e "  ${GREEN}[OK]${RESET}    $1"; }
log_warn()  { echo -e "  ${YELLOW}[WARN]${RESET}  $1"; }
log_error() { echo -e "  ${RED}[FAIL]${RESET}  $1"; }
log_step()  { echo -e "  ${BLUE}[...]${RESET}   $1"; }
log_dim()   { echo -e "  ${DIM}$1${RESET}"; }

ensure_dirs() {
  mkdir -p "$LOG_DIR" "$PID_DIR"
}

save_pid() {
  local name="$1" pid="$2"
  echo "$pid" > "$PID_DIR/$name.pid"
}

read_pid() {
  local name="$1"
  local pidfile="$PID_DIR/$name.pid"
  if [[ -f "$pidfile" ]]; then
    cat "$pidfile"
  fi
}

is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

wait_for_port() {
  local port="$1" name="$2" max="${3:-30}"
  local i=0
  while ! (echo >/dev/tcp/127.0.0.1/"$port") 2>/dev/null; do
    ((i++))
    if ((i >= max)); then
      log_error "$name did not start on port $port within ${max}s"
      return 1
    fi
    sleep 1
  done
  return 0
}

wait_for_health() {
  local url="$1" name="$2" max="${3:-30}"
  local i=0
  while ! curl -sf "$url" >/dev/null 2>&1; do
    ((i++))
    if ((i >= max)); then
      log_warn "$name health check failed after ${max}s (may still be starting)"
      return 1
    fi
    sleep 1
  done
  return 0
}

kill_pid() {
  local name="$1"
  local pid
  pid=$(read_pid "$name")
  if is_running "$pid"; then
    kill "$pid" 2>/dev/null && log_info "Stopped $name (PID $pid)"
    rm -f "$PID_DIR/$name.pid"
  else
    rm -f "$PID_DIR/$name.pid"
  fi
}

# ── Stop all ──────────────────────────────────────────────────────────────────
do_stop() {
  hive_banner
  echo -e "  ${BOLD}Stopping HIVE services...${RESET}"
  echo ""
  for svc in node-server dashboard docs ollama-proxy; do
    kill_pid "$svc"
  done
  echo ""
  log_info "All HIVE services stopped"
}

# ── Status ────────────────────────────────────────────────────────────────────
do_status() {
  hive_banner
  echo -e "  ${BOLD}HIVE Service Status${RESET}"
  echo ""
  printf "  %-18s %-8s %-8s %s\n" "SERVICE" "PID" "PORT" "STATUS"
  printf "  %-18s %-8s %-8s %s\n" "───────────────" "──────" "──────" "──────────"

  for svc_info in "node-server:$NODE_PORT" "dashboard:$DASHBOARD_PORT" "docs:$DOCS_PORT" "ollama-proxy:$OLLAMA_PROXY_PORT"; do
    local svc="${svc_info%%:*}"
    local port="${svc_info##*:}"
    local pid
    pid=$(read_pid "$svc")
    if is_running "$pid"; then
      printf "  %-18s %-8s %-8s ${GREEN}running${RESET}\n" "$svc" "$pid" "$port"
    else
      printf "  %-18s %-8s %-8s ${DIM}stopped${RESET}\n" "$svc" "-" "$port"
    fi
  done
  echo ""
}

# ── Logs ──────────────────────────────────────────────────────────────────────
do_logs() {
  hive_banner
  echo -e "  ${BOLD}Tailing all HIVE logs (Ctrl+C to stop)${RESET}"
  echo ""
  tail -f "$LOG_DIR"/*.log 2>/dev/null || log_warn "No log files found in $LOG_DIR"
}

# ── Clean ─────────────────────────────────────────────────────────────────────
do_clean() {
  hive_banner
  echo -e "  ${BOLD}Cleaning build artifacts...${RESET}"
  echo ""

  # Stop services first
  for svc in node-server dashboard docs ollama-proxy; do
    kill_pid "$svc"
  done

  # Clean build outputs
  rm -rf "$LOG_DIR"/*.log
  rm -rf "$PID_DIR"/*.pid
  rm -rf packages/shared/dist
  rm -rf packages/policy/dist
  rm -rf packages/intelligence/dist
  rm -rf packages/node-server/dist
  rm -rf packages/connector-sdk/dist
  rm -rf packages/scout/dist
  rm -rf packages/vault/dist
  rm -rf packages/dashboard/.next
  rm -rf docs-site/build
  rm -rf .turbo

  log_info "Build artifacts cleaned"
  echo ""
}

# ── Build ─────────────────────────────────────────────────────────────────────
do_build() {
  echo -e "  ${BOLD}Building HIVE packages...${RESET}"
  echo ""

  # 1. Install dependencies if needed
  if [[ ! -d node_modules ]]; then
    log_step "Installing dependencies..."
    npm install 2>&1 | tail -1
    log_info "Dependencies installed"
  fi

  # 2. Build shared (required by everything)
  log_step "Building @hive/shared..."
  npx tsc -p packages/shared/tsconfig.json 2>&1 || {
    log_error "@hive/shared build failed"
    exit 1
  }
  log_info "@hive/shared built"

  # 3. Build policy + intelligence (required by node-server)
  log_step "Building @hive/policy..."
  npx tsc -p packages/policy/tsconfig.json 2>&1 || {
    log_error "@hive/policy build failed"
    exit 1
  }
  log_info "@hive/policy built"

  log_step "Building @hive/intelligence..."
  npx tsc -p packages/intelligence/tsconfig.json 2>&1 || {
    log_error "@hive/intelligence build failed"
    exit 1
  }
  log_info "@hive/intelligence built"

  # 4. Build node-server
  log_step "Building @hive/node-server..."
  npx tsc -p packages/node-server/tsconfig.json 2>&1 || {
    log_error "@hive/node-server build failed"
    exit 1
  }
  log_info "@hive/node-server built"

  # 5. Build vault (optional, for credential storage)
  if [[ -f packages/vault/tsconfig.json ]]; then
    log_step "Building @hive/vault..."
    npx tsc -p packages/vault/tsconfig.json 2>&1 || log_warn "@hive/vault build failed (non-fatal)"
    log_info "@hive/vault built"
  fi

  # 6. Build connector-sdk + scout (optional)
  if [[ -f packages/connector-sdk/tsconfig.json ]]; then
    log_step "Building @hive/connector-sdk..."
    npx tsc -p packages/connector-sdk/tsconfig.json 2>&1 || log_warn "@hive/connector-sdk build failed (non-fatal)"
    log_info "@hive/connector-sdk built"
  fi

  echo ""
}

# ── Start Node Server ────────────────────────────────────────────────────────
start_node_server() {
  local existing_pid
  existing_pid=$(read_pid "node-server")
  if is_running "$existing_pid"; then
    log_info "Node server already running (PID $existing_pid)"
    return 0
  fi

  log_step "Starting Node server on port $NODE_PORT..."

  NODE_PORT="$NODE_PORT" \
  NODE_REGION="$NODE_REGION" \
  NODE_ID="$NODE_ID" \
  NODE_INGEST_TOKEN="$NODE_INGEST_TOKEN" \
  NODE_DATABASE_URL="$NODE_DATABASE_URL" \
  LOG_LEVEL="$LOG_LEVEL" \
    node packages/node-server/dist/cli.js \
    > "$LOG_DIR/node-server.log" 2>&1 &

  local pid=$!
  save_pid "node-server" "$pid"

  if wait_for_port "$NODE_PORT" "Node server" 15; then
    log_info "Node server running on port $NODE_PORT (PID $pid)"
    if [[ -z "$NODE_DATABASE_URL" ]]; then
      log_dim "Using in-memory store (set NODE_DATABASE_URL for persistence)"
    else
      log_dim "Connected to PostgreSQL"
    fi
  else
    log_error "Node server failed to start. Check $LOG_DIR/node-server.log"
    tail -5 "$LOG_DIR/node-server.log" 2>/dev/null | while read -r line; do
      log_dim "  $line"
    done
    return 1
  fi
}

# ── Start Dashboard ──────────────────────────────────────────────────────────
start_dashboard() {
  local existing_pid
  existing_pid=$(read_pid "dashboard")
  if is_running "$existing_pid"; then
    log_info "Dashboard already running (PID $existing_pid)"
    return 0
  fi

  log_step "Starting Dashboard on port $DASHBOARD_PORT..."

  DASHBOARD_PORT="$DASHBOARD_PORT" \
  NEXT_PUBLIC_NODE_URL="http://localhost:$NODE_PORT" \
    npx next dev packages/dashboard -p "$DASHBOARD_PORT" \
    > "$LOG_DIR/dashboard.log" 2>&1 &

  local pid=$!
  save_pid "dashboard" "$pid"

  if wait_for_port "$DASHBOARD_PORT" "Dashboard" 30; then
    log_info "Dashboard running on port $DASHBOARD_PORT (PID $pid)"
  else
    log_warn "Dashboard still starting (check $LOG_DIR/dashboard.log)"
  fi
}

# ── Start Docs ────────────────────────────────────────────────────────────────
start_docs() {
  local existing_pid
  existing_pid=$(read_pid "docs")
  if is_running "$existing_pid"; then
    log_info "Docs already running (PID $existing_pid)"
    return 0
  fi

  # Install docs deps if needed
  if [[ ! -d docs-site/node_modules ]]; then
    log_step "Installing docs dependencies..."
    (cd docs-site && npm install) > "$LOG_DIR/docs-install.log" 2>&1
    log_info "Docs dependencies installed"
  fi

  log_step "Starting Docs on port $DOCS_PORT..."

  (cd docs-site && npx docusaurus start --host 0.0.0.0 --port "$DOCS_PORT") \
    > "$LOG_DIR/docs.log" 2>&1 &

  local pid=$!
  save_pid "docs" "$pid"

  if wait_for_port "$DOCS_PORT" "Docs" 30; then
    log_info "Docs running on port $DOCS_PORT (PID $pid)"
  else
    log_warn "Docs still starting (check $LOG_DIR/docs.log)"
  fi
}

# ── Start Ollama Proxy ───────────────────────────────────────────────────────
start_ollama_proxy() {
  local existing_pid
  existing_pid=$(read_pid "ollama-proxy")
  if is_running "$existing_pid"; then
    log_info "Ollama proxy already running (PID $existing_pid)"
    return 0
  fi

  # Check if Ollama is reachable
  if ! curl -sf "$OLLAMA_TARGET/api/tags" >/dev/null 2>&1; then
    log_warn "Ollama not reachable at $OLLAMA_TARGET — skipping proxy"
    log_dim "Start Ollama first, then re-run: ./run.sh --proxy-only"
    return 0
  fi

  log_step "Starting Ollama proxy on port $OLLAMA_PROXY_PORT..."

  OLLAMA_PROXY_PORT="$OLLAMA_PROXY_PORT" \
  OLLAMA_TARGET="$OLLAMA_TARGET" \
  NODE_URL="http://localhost:$NODE_PORT" \
  NODE_INGEST_TOKEN="$NODE_INGEST_TOKEN" \
    node scripts/ollama-proxy.mjs \
    > "$LOG_DIR/ollama-proxy.log" 2>&1 &

  local pid=$!
  save_pid "ollama-proxy" "$pid"

  if wait_for_port "$OLLAMA_PROXY_PORT" "Ollama proxy" 10; then
    log_info "Ollama proxy running on port $OLLAMA_PROXY_PORT (PID $pid)"
    log_dim "All Ollama traffic via localhost:$OLLAMA_PROXY_PORT is now captured"
  else
    log_warn "Ollama proxy may have failed (check $LOG_DIR/ollama-proxy.log)"
  fi
}

# ── Seed Events ──────────────────────────────────────────────────────────────
seed_events() {
  local count="${1:-200}"

  log_step "Seeding $count demo events..."

  NODE_URL="http://localhost:$NODE_PORT" \
  NODE_INGEST_TOKEN="$NODE_INGEST_TOKEN" \
    node scripts/seed-events.mjs "$count" \
    > "$LOG_DIR/seed.log" 2>&1

  if [[ $? -eq 0 ]]; then
    log_info "Seeded $count events into Node server"
  else
    log_warn "Seeding may have failed (check $LOG_DIR/seed.log)"
  fi
}

# ── Print summary ────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "  ${BOLD}${YELLOW}HIVE is running${RESET}"
  echo ""
  echo -e "  ${BOLD}Services:${RESET}"
  echo -e "    Node Server    ${GREEN}http://localhost:$NODE_PORT${RESET}       TTP ingest API"
  if [[ "$RUN_DASHBOARD" == "true" ]]; then
    echo -e "    Dashboard      ${GREEN}http://localhost:$DASHBOARD_PORT${RESET}       HIVE Dashboard"
    echo -e "    Landing Page   ${GREEN}http://localhost:$DASHBOARD_PORT/landing${RESET}"
  fi
  if [[ "$RUN_DOCS" == "true" ]]; then
    echo -e "    Documentation  ${GREEN}http://localhost:$DOCS_PORT${RESET}       Docusaurus docs"
  fi
  if [[ "$RUN_PROXY" == "true" ]]; then
    echo -e "    Ollama Proxy   ${GREEN}http://localhost:$OLLAMA_PROXY_PORT${RESET}   Telemetry capture"
  fi
  echo ""
  echo -e "  ${BOLD}Useful commands:${RESET}"
  echo -e "    ${DIM}./run.sh status${RESET}          Show service status"
  echo -e "    ${DIM}./run.sh logs${RESET}            Tail all logs"
  echo -e "    ${DIM}./run.sh stop${RESET}            Stop all services"
  echo -e "    ${DIM}./run.sh --seed 500${RESET}      Seed more demo events"
  echo ""
  echo -e "  ${BOLD}Test the API:${RESET}"
  echo -e "    ${DIM}curl http://localhost:$NODE_PORT/health${RESET}"
  echo -e "    ${DIM}curl http://localhost:$NODE_PORT/metrics${RESET}"
  echo ""
  echo -e "  ${DIM}Logs: $LOG_DIR/${RESET}"
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

cd "$HIVE_DIR"

# Parse arguments
SEED_COUNT=""
RUN_DOCS="true"
RUN_PROXY="true"
RUN_DASHBOARD="true"

case "${1:-}" in
  stop)
    do_stop
    exit 0
    ;;
  status)
    do_status
    exit 0
    ;;
  logs)
    do_logs
    exit 0
    ;;
  clean)
    do_clean
    exit 0
    ;;
esac

while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed)
      if [[ -n "${2:-}" && "$2" =~ ^[0-9]+$ ]]; then
        SEED_COUNT="$2"
        shift
      else
        SEED_COUNT="200"
      fi
      ;;
    --no-docs)
      RUN_DOCS="false"
      ;;
    --no-proxy)
      RUN_PROXY="false"
      ;;
    --no-dashboard)
      RUN_DASHBOARD="false"
      ;;
    --proxy-only)
      RUN_DOCS="false"
      RUN_DASHBOARD="false"
      SEED_COUNT=""
      ;;
    *)
      ;;
  esac
  shift
done

# ── Go ────────────────────────────────────────────────────────────────────────

hive_banner
ensure_dirs

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d. -f1 | tr -d 'v')
if [[ -z "$NODE_VERSION" ]]; then
  log_error "Node.js is not installed. Install Node.js >= 18."
  exit 1
elif (( NODE_VERSION < 18 )); then
  log_error "Node.js $NODE_VERSION is too old. Install Node.js >= 18."
  exit 1
fi
log_info "Node.js v${NODE_VERSION} detected"

# Check for Postgres
if [[ -n "$NODE_DATABASE_URL" ]]; then
  log_info "PostgreSQL configured: ${NODE_DATABASE_URL%%@*}@..."
else
  # Try to detect local Postgres
  if pg_isready -q 2>/dev/null; then
    NODE_DATABASE_URL="postgresql://hive:hive_dev_password@localhost:5432/hive"
    log_info "Local PostgreSQL detected, using it"
  else
    log_warn "No PostgreSQL found — using in-memory store (data lost on restart)"
    log_dim "To persist data: export NODE_DATABASE_URL=postgresql://user:pass@host:5432/hive"
  fi
fi

echo ""

# Build TypeScript packages
do_build

# Start services in order
start_node_server || exit 1

echo ""

if [[ "$RUN_DASHBOARD" == "true" ]]; then
  start_dashboard
fi

if [[ "$RUN_DOCS" == "true" ]]; then
  start_docs
fi

if [[ "$RUN_PROXY" == "true" ]]; then
  start_ollama_proxy
fi

# Seed if requested
if [[ -n "$SEED_COUNT" ]]; then
  echo ""
  seed_events "$SEED_COUNT"
fi

# Summary
print_summary
