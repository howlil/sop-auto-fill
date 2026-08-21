# Current Iteration

- **Iteration:** `none`
- **Status:** `IDLE`
- **Working branch:** `none`
- **Pull request:** `none`
- **Goal:** tidak ada product iteration aktif. Iteration berikutnya hanya dimulai setelah instruksi user eksplisit.

## Last Completed Iteration

Iteration 6 `ai-assisted-revision` sudah selesai dan **squash-merged ke `master`** melalui PR #8 sebagai commit:

`448e12af5ee0ff533dd426719ad696f16d6c1ffb`

Scope yang selesai:

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

## Completed Product Iterations

- Iteration 1 — MVP vertical slice + executable E2E journey: **COMPLETED / MERGED**.
- Iteration 2 — production Docker Compose hardening, persistence, backup/restore: **COMPLETED / MERGED**.
- Iteration 3 — smart template auto-fill: **COMPLETED / MERGED**.
- Iteration 4 — AI-assisted SOP drafting: **COMPLETED / MERGED**.
- Iteration 5 — AI SOP quality review: **COMPLETED / MERGED**.
- Iteration 6 — AI-assisted SOP revision: **COMPLETED / MERGED**.

## Iteration 6 Safety Boundary

- Tidak ada silent mutation, bulk fix-all, atau AI revision apply/write endpoint.
- Persistence hanya melalui existing header/procedure autosave.
- Server suggestion path hanya membaca authoritative snapshot dan memanggil provider.
- JWT auth, ownership, dan status `DRAFT` diverifikasi sebelum provider invocation.
- Browser hanya mengirim selected finding dan tidak dapat menentukan arbitrary target.
- Allowed targets hanya: judul SOP, satu existing `peringatan` item, step `kegiatan`, `kelengkapan`, `keluaran`, atau `keterangan`.
- Protected: nomor SOP, organization identity, actors/swimlanes, step count/order/type, decision routing, timing, regulations, related SOPs, lifecycle, dan versioning.
- Provider-safe input tidak membawa application DB IDs/internal step IDs, email, token/cookie, audit log, official SOP number, organization identity, atau provider credentials.
- Completed/archived SOP tetap immutable.
- Tidak ada persisted revision history/chat/job/background queue, RAG, regulation lookup, web/file retrieval, compliance certification, atau Prisma migration.

## Final Verification for Iteration 6

Final PR-head mandatory CI #363 / run `32359268308`:

- `server`: **success**.
- `client`: **success**.
- `e2e`: **success**.
- `production-compose`: **success**.
- Playwright: **5 passed (59.8s)** tanpa retry/flaky label.

Verified journeys:

- AI-assisted drafting lifecycle.
- AI-assisted revision lifecycle.
- AI SOP quality review lifecycle.
- Blank SOP lifecycle/versioning.
- System-template lifecycle/versioning.

## Execution Lock

Repository saat ini berada pada milestone boundary setelah Iteration 6.

**Jangan memulai Iteration 7 atau product scope baru secara otomatis.** Maintenance/cleanup tidak dianggap sebagai iteration transition. Iteration berikutnya harus ditetapkan secara eksplisit oleh user dan kemudian dicatat di file ini sebelum implementation dimulai.
