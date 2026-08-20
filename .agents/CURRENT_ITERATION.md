# Current Iteration

- **Iteration:** `6-ai-assisted-revision`
- **Status:** `REVIEW_READY`
- **Working branch:** `feat/ai-assisted-revision`
- **Pull request:** `#8`
- **Goal:** menambahkan AI-assisted revision yang menghasilkan satu usulan perubahan tekstual transient dari finding AI Review, dengan preview before/after dan explicit user apply ke editor existing tanpa direct AI database write path.
- **Design spec:** `.agents/plans/2026-08-20-ai-assisted-revision-design.md`
- **Implementation plan:** `.agents/plans/2026-08-20-ai-assisted-revision-implementation.md`

## Previous Iteration

Iteration 5 `ai-sop-quality-review` sudah squash-merged ke `master` melalui PR #7 sebagai `8881d1888599ff1413fd6a454d2a1ba1ca844811`.

## Implemented Flow

```text
SOP DRAFT
  -> AI Review
  -> pilih finding revision-eligible
  -> Sarankan Perbaikan
  -> server membaca persisted authoritative snapshot
  -> provider menghasilkan satu constrained textual proposal
  -> application canonicalizes target + before
  -> user melihat before/after preview
  -> Batal membuang proposal tanpa mutation
  -> Terapkan mengubah existing React editor state saja
  -> existing autosave menyimpan perubahan
  -> previous review/revision menjadi stale dan dibersihkan
```

## Safety Boundary

- Tidak ada silent mutation, bulk fix-all, atau AI revision apply/write endpoint.
- Persistence hanya melalui existing header/procedure autosave.
- Server suggestion path hanya membaca authoritative snapshot dan memanggil provider.
- JWT auth, ownership, dan status `DRAFT` diverifikasi sebelum provider invocation.
- Browser hanya mengirim selected finding dan tidak dapat menentukan arbitrary target.
- Allowed targets hanya: judul SOP, satu existing `peringatan` item, step `kegiatan`, `kelengkapan`, `keluaran`, atau `keterangan`.
- Protected: nomor SOP, organization identity, actors/swimlanes, step count/order/type, decision routing, timing, regulations, related SOPs, lifecycle, dan versioning.
- Provider-safe input tidak membawa `detailSopId`, user/workspace/SOP DB IDs, actor IDs, internal step IDs, email, token/cookie, audit log, official SOP number, organization identity, atau provider credentials.
- Provider output diperlakukan sebagai `unknown`; target dan `before` dikontrol/canonicalized aplikasi.
- Stale network response dibuang bila detail/content/review fingerprint berubah.
- Stale Apply ditolak bila exact current target value tidak lagi sama dengan canonical `before`.
- Completed/archived SOP tetap immutable.
- Tidak ada persisted revision history/chat/job/background queue, RAG, regulation lookup, web/file retrieval, tools, compliance certification, atau Prisma migration.

## Revision Eligibility

- `HEADER + CLARITY` -> `JUDUL`.
- `PERINGATAN + CLARITY | SUPPORTING_FIELD | COMPLETENESS` -> satu existing warning index.
- `STEP + CLARITY` -> `KEGIATAN | KETERANGAN`.
- `STEP + INPUT_OUTPUT` -> `KELENGKAPAN | KELUARAN`.
- `STEP + COMPLETENESS` -> `KEGIATAN | KELENGKAPAN | KELUARAN | KETERANGAN`.
- `STEP + SUPPORTING_FIELD` -> `KETERANGAN`.
- Structural, actor, decision-routing, dan time-plausibility findings tetap manual.

`peringatan.itemIndex` bersifat zero-based. `STEP.stepOrder` adalah human-visible one-based order.

## Runtime / Provider

- `AI_REVISION_PROVIDER=disabled|openai|fake`, default `disabled`.
- `AI_REVISION_TIMEOUT_MS=5000..60000`, default `30000`.
- OpenAI memakai existing server-side `OPENAI_API_KEY` dan `OPENAI_MODEL`.
- `fake` hanya untuk deterministic test/development dan ditolak di production.
- OpenAI adapter memakai backend-only Node 22 native `fetch` ke Responses API, `store:false`, strict JSON Schema Structured Outputs, bounded timeout, tanpa tools/retrieval.
- Error 429/network/upstream/refusal/malformed output dipetakan ke application error yang sanitized.
- Tidak ada prompt, API key, atau full provider response logging.

## Client Apply Boundary

`applyAiRevisionToEditor()` adalah pure helper. Accepted proposal mengubah editor state existing; autosave existing tetap satu-satunya persistence path.

Compatibility rules:

- `KELENGKAPAN` mengubah `kelengkapan` dan legacy alias `mutu_kelengkapan` bersama-sama.
- `KELUARAN` mengubah `keluaran` dan legacy alias `output` bersama-sama.
- Step target memakai human-visible one-based array position, bukan transient local `row.urutan`.
- Apply orchestration membaca latest editor/proposal/detail refs agar tidak memakai stale React closure snapshot, tetapi exact `before` guard tetap dipertahankan.

## TDD / Acceptance Evidence

RED/GREEN nyata mencakup shared snapshot extraction, revision target/schema, service trust boundary, runtime config, OpenAI transport, client request concurrency/staleness, pure Apply, panel/orchestration, acceptance provider isolation, dan human-visible step-order regression.

Key acceptance evidence:

- **CI #357:** `AI_REVISION_PROVIDER` sengaja disabled. Empat journey existing pass dan hanya AI Revision journey gagal karena `Sarankan Perbaikan` unavailable.
- **CI #358:** fake provider aktif; proposal/preview berhasil tetapi Apply menunjukkan regression pada transient local step ordering.
- **Focused regression:** Apply diperbaiki memakai human-visible one-based row position.
- **Latest-state Apply fix:** Apply orchestration kemudian diperketat agar membaca latest editor/proposal/detail refs tanpa mengendurkan stale `before` guard.

## Final Code-Bearing Verification

Current code-bearing head:

`35007275d612c6520124be5dc62d4a024594ab9c`

Mandatory CI **#362** / run `32358777269` pada head tersebut:

- `server`: **success** — Prisma generate, typecheck, full Jest suite, build.
- `client`: **success** — typecheck, full Vitest suite, build.
- `e2e`: **success**.
- `production-compose`: **success** — production contract, image build, idempotent migrations, seed verification, MySQL/PDF persistence, backup/restore, readiness/public ingress.

Final Playwright log:

```text
5 passed (1.5m)
```

Tanpa retry/flaky label. Journey yang pass: AI-assisted draft, AI-assisted revision, AI SOP quality review, blank SOP lifecycle/versioning, dan system-template lifecycle/versioning.

## Focused Final Audit

- Branch terhadap `master`: `ahead`, `behind_by: 0`.
- Changed-file list tidak memuat `server/prisma/schema.prisma` atau migration baru.
- Controller hanya menyediakan availability + transient `suggest`; tidak ada revision apply/write route.
- Shared AI snapshot repository memakai satu `detailSOP.findUnique` dan tidak memiliki create/update/delete/mutating transaction.
- AI Revision service melakukan provider-enabled, snapshot load, owner, dan `DRAFT` checks sebelum provider call.
- Provider-safe mapping menghapus application DB IDs/internal step IDs serta tidak mengirim SOP number atau organization identity.
- OpenAI request memakai `store:false`, strict JSON Schema, tanpa tools/web/file retrieval/RAG, dan tanpa sensitive logging.
- Fake revision provider hanya aktif pada E2E; production-compose tetap `AI_REVISION_PROVIDER=disabled`.
- Pure Apply tidak dapat mengubah actor, routing, timing, step type/count/order, identity, lifecycle, atau versioning.
- PR #8 tidak memiliki inline review thread. Submitted review yang ada hanya Copilot quota notice dan bukan blocker.

## Merge Gate

Iteration 6 berada pada `REVIEW_READY`. Karena iteration ini menambah external AI provider behavior dan server-side credential boundary, PR #8 **tidak boleh squash-merged ke `master` tanpa explicit final user approval** setelah documentation-head CI hijau.

Jangan memulai Iteration 7 otomatis setelah merge. Transition berikutnya memerlukan instruksi user eksplisit.
