# Current Iteration

- **Iteration:** `2-production-hardening`
- **Status:** `READY_FOR_REVIEW`
- **Working branch:** `feat/production-hardening`
- **Pull request:** `#4`
- **Verified head:** `8664066be987827846b94e4a33c42dc817a775b7`
- **Verification:** GitHub Actions run `#187` / `31688082742` — server, client, E2E, dan production-compose `success`
- **Goal:** membuat aplikasi dapat dideploy dan dipulihkan secara pragmatis di MyPaaS menggunakan Docker Compose biasa, persistent MySQL/PDF storage, Prisma migrations, backup/restore, health verification, dan dokumentasi operasi tanpa registry atau CD otomatis.

## User-Approved Direction

User secara eksplisit menyetujui transition ke Iteration 2 dan mengunci keputusan berikut:

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

## Verified Production Behavior

Run #187 membuktikan pada disposable production Compose environment:

- image frontend/backend dapat dibuild langsung dari source repository;
- MySQL 8.4 production service menjadi healthy;
- baseline Prisma migration dapat diterapkan pada fresh DB dan `migrate deploy` kedua aman/idempotent;
- MySQL named volume bertahan setelah container dihapus dan dibuat ulang;
- frontend + backend production container healthy dan `/api/health/ready` dapat diakses melalui public frontend ingress;
- SOP PDF named volume bertahan setelah backend container dihapus dan dibuat ulang;
- `backup.sh` menghasilkan `.sql.gz` valid dan retention menghapus backup >14 hari;
- `restore.sh` mengembalikan data snapshot serta menghapus tabel yang dibuat setelah backup;
- server typecheck/tests/build, client typecheck/tests/build, dan MVP Playwright E2E tetap hijau.

## Review Findings Resolved

- Google Identity Services production CSP diizinkan secara targeted; CSP tidak dinonaktifkan.
- TanStack route Zod adapter dibundle ke SSR output agar runtime image tetap memakai production dependencies saja.
- Production scripts tidak `source` `.env.production`; database credentials digunakan dari container environment yang sudah diparse Docker Compose.
- Restore menggunakan root credential hanya di dalam MySQL container untuk drop/recreate DB sebelum import.
- MySQL dan backend tidak dipublish ke host; hanya frontend ingress yang diekspos.
- Deploy menolak tracked maupun untracked repository changes yang tidak di-ignore sebelum `git pull --ff-only`.

## Integration Gate

Implementation sudah siap direview tetapi **belum boleh otomatis di-merge**. Iteration ini menambahkan baseline production migration history dan security-sensitive CSP behavior, sehingga termasuk high-risk exception pada `AGENTS.md`.

Setelah user menyetujui PR #4:

1. squash merge ke `master`;
2. verifikasi master CI sekali lagi;
3. ubah iteration menjadi `COMPLETE` dengan post-merge evidence;
4. hapus branch `feat/production-hardening` bila tooling mendukung.
