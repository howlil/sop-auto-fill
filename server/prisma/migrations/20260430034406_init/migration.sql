-- CreateTable
CREATE TABLE `Pengguna` (
    `penggunaId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `opdId` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `kataSandi` VARCHAR(191) NOT NULL,
    `peran` ENUM('PJ_EVALUATOR', 'EVALUATOR', 'KEPALA_OPD', 'PJ_PENYUSUN', 'PENYUSUN') NOT NULL,
    `nip` VARCHAR(191) NOT NULL,
    `jabatan` VARCHAR(191) NOT NULL,
    `pangkat` VARCHAR(191) NOT NULL,
    `nohp` VARCHAR(191) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Pengguna_email_key`(`email`),
    UNIQUE INDEX `Pengguna_nip_key`(`nip`),
    PRIMARY KEY (`penggunaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OPD` (
    `opdId` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`opdId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RiwayatOpdPengguna` (
    `riwayatOpdPenggunaId` VARCHAR(191) NOT NULL,
    `penggunaId` VARCHAR(191) NOT NULL,
    `opdId` VARCHAR(191) NOT NULL,
    `mulaiPada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `berakhirPada` DATETIME(3) NULL,
    `alasan` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RiwayatOpdPengguna_penggunaId_mulaiPada_key`(`penggunaId`, `mulaiPada`),
    PRIMARY KEY (`riwayatOpdPenggunaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Peraturan` (
    `peraturanId` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `nomor` VARCHAR(191) NOT NULL,
    `tahun` INTEGER NOT NULL,
    `tentang` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Peraturan_nomor_tahun_key`(`nomor`, `tahun`),
    PRIMARY KEY (`peraturanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OPDPeraturan` (
    `opdId` VARCHAR(191) NOT NULL,
    `peraturanId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`opdId`, `peraturanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SOP` (
    `sopId` VARCHAR(191) NOT NULL,
    `opdId` VARCHAR(191) NOT NULL,
    `judul` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`sopId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DetailSOP` (
    `detailSopId` VARCHAR(191) NOT NULL,
    `sopId` VARCHAR(191) NOT NULL,
    `salinDariDetailSopId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SEDANG_DISUSUN', 'SIAP_DIEVALUASI', 'DIAJUKAN_EVALUASI', 'SEDANG_DIEVALUASI', 'REVISI_DARI_TIM_EVALUASI', 'SIAP_DIVERIFIKASI', 'DIVERIFIKASI_BIRO_ORGANISASI', 'BERLAKU', 'DIGANTIKAN', 'DICABUT') NOT NULL DEFAULT 'DRAFT',
    `versi` INTEGER NOT NULL DEFAULT 1,
    `nomorSOP` VARCHAR(191) NOT NULL,
    `tanggalPembuatan` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tanggalRevisi` DATETIME(3) NULL,
    `tanggalEfektif` DATETIME(3) NULL,
    `namaLembaga` TEXT NOT NULL,
    `lebarKolomKegiatan` INTEGER NULL,
    `lebarKolomPelaksana` INTEGER NULL,
    `lebarKolomKelengkapan` INTEGER NULL,
    `lebarKolomWaktu` INTEGER NULL,
    `lebarKolomOutput` INTEGER NULL,
    `lebarKolomKeterangan` INTEGER NULL,
    `dibuatOlehId` VARCHAR(191) NULL,
    `terakhirDieditOlehId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DetailSOP_nomorSOP_key`(`nomorSOP`),
    UNIQUE INDEX `DetailSOP_sopId_versi_key`(`sopId`, `versi`),
    PRIMARY KEY (`detailSopId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LampiranTeks` (
    `lampiranTeksId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `jenis` ENUM('PERINGATAN', 'KUALIFIKASI_PELAKSANAAN', 'PERALATAN', 'PENCATATAN_PENDATAAN') NOT NULL,
    `teks` TEXT NOT NULL,

    PRIMARY KEY (`lampiranTeksId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DasarHukum` (
    `detailSopId` VARCHAR(191) NOT NULL,
    `peraturanId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`detailSopId`, `peraturanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SopTerkait` (
    `detailSopId` VARCHAR(191) NOT NULL,
    `detailSopTerkaitId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`detailSopId`, `detailSopTerkaitId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LangkahSOP` (
    `langkahSopId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `kegiatan` TEXT NOT NULL,
    `jenis` ENUM('AWAL_AKHIR', 'KEGIATAN', 'KEPUTUSAN') NOT NULL DEFAULT 'KEGIATAN',
    `urutan` INTEGER NOT NULL,
    `kelengkapan` VARCHAR(191) NOT NULL,
    `keluaran` VARCHAR(191) NOT NULL,
    `waktu` INTEGER NOT NULL,
    `satuanWaktu` ENUM('m', 'h', 'd', 'w', 'mo', 'y') NOT NULL,
    `keterangan` TEXT NOT NULL,
    `pelaksanaId` VARCHAR(191) NOT NULL,
    `langkahSelanjutnyaYaId` VARCHAR(191) NULL,
    `langkahSelanjutnyaTidakId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LangkahSOP_detailSopId_urutan_key`(`detailSopId`, `urutan`),
    PRIMARY KEY (`langkahSopId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pelaksana` (
    `pelaksanaId` VARCHAR(191) NOT NULL,
    `opdId` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`pelaksanaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DetailSOPPelaksana` (
    `detailSopId` VARCHAR(191) NOT NULL,
    `pelaksanaId` VARCHAR(191) NOT NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`detailSopId`, `pelaksanaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TataLetakDiagram` (
    `tataLetakDiagramId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `jenis` ENUM('FLOWCHART', 'BPMN') NOT NULL,
    `versiLayout` INTEGER NOT NULL DEFAULT 1,
    `layoutSeed` INTEGER NOT NULL DEFAULT 0,
    `gayaPanah` ENUM('LURUS', 'SIKU') NULL,
    `langkahPerHalaman` INTEGER NULL DEFAULT 10,
    `lebarAreaKegiatan` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TataLetakDiagram_detailSopId_jenis_versiLayout_key`(`detailSopId`, `jenis`, `versiLayout`),
    PRIMARY KEY (`tataLetakDiagramId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PosisiNodeDiagram` (
    `tataLetakDiagramId` VARCHAR(191) NOT NULL,
    `langkahSopId` VARCHAR(191) NOT NULL,
    `page` INTEGER NOT NULL DEFAULT 1,
    `x` INTEGER NOT NULL,
    `y` INTEGER NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`tataLetakDiagramId`, `langkahSopId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SisiDiagram` (
    `sisiDiagramId` VARCHAR(191) NOT NULL,
    `tataLetakDiagramId` VARCHAR(191) NOT NULL,
    `dariLangkahId` VARCHAR(191) NOT NULL,
    `keLangkahId` VARCHAR(191) NOT NULL,
    `cabang` ENUM('UTAMA', 'YA', 'TIDAK') NOT NULL DEFAULT 'UTAMA',
    `labelTeks` VARCHAR(191) NULL,

    UNIQUE INDEX `SisiDiagram_tataLetakDiagramId_dariLangkahId_keLangkahId_cab_key`(`tataLetakDiagramId`, `dariLangkahId`, `keLangkahId`, `cabang`),
    PRIMARY KEY (`sisiDiagramId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TitikSisiDiagram` (
    `sisiDiagramId` VARCHAR(191) NOT NULL,
    `urutan` INTEGER NOT NULL,
    `x` INTEGER NOT NULL,
    `y` INTEGER NOT NULL,

    PRIMARY KEY (`sisiDiagramId`, `urutan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PengajuanEvaluasi` (
    `pengajuanEvaluasiId` VARCHAR(191) NOT NULL,
    `opdId` VARCHAR(191) NOT NULL,
    `jenis` ENUM('TERJADWAL', 'MANDIRI') NOT NULL,
    `status` ENUM('MENUNGGU_EVALUASI', 'SEDANG_DIEVALUASI', 'SELESAI_DIEVALUASI', 'DIVERIFIKASI_BIRO', 'DITANDATANGANI_KOORDINATOR', 'SELESAI') NOT NULL DEFAULT 'MENUNGGU_EVALUASI',
    `catatan` TEXT NULL,
    `nomorBA` VARCHAR(191) NULL,
    `tanggalPermintaan` DATETIME(3) NULL,
    `tanggalEvaluasi` DATETIME(3) NULL,
    `nilaiOPD` INTEGER NULL,
    `diverifikasiOlehUserId` VARCHAR(191) NULL,
    `ditandatanganiOlehKoordinatorUserId` VARCHAR(191) NULL,
    `tanggalTTDBaKoordinator` DATETIME(3) NULL,
    `diselesaikanOlehId` VARCHAR(191) NULL,
    `tanggalDiselesaikan` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`pengajuanEvaluasiId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NilaiEvaluasi` (
    `nilaiEvaluasiId` VARCHAR(191) NOT NULL,
    `pengajuanEvaluasiId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `hasil` ENUM('SESUAI', 'TIDAK_SESUAI') NULL,
    `catatan` TEXT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `dinilaiOlehId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NilaiEvaluasi_pengajuanEvaluasiId_detailSopId_key`(`pengajuanEvaluasiId`, `detailSopId`),
    PRIMARY KEY (`nilaiEvaluasiId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogNilaiEvaluasi` (
    `logNilaiEvaluasiId` VARCHAR(191) NOT NULL,
    `pengajuanEvaluasiId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `evaluatorId` VARCHAR(191) NOT NULL,
    `hasilSebelum` ENUM('SESUAI', 'TIDAK_SESUAI') NULL,
    `hasilSesudah` ENUM('SESUAI', 'TIDAK_SESUAI') NULL,
    `catatanSebelum` TEXT NULL,
    `catatanSesudah` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`logNilaiEvaluasiId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KredensialTTE` (
    `kredensialTteId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `hashPin` VARCHAR(191) NOT NULL,
    `emailTerverifikasi` BOOLEAN NOT NULL DEFAULT false,
    `tokenVerifikasi` VARCHAR(191) NULL,
    `tokenExpiry` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KredensialTTE_userId_key`(`userId`),
    PRIMARY KEY (`kredensialTteId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DokumenTte` (
    `dokumenTteId` VARCHAR(191) NOT NULL,
    `nomorDokumen` VARCHAR(191) NOT NULL,
    `jenisDokumen` VARCHAR(191) NOT NULL,
    `judulDokumen` VARCHAR(191) NOT NULL,
    `hashDokumen` VARCHAR(191) NOT NULL,
    `versiDokumen` INTEGER NOT NULL DEFAULT 1,
    `metodeKanonikalisasi` VARCHAR(191) NULL,
    `detailSopId` VARCHAR(191) NULL,
    `pengajuanEvaluasiId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DokumenTte_detailSopId_key`(`detailSopId`),
    UNIQUE INDEX `DokumenTte_pengajuanEvaluasiId_key`(`pengajuanEvaluasiId`),
    PRIMARY KEY (`dokumenTteId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RiwayatTandaTangan` (
    `riwayatTandaTanganId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `dokumenTteId` VARCHAR(191) NOT NULL,
    `peran` ENUM('PJ_EVALUATOR', 'EVALUATOR', 'KEPALA_OPD', 'PJ_PENYUSUN', 'PENYUSUN') NOT NULL,
    `signatureValue` LONGTEXT NULL,
    `signatureAlgorithm` VARCHAR(191) NULL,
    `signatureFormat` VARCHAR(191) NULL,
    `keyId` VARCHAR(191) NULL,
    `certSerialNumber` VARCHAR(191) NULL,
    `certIssuer` VARCHAR(191) NULL,
    `certSubject` VARCHAR(191) NULL,
    `certFingerprint` VARCHAR(191) NULL,
    `certValidFrom` DATETIME(3) NULL,
    `certValidTo` DATETIME(3) NULL,
    `ditandatanganiPada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RiwayatTandaTangan_dokumenTteId_peran_key`(`dokumenTteId`, `peran`),
    PRIMARY KEY (`riwayatTandaTanganId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogEditSOP` (
    `logEditSopId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `keterangan` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`logEditSopId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Komentar` (
    `komentarId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `isi` TEXT NOT NULL,
    `status` ENUM('TERBUKA', 'SELESAI') NOT NULL DEFAULT 'TERBUKA',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`komentarId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Pengguna` ADD CONSTRAINT `Pengguna_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiwayatOpdPengguna` ADD CONSTRAINT `RiwayatOpdPengguna_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiwayatOpdPengguna` ADD CONSTRAINT `RiwayatOpdPengguna_penggunaId_fkey` FOREIGN KEY (`penggunaId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OPDPeraturan` ADD CONSTRAINT `OPDPeraturan_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OPDPeraturan` ADD CONSTRAINT `OPDPeraturan_peraturanId_fkey` FOREIGN KEY (`peraturanId`) REFERENCES `Peraturan`(`peraturanId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SOP` ADD CONSTRAINT `SOP_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_dibuatOlehId_fkey` FOREIGN KEY (`dibuatOlehId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_salinDariDetailSopId_fkey` FOREIGN KEY (`salinDariDetailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_sopId_fkey` FOREIGN KEY (`sopId`) REFERENCES `SOP`(`sopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_terakhirDieditOlehId_fkey` FOREIGN KEY (`terakhirDieditOlehId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LampiranTeks` ADD CONSTRAINT `LampiranTeks_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DasarHukum` ADD CONSTRAINT `DasarHukum_peraturanId_fkey` FOREIGN KEY (`peraturanId`) REFERENCES `Peraturan`(`peraturanId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DasarHukum` ADD CONSTRAINT `DasarHukum_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SopTerkait` ADD CONSTRAINT `SopTerkait_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SopTerkait` ADD CONSTRAINT `SopTerkait_detailSopTerkaitId_fkey` FOREIGN KEY (`detailSopTerkaitId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LangkahSOP` ADD CONSTRAINT `LangkahSOP_langkahSelanjutnyaTidakId_fkey` FOREIGN KEY (`langkahSelanjutnyaTidakId`) REFERENCES `LangkahSOP`(`langkahSopId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LangkahSOP` ADD CONSTRAINT `LangkahSOP_langkahSelanjutnyaYaId_fkey` FOREIGN KEY (`langkahSelanjutnyaYaId`) REFERENCES `LangkahSOP`(`langkahSopId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LangkahSOP` ADD CONSTRAINT `LangkahSOP_pelaksanaId_fkey` FOREIGN KEY (`pelaksanaId`) REFERENCES `Pelaksana`(`pelaksanaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LangkahSOP` ADD CONSTRAINT `LangkahSOP_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pelaksana` ADD CONSTRAINT `Pelaksana_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOPPelaksana` ADD CONSTRAINT `DetailSOPPelaksana_pelaksanaId_fkey` FOREIGN KEY (`pelaksanaId`) REFERENCES `Pelaksana`(`pelaksanaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOPPelaksana` ADD CONSTRAINT `DetailSOPPelaksana_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TataLetakDiagram` ADD CONSTRAINT `TataLetakDiagram_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosisiNodeDiagram` ADD CONSTRAINT `PosisiNodeDiagram_tataLetakDiagramId_fkey` FOREIGN KEY (`tataLetakDiagramId`) REFERENCES `TataLetakDiagram`(`tataLetakDiagramId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PosisiNodeDiagram` ADD CONSTRAINT `PosisiNodeDiagram_langkahSopId_fkey` FOREIGN KEY (`langkahSopId`) REFERENCES `LangkahSOP`(`langkahSopId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SisiDiagram` ADD CONSTRAINT `SisiDiagram_dariLangkahId_fkey` FOREIGN KEY (`dariLangkahId`) REFERENCES `LangkahSOP`(`langkahSopId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SisiDiagram` ADD CONSTRAINT `SisiDiagram_tataLetakDiagramId_fkey` FOREIGN KEY (`tataLetakDiagramId`) REFERENCES `TataLetakDiagram`(`tataLetakDiagramId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SisiDiagram` ADD CONSTRAINT `SisiDiagram_keLangkahId_fkey` FOREIGN KEY (`keLangkahId`) REFERENCES `LangkahSOP`(`langkahSopId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TitikSisiDiagram` ADD CONSTRAINT `TitikSisiDiagram_sisiDiagramId_fkey` FOREIGN KEY (`sisiDiagramId`) REFERENCES `SisiDiagram`(`sisiDiagramId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PengajuanEvaluasi` ADD CONSTRAINT `PengajuanEvaluasi_diselesaikanOlehId_fkey` FOREIGN KEY (`diselesaikanOlehId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PengajuanEvaluasi` ADD CONSTRAINT `PengajuanEvaluasi_ditandatanganiOlehKoordinatorUserId_fkey` FOREIGN KEY (`ditandatanganiOlehKoordinatorUserId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PengajuanEvaluasi` ADD CONSTRAINT `PengajuanEvaluasi_diverifikasiOlehUserId_fkey` FOREIGN KEY (`diverifikasiOlehUserId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PengajuanEvaluasi` ADD CONSTRAINT `PengajuanEvaluasi_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NilaiEvaluasi` ADD CONSTRAINT `NilaiEvaluasi_dinilaiOlehId_fkey` FOREIGN KEY (`dinilaiOlehId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NilaiEvaluasi` ADD CONSTRAINT `NilaiEvaluasi_pengajuanEvaluasiId_fkey` FOREIGN KEY (`pengajuanEvaluasiId`) REFERENCES `PengajuanEvaluasi`(`pengajuanEvaluasiId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NilaiEvaluasi` ADD CONSTRAINT `NilaiEvaluasi_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogNilaiEvaluasi` ADD CONSTRAINT `LogNilaiEvaluasi_evaluatorId_fkey` FOREIGN KEY (`evaluatorId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogNilaiEvaluasi` ADD CONSTRAINT `LogNilaiEvaluasi_pengajuanEvaluasiId_fkey` FOREIGN KEY (`pengajuanEvaluasiId`) REFERENCES `PengajuanEvaluasi`(`pengajuanEvaluasiId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KredensialTTE` ADD CONSTRAINT `KredensialTTE_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DokumenTte` ADD CONSTRAINT `DokumenTte_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DokumenTte` ADD CONSTRAINT `DokumenTte_pengajuanEvaluasiId_fkey` FOREIGN KEY (`pengajuanEvaluasiId`) REFERENCES `PengajuanEvaluasi`(`pengajuanEvaluasiId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiwayatTandaTangan` ADD CONSTRAINT `RiwayatTandaTangan_dokumenTteId_fkey` FOREIGN KEY (`dokumenTteId`) REFERENCES `DokumenTte`(`dokumenTteId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiwayatTandaTangan` ADD CONSTRAINT `RiwayatTandaTangan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogEditSOP` ADD CONSTRAINT `LogEditSOP_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogEditSOP` ADD CONSTRAINT `LogEditSOP_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Komentar` ADD CONSTRAINT `Komentar_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Komentar` ADD CONSTRAINT `Komentar_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;
