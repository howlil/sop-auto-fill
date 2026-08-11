-- LogEditSOP: PK komposit (detailSopId, penggunaId, createdAt), meta JSON -> tabel LogEditSopDomainField + sesiChangeCount

CREATE TABLE `LogEditSopDomainField` (
    `detailSopId` VARCHAR(191) NOT NULL,
    `penggunaId` VARCHAR(191) NOT NULL,
    `logCreatedAt` DATETIME(3) NOT NULL,
    `domainField` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`detailSopId`, `penggunaId`, `logCreatedAt`, `domainField`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LogEditSOP` ADD COLUMN `sesiChangeCount` INTEGER NOT NULL DEFAULT 1;

UPDATE `LogEditSOP`
SET `sesiChangeCount` = COALESCE(
    CAST(JSON_UNQUOTE(JSON_EXTRACT(`meta`, '$.count')) AS SIGNED),
    1
)
WHERE `meta` IS NOT NULL
  AND JSON_EXTRACT(`meta`, '$.count') IS NOT NULL
  AND JSON_TYPE(JSON_EXTRACT(`meta`, '$.count')) IN ('INTEGER', 'DOUBLE');

INSERT INTO `LogEditSopDomainField` (`detailSopId`, `penggunaId`, `logCreatedAt`, `domainField`)
SELECT DISTINCT l.`detailSopId`, l.`userId`, l.`createdAt`, jt.`domainField`
FROM `LogEditSOP` l
JOIN JSON_TABLE(
    IF(
        JSON_TYPE(JSON_EXTRACT(l.`meta`, '$.fields')) = 'ARRAY',
        JSON_EXTRACT(l.`meta`, '$.fields'),
        JSON_ARRAY()
    ),
    '$[*]' COLUMNS (`domainField` VARCHAR(191) PATH '$')
) AS jt
WHERE l.`meta` IS NOT NULL
  AND JSON_TYPE(JSON_EXTRACT(l.`meta`, '$.fields')) = 'ARRAY'
  AND JSON_LENGTH(JSON_EXTRACT(l.`meta`, '$.fields')) > 0;

ALTER TABLE `LogEditSOP` DROP FOREIGN KEY `LogEditSOP_userId_fkey`;
ALTER TABLE `LogEditSOP` DROP FOREIGN KEY `LogEditSOP_detailSopId_fkey`;

DROP INDEX `LogEditSOP_detailSopId_userId_bagian_closedAt_idx` ON `LogEditSOP`;
DROP INDEX `LogEditSOP_detailSopId_createdAt_idx` ON `LogEditSOP`;

ALTER TABLE `LogEditSOP` DROP PRIMARY KEY;

ALTER TABLE `LogEditSOP` ADD COLUMN `penggunaId` VARCHAR(191) NULL;
UPDATE `LogEditSOP` SET `penggunaId` = `userId`;
ALTER TABLE `LogEditSOP` MODIFY `penggunaId` VARCHAR(191) NOT NULL;

ALTER TABLE `LogEditSOP` DROP COLUMN `userId`;
ALTER TABLE `LogEditSOP` DROP COLUMN `logEditSopId`;
ALTER TABLE `LogEditSOP` DROP COLUMN `meta`;

ALTER TABLE `LogEditSOP` ADD PRIMARY KEY (`detailSopId`, `penggunaId`, `createdAt`);

CREATE INDEX `LogEditSOP_detailSopId_penggunaId_bagian_closedAt_idx` ON `LogEditSOP`(`detailSopId`, `penggunaId`, `bagian`, `closedAt`);
CREATE INDEX `LogEditSOP_detailSopId_createdAt_idx` ON `LogEditSOP`(`detailSopId`, `createdAt`);

ALTER TABLE `LogEditSOP` ADD CONSTRAINT `LogEditSOP_detailSopId_fkey` FOREIGN KEY (`detailSopId`) REFERENCES `DetailSOP`(`detailSopId`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `LogEditSOP` ADD CONSTRAINT `LogEditSOP_penggunaId_fkey` FOREIGN KEY (`penggunaId`) REFERENCES `Pengguna`(`penggunaId`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `LogEditSopDomainField` ADD CONSTRAINT `LogEditSopDomainField_detailSopId_penggunaId_logCreatedAt_fkey` FOREIGN KEY (`detailSopId`, `penggunaId`, `logCreatedAt`) REFERENCES `LogEditSOP`(`detailSopId`, `penggunaId`, `createdAt`) ON DELETE CASCADE ON UPDATE CASCADE;
