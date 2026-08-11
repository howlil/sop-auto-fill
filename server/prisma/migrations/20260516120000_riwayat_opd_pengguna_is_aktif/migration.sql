-- Kolom penanda OPD utama (selaras Pengguna.opdId).
ALTER TABLE `RiwayatOpdPengguna` ADD COLUMN `isAktif` BOOLEAN NOT NULL DEFAULT false;

UPDATE `RiwayatOpdPengguna` AS r
INNER JOIN `Pengguna` AS p ON r.`penggunaId` = p.`penggunaId`
SET r.`isAktif` = (r.`opdId` = p.`opdId`);
