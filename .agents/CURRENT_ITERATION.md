# Current Iteration

- **Iteration:** `2-production-hardening`
- **Status:** `DESIGN_REVIEW`
- **Working branch:** `feat/production-hardening`
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

## Execution Lock

Status saat ini adalah design review. Jangan melakukan implementation changes sebelum written design spec direview/approved oleh user dan implementation plan ditulis sesuai workflow repository.

Setelah design approval final, lanjutkan ke implementation planning. Implementation tetap berada pada task branch `feat/production-hardening`; jangan membuat iteration branch permanen atau branch tambahan untuk follow-up kecil dalam scope task yang sama.
