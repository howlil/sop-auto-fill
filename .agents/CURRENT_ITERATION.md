# Current Iteration

- **Iteration:** `1-mvp-vertical-slice`
- **Status:** `COMPLETE`
- **Working branch:** `feat/mvp-vertical-slice`
- **Integration:** PR #3 pending final review and squash merge to `master`
- **Goal:** membuktikan satu alur MVP SOP dapat dijalankan end-to-end pada real frontend + real backend + test database tanpa bergantung pada live Google OAuth di CI.

## Execution Result

Vertical slice yang telah diverifikasi:

`authenticated session -> create workspace -> create pelaksana -> create SOP -> edit/autosave/reload -> Flowchart/BPMN -> print/PDF generation -> complete/read-only -> create new version DRAFT`

Fresh verification evidence sebelum iteration ditutup: GitHub Actions run #145 pada head `9c06a9482` menjalankan server, client, dan E2E; ketiga job selesai `success`.

## Constraints Preserved

- Production authentication tetap Google Identity Services dan endpoint `/auth/google`; tidak ada auth-bypass HTTP route untuk test.
- E2E memakai deterministic test user + JWT cookie yang dibuat oleh test harness/CLI dengan `JWT_SECRET` khusus environment test.
- Journey utama menggunakan real API dan disposable MySQL database; backend tidak di-mock di browser.
- Editor SOP, Flowchart, BPMN, PDF, dan versioning hanya diubah ketika E2E membuktikan blocker/regression nyata.
- Playwright acceptance surface aktif hanya menguji product Workspace/SOP saat ini; journey legacy OPD/evaluasi/TTE/public archive tidak lagi dijalankan oleh config aktif.
- Seluruh iteration dikerjakan di satu working branch `feat/mvp-vertical-slice`.

## Completion Evidence

1. Deterministic E2E bootstrap/session berjalan tanpa live Google OAuth.
2. MVP Playwright journey berjalan terhadap real frontend, backend, dan database.
3. Autosave/reload terbukti mempertahankan metadata dan prosedur SOP.
4. Flowchart dan BPMN dirender dari SOP bermakna dengan pelaksana dan tiga langkah valid.
5. PDF generation mencapai real blob print iframe; OS print dialog tidak dijadikan assertion karena Chromium headless tidak menyediakan lifecycle print yang deterministik.
6. SOP `COMPLETED` terbukti read-only dan hanya dapat diedit melalui Create New Version.
7. Create New Version terbukti meng-clone data menjadi versi `v2` berstatus editable `DRAFT`.
8. Server/client typecheck, unit tests, build, dan E2E gate semuanya hijau pada run #145.
9. Auth controller production hanya mengekspos Google login, `/auth/me`, dan logout; test harness tidak menambah endpoint auth production.

## Next Integration Step

PR #3 harus melewati final review tanpa blocker, lalu squash merge ke `master` dan master CI diverifikasi. Status iteration tetap `COMPLETE`; langkah tersebut adalah integrasi hasil iteration, bukan penambahan scope baru.
