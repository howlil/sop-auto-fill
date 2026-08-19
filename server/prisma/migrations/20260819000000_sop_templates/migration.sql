-- CreateTable
CREATE TABLE `SopTemplate` (
    `templateId` CHAR(36) NOT NULL,
    `key` VARCHAR(120) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `version` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `peringatan` JSON NOT NULL,
    `kualifikasiPelaksanaan` JSON NOT NULL,
    `peralatanPerlengkapan` JSON NOT NULL,
    `pencatatanPendataan` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SopTemplate_key_key`(`key`),
    PRIMARY KEY (`templateId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SopTemplateStep` (
    `templateStepId` CHAR(36) NOT NULL,
    `templateId` CHAR(36) NOT NULL,
    `urutan` INTEGER NOT NULL,
    `kegiatan` VARCHAR(500) NOT NULL,
    `jenis` ENUM('AWAL_AKHIR', 'KEGIATAN', 'KEPUTUSAN') NOT NULL DEFAULT 'KEGIATAN',
    `kelengkapan` VARCHAR(500) NOT NULL,
    `keluaran` VARCHAR(500) NOT NULL,
    `waktu` INTEGER NOT NULL,
    `satuanWaktu` ENUM('m', 'h', 'd', 'w', 'mo', 'y') NOT NULL,
    `keterangan` VARCHAR(500) NOT NULL,
    `actorName` VARCHAR(255) NOT NULL,
    `targetYaUrutan` INTEGER NULL,
    `targetTidakUrutan` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SopTemplateStep_templateId_idx`(`templateId`),
    UNIQUE INDEX `SopTemplateStep_templateId_urutan_key`(`templateId`, `urutan`),
    PRIMARY KEY (`templateStepId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SopTemplateStep` ADD CONSTRAINT `SopTemplateStep_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `SopTemplate`(`templateId`) ON DELETE CASCADE ON UPDATE CASCADE;
