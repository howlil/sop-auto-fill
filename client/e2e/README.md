# Playwright System Test Suite

Suite Playwright SOPFlow dipisahkan menjadi dua lapisan agar istilah dan coverage tidak menyesatkan:

1. **Functional system tests** — menguji fitur/aturan secara terisolasi: autentikasi, RBAC, CRUD, authoring, validasi, filter, TTE, arsip, PDF, concurrency, dan sebagainya.
2. **End-to-End Business Journeys** — tujuh alur bisnis lintas aktor/modul yang menguji state transition dan outcome utama melalui browser.

## End-to-End Business Journeys

| ID | Journey | Outcome/invariant utama |
|---|---|---|
| `J01` | Happy Path | SOP siap → diajukan → SESUAI → BA → TTE → pengesahan → `BERLAKU` → arsip publik |
| `J02` | Revision Loop | `PERLU_PERBAIKAN` → catatan → revisi → tindak lanjut selesai → kirim ulang → SESUAI |
| `J03` | Final Rejection | Pengajuan `DITOLAK`; versi lama terkunci; penyusun wajib membuat versi baru |
| `J04` | Mixed Multi-SOP | Pengajuan tidak boleh selesai selama salah satu SOP masih perlu perbaikan |
| `J05` | Version Replacement | Versi baru `BERLAKU`; versi lama atomik menjadi `DIGANTIKAN` |
| `J06` | Revocation | SOP `DICABUT` dan tidak lagi muncul pada arsip publik aktif |
| `J07` | Public Document Integrity | Arsip publik, verifikasi pengesahan TTE, dan verifikasi signature PDF konsisten |

Implementasi berada di `e2e/journeys/`.

### Boundary penting

Business journey **tidak mengulang semua input CRUD/form**. Data yang bukan objek pengujian journey boleh dibentuk melalui API sebagai precondition. Contoh: J01 dimulai dari SOP yang sudah lengkap dan berstatus siap diajukan karena editor SOP diuji tersendiri pada functional system tests.

Aturannya:

- aksi bisnis yang sedang diklaim oleh journey dilakukan melalui UI/browser;
- mutation API hanya boleh digunakan pada `support/business-preconditions.ts` untuk membentuk state awal atau melewati flow yang sudah dibuktikan oleh journey lain;
- postcondition boleh dibaca melalui API pada `support/business-audit.ts` untuk memverifikasi invariant server;
- setiap role pada journey memakai `BrowserContext` terpisah melalui `fixtures/business-test.ts`;
- setiap test menggunakan data unik dan harus dapat dijalankan sendiri pada database test yang dapat di-reset;
- `scenario-traceability.spec.ts` adalah meta/legacy mapping test, **bukan** bukti bahwa suatu business journey sudah dieksekusi.

`pnpm test:e2e:audit` menjaga kontrak arsitektur tersebut dan dijalankan oleh CI.

## Menjalankan

Backend test harus tersedia di port 3000. Dari folder `client`:

```powershell
pnpm test:e2e:install
pnpm test:e2e:critical
```

`test:e2e:critical` hanya menjalankan J01–J07 pada Chromium setelah audit statis.

Functional system regression:

```powershell
pnpm test:e2e:functional
```

Seluruh suite Chromium:

```powershell
pnpm test:e2e:all
```

Seluruh browser yang dikonfigurasi:

```powershell
pnpm test:e2e:all-browsers
```

Mode interaktif:

```powershell
pnpm test:e2e:ui
```

## Environment Variable

| Variable | Default |
|---|---|
| `E2E_BASE_URL` | `http://127.0.0.1:5173` |
| `E2E_API_BASE_URL` | `http://127.0.0.1:3000/api/v1` |
| `E2E_BROWSER_API_BASE_URL` | API URL dengan host `localhost` |
| `E2E_API_HEALTH_URL` | `http://127.0.0.1:3000/api/health` |
| `E2E_SEED_PASSWORD` | `@Password123:)` |
| `E2E_SKIP_WEB_SERVER` | `false` |
| `E2E_ALL_BROWSERS` | `false` |
| `E2E_SEED` | `false` |
| `E2E_TTE_PIN` | mengikuti fixture E2E |
| `E2E_TEST_RUN_ID` | generated per run |

Credential role dapat dioverride melalui:

```text
E2E_PJ_EVALUATOR_EMAIL
E2E_PJ_EVALUATOR_PASSWORD
E2E_EVALUATOR_EMAIL
E2E_EVALUATOR_PASSWORD
E2E_KEPALA_OPD_EMAIL
E2E_KEPALA_OPD_PASSWORD
E2E_PJ_PENYUSUN_EMAIL
E2E_PJ_PENYUSUN_PASSWORD
E2E_PENYUSUN_EMAIL
E2E_PENYUSUN_PASSWORD
```

## Struktur

```text
e2e/
  journeys/
    evaluation-lifecycle.spec.ts   # J01-J04
    sop-lifecycle.spec.ts          # J05-J06
    public-integrity.spec.ts       # J07
  fixtures/
    business-test.ts               # isolated browser context per role
    users.ts
  support/
    business-actions.ts            # browser-visible business actions
    business-audit.ts              # read-only server invariant assertions
    business-preconditions.ts      # mutation API only for setup/boundaries
    ...
  *.spec.ts                        # functional/system regression tests
```

Dokumen desain dan audit journey ada di `docs/e2e-business-journeys.md`.
