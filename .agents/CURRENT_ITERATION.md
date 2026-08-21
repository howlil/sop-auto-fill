# Current Iteration

- **Iteration:** `8`
- **Name:** `workspace-production-workbench`
- **Status:** `IMPLEMENTING`
- **Working branch:** `feat/workspace-production-workbench`
- **Pull request:** `#11`
- **Goal:** redesign workspace menjadi multi-SOP workbench yang compact dan non-wizard, mempertahankan core SOP editor, serta menyiapkan deployment production melalui nabilrn/MyPaas dengan CI/CD yang aman.

## Scope Lock

### Product
- Redesign halaman workspace mengikuti approved information architecture.
- Sidebar hanya merepresentasikan navigation/resource hierarchy, bukan wizard state.
- Workspace menampilkan statistik, SOP catalog, search/filter, dan entry point `+ Buat SOP`.
- Creation flow tetap mendukung AI, template, dan blank tetapi tidak persisten sebagai panel wizard di dashboard.
- `Review & Complete` tidak menjadi navigation workspace.
- Core SOP editor di `client/src/pages/penyusun/sop/detail/**` tidak diubah kecuali diperlukan adapter yang tidak mengubah editing behavior; perubahan seperti itu harus dievaluasi ulang sebelum implementasi.

### Delivery
- Target platform: `nabilrn/MyPaas`.
- Source deployment: Git repository `howlil/sop-auto-fill`.
- Preferred mode: Docker Compose menggunakan production stack yang ada.
- CI tetap menjadi quality gate sebelum production deployment.
- Deployment tidak boleh mem-bypass server/client/E2E/production-compose checks.
- Secrets dan production environment tetap berada di runtime/deployment configuration, bukan di source control.
- Persistent MySQL dan SOP PDF data harus tetap menggunakan named volumes.

## Approved Specs

- `docs/superpowers/specs/2026-08-22-workspace-production-workbench-design.md`
- `docs/superpowers/specs/2026-08-22-mypaas-cicd-design.md`

## Execution Plans

- `docs/superpowers/plans/2026-08-22-workspace-production-workbench.md`
- `docs/superpowers/plans/2026-08-22-mypaas-cicd.md`

## Current Phase

TDD RED/GREEN implementation pada PR #11. Contract tests didahulukan sebelum behavior implementation.

## Last Completed Iteration

Iteration 7 `product-workflow-redesign` sudah squash-merged ke `master` melalui PR #9 sebagai `474c5a317c817560c3923a8fd5e726da9084e501`.

## Execution Lock

Iteration 8 hanya boleh dikerjakan pada `feat/workspace-production-workbench` melalui PR #11 sampai seluruh acceptance dan mandatory CI kembali hijau.
