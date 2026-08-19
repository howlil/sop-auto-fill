# Current Iteration

- **Iteration:** `5-ai-sop-quality-review`
- **Status:** `DESIGN_SPEC_REVIEW`
- **Working branch:** `feat/ai-sop-quality-review`
- **Pull request:** belum dibuat
- **Goal:** menambahkan AI-assisted quality review sebagai evaluasi transient terhadap snapshot SOP `DRAFT` yang sudah tersimpan, tanpa mutation otomatis dan tanpa persisted AI review history.
- **Design spec:** `.agents/plans/2026-08-20-ai-sop-quality-review-design.md`
- **Implementation plan:** belum dibuat; blocked sampai written design spec direview dan disetujui user.

## Previous Iteration

Iteration 4 `ai-assisted-drafting` sudah squash-merged ke `master` melalui PR #6 sebagai `c662c2ca5cdb007f773ef9766e8bb65d3dc5f200`.

## User-Approved Direction

Pada 2026-08-20 user menyetujui arah Iteration 5 `ai-sop-quality-review` setelah membandingkan tiga opsi lanjutan: AI quality review, AI inline rewrite, dan workspace collaboration.

Arah yang dikunci:

- quality review berada di existing SOP editor, bukan page/editor baru;
- target review adalah ordinary editable SOP `DRAFT`;
- review memakai server-authoritative persisted snapshot, bukan arbitrary SOP JSON dari browser;
- client menunggu autosave settled sebelum memulai review sehingga tidak sengaja mereview state yang diketahui stale;
- AI menghasilkan findings transient `ERROR | WARNING | SUGGESTION` yang menunjuk lokasi spesifik pada SOP;
- findings berfokus pada process structure, actor responsibility, input/output continuity, decision routing, clarity, supporting fields, time plausibility, dan completeness signals;
- AI review bersifat advisory dan bukan approval, completion gate, legal compliance score, atau regulatory certification;
- user memperbaiki SOP secara manual melalui editor existing dan autosave existing;
- post-review edit membuat hasil lama stale atau dibersihkan;
- tidak ada automatic fix/write-back pada Iteration 5;
- tidak ada regulation lookup, web/file search, RAG, approval/evaluation/TTE/public archive, collaboration, model settings UI, atau generic chat;
- tidak ada Prisma migration, persisted AI review/history/job, atau background queue;
- mandatory CI memakai deterministic fake provider dan tidak memanggil provider live/berbayar.

## Design Invariants

1. Browser hanya mengirim target `detailSopId`; backend memuat review snapshot dari database.
2. Ownership dan status `DRAFT` diverifikasi server-side sebelum provider invocation.
3. Review path tidak membuat, mengubah, atau menghapus application rows.
4. Actor IDs dan internal step IDs tidak dikirim ke provider; provider menerima human-readable actor names dan step order references.
5. Provider output diperlakukan sebagai untrusted input dan divalidasi terhadap snapshot yang sama.
6. Invalid actor/step references pada finding menolak provider output, bukan diteruskan sebagai dangling UI state.
7. Review result transient dan tidak menjadi completion prerequisite.
8. Existing editor, autosave, Flowchart/BPMN, PDF, completion, dan versioning tetap berfungsi ketika AI review disabled/gagal.
9. Draft-generation provider contract Iteration 4 tidak di-overload; quality review memakai provider interface terpisah.
10. OpenAI production adapter tetap backend-only, `store: false`, strict structured output, no tools/retrieval, bounded timeout, dan sanitized errors.

## Execution State

Design spec sudah ditulis pada branch ini dan menunggu review user.

Selama status `DESIGN_SPEC_REVIEW`:

- boleh memperbaiki atau memperjelas design spec;
- boleh melakukan read-only inspection untuk menjawab pertanyaan design;
- **jangan** membuat implementation plan;
- **jangan** menulis production code, test implementation, migration, atau UI behavior;
- **jangan** memperluas scope menjadi inline AI correction atau subsystem lain.

Setelah user menyetujui written spec secara eksplisit, transisi berikutnya adalah membuat implementation plan TDD dengan skill `writing-plans`, lalu mengubah status execution lock sesuai tahap implementasi.

## Transition Rule

Jangan memulai Iteration 6 atau task produk di luar Iteration 5 hanya dari file ini. Transition berikutnya tetap membutuhkan instruksi atau approval user eksplisit.
