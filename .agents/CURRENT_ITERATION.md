# Current Iteration

- **Iteration:** `4-ai-assisted-drafting`
- **Status:** `IMPLEMENTING`
- **Working branch:** `feat/ai-assisted-drafting`
- **Pull request:** `#6` (draft)
- **Goal:** menambahkan AI-assisted drafting sebagai preview terstruktur yang tidak melakukan persistence sampai user mengonfirmasi, lalu membuat SOP `DRAFT` biasa dan melanjutkan ke editor existing.
- **Design spec:** `.agents/plans/2026-08-20-ai-assisted-drafting-design.md`
- **Implementation plan:** `.agents/plans/2026-08-20-ai-assisted-drafting-implementation.md`

## Previous Iteration

Iteration 3 `smart-template-auto-fill` sudah squash-merged ke `master` melalui PR #5 sebagai `ed5aace37bd12d6b246d81a70ea17931ea1655c4`.

## User-Approved Direction

User sudah mereview arah design dan pada 2026-08-20 memberi approval eksplisit untuk melanjutkan implementasi Iteration 4.

Arah yang dikunci:

- jalur baru `Dengan AI` ditambahkan di samping `SOP Kosong` dan `Dari Template`;
- user mendeskripsikan proses dalam bahasa natural;
- AI menghasilkan proposal SOP terstruktur untuk preview, bukan mutation langsung;
- user harus mengonfirmasi sebelum data SOP ditulis;
- setelah confirmation, hasil menjadi SOP `DRAFT` biasa dan existing editor tetap satu-satunya editor;
- production provider memakai backend provider adapter, dengan OpenAI sebagai implementasi awal;
- provider credential tidak pernah berada di browser;
- output provider memakai structured data dan divalidasi lagi oleh application domain rules;
- mandatory CI memakai fake provider deterministic dan tidak memanggil provider berbayar;
- blank/template flow harus tetap bekerja ketika AI disabled atau gagal;
- tidak ada automatic regulation attachment;
- tidak ada approval/evaluation/TTE/public archive/OPD roles/WhatsApp yang dikembalikan;
- Iteration 4 tidak menambah Prisma migration atau persisted AI history/job.

## Implementation Invariants

1. Generation endpoint melakukan zero application DB writes.
2. Confirmation endpoint revalidates proposal dan current workspace actor state sebelum transaction.
3. Existing deterministic actor matching/reuse rules tetap digunakan.
4. Template dan AI creation memakai satu shared transactional draft-instantiation boundary agar invariants tidak diduplikasi.
5. OpenAI production adapter menggunakan Responses API strict Structured Outputs, backend-only credentials, no tools/retrieval, dan `store: false`.
6. Model ID ditentukan runtime melalui `OPENAI_MODEL`, bukan hard-coded dalam product logic.
7. `AI_DRAFT_PROVIDER` default `disabled`, sehingga aplikasi tetap dapat boot/deploy tanpa AI credential.
8. Preview AI bersifat read-only pada Iteration 4; fine-grained editing dilakukan setelah confirmation melalui editor existing.
9. Semua production behavior dikerjakan TDD: failing test harus ada dan diverifikasi sebelum implementation yang membuatnya hijau.

## Execution State

Implementation plan sudah disetujui untuk dieksekusi inline pada branch/PR #6 yang sama. Lakukan task secara berurutan, simpan bukti RED/GREEN dari CI, dan jangan memperluas scope di luar design spec.

Status hanya boleh dipindahkan ke `REVIEW_READY` setelah server, client, E2E, dan production-compose mandatory CI hijau dan final review tidak menemukan blocker.

## Transition Rule

Jangan memulai iteration setelah Iteration 4 dari file ini. Transition berikutnya tetap membutuhkan instruksi atau approval user eksplisit.
