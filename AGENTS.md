# Repository Agent Instructions

Instruksi ini berlaku untuk seluruh repository `sop-auto-fill` kecuali ada `AGENTS.md` yang lebih spesifik di subdirektori.

## Engineering Goal

Optimalkan **fast verified delivery**, bukan volume aktivitas. Tujuannya adalah memperpendek waktu dari requirement yang jelas sampai perubahan siap merge tanpa mengorbankan correctness, security, data integrity, reliability, atau rollback safety.

Default loop untuk perubahan behavior:

```text
goal
  -> acceptance criteria
  -> RED
  -> GREEN
  -> REFACTOR
  -> focused verification
  -> PR / CI
  -> review + fix pada branch yang sama
  -> merge
  -> observe
```

## Development Discipline

1. **TDD adalah default untuk executable behavior change.** Feature dan bugfix mengikuti RED -> GREEN -> REFACTOR. Pengecualian hanya untuk perubahan tanpa behavior yang dapat diuji secara bermakna, misalnya prose-only docs atau formatting mekanis.
2. Untuk bug yang reproducible, tulis regression test yang gagal terlebih dahulu dan pastikan gagal karena behavior yang salah, bukan tooling/fixture yang rusak.
3. Implementasikan **smallest coherent vertical slice**. Utamakan slice end-to-end yang menghasilkan behavior berguna daripada batch horizontal besar per layer.
4. Keep batches small: mudah direview, diverifikasi, direvert, dan dipahami.
5. Gunakan feedback loop tercepat yang aman: focused test selama development, kemudian perluas verification sesuai risk sebelum merge.
6. Batasi WIP. Selesaikan satu task koheren end-to-end sebelum membuka pekerjaan unrelated bila tidak ada blocker nyata.
7. Jangan over-plan low-risk change. Planning harus cukup untuk acceptance criteria, dependency, risk, dan verification. Gunakan design lebih dalam untuk migration, concurrency, security boundary, durable state, public contract, atau architecture change.
8. Terapkan YAGNI. Jangan menambah abstraction, generalization, dependency, atau infrastructure untuk kebutuhan hipotetis.
9. Jangan melemahkan, menghapus, atau skip test valid hanya untuk membuat CI hijau.
10. Flaky test dan CI lambat adalah defect pada delivery system, bukan friction yang dianggap normal.

## Delivery Metrics

Gunakan metrics untuk memperbaiki sistem engineering, bukan menilai produktivitas individual atau agent.

Prioritaskan:

- **Cycle time**: task start -> merge-ready/merged.
- **PR lead time**: PR opened -> merged.
- **CI feedback time**: push -> actionable result.
- **Change failure rate**: perubahan merged/deployed yang memerlukan rollback, hotfix, atau menyebabkan incident.
- **Escaped defect rate**: defect behavior yang ditemukan setelah merge/release.
- **Rework rate**: pekerjaan substantial akibat requirement kabur, design lemah, test kurang, atau review churn.
- **Flaky-test rate**.
- **WIP age**: umur task aktif yang belum selesai.
- **Deployment frequency** jika signal deployment reliable tersedia.

Interpretation:

- Optimalkan trend dan bottleneck, bukan vanity number.
- **Commit count, branch count, lines changed, dan PR count bukan productivity KPI.**
- Cycle time rendah tetapi rework/escaped defect tinggi bukan delivery sehat.
- Bila metric memburuk, cari bottleneck: scope kabur, batch terlalu besar, CI lambat, flaky tests, review latency, coupling, atau release friction.

## Git Workflow — Non-Negotiable

1. Satu task atau bugfix menggunakan maksimal satu working branch.
2. Sebelum membuat branch, cek apakah task yang sama sudah punya branch/PR aktif. Jika ada, lanjutkan itu.
3. Jangan membuat branch baru karena test gagal, CI retry, formatting, review follow-up, atau siklus RED/GREEN tambahan.
4. Commit intermediate RED/GREEN diperbolehkan bila membantu diagnosis/review, tetapi bukan kewajiban dan bukan KPI.
5. Jangan membuat retained commit khusus formatting, typo kecil, CI retry, atau `fix previous commit` selama masih task yang sama. Amend/fold/squash bila aman.
6. Draft PR hanya dibuat jika early CI/review memang berguna. Jangan membuat PR baru untuk revisi task yang sama.
7. Satu task normal menggunakan satu PR sampai selesai.
8. Keep PR small enough untuk direview dan direvert dengan percaya diri. Split berdasarkan user-visible behavior atau invariant boundary, bukan layer teknis arbitrer.
9. Setelah acceptance test, mandatory CI, dan review gate relevan hijau serta tidak ada blocker, **langsung merge** untuk task yang sudah diotorisasi user.
10. Default merge adalah **squash merge**, sehingga `master` menerima satu logical commit bersih per task.
11. Setelah merge, hapus branch task bila tooling mengizinkan.
12. Jangan meninggalkan stale/experiment/retry/iteration branch sebagai arsip informal.
13. Auto-merge tidak berlaku untuk destructive/high-risk change, migration yang berpotensi kehilangan data, security-sensitive policy change, credentials, atau perubahan yang secara eksplisit membutuhkan review/approval tambahan.
14. Jangan memulai iteration berikutnya hanya karena maintenance PR merge. Execution lock mengikuti `.agents/CURRENT_ITERATION.md`.

## Required Task Lifecycle

### Sebelum bekerja

- baca `.agents/CURRENT_ITERATION.md`;
- pastikan task diizinkan oleh execution lock saat ini;
- resolve intended behavior dan acceptance criteria dari user request, code, test, issue, atau plan yang relevan;
- cek branch/PR aktif untuk task yang sama;
- identifikasi smallest safe test seam dan verification path.

### Saat bekerja

- pertahankan scope satu task per branch;
- buat RED evidence untuk behavior change;
- implement hanya cukup untuk GREEN;
- refactor sambil menjaga GREEN dan tanpa memperluas scope;
- jalankan focused verification segera;
- follow-up kecil, test fix, formatting, dan koreksi CI tetap pada branch/PR yang sama;
- update `.agents/` hanya bila artifact tersebut benar-benar meningkatkan execution, continuity, risk control, atau auditability.

### Sebelum merge

- jalankan acceptance/focused test relevan;
- perluas ke mandatory CI/build/e2e/security/container gates sesuai scope/risk;
- pastikan current PR head yang diverifikasi belum berubah;
- pastikan tidak ada blocker atau unresolved review thread;
- high-risk change harus memenuhi review/approval tambahan yang diperlukan;
- gunakan squash merge untuk task normal.

### Setelah merge

- hapus branch task bila tooling mendukung;
- jangan membuat branch lanjutan hanya untuk cleanup kecil dari task yang sama;
- observe hasil bila perubahan punya runtime/release signal yang tersedia;
- jangan mengubah iteration aktif kecuali `.agents/CURRENT_ITERATION.md` memang diubah secara eksplisit sebagai keputusan iteration transition.

## Agent Workspace

- Root `AGENTS.md` adalah execution policy repository.
- `.agents/CURRENT_ITERATION.md` adalah source of truth untuk execution lock product iteration.
- `.agents/plans/` menyimpan implementation plan ketika sequencing/risk cukup kompleks untuk membutuhkan artifact tertulis.
- `.agents/README.md` menjelaskan boundary dan operating model workspace agent.

Jangan membuat plan/checkpoint/spec sebagai ceremony. Low-risk task dengan acceptance criteria dan verification yang sudah jelas tidak membutuhkan heavyweight artifact.

## Iteration Lock

`.agents/CURRENT_ITERATION.md` adalah source of truth untuk iteration yang boleh dieksekusi. Merge maintenance, cleanup, documentation, tooling, atau perubahan agent policy tidak boleh dianggap sebagai sinyal otomatis untuk memulai iteration berikutnya.

Jika isi file tersebut bertentangan dengan asumsi, roadmap, issue, atau urutan PR, ikuti `.agents/CURRENT_ITERATION.md` sampai user secara eksplisit mengubah execution lock.
