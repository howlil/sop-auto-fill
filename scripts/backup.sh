#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${PRODUCTION_ENV_FILE:-.env.production}"
[[ -f "$ENV_FILE" ]] || { echo "Production env file missing: $ENV_FILE" >&2; exit 1; }

COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.yml)
"${COMPOSE[@]}" config --quiet

compose_env_value() {
  local key="$1"
  "${COMPOSE[@]}" config --environment | awk -v key="$key" '
    index($0, key "=") == 1 {
      sub(/^[^=]*=/, "")
      print
      found = 1
      exit
    }
    END { if (!found) exit 1 }
  '
}

BACKUP_DIR="$(compose_env_value BACKUP_DIR || true)"
BACKUP_RETENTION_DAYS="$(compose_env_value BACKUP_RETENTION_DAYS || true)"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
[[ "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] || {
  echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 1
}

mysql_container="$(${COMPOSE[@]} ps -q mysql)"
[[ -n "$mysql_container" ]] || { echo "MySQL container is not running" >&2; exit 1; }

db_name="$(${COMPOSE[@]} exec -T mysql sh -c 'printf "%s" "$MYSQL_DATABASE"')"
[[ -n "$db_name" ]] || { echo "MYSQL_DATABASE is empty inside MySQL container" >&2; exit 1; }
safe_db_name="${db_name//[^A-Za-z0-9_.-]/_}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="$BACKUP_DIR/${safe_db_name}_${stamp}.sql.gz"
tmp="${final}.tmp"
trap 'rm -f "$tmp"' EXIT

"${COMPOSE[@]}" exec -T mysql sh -c '
  exec mysqldump \
    --single-transaction \
    --quick \
    --lock-tables=false \
    --no-tablespaces \
    -u"$MYSQL_USER" \
    -p"$MYSQL_PASSWORD" \
    "$MYSQL_DATABASE"
' | gzip -c > "$tmp"

test -s "$tmp" || { echo "Backup is empty" >&2; exit 1; }
gzip -t "$tmp"
mv "$tmp" "$final"
trap - EXIT

find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime "+$BACKUP_RETENTION_DAYS" -delete
printf '%s\n' "$final"
