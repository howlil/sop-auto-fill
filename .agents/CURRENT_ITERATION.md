# Current Iteration

- **Iteration:** `3-smart-template-auto-fill`
- **Status:** `ACTIVE`
- **Working branch:** `feat/smart-template-auto-fill`
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

## Current Gate

Implementation aktif pada PR #5 dengan TDD. Kerjakan schema/migration/seed, server template API, client creation flow, integration/Playwright regression, dan production verification pada branch yang sama.

Karena Iteration 3 menambahkan migration produksi, final merge termasuk kategori high-risk sesuai `AGENTS.md`: seluruh acceptance/mandatory CI harus hijau dan merge tetap membutuhkan explicit review.

## Planned Acceptance Boundary

Iteration 3 harus membuktikan minimal:

1. template system dapat dilist dan dipreview tanpa mutation;
2. pembuatan dari template bersifat transactional;
3. matching workspace actor dipakai ulang dan actor yang belum ada dibuat satu kali;
4. hasilnya adalah SOP `DRAFT` normal yang masuk ke editor existing;
5. blank SOP creation tetap bekerja;
6. autosave, reload, Flowchart/BPMN, Complete, Create New Version, print, dan PDF tidak regress;
7. migration + seed idempotent pada jalur production Compose.

## Transition Rule

Jangan memulai Iteration 4 atau AI-assisted drafting dari file ini. Iteration berikutnya hanya dimulai setelah Iteration 3 selesai dan ada instruksi/approval user eksplisit.
