#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${PRODUCTION_ENV_FILE:-.env.production}"
[[ -f "$ENV_FILE" ]] || { echo "Production env file missing: $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${MYSQL_DATABASE:?MYSQL_DATABASE is required}"
: "${MYSQL_USER:?MYSQL_USER is required}"
: "${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
[[ "$BACKUP_RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]] || {
  echo "BACKUP_RETENTION_DAYS must be a positive integer" >&2
  exit 1
}

COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.yml)
"${COMPOSE[@]}" config --quiet

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="$BACKUP_DIR/${MYSQL_DATABASE}_${stamp}.sql.gz"
tmp="${final}.tmp"
trap 'rm -f "$tmp"' EXIT

"${COMPOSE[@]}" exec -T mysql \
  mysqldump --single-transaction --quick --lock-tables=false --no-tablespaces \
  -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  | gzip -c > "$tmp"

test -s "$tmp" || { echo "Backup is empty" >&2; exit 1; }
gzip -t "$tmp"
mv "$tmp" "$final"
trap - EXIT

find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime "+$BACKUP_RETENTION_DAYS" -delete
printf '%s\n' "$final"
