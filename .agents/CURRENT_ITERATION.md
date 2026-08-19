# Current Iteration

- **Iteration:** `5-ai-sop-quality-review`
- **Status:** `IMPLEMENTATION_PLAN_READY`
- **Working branch:** `feat/ai-sop-quality-review`
- **Pull request:** `#7` (draft)
- **Goal:** menambahkan AI-assisted quality review sebagai evaluasi transient terhadap snapshot SOP `DRAFT` yang sudah tersimpan, tanpa mutation otomatis dan tanpa persisted AI review history.
- **Design spec:** `.agents/plans/2026-08-20-ai-sop-quality-review-design.md`
- **Implementation plan:** `.agents/plans/2026-08-20-ai-sop-quality-review-implementation.md`

## Previous Iteration

Iteration 4 `ai-assisted-drafting` sudah squash-merged ke `master` melalui PR #6 sebagai `c662c2ca5cdb007f773ef9766e8bb65d3dc5f200`.

## User-Approved Direction

Pada 2026-08-20 user menyetujui arah Iteration 5 `ai-sop-quality-review`, kemudian menyetujui written design spec dengan instruksi eksplisit untuk melanjutkan.

Arah yang dikunci:

- quality review berada di existing SOP editor, bukan page/editor baru;
- target review adalah ordinary editable SOP `DRAFT`;
- review memakai server-authoritative persisted snapshot, bukan arbitrary SOP JSON dari browser;
- client memastikan autosave header dan prosedur benar-benar berhasil sebelum memulai review;
- AI menghasilkan findings transient `ERROR | WARNING | SUGGESTION` yang menunjuk lokasi spesifik pada SOP;
- findings berfokus pada process structure, actor responsibility, input/output continuity, decision routing, clarity, supporting fields, time plausibility, dan completeness signals;
- AI review bersifat advisory dan bukan approval, completion gate, legal compliance score, atau regulatory certification;
- user memperbaiki SOP secara manual melalui editor existing dan autosave existing;
- post-review edit membersihkan hasil review lama agar finding stale tidak dianggap masih berlaku;
- tidak ada automatic fix/write-back pada Iteration 5;
- tidak ada regulation lookup, web/file search, RAG, approval/evaluation/TTE/public archive, collaboration, model settings UI, atau generic chat;
- tidak ada Prisma migration, persisted AI review/history/job, atau background queue;
- mandatory CI memakai deterministic fake provider dan tidak memanggil provider live/berbayar.

## Design Invariants

1. Browser hanya mengirim target `detailSopId`; backend memuat review snapshot dari database.
2. Ownership dan status `DRAFT` diverifikasi server-side sebelum provider invocation.
3. Review path tidak membuat, mengubah, atau menghapus application rows.
4. Provider input tidak mengandung application DB IDs, termasuk `detailSopId`, actor IDs, internal step IDs, workspace ID, atau user ID; provider menerima human-readable content dan step order references.
5. Provider output diperlakukan sebagai untrusted input dan divalidasi terhadap snapshot yang sama.
6. Invalid actor/step references pada finding menolak provider output, bukan diteruskan sebagai dangling UI state.
7. Review result transient dan tidak menjadi completion prerequisite.
8. Existing editor, autosave, Flowchart/BPMN, PDF, completion, dan versioning tetap berfungsi ketika AI review disabled/gagal.
9. Draft-generation provider contract Iteration 4 tidak di-overload; quality review memakai provider interface terpisah.
10. OpenAI production adapter tetap backend-only, `store: false`, strict structured output, no tools/retrieval, bounded timeout `AI_REVIEW_TIMEOUT_MS`, dan sanitized errors.

## Planning Review

Implementation plan sudah ditulis dengan delapan task TDD: domain/schema, read-only snapshot repository, service/auth boundary, production provider/runtime, autosave/client hook, editor UI, genuine RED/GREEN E2E, dan final security/CI gate.

Self-review implementation plan menemukan dan memperbaiki asumsi autosave yang tidak akurat. Existing header dan prosedur `flush()` menyimpan error ke state dan resolve; implementation plan sekarang mengubah resolved value secara backward-compatible menjadi `Promise<boolean>`. AI review hanya boleh memanggil backend ketika kedua flush menghasilkan `true`. Caller existing yang tidak membutuhkan result dapat tetap mengabaikan boolean.

Implementation plan juga mengunci:

- mapping repository konkret dari internal target IDs ke step order;
- provider-safe mapper tanpa spread object yang dapat membawa DB IDs;
- side-panel `AI Review` sebagai tab existing, bukan editor/panel kedua;
- STEP finding membuka/scroll ke row prosedur melalui `data-sop-step-order`;
- non-STEP finding kembali ke tab Edit tanpa membuat selector field palsu;
- genuine RED E2E harus dijalankan sebelum `AI_REVIEW_PROVIDER=fake` diaktifkan pada CI;
- production tetap default `AI_REVIEW_PROVIDER=disabled`.

## Execution State

Written design spec sudah approved. Implementation plan sudah ditulis dan self-reviewed. Belum ada production code, test implementation, migration, atau UI behavior Iteration 5 yang ditambahkan.

Selama status `IMPLEMENTATION_PLAN_READY`:

- implementation harus mengikuti plan pada branch dan PR #7 yang sama;
- gunakan TDD RED/GREEN per task;
- jangan membuat branch atau PR baru untuk Iteration 5;
- jangan memperluas scope menjadi auto-fix, compliance retrieval, collaboration, atau subsystem lain;
- final state harus melewati full server/client/E2E/production-compose CI dan focused trust-boundary review;
- karena Iteration 5 memperluas external AI provider/credential boundary, final squash merge tetap memerlukan approval user eksplisit setelah `REVIEW_READY`.

## Transition Rule

Jangan memulai Iteration 6 atau task produk di luar Iteration 5 hanya dari file ini. Transition berikutnya tetap membutuhkan instruksi atau approval user eksplisit.
