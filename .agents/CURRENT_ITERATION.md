# Current Iteration

- **Iteration:** `1-mvp-vertical-slice`
- **Status:** `ACTIVE`
- **Working branch:** `feat/mvp-vertical-slice`
- **Goal:** membuktikan satu alur MVP SOP dapat dijalankan end-to-end pada real frontend + real backend + test database tanpa bergantung pada live Google OAuth di CI.

## Execution Lock

Iteration ini hanya mencakup vertical slice berikut:

`authenticated session -> create workspace -> create SOP -> edit/autosave/reload -> Flowchart/BPMN -> complete -> create new version -> print/PDF`

## Constraints

- Production authentication tetap Google Identity Services dan endpoint `/auth/google`; tidak boleh menambah auth-bypass HTTP route untuk test.
- E2E memakai deterministic test user + JWT cookie yang dibuat oleh test harness/CLI dengan `JWT_SECRET` khusus environment test.
- Gunakan real API dan real database untuk journey utama; jangan mock backend di browser.
- Jangan redesign editor SOP, Flowchart, BPMN, print, PDF, atau versioning kecuali E2E membuktikan bug nyata.
- Hapus atau nonaktifkan test Playwright legacy yang hanya menguji domain OPD/evaluasi/TTE/public archive yang sudah dihapus.
- Satu working branch untuk seluruh iteration task ini; follow-up tetap di branch yang sama.
- Merge menggunakan squash merge setelah mandatory CI + MVP E2E hijau dan tidak ada blocker.
- Jangan menambah feature di luar vertical slice ini.

## Completion Criteria

Iteration dapat ditandai `COMPLETE` hanya bila:

1. deterministic E2E bootstrap/session dapat dijalankan tanpa live Google;
2. MVP Playwright journey berjalan terhadap real frontend/backend/database;
3. autosave/reload, immutable `COMPLETED`, create-new-version clone, Flowchart/BPMN, dan print/PDF memiliki regression evidence;
4. server/client typecheck, unit tests, build, dan E2E mandatory CI hijau;
5. test legacy yang tidak lagi mewakili produk tidak menjadi bagian dari test surface aktif.
