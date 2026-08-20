# Current Iteration

- **Iteration:** `6-ai-assisted-revision`
- **Status:** `DESIGN_SPEC_REVIEW`
- **Working branch:** `feat/ai-assisted-revision`
- **Pull request:** `#8`
- **Goal:** menambahkan AI-assisted revision yang menghasilkan satu usulan perubahan tekstual transient dari finding AI Review, dengan preview before/after dan explicit user apply ke editor existing tanpa direct AI database write path.
- **Design spec:** `.agents/plans/2026-08-20-ai-assisted-revision-design.md`
- **Implementation plan:** not created; blocked until written design spec is approved by the user

## Previous Iteration

Iteration 5 `ai-sop-quality-review` sudah squash-merged ke `master` melalui PR #7 sebagai:

`8881d1888599ff1413fd6a454d2a1ba1ca844811`

Final pre-merge verification untuk Iteration 5 menggunakan CI #303 / run `32324819944` dan seluruh mandatory jobs sukses:

- server: success;
- client: success;
- e2e: success;
- production-compose: success;
- Playwright: `4 passed` tanpa retry/flaky pada final verified run.

## Approved High-Level Direction

Iteration 6 memperdalam authoring flow menjadi:

```text
Template -> AI Draft -> AI Review -> AI Revision
```

Flow produk yang disetujui:

```text
SOP DRAFT
  -> AI Review
  -> pilih finding yang aman untuk textual revision
  -> Sarankan Perbaikan
  -> preview before/after
  -> user Batal atau Terapkan
  -> Terapkan mengubah existing editor state
  -> existing autosave menyimpan perubahan
  -> review/proposal lama menjadi stale dan dibersihkan
```

## Locked Design Boundaries

- AI tidak melakukan silent mutation;
- tidak ada revision `apply` endpoint;
- server revision path suggestion-only dan read-only terhadap application persistence;
- user harus melihat before/after dan menekan `Terapkan` secara eksplisit;
- persistence tetap melalui existing editor autosave;
- server memuat authoritative persisted snapshot setelah autosave berhasil;
- browser-supplied finding diperlakukan sebagai untrusted input;
- provider tidak menerima DB IDs, credentials, audit logs, unrelated SOPs, SOP number, atau organization identity;
- provider output diperlakukan sebagai untrusted dan divalidasi terhadap finding + authoritative snapshot;
- hanya satu target tekstual per proposal;
- target yang diizinkan hanya judul, existing peringatan item, step kegiatan, kelengkapan, keluaran, atau keterangan;
- tidak boleh mengubah nomor SOP, lembaga, actor/swimlane, jumlah/urutan/jenis langkah, decision routing, waktu, lifecycle, atau struktur lain;
- finding `PROCESS_STRUCTURE`, `ACTOR_RESPONSIBILITY`, `DECISION_ROUTING`, `TIME_PLAUSIBILITY`, serta target non-textual tetap manual;
- stale response dan stale apply harus ditolak;
- completed SOP tetap immutable;
- tidak ada bulk `Fix all`;
- tidak ada persisted AI revision/history/chat/job;
- tidak ada background queue;
- tidak ada RAG, regulation lookup, web/file search, compliance certification, collaboration, atau model selector;
- tidak ada Prisma migration.

## Runtime Design

Planned independent runtime boundary:

- `AI_REVISION_PROVIDER=disabled|openai|fake`, default `disabled`;
- `AI_REVISION_TIMEOUT_MS=5000..60000`, default `30000`;
- `openai` memakai existing server-side `OPENAI_API_KEY` + `OPENAI_MODEL`;
- `fake` hanya test/development dan harus ditolak di production;
- OpenAI adapter mengikuti existing backend-only Node 22 `fetch` + Responses API pattern;
- request memakai `store: false`, strict structured output, tanpa tools/retrieval;
- production revision provider tetap disabled by default.

## Current Gate

Design spec sudah ditulis pada branch Iteration 6 dan draft PR #8 sekarang menjadi permukaan review. Status tetap `DESIGN_SPEC_REVIEW`.

Dilarang sebelum approval tersebut:

- menulis implementation plan;
- menulis production feature code;
- menambah migration;
- membuka Iteration 7;
- mengubah scope menjadi approval/evaluation/TTE/public archive/collaboration.

Setelah user menyetujui written design spec, invoke `superpowers/writing-plans`, tulis implementation plan TDD, self-review plan, lalu tunggu/ikuti gate eksekusi berikutnya.
