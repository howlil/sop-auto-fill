#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -ne 2 || "$2" != "--yes" ]]; then
  echo "Usage: scripts/restore.sh <backup.sql.gz> --yes" >&2
  exit 2
fi

BACKUP_FILE="$1"
[[ -r "$BACKUP_FILE" ]] || { echo "Backup file not readable: $BACKUP_FILE" >&2; exit 1; }
gzip -t "$BACKUP_FILE"

ENV_FILE="${PRODUCTION_ENV_FILE:-.env.production}"
[[ -f "$ENV_FILE" ]] || { echo "Production env file missing: $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"

COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.yml)
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" up -d mysql

mysql_container="$(${COMPOSE[@]} ps -q mysql)"
[[ -n "$mysql_container" ]] || { echo "MySQL container was not created" >&2; exit 1; }

for attempt in {1..60}; do
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$mysql_container" 2>/dev/null || true)"
  if [[ "$health" == "healthy" ]]; then
    break
  fi
  if [[ "$attempt" -eq 60 ]]; then
    echo "MySQL did not become healthy before restore" >&2
    "${COMPOSE[@]}" ps >&2 || true
    "${COMPOSE[@]}" logs --no-color --tail=100 mysql >&2 || true
    exit 1
  fi
  sleep 2
done

echo "Restoring database '$MYSQL_DATABASE' from $BACKUP_FILE" >&2
gzip -dc "$BACKUP_FILE" | "${COMPOSE[@]}" exec -T mysql \
  mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"

echo "Restore completed" >&2
