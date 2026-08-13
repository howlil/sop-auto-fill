# sop-auto-fill

Google-authenticated private workspace for authoring and maintaining Standard Operating Procedures (SOP).

The current product is intentionally focused on SOP authoring rather than evaluation/approval workflow. Its protected core includes:

- private `User -> Workspace -> SOP` ownership;
- SOP metadata and procedural-step editor with autosave;
- workspace-level pelaksana/swimlane data;
- Flowchart and BPMN rendering;
- print/PDF generation;
- immutable completed versions and **Create New Version** cloning.

## Repository

```text
client/   TanStack Start + React frontend/SSR, Nginx production ingress
server/   NestJS API, Prisma, MySQL persistence
compose.yml   production Docker Compose topology
scripts/      production deploy/backup/restore contracts
```

## Development

Client:

```bash
cd client
pnpm install
pnpm dev
```

Server:

```bash
cd server
pnpm install
pnpm start:dev
```

Use development/test environment values appropriate to each package. Production secrets must not be committed.

## Verification

The repository CI verifies four boundaries:

1. server typecheck, unit tests, and production build;
2. client typecheck, tests, and production build;
3. MVP Playwright journey against real frontend, backend, and disposable MySQL;
4. production Docker Compose build/recovery path, including Prisma migrations, DB/PDF persistence, backup retention, and restore.

Useful package-level checks:

```bash
cd server
pnpm typecheck
pnpm test --runInBand
pnpm build
```

```bash
cd client
pnpm typecheck
pnpm test
pnpm build
```

## Production

Production is deployed on MyPaaS using a normal Docker Compose stack built directly from repository source. No container registry or automatic production CD is required.

Long-running services:

```text
frontend -> backend -> mysql
```

Only `frontend` is published to the host/public route. MySQL data and generated SOP PDF files use persistent named volumes.

Start with:

```bash
cp .env.production.example .env.production
# Fill real production values, then:
./scripts/deploy.sh
```

The deployment script performs a pre-deploy backup for an existing database, fast-forward-only Git update, image build, Prisma migration, health-gated startup, and public smoke checks.

For first deployment, environment variables, MyPaaS routing, daily backup scheduling, restore, rollback, migration rules, and troubleshooting, read [`docs/production-deployment.md`](docs/production-deployment.md).

## Production Safety Rules

- Do not commit `.env.production` or database backups.
- Do not expose MySQL or the backend directly in the normal topology.
- Use `prisma migrate deploy` for production schema changes; do not replace it with `prisma db push`.
- Application Git rollback does not automatically downgrade the database.
- Treat destructive migrations and production restore as explicit operator actions with a verified backup.
