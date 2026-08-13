# Iteration 2 — Production Hardening Design

## Status

Approved design for Iteration 2. Implementation must not begin until this written spec is reviewed by the user and an implementation plan is written.

## Goal

Make `sop-auto-fill` deployable on MyPaaS using a normal Docker Compose workflow that is simple to operate, reproducible enough for production use, and easy to recover without introducing registry, Kubernetes, managed infrastructure, or automatic CD.

The production path is intentionally pragmatic:

`git pull --ff-only -> backup -> docker compose build -> database migration -> docker compose up -d -> smoke/readiness checks`

## Decisions Locked

1. Deployment target: MyPaaS.
2. Deployment mechanism: normal Docker Compose built from repository source on the server.
3. No GHCR, package publishing, image registry workflow, or automatic deployment pipeline.
4. MySQL runs in the same Compose project as the application.
5. Production has three primary services only: `frontend`, `backend`, and `mysql`.
6. Only the frontend is exposed to the platform/public route. Backend and MySQL stay on the internal Compose network.
7. Database data and generated SOP PDF files are persistent across rebuilds/restarts.
8. Database backup runs daily to the host filesystem with 14-day retention.
9. Production updates remain explicit/manual: `git pull` followed by Docker Compose deployment.
10. Rollback uses a previous Git commit and rebuild; database schema is not automatically downgraded.

## Current Repository Baseline

The repository already has production-oriented Dockerfiles for client and server. The frontend container combines TanStack Start SSR with Nginx and proxies `/api/` to `backend:3001`. The server exposes port `3001`.

The backend already has liveness and readiness endpoints. Readiness checks both database connectivity and read/write access to SOP PDF storage, so Iteration 2 should reuse this rather than introducing a second health framework.

Production environment validation already fail-fast checks JWT, Google client ID, database settings, and application origin/CORS safety. Iteration 2 should consolidate deployment configuration around these existing contracts rather than create another configuration layer.

The current Prisma directory contains `schema.prisma` but no committed production migration history. A baseline migration is therefore required before `prisma migrate deploy` can become the production schema mechanism.

## Runtime Architecture

```text
Internet / MyPaaS route
          |
          v
+-----------------------------+
| frontend                    |
| Nginx :80 + TanStack SSR    |
+-----------------------------+
          |
          | /api/*
          v
+-----------------------------+
| backend :3001               |
| NestJS                      |
+-----------------------------+
          |             |
          |             +----------------------+
          v                                    v
+-----------------------------+    +-----------------------------+
| mysql :3306                 |    | persistent SOP PDF storage  |
| internal network only       |    | named volume                |
+-----------------------------+    +-----------------------------+
          |
          v
+-----------------------------+
| mysql_data named volume     |
+-----------------------------+

Host filesystem:
./backups/*.sql.gz
14-day retention
```

## Compose Design

A root `compose.yml` is the single deployment source of truth.

Primary services:

- `frontend`
  - builds from `./client`;
  - exposes port 80 to MyPaaS;
  - proxies API traffic to service name `backend`;
  - starts only when backend dependencies are ready enough for normal operation;
  - receives only frontend/runtime configuration it actually needs.

- `backend`
  - builds from `./server`;
  - remains internal, no public host port required;
  - receives database connection values using Compose service name `mysql`;
  - mounts persistent SOP PDF storage;
  - exposes/reuses `/api/health/live` and `/api/health/ready` for health checks.

- `mysql`
  - uses a stable MySQL image version, pinned rather than `latest`;
  - remains internal, no public host port required;
  - mounts `mysql_data`;
  - has a native MySQL healthcheck.

Named volumes:

- `mysql_data`
- `sop_pdf_data`

No Redis, queue, monitoring stack, backup container, service mesh, or extra reverse proxy is added.

## Environment Configuration

Production secrets are not committed.

Repository provides `.env.production.example`; server uses a real `.env.production` on the deployment host.

The example should document only variables that operators actually need to set. Compose should provide topology defaults internally where possible, such as:

- backend DB host = `mysql`;
- backend DB port = `3306`;
- backend port = `3001`.

Expected operator-controlled configuration includes at minimum:

- MySQL database name;
- MySQL application user/password;
- MySQL root password;
- JWT secret;
- Google OAuth client ID required by backend and frontend runtime/build configuration;
- public application origin/domain.

Swagger should remain disabled by default in production unless explicitly enabled.

## Database Migration Strategy

Production schema changes use Prisma migrations, not `prisma db push`.

Iteration 2 creates a baseline migration representing the current approved schema. The baseline must be reproducible on a fresh disposable MySQL database.

Deployment sequence must run:

`pnpm prisma migrate deploy`

as an explicit one-shot deployment step after MySQL is healthy and before the new backend is considered deployed.

Migration rules after this iteration:

- normal production migrations should prefer additive/backward-compatible changes;
- destructive schema changes require explicit review and a verified backup;
- application rollback does not automatically execute reverse migrations;
- database downgrade scripts are not introduced in Iteration 2.

## Deploy Flow

A root/operator script such as `scripts/deploy.sh` provides the supported deployment flow without hiding Docker Compose.

Conceptual flow:

```text
preflight
  -> verify required env file/config
  -> verify Docker + Compose
  -> verify clean/usable repository state

existing deployment?
  -> create database backup before schema/application change

update source
  -> git pull --ff-only

build
  -> docker compose build

ensure database
  -> docker compose up -d mysql
  -> wait until MySQL is healthy

schema
  -> docker compose run --rm backend pnpm prisma migrate deploy

application
  -> docker compose up -d

verification
  -> backend readiness must succeed
  -> frontend HTTP smoke check must succeed
  -> docker compose ps must not show failed/unhealthy primary services
```

The script must fail loudly on errors. It must not continue after migration or readiness failure and then print a false success message.

The underlying manual commands remain understandable and usable without the script.

## Backup Design

`scripts/backup.sh` creates a compressed logical MySQL dump to a host directory outside application containers/volumes.

Default behavior:

- destination: `./backups` or an explicitly configurable host path;
- filename contains timestamp;
- dump is compressed as `.sql.gz`;
- partial/failed dump must not be presented as a successful backup;
- files older than 14 days are removed after a successful backup;
- backup directory is ignored by Git.

Backup is performed from the MySQL service/container using credentials supplied through deployment environment configuration.

Scheduling is host-level/MyPaaS-level cron because a permanent backup container is unnecessary for this scope.

Recommended schedule: once daily during a low-traffic period.

## Restore Design

`scripts/restore.sh <backup.sql.gz>` is an explicit operator action and is never called automatically by deploy.

Restore requirements:

- require a backup filename argument;
- validate that the file exists and is readable;
- fail if production environment configuration is missing;
- require an explicit confirmation mechanism or destructive-operation flag;
- restore through the Compose MySQL service;
- return non-zero on import failure;
- document that restore replaces database state and should normally be done in maintenance mode.

Acceptance testing for restore must use a disposable database/Compose environment, never the operator's live production database.

## Rollback Design

Application rollback is Git-based:

```text
git checkout <known-good-commit>
docker compose build
docker compose up -d
health/readiness verification
```

A convenience documented procedure is enough; no custom release manager is introduced.

Database is not automatically rolled back. This is deliberate. Automatic reverse migrations are riskier than application rollback and can destroy data.

Therefore migrations merged after Iteration 2 should preserve backward compatibility when practical so the previous application commit can still run during emergency rollback.

## Health and Failure Handling

Reuse existing backend health endpoints:

- liveness: process/application is responding;
- readiness: database works and SOP PDF storage is writable.

Compose healthchecks should use these existing contracts rather than duplicate application logic.

Failure behavior:

- unhealthy MySQL blocks migration/startup progression;
- failed migration blocks deployment;
- failed backend readiness makes deployment fail;
- failed frontend smoke check makes deployment fail;
- scripts print diagnostic commands/status suitable for immediate troubleshooting, but do not add a logging/monitoring platform.

## Security Baseline

Iteration 2 preserves and wires existing production controls instead of redesigning authentication/security.

Production deployment must ensure:

- MySQL is not published publicly;
- backend is not published publicly unless explicitly needed for debugging outside normal operation;
- frontend remains the public ingress;
- wildcard credentialed CORS is not allowed;
- JWT secret is strong and not committed;
- Google OAuth client ID/origin matches the deployed domain;
- production secrets are excluded from Git;
- containers continue running as non-root where current Dockerfiles support it;
- Swagger is disabled by default in production;
- backup files are stored outside Git and should have host permissions appropriate for database contents.

No secrets manager is introduced in this iteration.

## Documentation Deliverables

Production operation must be understandable without reading application source code.

Documentation should cover:

1. prerequisites;
2. first deployment;
3. required environment variables;
4. MyPaaS routing target;
5. normal update deployment;
6. health verification;
7. database backup scheduling;
8. manual backup;
9. restore procedure;
10. rollback procedure;
11. common failure diagnosis.

The root README should become useful enough to identify the project and point operators to the production deployment guide. It does not need to become a large OSS documentation site in this iteration.

## Acceptance Criteria

Iteration 2 is complete only when all of the following are demonstrated:

1. A fresh disposable environment can build the three-service Compose stack from repository source.
2. A fresh MySQL database can be initialized using committed Prisma migration history.
3. Running migration deployment again with no schema changes is safe/idempotent.
4. Only frontend requires public exposure; frontend successfully proxies application API requests to backend internally.
5. Backend readiness reports healthy database and writable SOP PDF storage.
6. Restart/rebuild does not delete database data.
7. Restart/rebuild does not delete persisted SOP PDF files.
8. `backup.sh` produces a valid compressed SQL dump.
9. Retention removes backups older than 14 days without deleting current valid backups.
10. `restore.sh` successfully restores a verified dump into a disposable database.
11. Deploy flow fails on migration/readiness failure rather than reporting false success.
12. Frontend HTTP smoke check succeeds after deployment.
13. Existing server/client typecheck, unit tests, builds, and MVP Playwright E2E remain green.
14. Production deployment and recovery procedures are documented clearly enough to execute without reading source internals.

## Explicit Non-Goals

Iteration 2 does not include:

- new SOP product features;
- UX redesign/onboarding work;
- GHCR or any container registry publishing;
- GitHub Actions production deployment;
- Kubernetes;
- Docker Swarm;
- Redis;
- message queues;
- Prometheus/Grafana/ELK/OpenTelemetry platform rollout;
- external managed database;
- S3/R2 backup storage;
- high availability or multi-node database replication;
- blue/green or canary deployment;
- automated database downgrade/reverse migrations;
- a permanent iteration branch.

## Intended File-Level Scope

Expected files to add or modify during implementation:

- `compose.yml`
- `.env.production.example`
- `.gitignore`
- `scripts/deploy.sh`
- `scripts/backup.sh`
- `scripts/restore.sh`
- Prisma migration history under `server/prisma/migrations/`
- targeted Dockerfile/entrypoint/config changes only if tests prove they are required
- production deployment documentation / root README
- targeted CI/tests required to verify Compose, migration, scripts, and existing regression surface
- `.agents/CURRENT_ITERATION.md` and implementation plan state

Unrelated application refactoring is out of scope.

## Engineering Principles

- YAGNI: solve deployment/recovery needs that exist now.
- Explicit operations over hidden automation.
- Fail fast rather than deploy partially.
- Persistent state must be obvious and testable.
- Recovery must be rehearsable on disposable infrastructure.
- Production migration history is source-controlled.
- Existing working security/health mechanisms are reused.
- Implementation follows TDD where behavior can be tested and keeps the existing product regression suite green.
