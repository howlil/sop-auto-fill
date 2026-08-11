-- Hanya BERITA_ACARA_EVALUASI dan SOP_BERLAKU: hapus nilai enum LAINNYA.

DELETE r
FROM `RiwayatTandaTangan` r
INNER JOIN `DokumenTte` d ON d.`dokumenTteId` = r.`dokumenTteId`
WHERE d.`jenisDokumen` = 'LAINNYA';

UPDATE `DokumenTte`
SET `jenisDokumen` = 'BERITA_ACARA_EVALUASI'
WHERE `jenisDokumen` = 'LAINNYA';

ALTER TABLE `DokumenTte` MODIFY COLUMN `jenisDokumen` ENUM('BERITA_ACARA_EVALUASI', 'SOP_BERLAKU') NOT NULL;
