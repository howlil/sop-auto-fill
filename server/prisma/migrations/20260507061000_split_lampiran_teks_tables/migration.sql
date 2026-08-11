-- Drop legacy table (nama bisa berbeda tergantung filesystem / migration lama)
DROP TABLE IF EXISTS `LampiranTeks`;
DROP TABLE IF EXISTS `lampiranteks`;

-- CreateTable
CREATE TABLE `LampiranPeringatan` (
    `lampiranPeringatanId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `teks` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LampiranPeringatan_detailSopId_createdAt_idx`(`detailSopId`, `createdAt`),
    PRIMARY KEY (`lampiranPeringatanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LampiranKualifikasiPelaksanaan` (
    `lampiranKualifikasiPelaksanaanId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `teks` TEXT NOT NULL,
    `urutan` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LampiranKualifikasiPelaksanaan_detailSopId_createdAt_idx`(`detailSopId`, `createdAt`),
    PRIMARY KEY (`lampiranKualifikasiPelaksanaanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LampiranPeralatanPerlengkapan` (
    `lampiranPeralatanPerlengkapanId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `teks` TEXT NOT NULL,
    `urutan` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LampiranPeralatanPerlengkapan_detailSopId_createdAt_idx`(`detailSopId`, `createdAt`),
    PRIMARY KEY (`lampiranPeralatanPerlengkapanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LampiranPencatatanPendataan` (
    `lampiranPencatatanPendataanId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `teks` TEXT NOT NULL,
    `urutan` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LampiranPencatatanPendataan_detailSopId_createdAt_idx`(`detailSopId`, `createdAt`),
    PRIMARY KEY (`lampiranPencatatanPendataanId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LampiranPeringatan`
ADD CONSTRAINT `LampiranPeringatan_detailSopId_fkey`
FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LampiranKualifikasiPelaksanaan`
ADD CONSTRAINT `LampiranKualifikasiPelaksanaan_detailSopId_fkey`
FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LampiranPeralatanPerlengkapan`
ADD CONSTRAINT `LampiranPeralatanPerlengkapan_detailSopId_fkey`
FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LampiranPencatatanPendataan`
ADD CONSTRAINT `LampiranPencatatanPendataan_detailSopId_fkey`
FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

