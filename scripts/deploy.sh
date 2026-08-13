#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${PRODUCTION_ENV_FILE:-.env.production}"
[[ -f "$ENV_FILE" ]] || { echo "Production env file missing: $ENV_FILE" >&2; exit 1; }

command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
docker compose version >/dev/null

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Tracked repository changes detected. Commit or discard them before deploy." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

FRONTEND_PORT="${FRONTEND_PORT:-8080}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.yml)
"${COMPOSE[@]}" config --quiet

show_diagnostics() {
  echo "--- docker compose ps ---" >&2
  "${COMPOSE[@]}" ps >&2 || true
  echo "--- backend logs ---" >&2
  "${COMPOSE[@]}" logs --no-color --tail=120 backend >&2 || true
  echo "--- frontend logs ---" >&2
  "${COMPOSE[@]}" logs --no-color --tail=120 frontend >&2 || true
}

wait_service_healthy() {
  local service="$1"
  local container health
  container="$(${COMPOSE[@]} ps -q "$service")"
  [[ -n "$container" ]] || { echo "$service container was not created" >&2; return 1; }

  for attempt in {1..60}; do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || true)"
    [[ "$health" == "healthy" ]] && return 0
    if [[ "$health" == "unhealthy" ]]; then
      echo "$service became unhealthy" >&2
      return 1
    fi
    sleep 2
  done

  echo "$service did not become healthy" >&2
  return 1
}

wait_http() {
  local url="$1"
  for attempt in {1..60}; do
    if curl --fail --silent --show-error "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "HTTP smoke check failed: $url" >&2
  return 1
}

if "${COMPOSE[@]}" ps -a -q mysql | grep -q .; then
  echo "Creating pre-deploy database backup..."
  PRODUCTION_ENV_FILE="$ENV_FILE" scripts/backup.sh
fi

echo "Updating source with fast-forward only..."
git pull --ff-only

"${COMPOSE[@]}" config --quiet

echo "Building production images..."
"${COMPOSE[@]}" build

echo "Starting MySQL..."
"${COMPOSE[@]}" up -d mysql
if ! wait_service_healthy mysql; then
  show_diagnostics
  exit 1
fi

echo "Applying Prisma migrations..."
"${COMPOSE[@]}" run --rm backend pnpm prisma migrate deploy

echo "Starting backend and frontend..."
"${COMPOSE[@]}" up -d backend frontend
if ! wait_service_healthy backend; then
  show_diagnostics
  exit 1
fi
if ! wait_service_healthy frontend; then
  show_diagnostics
  exit 1
fi

if ! wait_http "http://127.0.0.1:${FRONTEND_PORT}/api/health/ready"; then
  show_diagnostics
  exit 1
fi
if ! wait_http "http://127.0.0.1:${FRONTEND_PORT}/"; then
  show_diagnostics
  exit 1
fi

"${COMPOSE[@]}" ps
echo "Production deployment healthy."
