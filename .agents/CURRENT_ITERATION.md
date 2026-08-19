# Current Iteration

- **Iteration:** `3-smart-template-auto-fill`
- **Status:** `REVIEW_READY`
- **Working branch:** `feat/smart-template-auto-fill`
- **Pull request:** `#5`
- **Goal:** menambahkan jalur pembuatan SOP berbasis system template dan reusable workspace data tanpa mengganti editor, autosave, Flowchart/BPMN, versioning, print, atau PDF yang sudah stabil.
- **Design spec:** `.agents/plans/2026-08-18-smart-template-auto-fill-design.md`
- **Implementation plan:** `.agents/plans/2026-08-19-smart-template-auto-fill-implementation.md`

## User-Approved Direction

User secara eksplisit meminta Iteration 3 dilanjutkan ke implementasi dengan arah berikut:

- `Buat SOP` mempertahankan opsi SOP kosong;
- jalur baru `Dari Template` menghasilkan SOP `DRAFT` biasa;
- template digunakan sebagai starting point dan seluruh hasil tetap editable;
- reusable workspace data, terutama pelaksana/swimlane, digunakan kembali secara deterministik;
- auto-fill tidak boleh diam-diam menempelkan peraturan yang mungkin tidak relevan;
- existing editor menjadi satu-satunya editor setelah draft dibuat;
- AI/LLM assistance ditunda ke iteration terpisah setelah deterministic auto-fill terbukti;
- approval/evaluation/TTE/public archive/WhatsApp tidak dikembalikan ke scope produk ini.

## Implemented Behavior

Iteration 3 sekarang menyediakan:

1. dua model persisted read-only system template: `SopTemplate` dan `SopTemplateStep`;
2. migration additive production untuk kedua model tersebut;
3. tiga system template stabil: `administrasi-umum`, `pengelolaan-dokumen`, dan `pelayanan`;
4. API authenticated untuk list template, preview workspace actor reuse/create, dan transactional create-from-template;
5. deterministic actor matching berdasarkan normalized actor name, reuse actor existing, dan create actor missing tepat satu kali;
6. pembuatan `SOP` + `DetailSOP` + swimlane + lampiran + langkah + decision routing dalam satu Prisma transaction;
7. UI `Buat SOP` dengan jalur `SOP Kosong` dan `Dari Template`, preview sebelum mutation, lalu navigasi ke editor existing;
8. production-safe idempotent template seed yang dijalankan setelah `prisma migrate deploy`;
9. normalisasi default `keterangan` template agar draft hasil template langsung memenuhi kontrak validasi editor existing;
10. acceptance coverage yang mempertahankan blank-SOP journey dan menambahkan full template-SOP lifecycle.

Tidak ada automatic attachment `Peraturan`, template mutation endpoint, template designer, AI/LLM drafting, approval/evaluation/TTE/public archive, atau WhatsApp yang ditambahkan pada Iteration 3.

## Verification Evidence

Code-bearing head `4027cc02bc5be8561ae72bfba94257d80a01b13c` diverifikasi oleh GitHub Actions CI run `#212` / `32282912958` dengan seluruh mandatory jobs hijau:

- **server:** Prisma generate, typecheck, Jest, dan build lulus;
- **client:** typecheck, 278 unit tests, dan production build lulus;
- **E2E:** migration deploy dua kali, seed dua kali, lalu 2 Playwright journeys lulus:
  - blank workspace SOP lifecycle tetap lulus;
  - system-template SOP lifecycle lulus dari preview/create sampai autosave, reload, Flowchart/BPMN, Complete, dan Create New Version;
- **production-compose:** production contract, image builds, migration dua kali, template seed dua kali dengan exact state `3 SopTemplate / 15 SopTemplateStep`, MySQL persistence, readiness, PDF persistence, backup retention, dan full restore lulus.

Run `#212` juga membuktikan defect acceptance terakhir telah ditutup: template seed kini menghasilkan `keterangan` non-empty untuk langkah yang sebelumnya kosong sehingga `Selesai edit` dapat melewati validasi editor existing dan masuk ke diagram lifecycle normal.

## Review Gate

Implementation selesai dan siap explicit review. Karena Iteration 3 menambahkan migration produksi, final merge tetap kategori high-risk sesuai `AGENTS.md` dan **tidak boleh dilakukan hanya karena CI hijau**. Merge PR #5 membutuhkan approval user eksplisit setelah review.

## Transition Rule

Jangan memulai Iteration 4 atau AI-assisted drafting dari file ini. Iteration berikutnya hanya dimulai setelah Iteration 3 selesai/merged dan ada instruksi atau approval user eksplisit.
