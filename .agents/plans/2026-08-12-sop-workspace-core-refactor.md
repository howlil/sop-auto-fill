# SOP Workspace Core Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `sop-auto-fill` menjadi aplikasi authoring SOP umum berbasis Google Sign-In dengan ownership `User -> Workspace -> SOP`, sambil mempertahankan perilaku editor, Flowchart, BPMN, PDF, print, export, dan isi SOP yang sudah stabil.

**Architecture:** Ganti domain akses/evaluasi pemerintahan dengan autentikasi Google dan ownership sederhana. Workspace hanya container/folder milik satu user. SOP mempertahankan authoring core existing dan versioning snapshot; versi `COMPLETED` immutable dan perubahan berikutnya dilakukan dengan clone penuh ke versi baru `DRAFT`.

**Tech Stack:** React 19 + TanStack Router/Query, NestJS 11, Prisma 7 + MySQL/MariaDB, JWT HTTP-only cookie, Google Identity Services, Node `crypto` untuk verifikasi Google ID token.

## Global Constraints

- Jangan redesign UI SOP atau logic rendering Flowchart/BPMN/PDF.
- Pertahankan seluruh struktur isi SOP existing: header, dasar hukum, SOP terkait, lampiran, pelaksana/swimlane, langkah prosedur, diagram config.
- Workspace hanya folder/project container; nama workspace tidak diwariskan ke SOP.
- Satu user dapat memiliki banyak workspace; satu workspace hanya memiliki satu owner untuk V1.
- Status SOP hanya `DRAFT`, `COMPLETED`, `ARCHIVED`.
- Versi `COMPLETED` immutable; `Create New Version` clone penuh versi terakhir menjadi versi baru `DRAFT`.
- Data lama boleh di-reset; tidak perlu compatibility migration dengan domain OPD/evaluasi/TTE.
- Hapus domain evaluasi, pengajuan, berita acara, TTE, pengesahan, public archive, reminder WhatsApp, role bisnis, dan user management manual.
- Satu task memakai satu branch dan masuk `master` melalui squash merge; karena refactor schema destructive, jangan auto-merge tanpa review.

---

### Task 1: Baseline domain dan schema baru

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/20260812000000_sop_workspace_core/migration.sql`
- Modify: `server/src/app.module.ts`

- [ ] Ganti `Pengguna/OPD` menjadi `User/Workspace` dan relasi SOP menjadi workspace ownership.
- [ ] Pertahankan tabel authoring SOP serta diagram, tetapi putuskan relasi ke evaluasi/TTE.
- [ ] Sederhanakan status menjadi `DRAFT | COMPLETED | ARCHIVED` dan pisahkan status project dari nomor versi.
- [ ] Hapus modul legacy dari `AppModule`.

### Task 2: Google authentication tanpa role

**Files:**
- Modify: `server/src/modules/core/auth/*`
- Modify: `server/src/common/auth/*`
- Modify: `server/src/config/env.validation.ts`
- Modify: `client/src/api/auth.ts`
- Modify: `client/src/routes/login/*`

- [ ] Tambahkan verifier Google ID token berbasis JWK publik Google menggunakan `node:crypto`.
- [ ] Login melakukan upsert user berdasarkan claim Google `sub` dan menerbitkan JWT HTTP-only cookie.
- [ ] JWT payload hanya membawa identity user; hapus role/OPD/password/TTE dari contract auth.
- [ ] Frontend login menggunakan Google Identity Services dan `VITE_GOOGLE_CLIENT_ID`.

### Task 3: Workspace ownership

**Files:**
- Create: `server/src/modules/workspace/*`
- Create: `client/src/api/workspaces.ts`
- Create: `client/src/routes/workspaces/*`

- [ ] CRUD workspace hanya dapat dilakukan owner.
- [ ] Tambahkan endpoint list/create/read/update/delete workspace.
- [ ] Buat halaman daftar workspace dan workspace detail sebagai shell baru.

### Task 4: Adapt SOP catalog/procedure/diagram ke workspace

**Files:**
- Modify: `server/src/modules/sop/catalog/*`
- Modify: `server/src/modules/sop/prosedur/*`
- Modify: `server/src/modules/sop/diagram/*`
- Modify: `server/src/modules/sop/pelaksana/*`

- [ ] Ganti authorization OPD/role menjadi assertion ownership workspace.
- [ ] Hapus transition evaluasi, pencabutan, public archive, dan validator siap evaluasi dari service SOP.
- [ ] Pertahankan payload authoring/editor existing sebanyak mungkin untuk menghindari regression.
- [ ] Implement `complete` dan `create-new-version` dengan clone penuh seluruh data authoring + diagram.

### Task 5: Client shell baru tanpa menyentuh editor core

**Files:**
- Modify: `client/src/routes/__root.tsx`
- Modify: `client/src/routes/index.tsx`
- Add/Modify: route workspace/SOP adapters
- Preserve: `client/src/pages/penyusun/sop/detail/**`
- Preserve: `client/src/lib/print/**` terkait SOP

- [ ] Arahkan root authenticated ke `/workspaces`.
- [ ] Hapus navigasi role/evaluation/TTE/public archive dari shell.
- [ ] Mount editor existing dari route `/workspaces/:workspaceId/sops/:sopId` melalui adapter minimal.
- [ ] Pertahankan Flowchart, BPMN, preview, print, PDF, dan export.

### Task 6: Remove legacy dan update tests/docs

**Files:**
- Delete: server/client legacy evaluation, TTE, OPD-role, notification, public archive modules/routes/tests.
- Modify: `server/package.json`, `client/package.json`, docs/README bila relevan.
- Add/Modify: unit/E2E tests untuk Google auth contract, workspace ownership, SOP authoring regression, completed immutability, clone version.

- [ ] Hapus dead modules dan test yang hanya menguji domain lama.
- [ ] Pastikan tidak ada import/reference aktif ke evaluation/TTE/OPD/role lama.
- [ ] Jalankan typecheck/build/unit tests yang relevan dan mandatory CI.
- [ ] Review diff khusus area editor/rendering untuk memastikan tidak ada behavioral rewrite.
