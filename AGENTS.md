# Repository Agent Instructions

Instruksi ini berlaku untuk seluruh repository `sop-auto-fill` kecuali ada `AGENTS.md` yang lebih spesifik di subdirektori.

## Git Workflow — Non-Negotiable

1. Satu task atau bugfix menggunakan maksimal satu working branch.
2. Jangan membuat branch baru hanya karena satu test gagal atau ada follow-up kecil. Lanjutkan pekerjaan pada branch task yang sama.
3. Commit intermediate RED/GREEN diperbolehkan bila dibutuhkan untuk TDD, tetapi sebelum masuk ke `master` history task harus dirapikan dengan **squash merge**.
4. Jangan membuat commit terpisah hanya untuk formatting, typo kecil, CI retry, atau `fix previous commit` selama masih berada dalam task yang sama. Gabungkan perubahan tersebut ke pekerjaan task yang sedang berjalan bila memungkinkan.
5. Draft PR hanya dibuat bila benar-benar dibutuhkan untuk CI atau review. Jangan membuat PR baru untuk revisi dari task yang sama; gunakan PR yang sudah ada.
6. Setelah seluruh acceptance test dan mandatory CI hijau serta tidak ada blocker atau review unresolved, **langsung merge** tanpa menunggu konfirmasi tambahan untuk task yang sebelumnya memang sudah diminta dikerjakan.
7. Default merge untuk task normal adalah **squash merge**, sehingga `master` menerima satu commit bersih per task.
8. Setelah merge, hapus branch task bila tooling mengizinkan.
9. Jangan meninggalkan branch eksperimen atau stale. Branch yang abandoned harus dihapus.
10. Jangan membuat `iteration branch` permanen. Satu iteration tetap terdiri dari kumpulan short-lived feature/fix branches.
11. Auto-merge tidak berlaku untuk perubahan destructive/high-risk, migration yang berpotensi menyebabkan kehilangan data, security-sensitive policy change, atau ketika user secara eksplisit meminta review sebelum merge.
12. Jangan memulai iteration berikutnya hanya karena maintenance PR sudah merge. Execution lock iteration selalu mengikuti `.agents/CURRENT_ITERATION.md`.

## Required Task Lifecycle

Sebelum mulai bekerja:

- baca `.agents/CURRENT_ITERATION.md`;
- pastikan task diizinkan oleh execution lock saat ini;
- cek apakah task yang sama sudah memiliki branch atau PR aktif;
- gunakan branch/PR tersebut jika sudah ada, bukan membuat duplikat.

Saat bekerja:

- pertahankan scope satu task per branch;
- follow-up kecil, test fix, formatting, dan koreksi CI tetap berada pada branch yang sama;
- gunakan commit intermediate hanya bila membantu proses pengembangan, misalnya siklus TDD RED/GREEN;
- jangan membuat branch eksperimen permanen.

Sebelum merge:

- jalankan acceptance test yang relevan;
- pastikan mandatory CI hijau;
- pastikan tidak ada blocker atau review thread unresolved;
- untuk perubahan normal, gunakan squash merge;
- untuk perubahan high-risk sesuai pengecualian di atas, tahan merge sampai review/approval yang diperlukan selesai.

Setelah merge:

- hapus branch task bila tooling mendukung;
- jangan membuat branch lanjutan hanya untuk cleanup kecil dari task yang sama;
- jangan mengubah iteration aktif kecuali `.agents/CURRENT_ITERATION.md` memang diubah secara eksplisit sebagai bagian dari keputusan iteration transition.

## Iteration Lock

`.agents/CURRENT_ITERATION.md` adalah source of truth untuk iteration yang boleh dieksekusi. Merge maintenance, cleanup, documentation, atau tooling tidak boleh dianggap sebagai sinyal otomatis untuk memulai iteration berikutnya.

Jika isi file tersebut bertentangan dengan asumsi, roadmap, issue, atau urutan PR, ikuti `.agents/CURRENT_ITERATION.md` sampai user secara eksplisit mengubah execution lock.
