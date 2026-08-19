# AI SOP Quality Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** menambahkan `Periksa dengan AI` pada editor SOP `DRAFT` untuk menghasilkan review kualitas transient dari snapshot database authoritative, tanpa mutation SOP, tanpa history AI, dan tanpa migration.

**Architecture:** backend menambahkan modul `sop/ai-review` yang read-only terhadap data aplikasi: service memverifikasi owner/status, repository memuat snapshot persisted, service memetakan snapshot ke provider-safe context tanpa DB IDs, provider menghasilkan structured review, dan application schema memvalidasi output terhadap snapshot yang sama. Client menunggu existing header+prosedur autosave selesai melalui `flushAllAutosave()`, memanggil review endpoint, menampilkan hasil di tab side panel existing, dan menghapus hasil ketika konten lokal berubah setelah review.

**Tech Stack:** NestJS + TypeScript + Prisma + Zod + Node 22 native `fetch`; React + TanStack Query/API client + Vitest; Playwright; Docker Compose/GitHub Actions.

**Spec:** `.agents/plans/2026-08-20-ai-sop-quality-review-design.md`

## Implementation Status

`COMPLETE — REVIEW_READY`

Implementation diselesaikan pada branch `feat/ai-sop-quality-review` / PR #7 dengan TDD RED/GREEN dan full mandatory CI. Code-bearing verification CI #296 (`32305681398`) pada commit `3655c892c1c97b425dade448d81954718553be1c` menghasilkan `server`, `client`, `e2e`, dan `production-compose` semuanya success. E2E: `4 passed (1.3m)` termasuk AI-assisted drafting, AI SOP quality review, blank lifecycle, dan system-template lifecycle.

Tambahan regression yang ditemukan saat final audit: stale in-flight AI review response setelah user mengedit SOP. Regression test terlebih dahulu RED, lalu implementation menambahkan fingerprint/detail guard sehingga response stale dibuang dan meminta user menjalankan review ulang.

## Global Constraints

- Review hanya untuk authenticated owner dan SOP status `DRAFT`.
- Browser tidak mengirim body SOP; request review hanya menargetkan `detailSopId`.
- Backend memuat latest persisted snapshot dari database.
- Provider input tidak boleh memuat `detailSopId`, user/workspace ID, actor ID, internal step ID, access token, audit log, atau SOP lain.
- Provider output adalah untrusted `unknown` sampai lolos canonicalization/validation.
- Severity hanya `ERROR | WARNING | SUGGESTION`.
- Status hanya `PERLU_PERBAIKAN | CUKUP_BAIK | SIAP_DIREVIEW`; advisory, bukan approval/compliance score.
- Maksimum 30 findings; invalid actor/step reference harus menghasilkan safe `422`, bukan silently dropped.
- AI review tidak membuat/update/delete application row.
- Tidak ada Prisma schema change atau migration.
- Tidak ada auto-fix/write-back, regulation lookup, RAG, web/file search, approval/evaluation/TTE/public archive, collaboration, generic chat, model selector, background job, atau persisted review history.
- `AI_REVIEW_PROVIDER=disabled|openai|fake`, default `disabled`; `fake` dilarang di production.
- `AI_REVIEW_TIMEOUT_MS` integer `5000..60000`, default `30000`; jangan rename/repurpose `AI_DRAFT_TIMEOUT_MS`.
- Production OpenAI adapter backend-only, `store:false`, strict JSON Schema, no tools/retrieval, sanitized failures.
- Mandatory CI memakai deterministic fake provider dan tidak memanggil provider live/berbayar.
- Existing blank/template/AI creation, autosave, Flowchart/BPMN, PDF, Complete, immutability, dan Create New Version tidak boleh regress.

## Implemented File Structure

Server:

```text
server/src/modules/sop/ai-review/
  providers/
    ai-review-provider.ts
    disabled-ai-review.provider.ts
    fake-ai-review.provider.ts
    openai-ai-review.provider.ts
    openai-ai-review.provider.spec.ts
  sop-ai-review.controller.ts
  sop-ai-review.module.ts
  sop-ai-review.repository.ts
  sop-ai-review.repository.spec.ts
  sop-ai-review.schema.ts
  sop-ai-review.schema.spec.ts
  sop-ai-review.service.ts
  sop-ai-review.service.spec.ts
  sop-ai-review.types.ts
```

Client:

```text
client/src/pages/penyusun/sop/hooks/use-ai-sop-quality-review.ts
client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-quality-review.spec.tsx
client/src/pages/penyusun/sop/hooks/__tests__/use-ai-sop-quality-review-concurrency.spec.tsx
client/src/pages/penyusun/sop/hooks/__tests__/sop-autosave-flush-result.spec.tsx
client/src/pages/penyusun/sop/detail/components/AiSopQualityReviewPanel.tsx
client/src/pages/penyusun/sop/detail/components/__tests__/AiSopQualityReviewPanel.spec.tsx
client/e2e/journeys/ai-sop-quality-review.spec.ts
```

Runtime/CI:

```text
server/src/config/env.validation.ts
server/src/config/env.validation.spec.ts
server/src/app.module.ts
client/src/api/workspace-sops.ts
client/src/pages/penyusun/sop/hooks/use-detail-sop-penyusun.ts
client/src/pages/penyusun/sop/hooks/use-sop-header-autosave.ts
client/src/pages/penyusun/sop/hooks/use-sop-prosedur-autosave.ts
client/src/pages/penyusun/sop/detail/DetailSOPPenyusun.tsx
client/src/pages/penyusun/sop/detail/SopEditorContext.tsx
client/src/pages/penyusun/sop/detail/components/DetailSopPenyusunSidePanel.tsx
client/src/pages/penyusun/sop/detail/components/DetailSopProsedurEditor.tsx
client/playwright.config.ts
.github/workflows/ci.yml
compose.yml
.env.production.example
scripts/production-contract.sh
```

## Completed TDD Tasks

- [x] **Task 1 — Review Domain Types and Canonical Output Validation**: exact enums, trimming, length/count rules, deterministic duplicate collapse, actor/step snapshot validation.
- [x] **Task 2 — Authoritative Read-Only Review Snapshot Repository**: persisted snapshot mapping, ordered actors/steps, decision target IDs mapped to step order, zero mutation path.
- [x] **Task 3 — Service/Auth/Provider Trust Boundary**: availability, 404/403/DRAFT checks before provider invocation, explicit ID-stripping mapper, safe 422 invalid provider output, authenticated endpoints.
- [x] **Task 4 — Production Provider and Runtime Configuration**: separate review provider config, fake rejected production, Responses API `store:false`, strict JSON Schema, no tools/retrieval, sanitized errors, production-compose contract.
- [x] **Task 5 — Autosave-Gated Client Review Lifecycle**: boolean autosave flush result, `flushAllAutosave`, API contract, transient hook, edit invalidation, rerun replacement, stale in-flight response guard.
- [x] **Task 6 — Existing Editor AI Review UI**: side-panel tab, advisory copy, findings, STEP navigation by order, non-STEP Edit navigation, read-only hiding.
- [x] **Task 7 — Genuine RED/GREEN E2E Acceptance**: provider-disabled RED with three existing journeys still passing, then fake-provider E2E GREEN; hosted Chrome/ffmpeg CI runner fix; final 4/4 journey pass.
- [x] **Task 8 — Full CI and Focused Security/Scope Review**: server/client/E2E/production-compose green, branch behind_by 0, no migration, no unresolved review threads, no provider-safe ID leak/persistence mutation/logging/compliance gate.

## Verification Evidence

RED examples observed in GitHub CI:

- schema RED because AI review schema/types were absent;
- repository RED because read-only review repository was absent;
- service RED because trust-boundary service was absent;
- env/OpenAI adapter RED before review runtime/provider implementation;
- autosave RED because existing `flush()` returned `Promise<void>`;
- client hook/panel RED before review API/UI existed;
- acceptance RED with `AI_REVIEW_PROVIDER` disabled: new AI review journey failed at disabled CTA while AI drafting, blank, and template journeys passed;
- concurrency RED proving stale in-flight result could reappear after edit.

Final code-bearing GREEN:

```text
CI #296
run: 32305681398
head: 3655c892c1c97b425dade448d81954718553be1c
server: success
client: success
e2e: success
production-compose: success
E2E: 4 passed (1.3m)
```

E2E individual results:

```text
AI-assisted drafting lifecycle        pass 22.1s
AI SOP quality review lifecycle       pass 8.6s
blank SOP lifecycle                   pass 16.2s
system template lifecycle             pass 11.1s
```

## Final Merge Gate

Implementation is complete and review-ready. PR #7 must still be squash-merged only after explicit user approval because this iteration extends the external AI provider/server credential boundary. Do not start Iteration 6 automatically after merge.
