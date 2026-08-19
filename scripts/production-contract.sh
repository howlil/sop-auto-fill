#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${PRODUCTION_ENV_FILE:-.env.production.example}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.yml)

[[ -f compose.yml ]] || { echo "compose.yml missing" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE missing" >&2; exit 1; }
[[ -f server/prisma/seed-runtime.cjs ]] || { echo "production template seed runner missing" >&2; exit 1; }
[[ -f server/prisma/system-template-seed.cjs ]] || { echo "system template seed module missing" >&2; exit 1; }

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

grep -q 'AI_DRAFT_PROVIDER: disabled' <<<"$backend_block" || {
  echo "production AI drafting must default to disabled" >&2
  exit 1
}
! grep -q 'AI_DRAFT_PROVIDER: fake' <<<"$backend_block" || {
  echo "fake AI provider must never be used by production Compose" >&2
  exit 1
}
grep -q 'AI_REVIEW_PROVIDER: disabled' <<<"$backend_block" || {
  echo "production AI review must default to disabled" >&2
  exit 1
}
! grep -q 'AI_REVIEW_PROVIDER: fake' <<<"$backend_block" || {
  echo "fake AI review provider must never be used by production Compose" >&2
  exit 1
}

grep -q 'source: mysql_data' "$tmp" || { echo "mysql_data source missing" >&2; exit 1; }
grep -q 'target: /var/lib/mysql' "$tmp" || { echo "mysql persistence target missing" >&2; exit 1; }
grep -q 'source: sop_pdf_data' "$tmp" || { echo "sop_pdf_data source missing" >&2; exit 1; }
grep -q 'target: /app/storage/sop-pdf' "$tmp" || { echo "PDF persistence target missing" >&2; exit 1; }

for script in scripts/deploy.sh scripts/backup.sh scripts/restore.sh; do
  [[ -x "$script" ]] || { echo "$script must exist and be executable" >&2; exit 1; }
  bash -n "$script"
  ! grep -Eq '^[[:space:]]*source[[:space:]].*ENV_FILE' "$script" || {
    echo "$script must not source the Compose env file" >&2
    exit 1
  }
done

grep -q 'git pull --ff-only' scripts/deploy.sh || { echo "deploy must use ff-only pull" >&2; exit 1; }
grep -q 'scripts/backup.sh' scripts/deploy.sh || { echo "deploy must backup before migration" >&2; exit 1; }
grep -q 'prisma migrate deploy' scripts/deploy.sh || { echo "deploy must run migrate deploy" >&2; exit 1; }
grep -q 'seed-runtime.cjs' scripts/deploy.sh || { echo "deploy must seed system templates" >&2; exit 1; }
grep -q 'api/health/ready' scripts/deploy.sh || { echo "deploy must verify backend readiness" >&2; exit 1; }
grep -q 'BACKUP_RETENTION_DAYS' scripts/backup.sh || { echo "backup retention missing" >&2; exit 1; }
grep -q -- '--yes' scripts/restore.sh || { echo "restore destructive confirmation missing" >&2; exit 1; }
grep -q 'DROP DATABASE' scripts/restore.sh || { echo "restore must replace the database state" >&2; exit 1; }

grep -q 'accounts.google.com' client/nginx.conf || {
  echo "frontend CSP must allow Google Identity Services" >&2
  exit 1
}

echo "production compose contract: ok"
