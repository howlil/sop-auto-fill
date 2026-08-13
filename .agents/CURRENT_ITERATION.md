# Current Iteration

- **Iteration:** `2-production-hardening`
- **Status:** `ACTIVE`
- **Working branch:** `feat/production-hardening`
- **Pull request:** `#4` (draft during TDD execution)
- **Goal:** membuat aplikasi dapat dideploy dan dipulihkan secara pragmatis di MyPaaS menggunakan Docker Compose biasa, persistent MySQL/PDF storage, Prisma migrations, backup/restore, health verification, dan dokumentasi operasi tanpa registry atau CD otomatis.

## User-Approved Direction

User secara eksplisit menyetujui transition ke Iteration 2 dan mengunci keputusan berikut:

- target MyPaaS;
- Docker Compose biasa dari source repository;
- tiga service utama: `frontend`, `backend`, `mysql`;
- MySQL berada di Compose yang sama;
- tidak memakai GHCR/package registry;
- deployment manual `git pull` + Compose;
- backup database harian ke host filesystem dengan retention 14 hari;
- arsitektur production-hardened ringan, bukan ops stack kompleks.

Design spec: `.agents/plans/2026-08-13-production-hardening-design.md`.
Implementation plan: `.agents/plans/2026-08-13-production-hardening-implementation.md`.

## TDD Evidence

RED gate verified in GitHub Actions run #154: the new `production-contract` job failed for the intended reason `compose.yml missing` before production Compose implementation existed. Existing server checks were already green in the same run while the remaining baseline jobs continued independently.

## Execution Lock

Implementation is authorized and ACTIVE on `feat/production-hardening`. Keep all production-hardening follow-ups on this branch/PR. Do not expand into SOP product features or Iteration 3 scope.
