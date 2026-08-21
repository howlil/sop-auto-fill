# Current Iteration

- **Iteration:** `8`
- **Name:** `workspace-production-workbench`
- **Status:** `REVIEW_READY`
- **Working branch:** `feat/workspace-production-workbench`
- **Pull request:** `#11`
- **Goal:** redesign workspace menjadi multi-SOP workbench yang compact dan non-wizard, mempertahankan core SOP editor, serta menyiapkan deployment production melalui nabilrn/MyPaas dengan CI/CD yang aman.

## Scope Lock

### Product
- Workspace menggunakan resource navigation, bukan wizard state.
- Workspace menampilkan statistik, SOP catalog, search/filter, dan entry point `+ Buat SOP`.
- Creation flow tetap mendukung AI, template, dan blank melalui dialog episodic.
- `Review & Complete` tidak menjadi navigation workspace.
- Core SOP editor di `client/src/pages/penyusun/sop/detail/**` tidak diubah.

### Delivery
- Target platform: `nabilrn/MyPaas`.
- Source deployment: Git repository `howlil/sop-auto-fill`.
- Deploy mode: existing production Docker Compose stack.
- Backend production startup menjalankan `prisma migrate deploy` dan idempotent system-template seed sebelum aplikasi start.
- CI tetap menjadi quality gate sebelum production deployment.
- Validated push ke `master` mempromosikan exact SHA ke branch `production`; promotion tidak berjalan pada pull request.
- Secrets dan production environment tetap berada di runtime/deployment configuration, bukan source control.
- Persistent MySQL dan SOP PDF data tetap menggunakan named volumes.

## Approved Specs

- `docs/superpowers/specs/2026-08-22-workspace-production-workbench-design.md`
- `docs/superpowers/specs/2026-08-22-mypaas-cicd-design.md`

## Execution Plans

- `docs/superpowers/plans/2026-08-22-workspace-production-workbench.md`
- `docs/superpowers/plans/2026-08-22-mypaas-cicd.md`

## Verification Evidence

TDD RED run CI #387:
- server: success;
- e2e: success;
- client: failed only on the new workbench contract because the workbench shell was not implemented yet;
- production-compose: failed only because the new production backend entrypoint was not implemented yet.

GREEN code-bearing run CI #393:
- server: success;
- client: success (typecheck, full Vitest, production build);
- e2e: success;
- production-compose: success, including production contract, image build, migrations twice, seed twice, MySQL/PDF persistence, readiness, backup, and restore;
- `promote-production`: skipped on pull request as intended.

Focused diff audit:
- no changes under `client/src/pages/penyusun/sop/detail/**`;
- no Prisma schema/migration change;
- no production secret committed.

## Last Completed Iteration

Iteration 7 `product-workflow-redesign` sudah squash-merged ke `master` melalui PR #9 sebagai `474c5a317c817560c3923a8fd5e726da9084e501`.

## Merge Gate

Iteration 8 implementation is review-ready on PR #11. Because this iteration changes the production startup/deployment path, treat the merge as a high-risk operational gate under `AGENTS.md`; do not auto-merge until the required final review/approval is satisfied on the current PR head.
