# Current Iteration

- **Iteration:** `8`
- **Name:** `workspace-production-workbench`
- **Status:** `DESIGN_REVIEW`
- **Working branch:** `feat/workspace-production-workbench`
- **Pull request:** `none`
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

## Last Completed Iteration

Iteration 7 `product-workflow-redesign` sudah squash-merged ke `master` melalui PR #9 sebagai `474c5a317c817560c3923a8fd5e726da9084e501`.

## Execution Lock

Iteration 8 hanya boleh dikerjakan pada `feat/workspace-production-workbench`. Implementasi dimulai setelah design spec Iteration 8 direview dan disetujui user sesuai workflow Superpowers.
