#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${PRODUCTION_ENV_FILE:-.env.production.example}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.yml)

[[ -f compose.yml ]] || { echo "compose.yml missing" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE missing" >&2; exit 1; }

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
"${COMPOSE[@]}" config > "$tmp"

for service in frontend backend mysql; do
  grep -Eq "^  ${service}:$" "$tmp" || { echo "missing service: $service" >&2; exit 1; }
done

grep -Eq '^  mysql_data:$' "$tmp" || { echo "mysql_data volume missing" >&2; exit 1; }
grep -Eq '^  sop_pdf_data:$' "$tmp" || { echo "sop_pdf_data volume missing" >&2; exit 1; }

backend_block="$(sed -n '/^  backend:$/,/^  [a-zA-Z0-9_-]*:$/p' "$tmp")"
mysql_block="$(sed -n '/^  mysql:$/,/^  [a-zA-Z0-9_-]*:$/p' "$tmp")"
! grep -q '^    ports:' <<<"$backend_block" || { echo "backend must not publish ports" >&2; exit 1; }
! grep -q '^    ports:' <<<"$mysql_block" || { echo "mysql must not publish ports" >&2; exit 1; }

grep -q 'condition: service_healthy' "$tmp" || { echo "healthy dependency gating missing" >&2; exit 1; }
grep -q '/api/health/ready' "$tmp" || { echo "backend readiness healthcheck missing" >&2; exit 1; }
grep -q 'mysql_data:/var/lib/mysql' "$tmp" || { echo "mysql persistence missing" >&2; exit 1; }
grep -q 'sop_pdf_data:/app/storage/sop-pdf' "$tmp" || { echo "PDF persistence missing" >&2; exit 1; }

echo "production compose contract: ok"
