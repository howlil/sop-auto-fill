# Current Iteration

- **Iteration:** `4-ai-assisted-drafting`
- **Status:** `REVIEW_READY`
- **Working branch:** `feat/ai-assisted-drafting`
- **Pull request:** `#6`
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

## Implemented Behavior

Iteration 4 sekarang menyediakan:

1. shared transactional draft-instantiation boundary yang digunakan template dan AI creation;
2. canonical AI proposal validation/canonicalization untuk actor, langkah, lampiran, waktu, enum, dan decision routing;
3. authenticated API `availability`, `generate`, dan `create` di `/sop/ai-drafts`;
4. generation path yang hanya membaca ownership/workspace actor lalu memanggil provider tanpa application DB mutation;
5. confirmation path yang mengabaikan actor classification/ID dari client sebagai authority, memvalidasi ulang proposal, lalu membuat ordinary SOP `DRAFT` dalam satu transaction;
6. provider abstraction dengan `disabled`, deterministic `fake`, dan production `openai` implementation;
7. OpenAI Responses API transport dengan backend-only credential, server-configured model, strict JSON schema, `store: false`, bounded timeout, no tools/retrieval, dan user-safe upstream error mapping;
8. runtime config `AI_DRAFT_PROVIDER`, `AI_DRAFT_TIMEOUT_MS`, `OPENAI_API_KEY`, dan `OPENAI_MODEL` dengan default AI disabled serta larangan fake provider di production;
9. UI `Dengan AI` pada existing `Buat SOP`, input deskripsi/tujuan/catatan, explicit Generate, read-only preview, warning review, actor reuse/create preview, lalu explicit `Buat Draft SOP`;
10. transient AI proposal state yang dibuang ketika input/source berubah dan tidak menciptakan second editor;
11. mandatory Playwright AI journey yang masuk ke editor existing dan membuktikan autosave, reload, BPMN/Flowchart, Complete, immutability, dan Create New Version;
12. production contract yang membuktikan deployment tetap boot dengan AI disabled tanpa OpenAI credential dan menolak fake provider pada production Compose.

## TDD / Verification Evidence

Perubahan dibuat melalui RED/GREEN gates yang terpisah untuk shared instantiation, canonical proposal schema, DTO boundary, runtime config, service orchestration, OpenAI transport, client flow, dan E2E lifecycle.

Code-bearing head `cfa522dd17d598ae77f9caa53064ab560269ac13` diverifikasi oleh GitHub Actions CI run `#242` / `32292394826` dengan seluruh mandatory jobs hijau:

- **server:** typecheck, seluruh Jest, dan production build lulus;
- **client:** typecheck, seluruh Vitest, dan production build lulus;
- **E2E:** 3 Playwright journeys lulus:
  - blank SOP lifecycle;
  - system-template SOP lifecycle;
  - AI-assisted draft lifecycle dari generate/preview sampai autosave, reload, Flowchart/BPMN, Complete, immutable state, dan Create New Version;
- **production-compose:** production contract, image builds, migrations, exact template seed state, MySQL/PDF persistence, public readiness, backup retention, dan full restore lulus dengan `AI_DRAFT_PROVIDER=disabled` tanpa OpenAI credential.

Acceptance RED sebelumnya juga tervalidasi: setelah AI journey dimasukkan ke mandatory Playwright suite tetapi sebelum fake provider diaktifkan untuk E2E, run `#240` gagal tepat di `Generate Draft` karena provider default disabled sementara blank/template journeys tetap lulus.

## Final Review

Branch dibandingkan dengan `master` berada `ahead` dan `behind_by=0`. Final manual review memeriksa provider credential/error handling, authenticated controller boundary, generation read-only path, create-time proposal revalidation, stale/tampered actor classification, shared transaction atomicity, runtime provider selection, dan production fake-provider exclusion. Tidak ditemukan blocker pada review ini.

PR #6 tidak memiliki unresolved inline review thread atau submitted review blocker pada final gate.

## Merge Gate

Iteration 4 siap explicit final review/merge decision. Karena perubahan menambahkan external AI provider boundary dan server-side credential handling, jangan squash-merge PR #6 tanpa approval user eksplisit setelah review-ready state ini.

## Transition Rule

Jangan memulai Iteration 5 atau memperluas scope produk hanya dari file ini. Transition berikutnya tetap membutuhkan instruksi atau approval user eksplisit.
