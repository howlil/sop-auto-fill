-- DropForeignKey
ALTER TABLE `Pengguna` DROP FOREIGN KEY `Pengguna_opdId_fkey`;

-- DropForeignKey
ALTER TABLE `RiwayatOpdPengguna` DROP FOREIGN KEY `RiwayatOpdPengguna_opdId_fkey`;

-- DropForeignKey
ALTER TABLE `RiwayatOpdPengguna` DROP FOREIGN KEY `RiwayatOpdPengguna_penggunaId_fkey`;

-- DropForeignKey
ALTER TABLE `Peraturan` DROP FOREIGN KEY `Peraturan_lastEditedById_fkey`;

-- DropForeignKey
ALTER TABLE `OPDPeraturan` DROP FOREIGN KEY `OPDPeraturan_opdId_fkey`;

-- DropForeignKey
ALTER TABLE `OPDPeraturan` DROP FOREIGN KEY `OPDPeraturan_peraturanId_fkey`;

-- DropForeignKey
ALTER TABLE `SOP` DROP FOREIGN KEY `SOP_opdId_fkey`;

-- DropForeignKey
ALTER TABLE `DetailSOP` DROP FOREIGN KEY `DetailSOP_revisiDariDetailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `DetailSOP` DROP FOREIGN KEY `DetailSOP_dibuatOlehId_fkey`;

-- DropForeignKey
ALTER TABLE `DetailSOP` DROP FOREIGN KEY `DetailSOP_sopId_fkey`;

-- DropForeignKey
ALTER TABLE `DetailSOP` DROP FOREIGN KEY `DetailSOP_terakhirDieditOlehId_fkey`;

-- DropForeignKey
ALTER TABLE `LampiranPeringatan` DROP FOREIGN KEY `LampiranPeringatan_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `LampiranKualifikasiPelaksanaan` DROP FOREIGN KEY `LampiranKualifikasiPelaksanaan_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `LampiranPeralatanPerlengkapan` DROP FOREIGN KEY `LampiranPeralatanPerlengkapan_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `LampiranPencatatanPendataan` DROP FOREIGN KEY `LampiranPencatatanPendataan_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `DasarHukum` DROP FOREIGN KEY `DasarHukum_peraturanId_fkey`;

-- DropForeignKey
ALTER TABLE `DasarHukum` DROP FOREIGN KEY `DasarHukum_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `SopTerkait` DROP FOREIGN KEY `SopTerkait_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `SopTerkait` DROP FOREIGN KEY `SopTerkait_detailSopTerkaitId_fkey`;

-- DropForeignKey
ALTER TABLE `LangkahSOP` DROP FOREIGN KEY `LangkahSOP_langkahSelanjutnyaTidakId_fkey`;

-- DropForeignKey
ALTER TABLE `LangkahSOP` DROP FOREIGN KEY `LangkahSOP_langkahSelanjutnyaYaId_fkey`;

-- DropForeignKey
ALTER TABLE `LangkahSOP` DROP FOREIGN KEY `LangkahSOP_pelaksanaId_fkey`;

-- DropForeignKey
ALTER TABLE `LangkahSOP` DROP FOREIGN KEY `LangkahSOP_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `Pelaksana` DROP FOREIGN KEY `Pelaksana_opdId_fkey`;

-- DropForeignKey
ALTER TABLE `DetailSOPPelaksana` DROP FOREIGN KEY `DetailSOPPelaksana_pelaksanaId_fkey`;

-- DropForeignKey
ALTER TABLE `DetailSOPPelaksana` DROP FOREIGN KEY `DetailSOPPelaksana_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `LogEditSOP` DROP FOREIGN KEY `LogEditSOP_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `LogEditSOP` DROP FOREIGN KEY `LogEditSOP_penggunaId_fkey`;

-- DropForeignKey
ALTER TABLE `LogEditSopDomainField` DROP FOREIGN KEY `LogEditSopDomainField_detailSopId_penggunaId_logCreatedAt_fkey`;

-- DropForeignKey
ALTER TABLE `PengajuanEvaluasi` DROP FOREIGN KEY `PengajuanEvaluasi_diselesaikanOlehId_fkey`;

-- DropForeignKey
ALTER TABLE `PengajuanEvaluasi` DROP FOREIGN KEY `PengajuanEvaluasi_ditandatanganiOlehPjPenyusunUserId_fkey`;

-- DropForeignKey
ALTER TABLE `PengajuanEvaluasi` DROP FOREIGN KEY `PengajuanEvaluasi_diverifikasiOlehUserId_fkey`;

-- DropForeignKey
ALTER TABLE `PengajuanEvaluasi` DROP FOREIGN KEY `PengajuanEvaluasi_opdId_fkey`;

-- DropForeignKey
ALTER TABLE `NilaiEvaluasi` DROP FOREIGN KEY `NilaiEvaluasi_dinilaiOlehId_fkey`;

-- DropForeignKey
ALTER TABLE `NilaiEvaluasi` DROP FOREIGN KEY `NilaiEvaluasi_ditindaklanjutiOlehId_fkey`;

-- DropForeignKey
ALTER TABLE `NilaiEvaluasi` DROP FOREIGN KEY `NilaiEvaluasi_pengajuanEvaluasiId_fkey`;

-- DropForeignKey
ALTER TABLE `NilaiEvaluasi` DROP FOREIGN KEY `NilaiEvaluasi_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `LogNilaiEvaluasi` DROP FOREIGN KEY `LogNilaiEvaluasi_penggunaId_fkey`;

-- DropForeignKey
ALTER TABLE `LogNilaiEvaluasi` DROP FOREIGN KEY `LogNilaiEvaluasi_pengajuanEvaluasiId_fkey`;

-- DropForeignKey
ALTER TABLE `LogNilaiEvaluasi` DROP FOREIGN KEY `LogNilaiEvaluasi_pengajuanEvaluasiId_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `DokumenTte` DROP FOREIGN KEY `DokumenTte_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `DokumenTte` DROP FOREIGN KEY `DokumenTte_pengajuanEvaluasiId_fkey`;

-- DropForeignKey
ALTER TABLE `RiwayatTandaTangan` DROP FOREIGN KEY `RiwayatTandaTangan_dokumenTteId_fkey`;

-- DropForeignKey
ALTER TABLE `RiwayatTandaTangan` DROP FOREIGN KEY `RiwayatTandaTangan_userId_fkey`;

-- DropForeignKey
ALTER TABLE `KonfigurasiDiagramSOP` DROP FOREIGN KEY `KonfigurasiDiagramSOP_detailSopId_fkey`;

-- DropForeignKey
ALTER TABLE `OverridePanahDiagramSOP` DROP FOREIGN KEY `OverridePanahDiagramSOP_detailSopId_jenis_fkey`;

-- DropForeignKey
ALTER TABLE `OverridePanahDiagramSOP` DROP FOREIGN KEY `OverridePanahDiagramSOP_dariLangkahSopId_fkey`;

-- DropForeignKey
ALTER TABLE `OverridePanahDiagramSOP` DROP FOREIGN KEY `OverridePanahDiagramSOP_keLangkahSopId_fkey`;

-- DropForeignKey
ALTER TABLE `TitikTekukPanahDiagramSOP` DROP FOREIGN KEY `TitikTekukPanahDiagramSOP_detailSopId_jenis_dariLangkahSopI_fkey`;

-- DropForeignKey
ALTER TABLE `OverrideLabelDiagramSOP` DROP FOREIGN KEY `OverrideLabelDiagramSOP_detailSopId_jenis_fkey`;

-- AlterTable
ALTER TABLE `Pengguna` DROP PRIMARY KEY,
    MODIFY `penggunaId` CHAR(36) NOT NULL,
    MODIFY `email` VARCHAR(255) NOT NULL,
    MODIFY `opdId` CHAR(36) NOT NULL,
    MODIFY `nama` VARCHAR(255) NOT NULL,
    MODIFY `kataSandi` VARCHAR(60) NOT NULL,
    MODIFY `nip` VARCHAR(32) NOT NULL,
    MODIFY `jabatan` VARCHAR(255) NOT NULL,
    MODIFY `pangkat` VARCHAR(64) NOT NULL,
    MODIFY `nohp` VARCHAR(32) NOT NULL,
    MODIFY `refreshTokenHash` VARCHAR(60) NULL,
    MODIFY `ttePinHash` VARCHAR(60) NULL,
    MODIFY `tteP12PassphraseEncrypted` VARCHAR(255) NULL,
    ADD PRIMARY KEY (`penggunaId`);

-- AlterTable
ALTER TABLE `OPD` DROP PRIMARY KEY,
    MODIFY `opdId` CHAR(36) NOT NULL,
    MODIFY `nama` VARCHAR(255) NOT NULL,
    ADD PRIMARY KEY (`opdId`);

-- AlterTable
ALTER TABLE `RiwayatOpdPengguna` DROP PRIMARY KEY,
    MODIFY `penggunaId` CHAR(36) NOT NULL,
    MODIFY `opdId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`penggunaId`, `opdId`);

-- AlterTable
ALTER TABLE `Peraturan` DROP PRIMARY KEY,
    MODIFY `peraturanId` CHAR(36) NOT NULL,
    MODIFY `nama` VARCHAR(500) NOT NULL,
    MODIFY `nomor` VARCHAR(255) NOT NULL,
    MODIFY `tentang` VARCHAR(2000) NOT NULL,
    MODIFY `lastEditedById` CHAR(36) NULL,
    ADD PRIMARY KEY (`peraturanId`);

-- AlterTable
ALTER TABLE `OPDPeraturan` DROP PRIMARY KEY,
    MODIFY `opdId` CHAR(36) NOT NULL,
    MODIFY `peraturanId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`opdId`, `peraturanId`);

-- AlterTable
ALTER TABLE `SOP` DROP PRIMARY KEY,
    MODIFY `sopId` CHAR(36) NOT NULL,
    MODIFY `opdId` CHAR(36) NOT NULL,
    MODIFY `judul` VARCHAR(500) NOT NULL,
    ADD PRIMARY KEY (`sopId`);

-- AlterTable
ALTER TABLE `DetailSOP` DROP PRIMARY KEY,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `sopId` CHAR(36) NOT NULL,
    MODIFY `nomorSOP` VARCHAR(255) NOT NULL,
    MODIFY `namaLembaga` VARCHAR(2000) NOT NULL,
    MODIFY `dibuatOlehId` CHAR(36) NULL,
    MODIFY `terakhirDieditOlehId` CHAR(36) NULL,
    MODIFY `revisiDariDetailSopId` CHAR(36) NULL,
    ADD PRIMARY KEY (`detailSopId`);

-- AlterTable
ALTER TABLE `LampiranPeringatan` DROP PRIMARY KEY,
    MODIFY `lampiranPeringatanId` CHAR(36) NOT NULL,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`lampiranPeringatanId`);

-- AlterTable
ALTER TABLE `LampiranKualifikasiPelaksanaan` DROP PRIMARY KEY,
    MODIFY `lampiranKualifikasiPelaksanaanId` CHAR(36) NOT NULL,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`lampiranKualifikasiPelaksanaanId`);

-- AlterTable
ALTER TABLE `LampiranPeralatanPerlengkapan` DROP PRIMARY KEY,
    MODIFY `lampiranPeralatanPerlengkapanId` CHAR(36) NOT NULL,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`lampiranPeralatanPerlengkapanId`);

-- AlterTable
ALTER TABLE `LampiranPencatatanPendataan` DROP PRIMARY KEY,
    MODIFY `lampiranPencatatanPendataanId` CHAR(36) NOT NULL,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`lampiranPencatatanPendataanId`);

-- AlterTable
ALTER TABLE `DasarHukum` DROP PRIMARY KEY,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `peraturanId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`detailSopId`, `peraturanId`);

-- AlterTable
ALTER TABLE `SopTerkait` DROP PRIMARY KEY,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `detailSopTerkaitId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`detailSopId`, `detailSopTerkaitId`);

-- AlterTable
ALTER TABLE `LangkahSOP` DROP PRIMARY KEY,
    MODIFY `langkahSopId` CHAR(36) NOT NULL,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `kegiatan` VARCHAR(2000) NOT NULL,
    MODIFY `kelengkapan` VARCHAR(2000) NOT NULL,
    MODIFY `keluaran` VARCHAR(2000) NOT NULL,
    MODIFY `keterangan` VARCHAR(2000) NOT NULL,
    MODIFY `pelaksanaId` CHAR(36) NOT NULL,
    MODIFY `langkahSelanjutnyaYaId` CHAR(36) NULL,
    MODIFY `langkahSelanjutnyaTidakId` CHAR(36) NULL,
    ADD PRIMARY KEY (`langkahSopId`);

-- AlterTable
ALTER TABLE `Pelaksana` DROP PRIMARY KEY,
    MODIFY `pelaksanaId` CHAR(36) NOT NULL,
    MODIFY `opdId` CHAR(36) NOT NULL,
    MODIFY `nama` VARCHAR(255) NOT NULL,
    ADD PRIMARY KEY (`pelaksanaId`);

-- AlterTable
ALTER TABLE `DetailSOPPelaksana` DROP PRIMARY KEY,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `pelaksanaId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`detailSopId`, `pelaksanaId`);

-- AlterTable
ALTER TABLE `LogEditSOP` DROP PRIMARY KEY,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `penggunaId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`detailSopId`, `penggunaId`, `createdAt`);

-- AlterTable
ALTER TABLE `LogEditSopDomainField` DROP PRIMARY KEY,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `penggunaId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`detailSopId`, `penggunaId`, `logCreatedAt`, `domainField`);

-- AlterTable
ALTER TABLE `PengajuanEvaluasi` DROP PRIMARY KEY,
    MODIFY `pengajuanEvaluasiId` CHAR(36) NOT NULL,
    MODIFY `opdId` CHAR(36) NOT NULL,
    MODIFY `nomorBA` VARCHAR(255) NULL,
    MODIFY `diverifikasiOlehUserId` CHAR(36) NULL,
    MODIFY `ditandatanganiOlehPjPenyusunUserId` CHAR(36) NULL,
    MODIFY `diselesaikanOlehId` CHAR(36) NULL,
    ADD PRIMARY KEY (`pengajuanEvaluasiId`);

-- AlterTable
ALTER TABLE `NilaiEvaluasi` DROP PRIMARY KEY,
    MODIFY `pengajuanEvaluasiId` CHAR(36) NOT NULL,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `ditindaklanjutiOlehId` CHAR(36) NULL,
    MODIFY `dinilaiOlehId` CHAR(36) NULL,
    ADD PRIMARY KEY (`pengajuanEvaluasiId`, `detailSopId`);

-- AlterTable
ALTER TABLE `LogNilaiEvaluasi` DROP PRIMARY KEY,
    MODIFY `pengajuanEvaluasiId` CHAR(36) NOT NULL,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `penggunaId` CHAR(36) NOT NULL,
    MODIFY `ditindaklanjutiOlehId` CHAR(36) NULL,
    ADD PRIMARY KEY (`pengajuanEvaluasiId`, `detailSopId`, `penggunaId`, `createdAt`);

-- AlterTable
ALTER TABLE `DokumenTte` DROP PRIMARY KEY,
    MODIFY `dokumenTteId` CHAR(36) NOT NULL,
    MODIFY `nomorDokumen` VARCHAR(500) NOT NULL,
    MODIFY `judulDokumen` VARCHAR(2000) NOT NULL,
    MODIFY `hashDokumen` CHAR(64) NOT NULL,
    MODIFY `pdfSha256` CHAR(64) NULL,
    MODIFY `detailSopId` CHAR(36) NULL,
    MODIFY `pengajuanEvaluasiId` CHAR(36) NULL,
    ADD PRIMARY KEY (`dokumenTteId`);

-- AlterTable
ALTER TABLE `RiwayatTandaTangan` DROP PRIMARY KEY,
    MODIFY `userId` CHAR(36) NOT NULL,
    MODIFY `dokumenTteId` CHAR(36) NOT NULL,
    MODIFY `signatureAlgorithm` VARCHAR(32) NULL,
    MODIFY `signatureFormat` VARCHAR(32) NULL,
    MODIFY `certSerialNumber` VARCHAR(64) NULL,
    MODIFY `certIssuer` VARCHAR(500) NULL,
    MODIFY `certSubject` VARCHAR(500) NULL,
    MODIFY `certFingerprint` CHAR(64) NULL,
    ADD PRIMARY KEY (`userId`, `dokumenTteId`);

-- AlterTable
ALTER TABLE `KonfigurasiDiagramSOP` DROP PRIMARY KEY,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`detailSopId`, `jenis`);

-- AlterTable
ALTER TABLE `OverridePanahDiagramSOP` DROP PRIMARY KEY,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `dariLangkahSopId` CHAR(36) NOT NULL,
    MODIFY `keLangkahSopId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`);

-- AlterTable
ALTER TABLE `TitikTekukPanahDiagramSOP` DROP PRIMARY KEY,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `dariLangkahSopId` CHAR(36) NOT NULL,
    MODIFY `keLangkahSopId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`, `urutan`);

-- AlterTable
ALTER TABLE `OverrideLabelDiagramSOP` DROP PRIMARY KEY,
    MODIFY `detailSopId` CHAR(36) NOT NULL,
    MODIFY `kunciLabel` VARCHAR(255) NOT NULL,
    ADD PRIMARY KEY (`detailSopId`, `jenis`, `kunciLabel`);

-- AddForeignKey
ALTER TABLE `Pengguna` ADD CONSTRAINT `Pengguna_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiwayatOpdPengguna` ADD CONSTRAINT `RiwayatOpdPengguna_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiwayatOpdPengguna` ADD CONSTRAINT `RiwayatOpdPengguna_penggunaId_fkey` FOREIGN KEY (`penggunaId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Peraturan` ADD CONSTRAINT `Peraturan_lastEditedById_fkey` FOREIGN KEY (`lastEditedById`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OPDPeraturan` ADD CONSTRAINT `OPDPeraturan_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OPDPeraturan` ADD CONSTRAINT `OPDPeraturan_peraturanId_fkey` FOREIGN KEY (`peraturanId`) REFERENCES `Peraturan`(`peraturanId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SOP` ADD CONSTRAINT `SOP_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_revisiDariDetailSopId_fkey` FOREIGN KEY (`revisiDariDetailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_dibuatOlehId_fkey` FOREIGN KEY (`dibuatOlehId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_sopId_fkey` FOREIGN KEY (`sopId`) REFERENCES `SOP`(`sopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_terakhirDieditOlehId_fkey` FOREIGN KEY (`terakhirDieditOlehId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LampiranPeringatan` ADD CONSTRAINT `LampiranPeringatan_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LampiranKualifikasiPelaksanaan` ADD CONSTRAINT `LampiranKualifikasiPelaksanaan_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LampiranPeralatanPerlengkapan` ADD CONSTRAINT `LampiranPeralatanPerlengkapan_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LampiranPencatatanPendataan` ADD CONSTRAINT `LampiranPencatatanPendataan_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `LogEditSOP` ADD CONSTRAINT `LogEditSOP_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogEditSOP` ADD CONSTRAINT `LogEditSOP_penggunaId_fkey` FOREIGN KEY (`penggunaId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogEditSopDomainField` ADD CONSTRAINT `LogEditSopDomainField_detailSopId_penggunaId_logCreatedAt_fkey` FOREIGN KEY (`detailSopId`, `penggunaId`, `logCreatedAt`) REFERENCES `LogEditSOP`(`detailSopId`, `penggunaId`, `createdAt`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PengajuanEvaluasi` ADD CONSTRAINT `PengajuanEvaluasi_diselesaikanOlehId_fkey` FOREIGN KEY (`diselesaikanOlehId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PengajuanEvaluasi` ADD CONSTRAINT `PengajuanEvaluasi_ditandatanganiOlehPjPenyusunUserId_fkey` FOREIGN KEY (`ditandatanganiOlehPjPenyusunUserId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PengajuanEvaluasi` ADD CONSTRAINT `PengajuanEvaluasi_diverifikasiOlehUserId_fkey` FOREIGN KEY (`diverifikasiOlehUserId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PengajuanEvaluasi` ADD CONSTRAINT `PengajuanEvaluasi_opdId_fkey` FOREIGN KEY (`opdId`) REFERENCES `OPD`(`opdId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NilaiEvaluasi` ADD CONSTRAINT `NilaiEvaluasi_dinilaiOlehId_fkey` FOREIGN KEY (`dinilaiOlehId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NilaiEvaluasi` ADD CONSTRAINT `NilaiEvaluasi_ditindaklanjutiOlehId_fkey` FOREIGN KEY (`ditindaklanjutiOlehId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NilaiEvaluasi` ADD CONSTRAINT `NilaiEvaluasi_pengajuanEvaluasiId_fkey` FOREIGN KEY (`pengajuanEvaluasiId`) REFERENCES `PengajuanEvaluasi`(`pengajuanEvaluasiId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NilaiEvaluasi` ADD CONSTRAINT `NilaiEvaluasi_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogNilaiEvaluasi` ADD CONSTRAINT `LogNilaiEvaluasi_penggunaId_fkey` FOREIGN KEY (`penggunaId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogNilaiEvaluasi` ADD CONSTRAINT `LogNilaiEvaluasi_pengajuanEvaluasiId_fkey` FOREIGN KEY (`pengajuanEvaluasiId`) REFERENCES `PengajuanEvaluasi`(`pengajuanEvaluasiId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogNilaiEvaluasi` ADD CONSTRAINT `LogNilaiEvaluasi_pengajuanEvaluasiId_detailSopId_fkey` FOREIGN KEY (`pengajuanEvaluasiId`, `detailSopId`) REFERENCES `NilaiEvaluasi`(`pengajuanEvaluasiId`, `detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DokumenTte` ADD CONSTRAINT `DokumenTte_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DokumenTte` ADD CONSTRAINT `DokumenTte_pengajuanEvaluasiId_fkey` FOREIGN KEY (`pengajuanEvaluasiId`) REFERENCES `PengajuanEvaluasi`(`pengajuanEvaluasiId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiwayatTandaTangan` ADD CONSTRAINT `RiwayatTandaTangan_dokumenTteId_fkey` FOREIGN KEY (`dokumenTteId`) REFERENCES `DokumenTte`(`dokumenTteId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiwayatTandaTangan` ADD CONSTRAINT `RiwayatTandaTangan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KonfigurasiDiagramSOP` ADD CONSTRAINT `KonfigurasiDiagramSOP_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverridePanahDiagramSOP` ADD CONSTRAINT `OverridePanahDiagramSOP_detailSopId_jenis_fkey` FOREIGN KEY (`detailSopId`, `jenis`) REFERENCES `KonfigurasiDiagramSOP`(`detailSopId`, `jenis`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverridePanahDiagramSOP` ADD CONSTRAINT `OverridePanahDiagramSOP_dariLangkahSopId_fkey` FOREIGN KEY (`dariLangkahSopId`) REFERENCES `LangkahSOP`(`langkahSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverridePanahDiagramSOP` ADD CONSTRAINT `OverridePanahDiagramSOP_keLangkahSopId_fkey` FOREIGN KEY (`keLangkahSopId`) REFERENCES `LangkahSOP`(`langkahSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TitikTekukPanahDiagramSOP` ADD CONSTRAINT `TitikTekukPanahDiagramSOP_detailSopId_jenis_dariLangkahSopI_fkey` FOREIGN KEY (`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`) REFERENCES `OverridePanahDiagramSOP`(`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverrideLabelDiagramSOP` ADD CONSTRAINT `OverrideLabelDiagramSOP_detailSopId_jenis_fkey` FOREIGN KEY (`detailSopId`, `jenis`) REFERENCES `KonfigurasiDiagramSOP`(`detailSopId`, `jenis`) ON DELETE CASCADE ON UPDATE CASCADE;
