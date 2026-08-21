# MyPaas CI/CD Design

**Iteration:** 8 `workspace-production-workbench`  
**Status:** Design review  
**Target platform:** `nabilrn/MyPaas`  
**Application repository:** `howlil/sop-auto-fill`

## Goal

Deploy `sop-auto-fill` to MyPaas using the repository's existing production Docker Compose contract while ensuring production deployment occurs only after the existing GitHub CI quality gates pass.

## Platform Fit

MyPaas supports Git sources, Docker Compose deployment, branch selection, GitHub webhook deployments, environment variables, routing, persistent named volumes, deployment history, rollback, logs, and runtime health/status surfaces.

`sop-auto-fill` already provides:

- `compose.yml` with `mysql`, `backend`, and `frontend` services;
- production Dockerfiles for client and server;
- frontend nginx as the public application ingress;
- readiness endpoint through `/api/health/ready`;
- named volumes for MySQL and generated SOP PDFs;
- `.env.production.example` documenting production environment;
- GitHub CI jobs for server, client, E2E, and production Compose verification.

The design therefore adapts the existing deployment contract rather than introducing another container topology.

## Deployment Topology

```text
Internet
  -> MyPaas/Caddy route
      -> frontend:80
          ├── /        -> frontend runtime
          └── /api/*   -> backend:3001
                            -> mysql:3306

Persistent data:
  mysql_data   -> MySQL database
  sop_pdf_data -> generated SOP PDFs
```

MyPaas Compose project configuration:

```text
Source type       Git
Repository        howlil/sop-auto-fill
Deploy mode       compose
Deploy branch     production
Compose file      compose.yml
Main service      frontend
App port          80
Base directory    repository root
```

MyPaas is expected to own public routing/host exposure. Repository-defined Compose host ports must not be relied on as the public routing mechanism.

## Why a Production Promotion Branch

MyPaas's GitHub webhook accepts GitHub `push` events and deploys only when the pushed branch matches the project's configured branch. A webhook connected directly to `master` can race with CI because GitHub sends the push event before CI results are known.

Therefore:

```text
feature branch
  -> pull request CI
  -> squash merge master
  -> master CI
       ├── server
       ├── client
       ├── e2e
       └── production-compose
            -> all PASS
                 -> promote exact master SHA to production branch
                      -> GitHub push webhook
                           -> MyPaas deploy production
```

The `production` branch is a deployment pointer, not a development branch. Humans should not commit directly to it.

## GitHub Actions Promotion

Extend the existing CI workflow with one promotion job rather than creating a second independent test pipeline.

Promotion conditions:

- event is `push`;
- ref is `refs/heads/master`;
- `server`, `client`, `e2e`, and `production-compose` jobs all succeeded;
- workflow has `contents: write` only where required for promotion.

Promotion behavior:

```text
GITHUB_SHA on master
  -> push the exact SHA to refs/heads/production
```

No build artifact is promoted separately because MyPaas Git deployments build from the promoted Git revision. The deployment identity remains the exact commit SHA.

The workflow must not force-push over unexpected divergence silently. If `production` cannot fast-forward to the validated SHA, promotion fails visibly and requires operator investigation.

## MyPaas Webhook

Configure the MyPaas project's generated GitHub webhook URL and webhook secret in the GitHub repository webhook settings.

Webhook configuration:

- content type: JSON;
- event: push only;
- secret: exact MyPaas project webhook secret;
- target project branch: `production`.

MyPaas validates `X-Hub-Signature-256` and ignores push events whose branch differs from the configured project branch.

Webhook secret must never be stored in the application repository.

## Production Environment

Runtime variables remain in MyPaas environment configuration.

Required application environment:

```text
PUBLIC_APP_ORIGIN
GOOGLE_CLIENT_ID
JWT_SECRET
JWT_EXPIRATION
MYSQL_DATABASE
MYSQL_USER
MYSQL_PASSWORD
MYSQL_ROOT_PASSWORD
AI_DRAFT_PROVIDER
AI_DRAFT_TIMEOUT_MS
AI_REVIEW_PROVIDER
AI_REVIEW_TIMEOUT_MS
AI_REVISION_PROVIDER
AI_REVISION_TIMEOUT_MS
SWAGGER_ENABLED
```

When an AI provider is configured as OpenAI:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

`JWT_SECRET`, database passwords, webhook secret, and `OPENAI_API_KEY` are secrets. No real production value is committed to Git.

`PUBLIC_APP_ORIGIN` must match the public MyPaas/Caddy URL used by users and must also remain the backend allowed origin through the existing Compose environment contract.

## Database Migration and Seed Safety

The current production verification explicitly runs `prisma migrate deploy` and the system template seed, but the current backend container command starts the application directly. A real MyPaas deployment must not depend on a human remembering to run migrations.

The deployment contract must therefore gain an idempotent startup/pre-start path that guarantees:

```text
MySQL healthy
  -> prisma migrate deploy
  -> idempotent system-template seed
  -> backend application start
```

Preferred implementation: a small production entrypoint script packaged in the backend image and used by the Compose backend service.

Properties:

- `prisma migrate deploy` is safe to re-run;
- the existing seed behavior must remain idempotent and verified by CI;
- if migration or seed fails, backend must not start;
- no `prisma migrate dev` is allowed in production;
- database destructive reset is never part of deployment.

This keeps schema state coupled to the application release without changing SOP business logic.

## Persistent Storage

Retain engine-managed named volumes:

```text
mysql_data
sop_pdf_data
```

Do not replace them with host bind mounts. MyPaas Compose sanitization accepts safe engine-managed named volumes and rejects unsafe host-bound configuration.

A redeploy/restart must preserve both database state and generated SOP PDFs.

## Health and Readiness

Deployment readiness is based on the existing application path:

```text
frontend public route
  -> /api/health/ready
  -> backend readiness
```

Container-level healthchecks remain useful for Compose dependency ordering. MyPaas deployment success must not be treated as equivalent to application correctness unless the runtime reaches a healthy/running state.

Post-deployment smoke validation should verify:

1. public root returns successfully;
2. `/api/health/ready` reports healthy;
3. frontend can reach backend through the same origin;
4. no secret is exposed in client output/logging.

## Rollback

MyPaas Compose deployments retain historical deployment state for supported rollback.

Application rollback rules:

- code/runtime rollback may use MyPaas deployment rollback;
- schema migrations must be designed backward-compatible because Prisma migration rollback is not automatic;
- destructive schema migrations require a separate reviewed rollout strategy and are outside this iteration;
- persistent volumes are never deleted as part of ordinary rollback/redeploy.

## Security Boundaries

- production secrets live in MyPaas, not Git;
- webhook uses HMAC secret validation;
- only `production` branch pushes trigger this project;
- CI controls promotion to `production`;
- MyPaas owns external routing;
- Compose must not add privileged mode, host network, host bind mounts, Docker/Podman socket mounts, devices, or external unmanaged volumes/networks;
- Swagger remains disabled in production unless explicitly enabled by an operator.

## Repository Changes Expected

Likely application-repository changes:

```text
.github/workflows/ci.yml
server/Dockerfile
server/scripts/production-entrypoint.sh   (or equivalent focused path)
compose.yml
.env.production.example                  (only if contract changes)
scripts/production-contract.sh           (if required to validate MyPaas assumptions)
docs/deployment/...                       (operator setup/runbook)
```

No changes to `client/src/pages/penyusun/sop/detail/**` are required for deployment.

## MyPaas-Side Setup

The actual platform setup requires an existing running MyPaas installation and operator access to its dashboard/API. Once available, create/configure one project with the values in this spec, add production environment values, and register its GitHub webhook.

If the MyPaas instance URL/credentials are not available through connected tools, repository preparation can still be completed, but the final platform project creation and webhook registration must be performed by an operator in that instance.

## Testing

Repository verification must include:

1. server typecheck/tests/build;
2. client typecheck/tests/build;
3. existing E2E journey suite;
4. production Compose build;
5. production migrations twice to prove idempotency;
6. system template seed twice to prove idempotency;
7. MySQL volume persistence;
8. SOP PDF volume persistence;
9. frontend/backend readiness through public ingress contract;
10. promotion job test/inspection ensuring it cannot run before all required jobs pass.

## Non-Goals

- Kubernetes or multi-node HA;
- external managed database migration;
- private OCI registry pipeline;
- blue/green application architecture beyond MyPaas's existing runtime behavior;
- destructive schema migration automation;
- storing production secrets in GitHub source files;
- changing SOP editor/business behavior.

## Acceptance Criteria

The deployment setup is complete when a validated commit merged to `master` passes all mandatory CI jobs, the exact SHA is promoted to `production`, MyPaas receives the authenticated `production` push webhook, successfully deploys the Compose application with migrations applied, persistent data preserved, and the public readiness endpoint healthy.
