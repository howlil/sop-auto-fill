# Current Iteration

- **Iteration:** `5-ai-sop-quality-review`
- **Status:** `REVIEW_READY`
- **Working branch:** `feat/ai-sop-quality-review`
- **Pull request:** `#7`
- **Goal:** menambahkan AI-assisted quality review sebagai evaluasi transient terhadap snapshot SOP `DRAFT` yang sudah tersimpan, tanpa mutation otomatis dan tanpa persisted AI review history.
- **Design spec:** `.agents/plans/2026-08-20-ai-sop-quality-review-design.md`
- **Implementation plan:** `.agents/plans/2026-08-20-ai-sop-quality-review-implementation.md`

## Previous Iteration

Iteration 4 `ai-assisted-drafting` sudah squash-merged ke `master` melalui PR #6 sebagai `c662c2ca5cdb007f773ef9766e8bb65d3dc5f200`.

## Implemented Behavior

Iteration 5 sudah diimplementasikan pada PR #7:

- existing SOP editor memiliki tab `AI Review` hanya untuk SOP editable berstatus `DRAFT`;
- browser hanya menargetkan `detailSopId`; backend memuat snapshot persisted authoritative dari database;
- header dan prosedur autosave sekarang mengekspos `Promise<boolean>` agar review berhenti bila salah satu save gagal;
- server memeriksa authentication, ownership, dan status `DRAFT` sebelum provider invocation;
- repository review read-only dan tidak menggunakan create/update/delete atau transaction mutation;
- provider input tidak memuat `detailSopId`, user/workspace ID, actor ID, internal step ID, audit log, token, atau SOP lain;
- provider output diperlakukan sebagai `unknown`, divalidasi dan dicanonicalize terhadap snapshot yang sama;
- findings hanya `ERROR | WARNING | SUGGESTION` dan status advisory hanya `PERLU_PERBAIKAN | CUKUP_BAIK | SIAP_DIREVIEW`;
- invalid actor/step finding reference menghasilkan safe `422`;
- hasil review transient, dibersihkan setelah edit, dan stale in-flight response dibuang bila SOP berubah selama request;
- STEP finding membuka dan scroll ke row prosedur berdasarkan step order, tanpa membawa DB ID ke provider/UI contract;
- non-STEP finding kembali ke existing Edit tab;
- completed SOP tetap immutable dan tidak menampilkan AI Review; versi baru kembali menjadi DRAFT dan dapat direview;
- tidak ada auto-fix/write-back, compliance certification, regulation lookup/RAG/web/file search, persisted review/history/job, background queue, generic chat, collaboration, atau Prisma migration.

## Runtime and Provider Boundary

- `AI_REVIEW_PROVIDER=disabled|openai|fake`, default `disabled`;
- `AI_REVIEW_TIMEOUT_MS=5000..60000`, default `30000`;
- `fake` hanya untuk test/development dan ditolak pada production;
- production OpenAI adapter menggunakan backend-only Node 22 `fetch` ke Responses API;
- runtime credential tetap `OPENAI_API_KEY` dan `OPENAI_MODEL` server-side;
- request memakai `store: false`, strict JSON Schema Structured Outputs, dan tidak mengirim `tools`/retrieval;
- upstream rate-limit/network/refusal/invalid output dipetakan ke error aplikasi yang sanitized;
- production Compose dan production contract memaksa AI review default `disabled` dan melarang fake provider.

## TDD and Regression Evidence

RED/GREEN yang benar-benar dijalankan mencakup:

1. review schema/types: RED karena module belum ada, kemudian GREEN setelah canonical validation;
2. authoritative repository: RED karena repository belum ada, kemudian GREEN setelah read-only snapshot query;
3. service trust boundary: RED karena service belum ada, kemudian GREEN setelah ownership/DRAFT/ID-stripping/provider validation;
4. runtime/OpenAI provider: RED untuk env review dan adapter transport, kemudian GREEN dengan config terpisah dan sanitized Responses API adapter;
5. autosave gate: RED karena existing `flush()` masih `Promise<void>`, kemudian GREEN dengan backward-compatible boolean outcome;
6. client review hook/UI: RED karena API/hook/panel belum ada, kemudian GREEN setelah transient autosave-gated review flow;
7. acceptance RED: AI review provider sengaja disabled sehingga journey baru gagal pada CTA disabled, sementara tiga existing journeys tetap pass; setelah fake provider diaktifkan hanya pada E2E, acceptance bergerak ke GREEN;
8. concurrency regression: RED membuktikan stale in-flight response sempat dapat muncul setelah edit; GREEN setelah request fingerprint/detail guard membuang response stale;
9. E2E infrastructure regression diperbaiki dengan hosted Chrome + Playwright ffmpeg helper tanpa mengubah product behavior.

## Final Verification

Code-bearing head sebelum state-doc commit:

`3655c892c1c97b425dade448d81954718553be1c`

Mandatory CI #296 / run `32305681398` pada head tersebut:

- `server`: success;
- `client`: success;
- `e2e`: success;
- `production-compose`: success.

E2E menjalankan 4 journey menggunakan 1 worker dan semuanya pass:

- AI-assisted drafting lifecycle: pass (22.1s);
- AI SOP quality review lifecycle: pass (8.6s);
- blank SOP lifecycle: pass (16.2s);
- system template lifecycle: pass (11.1s);
- total: `4 passed (1.3m)`.

Focused final audit:

- branch `behind_by: 0` terhadap `master`;
- tidak ada Prisma schema/migration baru;
- tidak ada unresolved PR review thread;
- tidak ada submitted review blocker;
- tidak ada prompt/API-key/full-provider-response logging pada AI review path;
- tidak ada application DB ID pada provider-safe input;
- tidak ada persistence mutation pada review path;
- tidak ada automatic completion/approval/compliance gate yang ditambahkan.

## Merge Gate

Implementation Iteration 5 selesai dan siap direview. Karena iteration ini memperluas external AI provider dan server-side credential boundary, squash merge PR #7 ke `master` tetap memerlukan approval user eksplisit setelah final documentation-head CI juga hijau.

Jangan memulai Iteration 6 atau task produk lain otomatis setelah merge. Transition berikutnya tetap membutuhkan instruksi user eksplisit.
