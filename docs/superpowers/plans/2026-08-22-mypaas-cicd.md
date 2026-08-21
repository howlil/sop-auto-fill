# MyPaaS CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menjadikan validated `master` commit sebagai satu-satunya source yang dapat dipromosikan ke branch `production`, lalu membuat backend production menjalankan migration + idempotent seed sebelum aplikasi start.

**Architecture:** Existing four CI jobs tetap authoritative quality gates. Satu promotion job hanya berjalan pada push ke `master` setelah semua gate sukses dan menggeser `production` ke exact `GITHUB_SHA` secara fast-forward-safe; MyPaaS webhook kemudian deploy branch tersebut. Backend image memakai production entrypoint yang melakukan `prisma migrate deploy`, template seed, lalu `exec pnpm start:prod`.

**Tech Stack:** GitHub Actions, Docker Compose, Node 22 Alpine, pnpm 10.28.2, Prisma, Bash, MySQL, MyPaaS Git webhook deployment.

**Spec:** `docs/superpowers/specs/2026-08-22-mypaas-cicd-design.md`

## Global Constraints

- Promotion hanya pada event `push` ke `master` setelah `server`, `client`, `e2e`, dan `production-compose` sukses.
- `production` adalah deployment pointer; tidak ada direct development commit.
- Promotion menunjuk exact validated SHA dan tidak boleh silently force-push divergence.
- Production startup wajib migration -> idempotent seed -> app start.
- Persistent `mysql_data` dan `sop_pdf_data` tetap named volumes.
- Secrets tidak ditulis ke repository.

---

### Task 1: Production startup contract

**Files:**
- Modify: `scripts/production-contract.sh`
- Create: `server/scripts/production-entrypoint.sh`
- Modify: `server/Dockerfile`

**Interfaces:**
- Consumes: runtime environment already provided by `compose.yml`.
- Produces: executable entrypoint that exits on migration/seed failure and otherwise replaces itself with `pnpm start:prod`.

- [ ] **Step 1: Extend production contract first** to require executable entrypoint, `prisma migrate deploy`, `seed-runtime.cjs`, and Dockerfile wiring.
- [ ] **Step 2: Run PR CI and observe RED** because entrypoint is absent.
- [ ] **Step 3: Add minimal entrypoint:** `set -euo pipefail`; `pnpm prisma migrate deploy`; `node prisma/seed-runtime.cjs`; `exec pnpm start:prod`.
- [ ] **Step 4: Copy/chmod entrypoint into runtime image and set Docker `ENTRYPOINT`.**
- [ ] **Step 5: Verify production-compose boots from an empty database and repeated backend recreation remains idempotent.**

### Task 2: CI promotion gate

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/production-contract.sh`

**Interfaces:**
- Consumes: `GITHUB_SHA` from successful push-to-master CI.
- Produces: `refs/heads/production` fast-forwarded to exact validated SHA.

- [ ] **Step 1: Add RED contract assertions** requiring a `promote-production` job, all four `needs`, push/master guard, and exact production ref.
- [ ] **Step 2: Observe production-contract RED on PR CI.**
- [ ] **Step 3: Add promotion job with `contents: write`, full git history, remote production ref fetch, ancestor/divergence guard, and push `GITHUB_SHA:refs/heads/production`.**
- [ ] **Step 4: Ensure PR CI never executes promotion because guard requires push/master.**
- [ ] **Step 5: Verify YAML/contract through mandatory CI.**

### Task 3: Production operational documentation

**Files:**
- Modify: `.env.production.example` only if variables need clarification.
- Create: `docs/deployment/mypaas.md`

**Interfaces:**
- Consumes: production branch + MyPaaS project settings.
- Produces: operator runbook for Git source, Compose file, main service/port, environment/secrets, webhook, readiness, rollback.

- [ ] **Step 1: Document MyPaaS project configuration:** repo `howlil/sop-auto-fill`, branch `production`, compose `compose.yml`, main service `frontend`, port `80`.
- [ ] **Step 2: Document required environment variables and secret ownership without real values.**
- [ ] **Step 3: Document GitHub push webhook setup and readiness `/api/health/ready`.**
- [ ] **Step 4: Document rollback boundary: code rollback is supported; schema changes remain backward-compatible and persistent volumes are retained.**

### Task 4: Final verification and merge gate

**Files:**
- Update: `.agents/CURRENT_ITERATION.md`

- [ ] **Step 1: Confirm PR head CI has server/client/e2e/production-compose all success.**
- [ ] **Step 2: Confirm no destructive schema migration or secret was added.**
- [ ] **Step 3: Confirm promotion job is structurally unable to run on pull requests.**
- [ ] **Step 4: Mark Iteration 8 review-ready; squash merge only after current-head verification.**
