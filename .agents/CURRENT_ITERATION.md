# Current Iteration

- **Iteration:** `2-production-hardening`
- **Status:** `COMPLETE`
- **Working branch:** `feat/production-hardening` (merged via PR #4)
- **Integration:** squash-merged to `master` as `ebf8855c45d8e2446a580ef8b93645aea85fbb82`
- **Post-merge verification:** GitHub Actions run `#189` / `31710518699` — server, client, E2E, dan production-compose `success`
- **Goal:** membuat aplikasi dapat dideploy dan dipulihkan secara pragmatis di MyPaaS menggunakan Docker Compose biasa, persistent MySQL/PDF storage, Prisma migrations, backup/restore, health verification, dan dokumentasi operasi tanpa registry atau CD otomatis.

## User-Approved Direction

User secara eksplisit menyetujui transition dan merge Iteration 2 dengan keputusan berikut:

- target MyPaaS;
- Docker Compose biasa dari source repository;
- tiga service utama: `frontend`, `backend`, `mysql`;
- MySQL berada di Compose yang sama;
- tidak memakai GHCR/package registry;
- deployment manual `git pull` + Compose;
- backup database harian ke host filesystem dengan retention 14 hari;
- arsitektur production-hardened ringan, bukan ops stack kompleks.

Design spec: `.agents/plans/2026-08-13-production-hardening-design.md`.
Implementation plan: `.agents/plans/2026-08-13-production-hardening-implementation.md`.
Production runbook: `docs/production-deployment.md`.

## TDD / Regression Evidence

1. Run #154 RED: production contract gagal karena `compose.yml missing` sebelum Compose diimplementasikan.
2. Run #161 RED: `prisma migrate deploy` tidak menemukan migration dan MVP E2E gagal karena tabel `User` belum ada.
3. Run #164 GREEN: baseline migration diterapkan, rerun migration idempotent, MVP E2E kembali hijau.
4. Run #165 RED: production contract gagal karena operator scripts belum tersedia/executable.
5. Run #174 RED: production contract menangkap CSP yang belum mengizinkan Google Identity Services.
6. Run #176 menemukan runtime SSR blocker: production frontend kehilangan `@tanstack/router-zod-adapter` karena dependency diexternalize dari SSR bundle.
7. Run #177 GREEN: SSR dependency dibundle; public readiness, DB/PDF persistence, backup retention, dan restore lulus.
8. Run #180 RED review gate: operator scripts masih men-source Compose env file di host.
9. Run #187 GREEN: host secret sourcing dihapus, restore mengganti database state secara penuh, dan seluruh mandatory jobs kembali lulus.
10. Run #188 GREEN: final PR head `8c405bf6e2fdbca4b6e18f45aa442aaea2f42da6` lulus seluruh mandatory jobs sebelum merge.
11. Run #189 GREEN: squash merge commit `ebf8855c45d8e2446a580ef8b93645aea85fbb82` lulus ulang seluruh mandatory jobs di `master`.

## Verified Production Behavior

Post-merge run #189 membuktikan pada disposable production Compose environment:

- image frontend/backend dapat dibuild langsung dari source repository;
- MySQL 8.4 production service menjadi healthy;
- baseline Prisma migration dapat diterapkan pada fresh DB dan `migrate deploy` kedua aman/idempotent;
- MySQL named volume bertahan setelah container dihapus dan dibuat ulang;
- frontend + backend production container healthy dan `/api/health/ready` dapat diakses melalui public frontend ingress;
- SOP PDF named volume bertahan setelah backend container dihapus dan dibuat ulang;
- `backup.sh` menghasilkan `.sql.gz` valid dan retention menghapus backup >14 hari;
- `restore.sh` mengganti database state kembali ke snapshot backup;
- server typecheck/tests/build, client typecheck/tests/build, dan MVP Playwright E2E tetap hijau.

## Review Findings Resolved

- Google Identity Services production CSP diizinkan secara targeted; CSP tidak dinonaktifkan.
- TanStack route Zod adapter dibundle ke SSR output agar runtime image tetap memakai production dependencies saja.
- Production scripts tidak `source` `.env.production`; database credentials digunakan dari container environment yang sudah diparse Docker Compose.
- Restore menggunakan root credential hanya di dalam MySQL container untuk drop/recreate DB sebelum import.
- MySQL dan backend tidak dipublish ke host; hanya frontend ingress yang diekspos.
- Deploy menolak tracked maupun untracked repository changes yang tidak di-ignore sebelum `git pull --ff-only`.

## Transition State

Iteration 2 selesai dan sudah terintegrasi ke `master`. Jangan memulai Iteration 3 atau memperluas scope produk hanya dari file ini; transition berikutnya harus berasal dari instruksi/approval user yang eksplisit.
