# Production Deployment

This runbook covers the supported production path for `sop-auto-fill` on MyPaaS: a normal Docker Compose deployment built directly from repository source.

The stack intentionally has three long-running services only:

- `frontend` — Nginx + TanStack Start SSR, public ingress;
- `backend` — NestJS API on the internal Compose network;
- `mysql` — MySQL on the internal Compose network.

Persistent state is stored in Docker named volumes:

- `mysql_data` — MySQL data;
- `sop_pdf_data` — generated SOP PDF files.

Database backups are host files and are not stored inside those application volumes.

## Prerequisites

The deployment host must provide:

- Git;
- Docker Engine;
- Docker Compose v2 (`docker compose`);
- access to the repository;
- a MyPaaS route/domain that forwards traffic to the frontend host port;
- a Google OAuth web client configured for the production origin.

The supported deployment scripts assume a Linux/POSIX shell environment with Bash, `curl`, `gzip`, and standard Unix utilities.

## First Deployment on MyPaaS

Clone the repository and enter it:

```bash
git clone https://github.com/howlil/sop-auto-fill.git
cd sop-auto-fill
```

Create the real production environment file from the committed example:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and replace every placeholder secret/domain value. Never commit this file.

Validate the resolved Compose configuration before starting anything:

```bash
docker compose --env-file .env.production -f compose.yml config --quiet
```

Build production images from source:

```bash
docker compose --env-file .env.production -f compose.yml build
```

Start MySQL and wait for its healthcheck:

```bash
docker compose --env-file .env.production -f compose.yml up -d --wait mysql
```

Apply the committed Prisma migration history:

```bash
docker compose --env-file .env.production -f compose.yml run --rm backend \
  pnpm prisma migrate deploy
```

Start the application:

```bash
docker compose --env-file .env.production -f compose.yml up -d --wait backend frontend
```

Verify the public ingress:

```bash
curl --fail http://127.0.0.1:${FRONTEND_PORT:-8080}/api/health/ready
curl --fail http://127.0.0.1:${FRONTEND_PORT:-8080}/
```

Then point the MyPaaS route/domain to the frontend host port configured by `FRONTEND_PORT`.

## Environment Variables

The source of truth for operator-set variables is `.env.production.example`.

Required production values:

| Variable | Purpose |
|---|---|
| `PUBLIC_APP_ORIGIN` | Exact public application origin, for example `https://sop.example.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID used by frontend GIS and backend token verification |
| `JWT_SECRET` | Application JWT signing secret; use a strong random value of at least 32 characters |
| `MYSQL_DATABASE` | Application database name |
| `MYSQL_USER` | Application MySQL user |
| `MYSQL_PASSWORD` | Application MySQL password |
| `MYSQL_ROOT_PASSWORD` | MySQL root password used to initialize/health-check the database container |

Operational/default variables:

| Variable | Default | Purpose |
|---|---:|---|
| `FRONTEND_PORT` | `8080` | Host port published by frontend |
| `JWT_EXPIRATION` | `7d` | Access-token lifetime |
| `SWAGGER_ENABLED` | `false` | Enable Swagger explicitly if required |
| `BACKUP_DIR` | `./backups` | Host directory for compressed SQL backups |
| `BACKUP_RETENTION_DAYS` | `14` | Backup retention window |

Database topology values such as backend DB host `mysql`, DB port `3306`, and backend port `3001` are defined by Compose and are not operator configuration.

## MyPaaS Route / Frontend Port

Normal production exposure is:

```text
Internet / MyPaaS
        |
        v
frontend:${FRONTEND_PORT:-8080}
        |
        +-- /api/* --> backend:3001
                        |
                        +--> mysql:3306
```

Only the frontend publishes a host port. Do not publish backend or MySQL ports as part of the normal production topology.

If `FRONTEND_PORT=8080`, configure MyPaaS to route the public domain to port `8080` on this Compose project/host.

`PUBLIC_APP_ORIGIN` must match the real browser origin, including HTTPS and the hostname. Configure the same origin in the Google OAuth web-client settings.

## Normal Update Deployment

The supported normal update is:

```bash
./scripts/deploy.sh
```

`deploy.sh` performs these operations in fail-fast order:

1. validates Git, Docker, Compose, the environment file, and a clean tracked working tree;
2. creates a pre-deploy DB backup when an existing MySQL container is present;
3. updates the repository with `git pull --ff-only`;
4. validates and builds the Compose stack;
5. starts/waits for healthy MySQL;
6. runs `prisma migrate deploy` explicitly;
7. starts backend/frontend and waits for their healthchecks;
8. verifies backend readiness and frontend HTTP through the public ingress;
9. prints Compose status only after success.

The transparent equivalent is approximately:

```bash
PRODUCTION_ENV_FILE=.env.production ./scripts/backup.sh
git pull --ff-only
docker compose --env-file .env.production -f compose.yml config --quiet
docker compose --env-file .env.production -f compose.yml build
docker compose --env-file .env.production -f compose.yml up -d --wait mysql
docker compose --env-file .env.production -f compose.yml run --rm backend \
  pnpm prisma migrate deploy
docker compose --env-file .env.production -f compose.yml up -d --wait backend frontend
curl --fail http://127.0.0.1:${FRONTEND_PORT:-8080}/api/health/ready
curl --fail http://127.0.0.1:${FRONTEND_PORT:-8080}/
docker compose --env-file .env.production -f compose.yml ps
```

The backup line applies to an existing deployment. A first deployment has nothing to back up yet.

## Health Verification

Backend endpoints:

```text
/api/health/live
/api/health/ready
```

`/api/health/ready` is the stronger deployment check. It verifies:

- database connectivity;
- read/write access to SOP PDF storage.

Check it through the frontend ingress, not by publishing the backend port:

```bash
curl --fail http://127.0.0.1:${FRONTEND_PORT:-8080}/api/health/ready
```

Inspect container health/state:

```bash
docker compose --env-file .env.production -f compose.yml ps
```

Useful logs:

```bash
docker compose --env-file .env.production -f compose.yml logs --tail=200 backend
docker compose --env-file .env.production -f compose.yml logs --tail=200 frontend
docker compose --env-file .env.production -f compose.yml logs --tail=200 mysql
```

## Daily Backup Scheduling

Backups are intentionally scheduled at host/MyPaaS level rather than by a permanent backup container.

Example cron entry:

```cron
0 2 * * * cd /path/to/sop-auto-fill && PRODUCTION_ENV_FILE=.env.production ./scripts/backup.sh >> /var/log/sop-auto-fill-backup.log 2>&1
```

The `02:00` example is not a required time. Choose a low-traffic time appropriate to the deployment host's timezone.

A successful backup is a gzip-compressed logical SQL dump. After a successful backup, files older than `BACKUP_RETENTION_DAYS` are deleted. The repository default is 14 days.

Backups may contain application data and should be protected with appropriate host filesystem permissions. `backups/` is ignored by Git.

## Manual Backup

Run:

```bash
PRODUCTION_ENV_FILE=.env.production ./scripts/backup.sh
```

The script prints the final `.sql.gz` path only after the dump is non-empty and passes gzip validation.

Example output:

```text
./backups/sopflow_20260813T083000Z.sql.gz
```

Do not treat a leftover `.tmp` file as a backup; the script writes to a temporary path and moves it into place only after validation.

## Restore

Restore is destructive and is never run automatically by deployment.

Stop application traffic before restoring when operating a real production database:

```bash
docker compose --env-file .env.production -f compose.yml stop frontend backend
```

Restore an explicit backup:

```bash
PRODUCTION_ENV_FILE=.env.production \
  ./scripts/restore.sh ./backups/sopflow_20260813T083000Z.sql.gz --yes
```

The `--yes` flag is deliberately required. The script validates the gzip file, starts/waits for healthy MySQL, and imports the dump. It returns non-zero when validation or import fails.

After restore:

```bash
docker compose --env-file .env.production -f compose.yml up -d --wait backend frontend
curl --fail http://127.0.0.1:${FRONTEND_PORT:-8080}/api/health/ready
```

For recovery rehearsals, restore into disposable infrastructure first. CI validates backup/restore against a disposable MySQL database, not a live production database.

## Application Rollback

Application rollback is Git-based. Identify a known-good commit and rebuild that application version:

```bash
git log --oneline --decorate -n 20
git checkout <known-good-commit>
docker compose --env-file .env.production -f compose.yml build
docker compose --env-file .env.production -f compose.yml up -d --wait backend frontend
curl --fail http://127.0.0.1:${FRONTEND_PORT:-8080}/api/health/ready
```

After the incident, restore the repository to the intended tracked branch before the next normal `deploy.sh` run.

Application rollback does **not** automatically downgrade the database schema. Reverse migrations can destroy data and are intentionally not part of this deployment model.

If a release contains a destructive/incompatible schema change, recovery must be planned explicitly before that migration is deployed.

## Database Migration Rules

Production schema changes use committed Prisma migrations:

```bash
docker compose --env-file .env.production -f compose.yml run --rm backend \
  pnpm prisma migrate deploy
```

Do not use `prisma db push` as the normal production schema mechanism.

Rules for future schema changes:

- prefer additive/backward-compatible migrations;
- review destructive migration SQL explicitly;
- take and verify a backup before destructive changes;
- keep application rollback compatibility where practical;
- do not assume a Git rollback also rolls back database state.

The current repository includes a baseline migration for the approved schema, allowing a fresh database to be created with `prisma migrate deploy`.

## Troubleshooting

### `docker compose config` fails

Check `.env.production` first. Required variables use Compose fail-fast expansion and deployment should not proceed with missing values.

```bash
docker compose --env-file .env.production -f compose.yml config
```

### MySQL never becomes healthy

```bash
docker compose --env-file .env.production -f compose.yml ps
docker compose --env-file .env.production -f compose.yml logs --tail=200 mysql
```

Verify credentials and confirm the `mysql_data` volume is writable and has enough disk space.

### Prisma migration fails

Do not continue the deployment and do not replace `migrate deploy` with `db push` as a shortcut.

```bash
docker compose --env-file .env.production -f compose.yml run --rm backend \
  pnpm prisma migrate status
```

Inspect the migration error and database state. For destructive/manual recovery, use a verified backup.

### Backend is unhealthy

```bash
docker compose --env-file .env.production -f compose.yml logs --tail=200 backend
curl -v http://127.0.0.1:${FRONTEND_PORT:-8080}/api/health/ready
```

Readiness failure identifies database or PDF-storage dependency problems rather than merely process liveness.

### Frontend is unhealthy or returns 502

```bash
docker compose --env-file .env.production -f compose.yml logs --tail=200 frontend
docker compose --env-file .env.production -f compose.yml ps
```

Confirm backend is healthy first because frontend proxies `/api/` to service `backend:3001` and its startup depends on backend health.

### Google Sign-In does not load

Check:

- `GOOGLE_CLIENT_ID` matches the Google OAuth web client;
- `PUBLIC_APP_ORIGIN` exactly matches the public production origin;
- the production origin is authorized in the Google OAuth client configuration;
- browser console/network output for Google Identity Services errors.

The frontend Nginx CSP explicitly allows the Google Identity Services resources required by the login page; do not solve OAuth configuration problems by broadly disabling CSP.

### Backup fails

```bash
PRODUCTION_ENV_FILE=.env.production ./scripts/backup.sh
```

Verify MySQL is healthy, the application DB user can read the database, `BACKUP_DIR` is writable, and the host has enough disk space.

### Restore fails

Confirm the file first:

```bash
gzip -t ./backups/<backup>.sql.gz
```

Then inspect MySQL logs and credentials. Never retry by dropping random tables in a live database without a recovery plan.
