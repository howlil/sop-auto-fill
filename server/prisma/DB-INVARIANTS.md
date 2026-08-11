# Invariant Database dan Transisi Status

Dokumen ini merangkum aturan bisnis yang tidak cukup dijelaskan oleh foreign key biasa. Sebagian aturan dikunci oleh trigger/migration database, sebagian oleh service transaction, dan sebagian menjadi kontrak domain untuk laporan tugas akhir.

## Sumber Kebenaran OPD Aktif Pengguna

`Pengguna.opdId` adalah sumber kebenaran OPD aktif pengguna.

`RiwayatOpdPengguna` menyimpan histori pasangan pengguna dan OPD. Field `isAktif` hanya penanda tampilan riwayat yang disinkronkan oleh service:

- Saat pengguna dibuat, service membuat riwayat OPD aktif sesuai `Pengguna.opdId`.
- Saat pengguna pindah OPD, service mengubah `Pengguna.opdId`, menonaktifkan seluruh riwayat OPD pengguna, lalu mengaktifkan baris riwayat OPD tujuan.
- Jika terjadi perbedaan, aplikasi harus mempercayai `Pengguna.opdId` dan memperbaiki `RiwayatOpdPengguna.isAktif`.

## Transisi Status DetailSOP

Transisi manual lewat endpoint status hanya memperbolehkan:

- `DRAFT`, `SEDANG_DISUSUN`, atau `REVISI_DARI_EVALUATOR` ke `MENUNGGU_PENGAJUAN_EVALUASI` oleh `PENYUSUN` atau `PJ_PENYUSUN`.
- `MENUNGGU_PENGAJUAN_EVALUASI` ke `DIAJUKAN_EVALUASI` oleh `PJ_PENYUSUN`.
- `BERLAKU` ke `DICABUT` oleh `KEPALA_OPD`.

Transisi lain dikendalikan oleh proses evaluasi dan TTE:

- Saat pengajuan evaluasi dibuat, `DetailSOP.MENUNGGU_PENGAJUAN_EVALUASI` berubah menjadi `SEDANG_DIEVALUASI`.
- Jika evaluator memberi `PERLU_PERBAIKAN`, `DetailSOP` berubah menjadi `REVISI_DARI_EVALUATOR`.
- Jika evaluator menolak pengajuan, seluruh `DetailSOP` di dalamnya berubah menjadi `DITOLAK_EVALUATOR`. Status ini terminal: versi lama tidak dapat diedit atau diajukan ulang, tetapi dapat dijadikan sumber versi baru.
- Jika seluruh nilai evaluasi `SESUAI`, `DetailSOP` berubah menjadi `MENUNGGU_TTD_PJ_EVALUATOR`.
- Setelah BA ditandatangani `PJ_PENYUSUN`, `DetailSOP` berubah menjadi `DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI`.
- `DetailSOP.BERLAKU` hanya boleh terjadi melalui TTE `KEPALA_OPD`; service menghitung satu tanggal efektif kalender WIB, menempelkannya ke PDF sebelum tanda tangan digital, memakai objek tanggal yang sama untuk `DetailSOP.tanggalEfektif`, membuat `DokumenTte` jenis `SOP_BERLAKU`, mencatat `RiwayatTandaTangan`, dan mengganti versi lama yang `BERLAKU` menjadi `DIGANTIKAN`.

Database juga menjaga maksimal satu `DetailSOP.BERLAKU` per `SOP`.

## Transisi Status PengajuanEvaluasi

Alur status pengajuan evaluasi:

- `SEDANG_DIEVALUASI`: evaluator mengisi nilai per SOP.
- `DITOLAK`: penolakan final oleh evaluator; semua nilai menjadi `DITOLAK`, semua versi SOP menjadi `DITOLAK_EVALUATOR`, dan pengajuan tidak dapat dibuka kembali.
- `SELESAI_DIEVALUASI`: hanya boleh jika seluruh `NilaiEvaluasi.hasil = SESUAI`; untuk pengajuan `EVALUASI_REQUEST_EVALUATOR`, `nilaiOPD` wajib 1 sampai 5.
- `DITANDATANGANI_PJ_EVALUATOR`: terjadi setelah BA ditandatangani `PJ_EVALUATOR`.
- `DITANDATANGANI_PJ_PENYUSUN`: terjadi setelah BA ditandatangani `PJ_PENYUSUN`.
- `SELESAI`: terjadi setelah `KEPALA_OPD` menandatangani semua SOP dalam pengajuan.

Service memakai optimistic locking melalui `PengajuanEvaluasi.version` saat mutasi status.

## Invariant NilaiEvaluasi dan Tindak Lanjut

- `NilaiEvaluasi.hasil = PERLU_PERBAIKAN` wajib memiliki `catatan` tidak kosong.
- `NilaiEvaluasi.hasil = DITOLAK` hanya dapat ditetapkan oleh aksi penolakan tingkat pengajuan dan tidak memiliki tindak lanjut pada versi yang sama.
- Saat hasil menjadi `PERLU_PERBAIKAN`, `statusTindakLanjut` wajib `TERBUKA`, sedangkan `ditindaklanjutiPada` dan `ditindaklanjutiOlehId` dikosongkan.
- Penyusun atau PJ Penyusun hanya boleh menandai tindak lanjut `SELESAI` jika `hasil = PERLU_PERBAIKAN`, `statusTindakLanjut = TERBUKA`, dan `DetailSOP` sedang `REVISI_DARI_EVALUATOR`.
- Pengajuan hanya boleh diselesaikan evaluator jika seluruh hasil sudah `SESUAI`.
- `LogNilaiEvaluasi` mencatat perubahan hasil, catatan, dan status tindak lanjut.

## Invariant OPD Pengajuan dan SOP

Semua `NilaiEvaluasi.detailSopId` dalam satu `PengajuanEvaluasi` harus berasal dari OPD yang sama dengan `PengajuanEvaluasi.opdId`.

Aturan ini dijaga oleh service saat pengajuan dibuat:

- Detail SOP wajib ditemukan pada OPD pengguna/pengajuan.
- Detail SOP wajib berada pada status `MENUNGGU_PENGAJUAN_EVALUASI`.
- Satu OPD tidak boleh punya lebih dari satu pengajuan aktif lintas jobdesk.

## Invariant Pelaksana dan Langkah SOP

- `Pelaksana` unik per OPD berdasarkan pasangan `(opdId, nama)`.
- `DetailSOPPelaksana.pelaksanaId` harus berasal dari OPD yang sama dengan SOP pemilik `detailSopId`.
- `LangkahSOP.pelaksanaId` harus berasal dari OPD yang sama dengan SOP pemilik `detailSopId`.
- `LangkahSOP.langkahSelanjutnyaYaId` dan `langkahSelanjutnyaTidakId`, jika terisi, harus menunjuk langkah pada `DetailSOP` yang sama.
- Untuk payload prosedur, service memastikan `KEPUTUSAN` hanya menerima cabang Ya/Tidak yang merujuk langkah dikenal, sedangkan non-keputusan tidak memakai cabang.

## Invariant SopTerkait

`SopTerkait` tidak boleh menunjuk dirinya sendiri. Relasi dua arah diperbolehkan karena UI memperlakukan keterkaitan SOP sebagai informasi yang bisa dimasukkan dari kedua sisi.

## Invariant DokumenTte dan Tanda Tangan

- `DokumenTte` wajib memiliki tepat satu parent: `detailSopId` atau `pengajuanEvaluasiId`.
- `DokumenTte.nomorDokumen` unik global.
- `PengajuanEvaluasi.nomorBA` unik global saat terisi; nilai `NULL` diperbolehkan untuk pengajuan yang belum memiliki BA.
- Satu dokumen hanya boleh memiliki satu tanda tangan per peran melalui unique `(dokumenTteId, peran)`.
- `RiwayatTandaTangan.peran` adalah snapshot peran saat tanda tangan.
- `DokumenTte.judulDokumen`, `nomorDokumen`, dan `hashDokumen` adalah snapshot legal dokumen saat legalisasi.
