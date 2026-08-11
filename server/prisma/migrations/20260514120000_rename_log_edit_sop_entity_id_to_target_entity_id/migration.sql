-- AlterTable: penamaan kolom lebih eksplisit (pointer audit, bukan relasi).
ALTER TABLE `LogEditSOP` CHANGE `entityId` `targetEntityId` VARCHAR(191) NULL;
