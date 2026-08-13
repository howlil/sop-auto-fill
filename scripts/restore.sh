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

db_name="$(${COMPOSE[@]} exec -T mysql sh -c 'printf "%s" "$MYSQL_DATABASE"')"
[[ -n "$db_name" ]] || { echo "MYSQL_DATABASE is empty inside MySQL container" >&2; exit 1; }

echo "Replacing database '$db_name' from $BACKUP_FILE" >&2
"${COMPOSE[@]}" exec -T mysql sh -eu -c '
  case "$MYSQL_DATABASE" in
    ""|*[!A-Za-z0-9_]*)
      echo "MYSQL_DATABASE must contain only letters, numbers, and underscores for restore" >&2
      exit 1
      ;;
  esac

  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
    DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`;
    CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  "
'

gzip -dc "$BACKUP_FILE" | "${COMPOSE[@]}" exec -T mysql sh -c '
  exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"
'

echo "Restore completed" >&2
