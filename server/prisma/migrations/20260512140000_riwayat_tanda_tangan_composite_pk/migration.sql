-- RiwayatTandaTangan sebagai junction: PK (userId, dokumenTteId), hapus surrokat riwayatTandaTanganId.
-- Unique (dokumenTteId, peran) tetap untuk aturan bisnis.

ALTER TABLE `RiwayatTandaTangan` DROP PRIMARY KEY;

ALTER TABLE `RiwayatTandaTangan` DROP COLUMN `riwayatTandaTanganId`;

ALTER TABLE `RiwayatTandaTangan` ADD PRIMARY KEY (`userId`, `dokumenTteId`);
