-- Normalize existing free-text values before tightening the column type.
UPDATE `DokumenTte`
SET `jenisDokumen` = 'LAINNYA'
WHERE `jenisDokumen` NOT IN ('BERITA_ACARA_EVALUASI', 'SOP_BERLAKU', 'LAINNYA');

ALTER TABLE `DokumenTte`
MODIFY `jenisDokumen` ENUM('BERITA_ACARA_EVALUASI', 'SOP_BERLAKU', 'LAINNYA') NOT NULL;
