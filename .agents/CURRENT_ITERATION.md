# Current Iteration

- **Iteration:** `7-product-workflow-redesign`
- **Status:** `ACTIVE`
- **Working branch:** `feat/product-workflow-redesign`
- **Pull request:** `#9`
- **Goal:** merombak end-to-end workflow dan UI authoring SOP agar task-oriented, mudah dipahami user baru, dan tetap mempertahankan backend/domain/AI safety boundary Iteration 1-6.
- **Design spec:** `docs/superpowers/specs/2026-08-21-product-workflow-redesign-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-08-21-product-workflow-redesign.md`

## Approved Product Flow

```text
LOGIN
  -> WORKSPACES
  -> WORKSPACE
       -> search / browse SOP
       -> + Buat SOP
            -> Dengan AI | Template | Kosong
            -> guided SOP editor
                 -> 1 Informasi Dasar
                 -> 2 Pelaksana
                 -> 3 Prosedur
                 -> 4 Informasi Pendukung
                 -> 5 Review
            -> Preview: Dokumen | Flowchart | BPMN
            -> Review & Complete
            -> COMPLETED
                 -> PDF / Create New Version
```

## Product Principles

- Satu primary action per screen/section.
- Navigation mengikuti task user, bukan struktur module internal.
- Edit-first, preview-second.
- Pelaksana dapat dikelola dalam konteks penyusunan SOP; workspace tidak memaksa setup pelaksana sebelum authoring.
- AI menjadi contextual capability dan review stage, bukan navigation domain utama.
- Diagram adalah generated view; manual path editing menjadi advanced secondary action.
- Completion adalah explicit lifecycle transition dengan readiness check, bukan sekadar tombol `Selesai` generik.
- Version/activity tetap tersedia tetapi tidak mendominasi authoring workflow.

## Non-Negotiable Technical Boundaries

- Tidak ada Prisma schema/migration pada iteration ini.
- Tidak mengubah ownership, DRAFT/COMPLETED/ARCHIVED semantics, immutable completed version, atau create-new-version behavior.
- Tidak memberi AI direct database write path.
- Existing autosave tetap persistence boundary untuk editing.
- Existing AI Draft / AI Review / AI Revision API contracts dipertahankan kecuali adapter frontend yang backward-compatible.
- Existing Flowchart/BPMN generation dan PDF/export tetap dipertahankan.
- Iteration selesai hanya setelah client tests/build dan lifecycle E2E utama kembali hijau.

## Last Completed Iteration

Iteration 6 `ai-assisted-revision` sudah squash-merged ke `master` melalui PR #8 sebagai `448e12af5ee0ff533dd426719ad696f16d6c1ffb`.
