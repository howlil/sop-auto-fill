# Current Iteration

- **Iteration:** `bootstrap`
- **Status:** `ACTIVE`
- **Execution lock:** hanya pekerjaan yang secara eksplisit diminta user dan maintenance yang diperlukan untuk menyiapkan repository/workflow saat ini.

## Source of Truth

File ini adalah execution lock iteration untuk seluruh repository.

Agent wajib membaca file ini sebelum memulai task baru. Jangan menyimpulkan bahwa iteration berikutnya boleh dimulai hanya karena PR maintenance, documentation, cleanup, tooling, atau CI sudah merge.

## Transition Rule

Iteration hanya boleh berubah apabila user secara eksplisit meminta atau menyetujui transition tersebut dan perubahan itu tercermin di file ini.

Sampai file ini diperbarui:

- tetap gunakan short-lived feature/fix branches untuk task yang diizinkan;
- jangan membuat branch iteration permanen;
- follow-up dalam task yang sama tetap menggunakan working branch/PR yang sama;
- merge task normal menggunakan squash merge setelah acceptance test dan mandatory CI hijau serta tidak ada blocker/review unresolved;
- perubahan destructive/high-risk, migration berisiko kehilangan data, atau security-sensitive policy change tidak boleh auto-merge.
