-- Normalisasi konfigurasi diagram:
-- 1) drop JSON pathOverrides
-- 2) ganti PK parent menjadi komposit (detailSopId, jenis)
-- 3) simpan override path/label ke tabel relasional
-- Catatan: strategi reset data manual path lama (tanpa backfill JSON lama).

-- Drop index unik lama (akan digantikan oleh PK komposit)
ALTER TABLE `KonfigurasiDiagramSOP`
  DROP INDEX `KonfigurasiDiagramSOP_detailSopId_jenis_key`;

-- Ganti PK dari surrogate id -> komposit, lalu hapus kolom JSON
ALTER TABLE `KonfigurasiDiagramSOP`
  DROP PRIMARY KEY,
  DROP COLUMN `konfigurasiDiagramId`,
  DROP COLUMN `pathOverrides`,
  ADD PRIMARY KEY (`detailSopId`, `jenis`);

-- Tabel edge override manual
CREATE TABLE `OverridePanahDiagramSOP` (
    `detailSopId` VARCHAR(191) NOT NULL,
    `jenis` ENUM('FLOWCHART', 'BPMN') NOT NULL,
    `dariLangkahSopId` VARCHAR(191) NOT NULL,
    `keLangkahSopId` VARCHAR(191) NOT NULL,
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

-- Titik tekuk (bend points) berurutan per edge
CREATE TABLE `TitikTekukPanahDiagramSOP` (
    `detailSopId` VARCHAR(191) NOT NULL,
    `jenis` ENUM('FLOWCHART', 'BPMN') NOT NULL,
    `dariLangkahSopId` VARCHAR(191) NOT NULL,
    `keLangkahSopId` VARCHAR(191) NOT NULL,
    `cabang` ENUM('UTAMA', 'YA', 'TIDAK') NOT NULL,
    `urutan` INTEGER NOT NULL,
    `x` DOUBLE NOT NULL,
    `y` DOUBLE NOT NULL,

    PRIMARY KEY (`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`, `urutan`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Override posisi label
CREATE TABLE `OverrideLabelDiagramSOP` (
    `detailSopId` VARCHAR(191) NOT NULL,
    `jenis` ENUM('FLOWCHART', 'BPMN') NOT NULL,
    `kunciLabel` VARCHAR(191) NOT NULL,
    `posisiX` DOUBLE NOT NULL,
    `posisiY` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`detailSopId`, `jenis`, `kunciLabel`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `OverridePanahDiagramSOP`
  ADD CONSTRAINT `OverridePanahDiagramSOP_detailSopId_jenis_fkey`
    FOREIGN KEY (`detailSopId`, `jenis`)
    REFERENCES `KonfigurasiDiagramSOP`(`detailSopId`, `jenis`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OverridePanahDiagramSOP`
  ADD CONSTRAINT `OverridePanahDiagramSOP_dariLangkahSopId_fkey`
    FOREIGN KEY (`dariLangkahSopId`)
    REFERENCES `LangkahSOP`(`langkahSopId`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OverridePanahDiagramSOP`
  ADD CONSTRAINT `OverridePanahDiagramSOP_keLangkahSopId_fkey`
    FOREIGN KEY (`keLangkahSopId`)
    REFERENCES `LangkahSOP`(`langkahSopId`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TitikTekukPanahDiagramSOP`
  ADD CONSTRAINT `TitikTekukPanahDiagramSOP_overridePanah_fkey`
    FOREIGN KEY (`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`)
    REFERENCES `OverridePanahDiagramSOP`(`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `OverrideLabelDiagramSOP`
  ADD CONSTRAINT `OverrideLabelDiagramSOP_detailSopId_jenis_fkey`
    FOREIGN KEY (`detailSopId`, `jenis`)
    REFERENCES `KonfigurasiDiagramSOP`(`detailSopId`, `jenis`)
    ON DELETE CASCADE ON UPDATE CASCADE;
