-- AlterTable: relasi revisi dari versi BERLAKU
ALTER TABLE `DetailSOP`
    ADD COLUMN `revisiDariDetailSopId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `DetailSOP`
    ADD CONSTRAINT `DetailSOP_revisiDariDetailSopId_fkey`
    FOREIGN KEY (`revisiDariDetailSopId`) REFERENCES `DetailSOP`(`detailSopId`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX `DetailSOP_revisiDariDetailSopId_idx` ON `DetailSOP`(`revisiDariDetailSopId`);
