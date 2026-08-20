# Current Iteration

- **Iteration:** `6-ai-assisted-revision`
- **Status:** `REVIEW_READY`
- **Working branch:** `feat/ai-assisted-revision`
- **Pull request:** `#8`
- **Goal:** menambahkan AI-assisted revision yang menghasilkan satu usulan perubahan tekstual transient dari finding AI Review, dengan preview before/after dan explicit user apply ke editor existing tanpa direct AI database write path.
- **Design spec:** `.agents/plans/2026-08-20-ai-assisted-revision-design.md`
- **Implementation plan:** `.agents/plans/2026-08-20-ai-assisted-revision-implementation.md`

## Previous Iteration

Iteration 5 `ai-sop-quality-review` sudah squash-merged ke `master` melalui PR #7 sebagai:

`8881d1888599ff1413fd6a454d2a1ba1ca844811`

Final pre-merge verification Iteration 5 menggunakan CI #303 / run `32324819944` dan seluruh mandatory jobs sukses: server, client, e2e, production-compose. Final Playwright run: `4 passed` tanpa retry/flaky.

## Implemented Product Flow

```text
Template -> AI Draft -> AI Review -> AI Revision
```

Iteration 6 sekarang mengimplementasikan:

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

## Implemented Safety Boundary

- tidak ada silent mutation;
- tidak ada AI revision apply/write endpoint;
- persistence hanya melalui existing header/procedure autosave;
- suggestion server path hanya membaca authoritative snapshot dan memanggil provider;
- satu textual target per proposal;
- allowed targets hanya judul, satu existing `peringatan` item, step `kegiatan`, `kelengkapan`, `keluaran`, atau `keterangan`;
- protected: nomor SOP, organization identity, actors/swimlanes, step count/order/type, decision routing, timing, regulations, related SOPs, lifecycle/versioning;
- browser-supplied finding dan provider output diperlakukan sebagai untrusted;
- server authoritative snapshot menentukan owner, status, allowed targets, canonical target, dan `before`;
- provider-safe input tidak membawa `detailSopId`, user/workspace/SOP DB IDs, actor IDs, internal step IDs, email, token/cookie, audit log, official SOP number, organization identity, atau provider credentials;
- provider output tidak boleh menentukan `before`;
- stale network response dibuang bila detail/content/review fingerprint berubah;
- stale apply ditolak bila exact current target value tidak lagi sama dengan authoritative `before`;
- completed/archived SOP tetap immutable dan tidak menampilkan editing review/revision action;
- tidak ada bulk fix-all, AI revision persistence/history/chat/job/background queue;
- tidak ada RAG, regulation lookup, web/file retrieval, tools, compliance certification, collaboration, atau model selector;
- tidak ada Prisma schema/migration baru.

## Revision Eligibility

Conservative allowlist yang diterapkan:

- `HEADER + CLARITY` -> `JUDUL`;
- `PERINGATAN + CLARITY | SUPPORTING_FIELD | COMPLETENESS` -> satu existing warning index;
- `STEP + CLARITY` -> `KEGIATAN | KETERANGAN`;
- `STEP + INPUT_OUTPUT` -> `KELENGKAPAN | KELUARAN`;
- `STEP + COMPLETENESS` -> `KEGIATAN | KELENGKAPAN | KELUARAN | KETERANGAN`;
- `STEP + SUPPORTING_FIELD` -> `KETERANGAN`;
- `PROCESS_STRUCTURE`, `ACTOR_RESPONSIBILITY`, `DECISION_ROUTING`, `TIME_PLAUSIBILITY`, actor-located findings, dan target di luar allowlist tetap manual.

`peringatan.itemIndex` bersifat zero-based. `STEP.stepOrder` adalah urutan manusia one-based.

## Shared Authoritative Snapshot

Iteration 5 review repository sudah diekstrak ke internal shared AI boundary:

```text
server/src/modules/sop/ai-common/
  sop-ai-snapshot.repository.ts
  sop-ai-snapshot.types.ts
```

AI Review dan AI Revision sekarang menggunakan satu read-only snapshot loader yang sama. Query tetap satu `detailSOP.findUnique`, mengurutkan lampiran/swimlane/langkah secara deterministik, mengubah internal decision target ID menjadi target step order, dan tidak memiliki create/update/delete atau mutating transaction path.

## Runtime and Provider Boundary

- `AI_REVISION_PROVIDER=disabled|openai|fake`, default `disabled`;
- `AI_REVISION_TIMEOUT_MS=5000..60000`, default `30000`;
- `openai` memakai existing server-side `OPENAI_API_KEY` + `OPENAI_MODEL`;
- `fake` hanya test/development dan ditolak di production;
- OpenAI adapter menggunakan backend-only Node 22 native `fetch` ke Responses API;
- request memakai `store: false`, strict JSON Schema Structured Outputs, bounded timeout, dan tidak mengirim `tools` atau retrieval;
- instructions memperlakukan SOP/finding sebagai untrusted data dan melarang perubahan protected structure, invented regulation/citation, compliance approval, atau external tool use;
- 429/network/upstream/refusal/malformed output dipetakan ke application error yang sanitized;
- tidak ada prompt, API key, atau full provider response logging;
- production Compose dan production contract menetapkan revision provider `disabled` dan melarang fake provider.

## Client Apply Boundary

Accepted proposal tidak memanggil revision write API. Pure helper `applyAiRevisionToEditor()` mengubah state editor yang sudah ada dan existing autosave menjadi satu-satunya persistence path.

Important compatibility behavior:

- `KELENGKAPAN` mengubah `kelengkapan` dan legacy alias `mutu_kelengkapan` bersamaan;
- `KELUARAN` mengubah `keluaran` dan legacy alias `output` bersamaan;
- step target memakai human-visible one-based array position, bukan `row.urutan` lokal yang pada newly-added rows dapat belum ternormalisasi.

## TDD / Regression Evidence

RED/GREEN yang benar-benar dijalankan:

1. **Shared snapshot repository**: RED karena `ai-common` repository belum ada; GREEN setelah query/mapping dipindahkan dan AI Review tetap regression-green.
2. **Revision target/schema**: RED karena revision schema belum ada; GREEN setelah explicit allowlist, canonical `before`, length checks, no-op rejection, zero-based warning index, dan one-based step order.
3. **Service trust boundary**: RED karena revision service/provider belum ada; GREEN setelah disabled/notfound/owner/DRAFT/eligibility checks dan provider-safe mapping.
4. **Runtime config**: RED untuk missing `AI_REVISION_*`; GREEN dengan disabled default, timeout boundary, OpenAI credential dependency, dan production fake rejection.
5. **OpenAI transport**: RED karena adapter belum ada; GREEN dengan Responses API, `store:false`, strict schema, no tools, timeout, dan sanitized errors.
6. **Client request state**: RED karena API/hook belum ada; GREEN dengan autosave gate, transient proposal, request sequencing, and stale content/detail/review response rejection.
7. **Pure Apply**: RED karena apply helper belum ada; GREEN setelah immutable mapping, stale `before` validation, alias-pair handling, dan no network/write dependency.
8. **Panel/orchestration**: RED karena AI Review panel belum memiliki revision contract; GREEN setelah eligible/manual UX, preview, cancel/apply, and existing finding navigation.
9. **Acceptance RED**: CI #357 menjalankan provider revision disabled. Empat existing journeys pass dan hanya new AI Revision journey gagal karena `Sarankan Perbaikan` tidak tersedia.
10. **Acceptance GREEN debugging**: CI #358 membuktikan proposal/preview berhasil tetapi Apply ditolak pada newly-added local rows. Root cause ditemukan pada mismatch internal `row.urutan` 2/3/4 versus human-visible Langkah 1/2/3.
11. **Step-order regression RED**: CI #359 menambahkan focused unit case dan 306 test lain pass sementara satu case human-visible order gagal.
12. **Step-order regression GREEN**: Apply helper diperbaiki menggunakan human-visible one-based array position. CI #360 kemudian full green termasuk E2E.

## Final Code-Bearing Verification

Code-bearing head:

`c13e8ea763ae92fc844daa6932e457623d0231cb`

Mandatory CI #360 / run `32351852414` pada head tersebut:

- `server`: success;
  - dependency install: success;
  - Prisma generate: success;
  - typecheck: success;
  - full Jest suite: success;
  - build: success;
- `client`: success;
  - typecheck: success;
  - full Vitest suite: success;
  - build: success;
- `e2e`: success;
- `production-compose`: success;
  - production contract: success;
  - image build: success;
  - migrations idempotent: success;
  - system template seed verification: success;
  - MySQL/PDF volume persistence: success;
  - backup retention: success;
  - restore replacement: success;
  - readiness/public ingress: success.

Final Playwright log:

```text
5 passed (1.6m)
```

Journey coverage:

- AI-assisted drafting: pass;
- AI-assisted revision: pass;
- AI SOP quality review: pass;
- blank SOP lifecycle: pass;
- system template lifecycle: pass.

Tidak ada retry/flaky label pada final verified run.

## Focused Final Audit

- branch `behind_by: 0` terhadap `master`;
- changed-file audit tidak memuat `server/prisma/schema.prisma` atau migration baru;
- tidak ada `ai-revisions/apply` route;
- AI Revision service tidak memiliki application create/update/delete atau mutating transaction;
- provider-safe input tidak membawa application DB ID, SOP number, institution identity, token, audit log, atau credential;
- OpenAI request tidak membawa `tools`, web/file retrieval, atau RAG;
- tidak ada prompt/API-key/full-provider-response logging pada AI Revision path;
- fake revision provider hanya aktif pada E2E job dan production-compose tetap `disabled`;
- pure Apply tidak dapat mengubah actor, routing, timing, step type/count/order, identity, lifecycle, atau versioning;
- completed SOP tetap immutable;
- PR #8 tidak memiliki inline review thread atau submitted review blocker.

## Merge Gate

Implementation Iteration 6 selesai pada code-bearing head dan siap untuk final PR review. Karena iteration ini menambah external AI provider behavior dan server-side credential boundary baru, PR #8 **tidak boleh squash-merged ke `master` tanpa explicit final user approval** setelah documentation-head CI juga hijau.

Jangan memulai Iteration 7 otomatis setelah merge. Transition berikutnya tetap memerlukan instruksi user eksplisit.
