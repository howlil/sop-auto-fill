-- CreateTable
CREATE TABLE `User` (
    `userId` CHAR(36) NOT NULL,
    `googleSub` VARCHAR(255) NOT NULL,
    `email` VARCHAR(320) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `avatarUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_googleSub_key`(`googleSub`),
    INDEX `User_email_idx`(`email`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Workspace` (
    `workspaceId` CHAR(36) NOT NULL,
    `ownerId` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Workspace_ownerId_updatedAt_idx`(`ownerId`, `updatedAt`),
    PRIMARY KEY (`workspaceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Peraturan` (
    `peraturanId` CHAR(36) NOT NULL,
    `ownerId` CHAR(36) NOT NULL,
    `nama` VARCHAR(255) NOT NULL,
    `nomor` VARCHAR(120) NOT NULL,
    `tahun` INTEGER NOT NULL,
    `tentang` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Peraturan_ownerId_nama_idx`(`ownerId`, `nama`),
    UNIQUE INDEX `Peraturan_ownerId_nomor_tahun_key`(`ownerId`, `nomor`, `tahun`),
    PRIMARY KEY (`peraturanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SOP` (
    `sopId` CHAR(36) NOT NULL,
    `workspaceId` CHAR(36) NOT NULL,
    `judul` VARCHAR(500) NOT NULL,
    `status` ENUM('DRAFT', 'COMPLETED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SOP_workspaceId_status_updatedAt_idx`(`workspaceId`, `status`, `updatedAt`),
    PRIMARY KEY (`sopId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DetailSOP` (
    `detailSopId` CHAR(36) NOT NULL,
    `sopId` CHAR(36) NOT NULL,
    `versi` INTEGER NOT NULL DEFAULT 1,
    `nomorSOP` VARCHAR(255) NOT NULL,
    `tanggalPembuatan` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tanggalRevisi` DATETIME(3) NULL,
    `tanggalEfektif` DATETIME(3) NULL,
    `namaLembaga` VARCHAR(500) NOT NULL,
    `dibuatOlehId` CHAR(36) NULL,
    `terakhirDieditOlehId` CHAR(36) NULL,
    `revisiDariDetailSopId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DetailSOP_sopId_versi_idx`(`sopId`, `versi`),
    INDEX `DetailSOP_revisiDariDetailSopId_idx`(`revisiDariDetailSopId`),
    UNIQUE INDEX `DetailSOP_sopId_versi_key`(`sopId`, `versi`),
    PRIMARY KEY (`detailSopId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LampiranPeringatan` (
    `lampiranPeringatanId` CHAR(36) NOT NULL,
    `detailSopId` CHAR(36) NOT NULL,
    `teks` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LampiranPeringatan_detailSopId_idx`(`detailSopId`),
    PRIMARY KEY (`lampiranPeringatanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LampiranKualifikasiPelaksanaan` (
    `lampiranKualifikasiPelaksanaanId` CHAR(36) NOT NULL,
    `detailSopId` CHAR(36) NOT NULL,
    `teks` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LampiranKualifikasiPelaksanaan_detailSopId_idx`(`detailSopId`),
    PRIMARY KEY (`lampiranKualifikasiPelaksanaanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LampiranPeralatanPerlengkapan` (
    `lampiranPeralatanPerlengkapanId` CHAR(36) NOT NULL,
    `detailSopId` CHAR(36) NOT NULL,
    `teks` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LampiranPeralatanPerlengkapan_detailSopId_idx`(`detailSopId`),
    PRIMARY KEY (`lampiranPeralatanPerlengkapanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LampiranPencatatanPendataan` (
    `lampiranPencatatanPendataanId` CHAR(36) NOT NULL,
    `detailSopId` CHAR(36) NOT NULL,
    `teks` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LampiranPencatatanPendataan_detailSopId_idx`(`detailSopId`),
    PRIMARY KEY (`lampiranPencatatanPendataanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DasarHukum` (
    `detailSopId` CHAR(36) NOT NULL,
    `peraturanId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DasarHukum_peraturanId_idx`(`peraturanId`),
    PRIMARY KEY (`detailSopId`, `peraturanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SopTerkait` (
    `detailSopId` CHAR(36) NOT NULL,
    `detailSopTerkaitId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SopTerkait_detailSopTerkaitId_idx`(`detailSopTerkaitId`),
    PRIMARY KEY (`detailSopId`, `detailSopTerkaitId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LangkahSOP` (
    `langkahSopId` CHAR(36) NOT NULL,
    `detailSopId` CHAR(36) NOT NULL,
    `kegiatan` VARCHAR(500) NOT NULL,
    `jenis` ENUM('AWAL_AKHIR', 'KEGIATAN', 'KEPUTUSAN') NOT NULL DEFAULT 'KEGIATAN',
    `urutan` INTEGER NOT NULL,
    `kelengkapan` VARCHAR(500) NOT NULL,
    `keluaran` VARCHAR(500) NOT NULL,
    `waktu` INTEGER NOT NULL,
    `satuanWaktu` ENUM('m', 'h', 'd', 'w', 'mo', 'y') NOT NULL,
    `keterangan` VARCHAR(500) NOT NULL,
    `pelaksanaId` CHAR(36) NOT NULL,
    `langkahSelanjutnyaYaId` CHAR(36) NULL,
    `langkahSelanjutnyaTidakId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LangkahSOP_pelaksanaId_idx`(`pelaksanaId`),
    INDEX `LangkahSOP_langkahSelanjutnyaYaId_idx`(`langkahSelanjutnyaYaId`),
    INDEX `LangkahSOP_langkahSelanjutnyaTidakId_idx`(`langkahSelanjutnyaTidakId`),
    UNIQUE INDEX `LangkahSOP_detailSopId_urutan_key`(`detailSopId`, `urutan`),
    PRIMARY KEY (`langkahSopId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pelaksana` (
    `pelaksanaId` CHAR(36) NOT NULL,
    `workspaceId` CHAR(36) NOT NULL,
    `nama` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Pelaksana_workspaceId_idx`(`workspaceId`),
    UNIQUE INDEX `Pelaksana_workspaceId_nama_key`(`workspaceId`, `nama`),
    PRIMARY KEY (`pelaksanaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DetailSOPPelaksana` (
    `detailSopId` CHAR(36) NOT NULL,
    `pelaksanaId` CHAR(36) NOT NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DetailSOPPelaksana_pelaksanaId_idx`(`pelaksanaId`),
    PRIMARY KEY (`detailSopId`, `pelaksanaId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogEditSOP` (
    `detailSopId` CHAR(36) NOT NULL,
    `penggunaId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `bagian` ENUM('HEADER', 'LANGKAH', 'STATUS') NOT NULL DEFAULT 'HEADER',
    `keterangan` TEXT NULL,
    `sesiChangeCount` INTEGER NOT NULL DEFAULT 1,
    `closedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LogEditSOP_detailSopId_penggunaId_bagian_closedAt_idx`(`detailSopId`, `penggunaId`, `bagian`, `closedAt`),
    INDEX `LogEditSOP_detailSopId_createdAt_idx`(`detailSopId`, `createdAt`),
    PRIMARY KEY (`detailSopId`, `penggunaId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogEditSopDomainField` (
    `detailSopId` CHAR(36) NOT NULL,
    `penggunaId` CHAR(36) NOT NULL,
    `logCreatedAt` DATETIME(3) NOT NULL,
    `domainField` VARCHAR(64) NOT NULL,

    PRIMARY KEY (`detailSopId`, `penggunaId`, `logCreatedAt`, `domainField`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KonfigurasiDiagramSOP` (
    `detailSopId` CHAR(36) NOT NULL,
    `jenis` ENUM('FLOWCHART', 'BPMN') NOT NULL,
    `layoutSeed` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KonfigurasiDiagramSOP_detailSopId_idx`(`detailSopId`),
    PRIMARY KEY (`detailSopId`, `jenis`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OverridePanahDiagramSOP` (
    `detailSopId` CHAR(36) NOT NULL,
    `jenis` ENUM('FLOWCHART', 'BPMN') NOT NULL,
    `dariLangkahSopId` CHAR(36) NOT NULL,
    `keLangkahSopId` CHAR(36) NOT NULL,
    `cabang` ENUM('UTAMA', 'YA', 'TIDAK') NOT NULL,
    `sSide` ENUM('top', 'bottom', 'left', 'right') NOT NULL,
    `eSide` ENUM('top', 'bottom', 'left', 'right') NOT NULL,
    `startX` DOUBLE NOT NULL,
    `startY` DOUBLE NOT NULL,
    `endX` DOUBLE NOT NULL,
    `endY` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OverridePanahDiagramSOP_dariLangkahSopId_idx`(`dariLangkahSopId`),
    INDEX `OverridePanahDiagramSOP_keLangkahSopId_idx`(`keLangkahSopId`),
    PRIMARY KEY (`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TitikTekukPanahDiagramSOP` (
    `detailSopId` CHAR(36) NOT NULL,
    `jenis` ENUM('FLOWCHART', 'BPMN') NOT NULL,
    `dariLangkahSopId` CHAR(36) NOT NULL,
    `keLangkahSopId` CHAR(36) NOT NULL,
    `cabang` ENUM('UTAMA', 'YA', 'TIDAK') NOT NULL,
    `urutan` INTEGER NOT NULL,
    `x` DOUBLE NOT NULL,
    `y` DOUBLE NOT NULL,

    PRIMARY KEY (`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`, `urutan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OverrideLabelDiagramSOP` (
    `detailSopId` CHAR(36) NOT NULL,
    `jenis` ENUM('FLOWCHART', 'BPMN') NOT NULL,
    `kunciLabel` VARCHAR(64) NOT NULL,
    `posisiX` DOUBLE NOT NULL,
    `posisiY` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`detailSopId`, `jenis`, `kunciLabel`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Workspace` ADD CONSTRAINT `Workspace_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Peraturan` ADD CONSTRAINT `Peraturan_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SOP` ADD CONSTRAINT `SOP_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`workspaceId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_revisiDariDetailSopId_fkey` FOREIGN KEY (`revisiDariDetailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_dibuatOlehId_fkey` FOREIGN KEY (`dibuatOlehId`) REFERENCES `User`(`userId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_sopId_fkey` FOREIGN KEY (`sopId`) REFERENCES `SOP`(`sopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOP` ADD CONSTRAINT `DetailSOP_terakhirDieditOlehId_fkey` FOREIGN KEY (`terakhirDieditOlehId`) REFERENCES `User`(`userId`) ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE `Pelaksana` ADD CONSTRAINT `Pelaksana_workspaceId_fkey` FOREIGN KEY (`workspaceId`) REFERENCES `Workspace`(`workspaceId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOPPelaksana` ADD CONSTRAINT `DetailSOPPelaksana_pelaksanaId_fkey` FOREIGN KEY (`pelaksanaId`) REFERENCES `Pelaksana`(`pelaksanaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DetailSOPPelaksana` ADD CONSTRAINT `DetailSOPPelaksana_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogEditSOP` ADD CONSTRAINT `LogEditSOP_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogEditSOP` ADD CONSTRAINT `LogEditSOP_penggunaId_fkey` FOREIGN KEY (`penggunaId`) REFERENCES `User`(`userId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogEditSopDomainField` ADD CONSTRAINT `LogEditSopDomainField_detailSopId_penggunaId_logCreatedAt_fkey` FOREIGN KEY (`detailSopId`, `penggunaId`, `logCreatedAt`) REFERENCES `LogEditSOP`(`detailSopId`, `penggunaId`, `createdAt`) ON DELETE CASCADE ON UPDATE CASCADE;

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
