# MyPaaS Production Deployment

This runbook configures `howlil/sop-auto-fill` as a Git-sourced Docker Compose application on `nabilrn/MyPaas`.

## Release Flow

```text
feature branch
  -> pull request CI
  -> squash merge to master
  -> master CI
       -> server
       -> client
       -> e2e
       -> production-compose
  -> all mandatory jobs pass
  -> exact GITHUB_SHA promoted to production branch
  -> GitHub push webhook
  -> MyPaaS deploy
```

`production` is a deployment pointer managed by CI. Do not commit or merge feature work directly to that branch.

## MyPaaS Project Settings

Configure one Compose project with:

| Setting | Value |
| --- | --- |
| Source | Git |
| Repository | `howlil/sop-auto-fill` |
| Branch | `production` |
| Deploy mode | Docker Compose |
| Compose file | `compose.yml` |
| Base directory | repository root |
| Main service | `frontend` |
| Application port | `80` |

MyPaaS/Caddy owns public routing. The application ingress is the `frontend` service; backend and MySQL remain internal Compose services.

## Runtime Topology

```text
Internet
  -> MyPaaS / Caddy
      -> frontend:80
          ├── /      -> frontend
          └── /api/* -> backend:3001
                         -> mysql:3306
```

Persistent engine-managed volumes:

- `mysql_data` for MySQL data;
- `sop_pdf_data` for generated SOP PDFs.

Ordinary redeploy, restart, or rollback must not delete these volumes.

## Production Environment

Configure runtime values in MyPaaS. Do not commit real production values to Git.

Required application variables:

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

When an AI provider is `openai`, also configure:

```text
OPENAI_API_KEY
OPENAI_MODEL
```

Treat at least `JWT_SECRET`, database passwords, `OPENAI_API_KEY`, and the MyPaaS webhook secret as secrets.

`PUBLIC_APP_ORIGIN` must equal the public HTTPS origin users open in the browser. The Compose contract also uses that value as the backend allowed origin.

## Database Startup Contract

The backend container runs this sequence every time it starts:

```text
MySQL healthy
  -> prisma migrate deploy
  -> idempotent system-template seed
  -> backend application start
```

If migration or seed fails, the backend does not start. Production must never use `prisma migrate dev` or a destructive database reset.

The template seed is intentionally idempotent; CI runs migration and seed repeatedly and verifies the expected template state.

## GitHub Webhook

Create the MyPaaS GitHub webhook for this project, then register it in the GitHub repository webhook settings.

Use:

- content type: JSON;
- event: push only;
- branch on the MyPaaS project: `production`;
- secret: the exact MyPaaS-generated webhook secret.

The webhook secret belongs in GitHub/MyPaaS configuration, not in this repository.

A push to `master` does not directly deploy production. CI first validates the commit and only then advances `production` to that exact SHA.

## Readiness and Smoke Check

After MyPaaS reports the deployment running, verify through the public application origin:

1. `/` returns the frontend;
2. `/api/health/ready` returns a healthy response;
3. frontend API calls remain same-origin through `/api/*`;
4. client assets and logs do not expose server secrets.

Container healthchecks are useful for dependency ordering, but a container being started is not equivalent to application readiness.

## Rollback

Use MyPaaS deployment history to roll application code back to a previous known-good deployment when needed.

Rules:

- retain `mysql_data` and `sop_pdf_data` during normal rollback/redeploy;
- Prisma migrations are not automatically reversed;
- schema changes must therefore be backward-compatible across the intended rollback window;
- destructive schema migrations require a separate reviewed rollout and rollback plan.

## Promotion Failure

The CI promotion job refuses to silently overwrite a divergent `production` history. If `production` is not an ancestor of the validated `master` SHA, promotion fails and requires operator investigation.

Do not solve this by force-pushing until the divergence is understood.
