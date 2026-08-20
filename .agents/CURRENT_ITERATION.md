# Current Iteration

- **Iteration:** `6-ai-assisted-revision`
- **Status:** `IMPLEMENTATION_PLAN_READY`
- **Working branch:** `feat/ai-assisted-revision`
- **Pull request:** `#8` (draft)
- **Goal:** menambahkan AI-assisted revision yang menghasilkan satu usulan perubahan tekstual transient dari finding AI Review, dengan preview before/after dan explicit user apply ke editor existing tanpa direct AI database write path.
- **Design spec:** `.agents/plans/2026-08-20-ai-assisted-revision-design.md`
- **Implementation plan:** `.agents/plans/2026-08-20-ai-assisted-revision-implementation.md`

## Previous Iteration

Iteration 5 `ai-sop-quality-review` sudah squash-merged ke `master` melalui PR #7 sebagai:

`8881d1888599ff1413fd6a454d2a1ba1ca844811`

Final pre-merge verification Iteration 5 menggunakan CI #303 / run `32324819944` dan seluruh mandatory jobs sukses: server, client, e2e, production-compose. Final Playwright run: `4 passed` tanpa retry/flaky.

## Approved Product Direction

```text
Template -> AI Draft -> AI Review -> AI Revision
```

Iteration 6 flow:

```text
SOP DRAFT
  -> AI Review
  -> pilih finding revision-eligible
  -> Sarankan Perbaikan
  -> server membaca persisted authoritative snapshot
  -> transient before/after proposal
  -> user Batal atau Terapkan
  -> Terapkan mengubah existing editor state saja
  -> existing autosave menyimpan perubahan
  -> previous review/revision menjadi stale dan dibersihkan
```

## Locked Boundaries

- no silent mutation;
- no AI revision apply/write endpoint;
- persistence hanya melalui existing editor autosave;
- satu textual target per proposal;
- allowed targets: judul, satu existing peringatan item, step kegiatan/kelengkapan/keluaran/keterangan;
- protected: nomor SOP, organization identity, actors/swimlanes, step count/order/type, decision routing, timing, regulations, related SOPs, lifecycle/versioning;
- browser finding dan provider output untrusted;
- server authoritative snapshot menentukan owner/status/target/before;
- provider-safe input tidak membawa application DB IDs, credentials, audit logs, official SOP number, atau organization identity;
- stale response dan stale apply ditolak;
- completed SOP immutable;
- no bulk fix-all, persistence/history/chat/job/background queue;
- no RAG/regulation lookup/web/file retrieval/compliance certification/collaboration/model selector;
- no Prisma migration.

## Runtime Plan

- `AI_REVISION_PROVIDER=disabled|openai|fake`, default `disabled`;
- `AI_REVISION_TIMEOUT_MS=5000..60000`, default `30000`;
- `openai` memakai existing server-side `OPENAI_API_KEY` + `OPENAI_MODEL`;
- `fake` ditolak di production;
- OpenAI uses backend-only Node 22 `fetch`, Responses API, `store:false`, strict JSON Schema, no tools/retrieval;
- production revision provider disabled by default.

## Implementation Plan Summary

Implementation plan sudah ditulis dan self-reviewed menjadi 9 task TDD:

1. extract shared read-only AI snapshot boundary and keep AI Review regression-green;
2. define revision targets, eligibility, and snapshot-aware validation;
3. add authenticated read-only revision API + deterministic disabled/fake providers;
4. add independent runtime config + production OpenAI transport;
5. add typed client API + stale-safe transient hook;
6. add pure apply helper that preserves existing autosave alias precedence;
7. wire revision actions, preview, explicit apply, and manual-only UX into AI Review;
8. add deterministic E2E acceptance and CI provider isolation;
9. run final security/regression audit and move PR #8 to REVIEW_READY.

Important implementation detail discovered during planning: existing procedure autosave prefers `mutu_kelengkapan` before `kelengkapan` and `output` before `keluaran`, so AI Apply must update both compatibility aliases for those two targets.

## Current Gate

Written design spec sudah disetujui user. Implementation plan sudah selesai dan siap dieksekusi.

Belum boleh dilakukan sebelum execution choice dipilih:

- menulis production feature code;
- menambah migration;
- merge PR #8;
- memulai Iteration 7.

Execution options follow `superpowers/writing-plans`:

1. Subagent-Driven Development;
2. Inline Execution with checkpoints.
