-- Gabungkan PIN TTE ke `Pengguna`, hapus tabel `KredensialTTE`.

ALTER TABLE `Pengguna`
  ADD COLUMN `ttePinHash` VARCHAR(255) NULL,
  ADD COLUMN `ttePinSetAt` DATETIME(3) NULL;

UPDATE `Pengguna` AS p
INNER JOIN `KredensialTTE` AS k ON k.`userId` = p.`penggunaId`
SET
  p.`ttePinHash` = k.`hashPin`,
  p.`ttePinSetAt` = k.`createdAt`;

ALTER TABLE `KredensialTTE` DROP FOREIGN KEY `KredensialTTE_userId_fkey`;

DROP TABLE `KredensialTTE`;
