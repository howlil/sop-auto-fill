# Iteration 1 — MVP Vertical Slice Design

## Objective

Membuat satu executable product journey yang membuktikan hasil refactor Workspace dapat dipakai sebagai MVP nyata, bukan hanya lolos unit test. Journey harus menjalankan frontend, backend, dan database sungguhan untuk operasi bisnis utama.

## Product Journey

1. User memiliki authenticated session yang ekuivalen dengan hasil login Google.
2. User membuka `/workspaces`.
3. User membuat workspace.
4. User membuat SOP di workspace tersebut.
5. User mengisi data SOP dan perubahan tersimpan melalui mekanisme autosave existing.
6. Browser reload dan data yang disimpan tetap ada.
7. Flowchart dan BPMN dapat dirender dari data SOP yang tersimpan.
8. SOP dipindahkan ke `COMPLETED` dan menjadi immutable.
9. User memilih Create New Version; snapshot versi terakhir dicloning menjadi versi baru `DRAFT` yang editable.
10. Print/PDF path dapat dieksekusi dari SOP tersebut.

## Architecture Decision

### Production authentication

Production tetap menggunakan Google Identity Services -> `POST /auth/google` -> JWT HTTP-only cookie. Tidak ada endpoint test login atau bypass authentication di production API.

### E2E authentication

Live Google OAuth tidak digunakan oleh Playwright karena bergantung pada third-party UI/network dan membuat CI flaky. Sebagai gantinya, test harness server:

- membersihkan data milik deterministic E2E user;
- melakukan upsert `User` dengan `googleSub` test;
- menerbitkan JWT dengan payload dan secret yang sama seperti aplikasi;
- memberikan token ke Playwright global setup;
- Playwright menyimpan token sebagai cookie `accessToken` pada storage state.

Dengan demikian request setelah bootstrap tetap melewati JWT strategy, authorization, service, repository, Prisma, dan database yang sebenarnya.

## Test Data Isolation

Test harness hanya boleh membersihkan data milik deterministic E2E user. CI menggunakan database khusus E2E yang dibuat/reset sebelum journey. Production database tidak boleh menjadi target command ini.

Command E2E harus fail-fast apabila environment tidak menandakan test/E2E atau JWT/database config tidak lengkap.

## Playwright Surface

Legacy Playwright specs untuk OPD, evaluator, TTE, pengesahan, dan public archive tidak lagi menjadi acceptance suite karena domain tersebut sudah dihapus. Active acceptance surface Iteration 1 berfokus pada current Workspace/SOP product.

Selector harus mengutamakan accessible role/name atau stable test id bila benar-benar dibutuhkan; hindari selector berdasarkan struktur CSS.

## CI

Tambahkan job E2E terpisah yang:

1. menyediakan MySQL/MariaDB service;
2. install dependencies dan generate Prisma client;
3. membuat schema test dengan `prisma db push` pada database disposable;
4. menjalankan backend dengan environment E2E;
5. install Chromium Playwright;
6. menjalankan current MVP journey melalui Vite frontend;
7. menyimpan Playwright report/trace saat gagal.

Server/client typecheck, unit tests, dan build tetap mandatory dan tidak digantikan oleh E2E.

## Protected Core

Tidak ada behavioral rewrite pada editor SOP, Flowchart, BPMN, version clone, print, atau PDF hanya demi membuat test mudah. Jika E2E menemukan bug, perubahan production dibuat dengan TDD dan sesempit mungkin.

## Acceptance Evidence

Iteration selesai bila CI menunjukkan:

- server unit/typecheck/build green;
- client unit/typecheck/build green;
- current MVP Playwright journey green;
- completed SOP tidak dapat diedit langsung;
- new version merupakan DRAFT hasil clone;
- reload mempertahankan data yang diautosave;
- Flowchart/BPMN dan print/PDF path berhasil dieksekusi.
