-- CreateTable
CREATE TABLE `KonfigurasiDiagramSOP` (
    `konfigurasiDiagramId` VARCHAR(191) NOT NULL,
    `detailSopId` VARCHAR(191) NOT NULL,
    `jenis` ENUM('FLOWCHART', 'BPMN') NOT NULL,
    `layoutSeed` INTEGER NOT NULL DEFAULT 0,
    `pathOverrides` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `KonfigurasiDiagramSOP_detailSopId_jenis_key`(`detailSopId`, `jenis`),
    INDEX `KonfigurasiDiagramSOP_detailSopId_idx`(`detailSopId`),
    PRIMARY KEY (`konfigurasiDiagramId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `KonfigurasiDiagramSOP` ADD CONSTRAINT `KonfigurasiDiagramSOP_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;
