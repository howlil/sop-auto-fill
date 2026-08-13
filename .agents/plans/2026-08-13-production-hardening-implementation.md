# Iteration 2 Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> This repository execution is explicitly **inline** because the user does not use agentic subagents. Use `superpowers:executing-plans`.

**Goal:** Make `sop-auto-fill` deployable and recoverable on MyPaaS using one normal Docker Compose stack with frontend, backend, MySQL, persistent state, Prisma migrations, host-level backups, explicit restore, and a manual fail-fast deploy workflow.

**Architecture:** Root `compose.yml` builds the existing client/server Dockerfiles and runs MySQL 8.4 LTS on the internal Compose network. Only frontend publishes a host port; backend readiness gates frontend, MySQL health gates backend operations, and production schema changes run explicitly with `prisma migrate deploy` before application startup. Operator scripts remain thin wrappers over understandable Docker/Git commands.

**Tech Stack:** Docker Compose, Docker Engine, MySQL 8.4 LTS, Node.js 22, pnpm 10.28.2, NestJS 11, Prisma 7.5, TanStack Start, Nginx, Bash, GitHub Actions.

## Global Constraints

- Target deployment platform: MyPaaS.
- Build production images from repository source on the deployment host; no GHCR or registry publishing.
- Exactly three primary long-running services: `frontend`, `backend`, `mysql`.
- Only frontend is host/publicly exposed in normal production operation.
- Persist MySQL data and SOP PDF storage across container rebuild/restart.
- Database backups are host files with 14-day retention.
- Production update remains explicit/manual: `git pull --ff-only` plus Docker Compose deployment.
- Production schema changes use committed Prisma migrations; no production `prisma db push`.
- Database rollback is not automatic.
- No Kubernetes, Swarm, Redis, queue, monitoring stack, secrets manager, managed DB, registry, or automatic CD.
- Existing Workspace/SOP behavior and Iteration 1 E2E acceptance surface must remain green.
- TDD/acceptance-first: introduce failing deployment acceptance checks before production implementation and make them green without weakening assertions.
- One task branch only: `feat/production-hardening`.

---

## File Structure

### New files

- `compose.yml` — production runtime topology and persistence contracts.
- `.env.production.example` — operator-owned production variables only; contains placeholders, never secrets.
- `scripts/production-contract.sh` — static/Compose acceptance checks suitable for CI and local preflight.
- `scripts/deploy.sh` — manual production deployment orchestration.
- `scripts/backup.sh` — compressed MySQL logical backup + 14-day retention.
- `scripts/restore.sh` — explicit destructive restore from `.sql.gz`.
- `docs/production-deployment.md` — MyPaaS deployment, backup, restore, rollback, troubleshooting runbook.
- `server/prisma/migrations/20260813000000_baseline/migration.sql` — baseline schema migration generated from the approved current Prisma schema.
- `server/prisma/migrations/migration_lock.toml` — Prisma migration provider lock.

### Existing files to modify

- `client/Dockerfile` — pass `VITE_GOOGLE_CLIENT_ID` into the production build explicitly.
- `.gitignore` — allow the committed `.env.production.example`; ignore `backups/` and real production env files.
- `.github/workflows/ci.yml` — replace E2E `db push` with `migrate deploy` and add production Compose acceptance job.
- `README.md` — project purpose + local/production entry points.
- `.agents/CURRENT_ITERATION.md` — track Iteration 2 execution/results.

No unrelated application module refactor is part of this plan.

---

### Task 1: Lock the Production Compose and Environment Contract

**Files:**
- Create: `scripts/production-contract.sh`
- Create: `compose.yml`
- Create: `.env.production.example`
- Modify: `client/Dockerfile`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: existing `client/Dockerfile`, `server/Dockerfile`, frontend Nginx proxy to `backend:3001`, backend `/api/health/ready`, existing backend env validation.
- Produces: `compose.yml` services `frontend`, `backend`, `mysql`; named volumes `mysql_data`, `sop_pdf_data`; production env contract; executable contract test.

- [ ] **Step 1: Write the failing production contract test**

Create `scripts/production-contract.sh`:

```bash
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

# Only frontend may publish a host port.
backend_block="$(sed -n '/^  backend:$/,/^  [a-zA-Z0-9_-]*:$/p' "$tmp")"
mysql_block="$(sed -n '/^  mysql:$/,/^  [a-zA-Z0-9_-]*:$/p' "$tmp")"
! grep -q '^    ports:' <<<"$backend_block" || { echo "backend must not publish ports" >&2; exit 1; }
! grep -q '^    ports:' <<<"$mysql_block" || { echo "mysql must not publish ports" >&2; exit 1; }

grep -q 'condition: service_healthy' "$tmp" || { echo "healthy dependency gating missing" >&2; exit 1; }
grep -q '/api/health/ready' "$tmp" || { echo "backend readiness healthcheck missing" >&2; exit 1; }
grep -q 'mysql_data:/var/lib/mysql' "$tmp" || { echo "mysql persistence missing" >&2; exit 1; }
grep -q 'sop_pdf_data:/app/storage/sop-pdf' "$tmp" || { echo "PDF persistence missing" >&2; exit 1; }

echo "production compose contract: ok"
```

- [ ] **Step 2: Run the contract to verify RED**

Run:

```bash
bash scripts/production-contract.sh
```

Expected: FAIL because `compose.yml` and `.env.production.example` do not exist yet.

- [ ] **Step 3: Add the production environment example**

Create `.env.production.example` with operator-controlled values only:

```dotenv
# Public routing
FRONTEND_PORT=8080
PUBLIC_APP_ORIGIN=https://sop.example.com

# Google Identity Services
GOOGLE_CLIENT_ID=replace-with-google-oauth-client-id.apps.googleusercontent.com

# Application auth
JWT_SECRET=replace-with-at-least-32-random-characters
JWT_EXPIRATION=7d

# MySQL
MYSQL_DATABASE=sopflow
MYSQL_USER=sopflow
MYSQL_PASSWORD=replace-with-strong-database-password
MYSQL_ROOT_PASSWORD=replace-with-strong-root-password

# Optional production behavior
SWAGGER_ENABLED=false
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=14
```

Do not expose topology variables (`DATABASE_HOST`, `DATABASE_PORT`, backend port) to the operator; Compose supplies them.

- [ ] **Step 4: Add `compose.yml` with the minimal production topology**

Implement these exact contracts:

```yaml
services:
  mysql:
    image: mysql:8.4.10
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${MYSQL_DATABASE:?MYSQL_DATABASE is required}
      MYSQL_USER: ${MYSQL_USER:?MYSQL_USER is required}
      MYSQL_PASSWORD: ${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD is required}
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD-SHELL", "mysqladmin ping -h 127.0.0.1 -uroot -p$$MYSQL_ROOT_PASSWORD --silent"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

  backend:
    build:
      context: ./server
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: "3001"
      DATABASE_HOST: mysql
      DATABASE_PORT: "3306"
      DATABASE_USER: ${MYSQL_USER:?MYSQL_USER is required}
      DATABASE_PASSWORD: ${MYSQL_PASSWORD:?MYSQL_PASSWORD is required}
      DATABASE_NAME: ${MYSQL_DATABASE:?MYSQL_DATABASE is required}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
      JWT_EXPIRATION: ${JWT_EXPIRATION:-7d}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:?GOOGLE_CLIENT_ID is required}
      PUBLIC_APP_ORIGIN: ${PUBLIC_APP_ORIGIN:?PUBLIC_APP_ORIGIN is required}
      ALLOWED_ORIGINS: ${PUBLIC_APP_ORIGIN:?PUBLIC_APP_ORIGIN is required}
      SWAGGER_ENABLED: ${SWAGGER_ENABLED:-false}
      SOP_PDF_STORAGE_DIR: /app/storage/sop-pdf
    volumes:
      - sop_pdf_data:/app/storage/sop-pdf
    depends_on:
      mysql:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:3001/api/health/ready || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

  frontend:
    build:
      context: ./client
      args:
        VITE_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:?GOOGLE_CLIENT_ID is required}
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT:-8080}:80"
    depends_on:
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 20s

volumes:
  mysql_data:
  sop_pdf_data:
```

- [ ] **Step 5: Wire Google client ID into the client image build**

In `client/Dockerfile`, inside the `builder` stage before `pnpm build`:

```dockerfile
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
```

Do not add a second API URL variable: production frontend already uses relative `/api/v1`.

- [ ] **Step 6: Fix ignore rules**

Ensure `.gitignore` contains:

```gitignore
.env
.env.*
!.env.production.example
backups/
```

Real `.env.production` remains ignored while the example remains tracked.

- [ ] **Step 7: Run contract to verify GREEN**

Run:

```bash
bash scripts/production-contract.sh
```

Expected: `production compose contract: ok`.

Also run:

```bash
docker compose --env-file .env.production.example config --quiet
```

Expected: exit code 0.

- [ ] **Step 8: Commit the contract slice**

```bash
git add compose.yml .env.production.example .gitignore client/Dockerfile scripts/production-contract.sh
git commit -m "feat: define production compose contract"
```

---

### Task 2: Establish Prisma Migration History and Make CI Use It

**Files:**
- Create: `server/prisma/migrations/20260813000000_baseline/migration.sql`
- Create: `server/prisma/migrations/migration_lock.toml`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: current `server/prisma/schema.prisma`, `server/prisma.config.ts` migration path.
- Produces: reproducible fresh-database schema and idempotent `prisma migrate deploy` path used by E2E and production deployment.

- [ ] **Step 1: Change E2E preparation to migration deployment first (RED)**

Replace CI E2E step:

```yaml
- name: Prepare disposable E2E database
  run: pnpm --dir server exec prisma db push
```

with:

```yaml
- name: Deploy Prisma migrations to disposable E2E database
  run: pnpm --dir server exec prisma migrate deploy
- name: Verify migration deployment is idempotent
  run: pnpm --dir server exec prisma migrate deploy
```

Run the E2E workflow/commands. Expected: FAIL because there is no committed baseline migration yet.

- [ ] **Step 2: Generate the baseline SQL from the current schema**

From `server/` with the existing Prisma version:

```bash
mkdir -p prisma/migrations/20260813000000_baseline
pnpm exec prisma migrate diff \
  --from-empty \
  --to-schema prisma/schema.prisma \
  --script > prisma/migrations/20260813000000_baseline/migration.sql
```

The generated SQL must represent the current approved schema exactly; do not hand-edit model semantics.

Create `server/prisma/migrations/migration_lock.toml`:

```toml
provider = "mysql"
```

- [ ] **Step 3: Verify baseline against a fresh disposable MySQL instance**

Run against a fresh test database using the same env shape as CI:

```bash
pnpm exec prisma migrate deploy
pnpm exec prisma migrate deploy
```

Expected first run: one migration applied. Expected second run: no pending migrations and exit code 0.

- [ ] **Step 4: Run schema/client regression checks**

```bash
pnpm exec prisma generate
pnpm typecheck
pnpm test --runInBand
pnpm build
```

Expected: all green.

- [ ] **Step 5: Commit migration history**

```bash
git add server/prisma/migrations .github/workflows/ci.yml
git commit -m "feat: establish production prisma migrations"
```

---

### Task 3: Implement Fail-Fast Backup, Restore, and Deploy Operations

**Files:**
- Create: `scripts/backup.sh`
- Create: `scripts/restore.sh`
- Create: `scripts/deploy.sh`
- Modify: `scripts/production-contract.sh`

**Interfaces:**
- Consumes: `compose.yml`, `.env.production`, MySQL service name `mysql`, backend service name `backend`, frontend host port.
- Produces: operator commands `scripts/backup.sh`, `scripts/restore.sh <file> --yes`, `scripts/deploy.sh`.

- [ ] **Step 1: Extend the acceptance contract before writing scripts (RED)**

Add to `scripts/production-contract.sh`:

```bash
for script in scripts/deploy.sh scripts/backup.sh scripts/restore.sh; do
  [[ -x "$script" ]] || { echo "$script must exist and be executable" >&2; exit 1; }
  bash -n "$script"
done

grep -q 'git pull --ff-only' scripts/deploy.sh || { echo "deploy must use ff-only pull" >&2; exit 1; }
grep -q 'scripts/backup.sh' scripts/deploy.sh || { echo "deploy must backup before migration" >&2; exit 1; }
grep -q 'prisma migrate deploy' scripts/deploy.sh || { echo "deploy must run migrate deploy" >&2; exit 1; }
grep -q 'api/health/ready' scripts/deploy.sh || { echo "deploy must verify backend readiness" >&2; exit 1; }
grep -q 'BACKUP_RETENTION_DAYS' scripts/backup.sh || { echo "backup retention missing" >&2; exit 1; }
grep -q -- '--yes' scripts/restore.sh || { echo "restore destructive confirmation missing" >&2; exit 1; }
```

Run:

```bash
bash scripts/production-contract.sh
```

Expected: FAIL because operator scripts do not exist.

- [ ] **Step 2: Implement shared operator assumptions without introducing a framework**

Each script independently uses:

```bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
ENV_FILE="${PRODUCTION_ENV_FILE:-.env.production}"
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE missing" >&2; exit 1; }
COMPOSE=(docker compose --env-file "$ENV_FILE" -f compose.yml)
```

Do not create a shell library unless duplication becomes materially error-prone during implementation.

- [ ] **Step 3: Implement `backup.sh` atomically**

Required flow:

```bash
set -euo pipefail
source "$ENV_FILE"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR" 2>/dev/null || true
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="$BACKUP_DIR/${MYSQL_DATABASE}_${stamp}.sql.gz"
tmp="${final}.tmp"
trap 'rm -f "$tmp"' EXIT

"${COMPOSE[@]}" exec -T mysql \
  mysqldump --single-transaction --quick --lock-tables=false \
  -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  | gzip -c > "$tmp"

test -s "$tmp"
mv "$tmp" "$final"
find "$BACKUP_DIR" -type f -name '*.sql.gz' -mtime "+$BACKUP_RETENTION_DAYS" -delete
printf '%s\n' "$final"
```

Validate numeric positive retention before using `find`.

- [ ] **Step 4: Implement explicit `restore.sh`**

Supported CLI:

```text
scripts/restore.sh <backup.sql.gz> --yes
```

Behavior:

```bash
[[ $# -eq 2 && "$2" == "--yes" ]] || {
  echo "Usage: scripts/restore.sh <backup.sql.gz> --yes" >&2
  exit 2
}
[[ -r "$1" ]] || { echo "backup file not readable: $1" >&2; exit 1; }

gzip -t "$1"
"${COMPOSE[@]}" up -d mysql
# Wait until MySQL health is healthy before import.
gzip -dc "$1" | "${COMPOSE[@]}" exec -T mysql \
  mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"
```

Return non-zero on malformed gzip or SQL/import failure. Never call restore from deploy.

- [ ] **Step 5: Implement `deploy.sh` in fail-fast order**

Required sequence:

```bash
set -euo pipefail
command -v git >/dev/null
command -v docker >/dev/null
docker compose version >/dev/null
[[ -f "$ENV_FILE" ]]

git diff --quiet
git diff --cached --quiet

# If MySQL service already exists, backup before source/schema change.
if "${COMPOSE[@]}" ps -q mysql | grep -q .; then
  PRODUCTION_ENV_FILE="$ENV_FILE" scripts/backup.sh
fi

git pull --ff-only
"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d mysql
# Poll Docker health until healthy or fail.
"${COMPOSE[@]}" run --rm backend pnpm prisma migrate deploy
"${COMPOSE[@]}" up -d backend frontend
# Poll http://127.0.0.1:${FRONTEND_PORT:-8080}/api/health/ready
# Poll http://127.0.0.1:${FRONTEND_PORT:-8080}/
"${COMPOSE[@]}" ps
```

The health polling loop must have a finite attempt count and print `docker compose ps` plus backend/frontend logs on failure.

- [ ] **Step 6: Verify shell/contract GREEN**

```bash
bash -n scripts/deploy.sh
bash -n scripts/backup.sh
bash -n scripts/restore.sh
bash scripts/production-contract.sh
```

Expected: all exit 0 using `.env.production.example` for static contract validation.

- [ ] **Step 7: Commit operator scripts**

```bash
git add scripts/
git commit -m "feat: add production backup restore and deploy operations"
```

---

### Task 4: Prove Compose Persistence, Migration, Backup, and Restore in CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: production Compose stack and operator scripts from Tasks 1–3.
- Produces: mandatory `production-compose` CI evidence for fresh deployment/recovery behavior.

- [ ] **Step 1: Add the production Compose CI job before relying on it**

Add a job with repository checkout and a generated test env file:

```yaml
  production-compose:
    runs-on: ubuntu-latest
    env:
      PRODUCTION_ENV_FILE: .env.production.ci
    steps:
      - uses: actions/checkout@v4
      - name: Create disposable production env
        run: |
          cat > .env.production.ci <<'EOF'
          FRONTEND_PORT=18080
          PUBLIC_APP_ORIGIN=http://localhost:18080
          GOOGLE_CLIENT_ID=ci-client-id.apps.googleusercontent.com
          JWT_SECRET=ci-production-secret-that-is-at-least-32-characters
          JWT_EXPIRATION=15m
          MYSQL_DATABASE=sop_prod_ci
          MYSQL_USER=sop
          MYSQL_PASSWORD=sop-ci-password
          MYSQL_ROOT_PASSWORD=root-ci-password
          SWAGGER_ENABLED=false
          BACKUP_DIR=./backups-ci
          BACKUP_RETENTION_DAYS=14
          EOF
      - name: Validate production contract
        run: PRODUCTION_ENV_FILE=.env.production.ci bash scripts/production-contract.sh
      - name: Build production images
        run: docker compose --env-file .env.production.ci build
      - name: Start MySQL
        run: docker compose --env-file .env.production.ci up -d mysql
      - name: Deploy migrations twice
        run: |
          docker compose --env-file .env.production.ci run --rm backend pnpm prisma migrate deploy
          docker compose --env-file .env.production.ci run --rm backend pnpm prisma migrate deploy
      - name: Start application
        run: docker compose --env-file .env.production.ci up -d backend frontend
```

- [ ] **Step 2: Add health assertions**

Use a finite retry loop against public frontend ingress:

```bash
for attempt in {1..60}; do
  if curl --fail --silent http://127.0.0.1:18080/api/health/ready | grep -q '"status":"ok"'; then
    break
  fi
  [[ "$attempt" -lt 60 ]] || exit 1
  sleep 2
done
curl --fail --silent http://127.0.0.1:18080/ >/dev/null
```

- [ ] **Step 3: Prove database persistence across recreate**

Insert a sentinel row/data using an existing safe table after migrations, recreate the MySQL container without removing volumes, and assert the sentinel still exists. Use SQL only against the disposable CI database.

Concrete pattern:

```bash
docker compose --env-file .env.production.ci exec -T mysql \
  mysql -usop -psop-ci-password sop_prod_ci \
  -e "CREATE TABLE IF NOT EXISTS ci_persistence_probe (id INT PRIMARY KEY); INSERT IGNORE INTO ci_persistence_probe VALUES (1);"
docker compose --env-file .env.production.ci stop mysql
docker compose --env-file .env.production.ci rm -f mysql
docker compose --env-file .env.production.ci up -d mysql
# wait healthy, then:
docker compose --env-file .env.production.ci exec -T mysql \
  mysql -N -usop -psop-ci-password sop_prod_ci \
  -e "SELECT COUNT(*) FROM ci_persistence_probe WHERE id=1" | grep -qx '1'
```

Drop `ci_persistence_probe` afterwards.

- [ ] **Step 4: Prove PDF volume persistence**

Create a sentinel file through the backend-mounted volume, recreate backend, and assert it remains:

```bash
docker compose --env-file .env.production.ci exec -T backend sh -c 'echo probe > /app/storage/sop-pdf/ci-probe.txt'
docker compose --env-file .env.production.ci stop backend
docker compose --env-file .env.production.ci rm -f backend
docker compose --env-file .env.production.ci up -d backend
docker compose --env-file .env.production.ci exec -T backend grep -qx probe /app/storage/sop-pdf/ci-probe.txt
```

- [ ] **Step 5: Prove backup and restore against disposable database**

```bash
PRODUCTION_ENV_FILE=.env.production.ci bash scripts/backup.sh
backup="$(find backups-ci -type f -name '*.sql.gz' | sort | tail -n 1)"
test -s "$backup"
gzip -t "$backup"

docker compose --env-file .env.production.ci exec -T mysql \
  mysql -usop -psop-ci-password sop_prod_ci -e 'DROP TABLE ci_persistence_probe;'
PRODUCTION_ENV_FILE=.env.production.ci bash scripts/restore.sh "$backup" --yes
```

Then assert the probe table/data from the backup exists again. This is disposable CI only.

- [ ] **Step 6: Add failure diagnostics and cleanup**

```yaml
      - name: Production Compose diagnostics
        if: failure()
        run: |
          docker compose --env-file .env.production.ci ps || true
          docker compose --env-file .env.production.ci logs --no-color --tail=200 || true
      - name: Cleanup production Compose stack
        if: always()
        run: docker compose --env-file .env.production.ci down -v --remove-orphans || true
```

- [ ] **Step 7: Run existing CI plus new job**

Expected mandatory jobs:

```text
server: success
client: success
e2e: success
production-compose: success
```

Do not weaken existing E2E assertions to make the production job pass.

- [ ] **Step 8: Commit CI acceptance coverage**

```bash
git add .github/workflows/ci.yml
git commit -m "test: verify production compose recovery path"
```

---

### Task 5: Write the Operator Runbook and Close the Iteration

**Files:**
- Create: `docs/production-deployment.md`
- Modify: `README.md`
- Modify: `.agents/CURRENT_ITERATION.md`

**Interfaces:**
- Consumes: verified commands and environment names from Tasks 1–4.
- Produces: operator-readable deployment/recovery guide and final iteration evidence.

- [ ] **Step 1: Write production deployment runbook from verified commands only**

`docs/production-deployment.md` must document these exact sections:

```markdown
# Production Deployment

## Prerequisites
## First Deployment on MyPaaS
## Environment Variables
## MyPaaS Route / Frontend Port
## Normal Update Deployment
## Health Verification
## Daily Backup Scheduling
## Manual Backup
## Restore
## Application Rollback
## Database Migration Rules
## Troubleshooting
```

Document normal update as:

```bash
./scripts/deploy.sh
```

and show the transparent equivalent commands so operators are not locked into the wrapper.

Document cron example without hardcoding a universal time:

```cron
0 2 * * * cd /path/to/sop-auto-fill && PRODUCTION_ENV_FILE=.env.production ./scripts/backup.sh >> /var/log/sop-auto-fill-backup.log 2>&1
```

State that operators should choose a low-traffic local time appropriate for their server timezone.

- [ ] **Step 2: Replace placeholder README with a compact project entry point**

README should state:

- Google-authenticated private Workspace/SOP authoring product;
- protected core includes SOP editor, Flowchart, BPMN, PDF/print, versioning;
- `client/` and `server/` locations;
- CI verification commands at a high level;
- production uses `compose.yml`;
- link to `docs/production-deployment.md`;
- no claims about unsupported HA/managed infrastructure.

- [ ] **Step 3: Run final verification before marking complete**

Require fresh evidence for:

```text
server typecheck/tests/build
client typecheck/tests/build
MVP Playwright E2E
production-compose acceptance
```

Also inspect `git diff master...feat/production-hardening` for accidental product-scope changes.

- [ ] **Step 4: Update iteration state only from verified evidence**

Set `.agents/CURRENT_ITERATION.md` to `COMPLETE` only after all mandatory jobs are green. Record:

- PR number;
- verified head SHA;
- CI run number/id;
- migration baseline result;
- production Compose result;
- backup/restore result;
- remaining operational caveats, if any.

- [ ] **Step 5: Final branch integration**

Because this task introduces the first production migration history and operational recovery path, treat final merge as high-risk under `AGENTS.md`: review the complete diff and CI evidence before integration. Once review is satisfied, squash merge to `master`, verify master CI again, and delete `feat/production-hardening` if tooling supports branch deletion.
