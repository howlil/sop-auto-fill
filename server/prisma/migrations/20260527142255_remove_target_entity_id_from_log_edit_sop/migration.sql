/*
  Warnings:

  - You are about to drop the column `targetEntityId` on the `logeditsop` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `riwayattandatangan` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `pengajuanevaluasi` DROP FOREIGN KEY `PengajuanEvaluasi_ditandatanganiOlehKoordinatorUserId_fkey`;

-- DropForeignKey
ALTER TABLE `titiktekukpanahdiagramsop` DROP FOREIGN KEY `TitikTekukPanahDiagramSOP_overridePanah_fkey`;

-- AlterTable
ALTER TABLE `logeditsop` DROP COLUMN `targetEntityId`;

-- AlterTable
ALTER TABLE `riwayattandatangan` DROP COLUMN `createdAt`;

-- AddForeignKey
ALTER TABLE `PengajuanEvaluasi` ADD CONSTRAINT `PengajuanEvaluasi_ditandatanganiOlehPjPenyusunUserId_fkey` FOREIGN KEY (`ditandatanganiOlehPjPenyusunUserId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TitikTekukPanahDiagramSOP` ADD CONSTRAINT `TitikTekukPanahDiagramSOP_detailSopId_jenis_dariLangkahSopI_fkey` FOREIGN KEY (`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`) REFERENCES `OverridePanahDiagramSOP`(`detailSopId`, `jenis`, `dariLangkahSopId`, `keLangkahSopId`, `cabang`) ON DELETE CASCADE ON UPDATE CASCADE;
