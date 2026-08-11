-- Slot jabatan & flag biro dipindah ke invariant aplikasi (Pengguna.opdId + peran).
-- Hapus trigger yang mereferensikan kolom yang akan di-drop.

DROP TRIGGER IF EXISTS `trg_pengguna_pindah_lepas_slot`;
DROP TRIGGER IF EXISTS `trg_opd_kepala_pj_konsisten_insert`;
DROP TRIGGER IF EXISTS `trg_opd_kepala_pj_konsisten_update`;
DROP TRIGGER IF EXISTS `trg_pengguna_peran_slot_konsisten_update`;
DROP TRIGGER IF EXISTS `trg_pengguna_evaluator_from_biro_insert`;
DROP TRIGGER IF EXISTS `trg_pengguna_evaluator_from_biro_update`;
DROP TRIGGER IF EXISTS `trg_opd_max_one_pj_evaluator_org_insert`;
DROP TRIGGER IF EXISTS `trg_opd_max_one_pj_evaluator_org_update`;

-- Lepas FK & indeks unik pointer, lalu hapus kolom.
ALTER TABLE `OPD` DROP FOREIGN KEY `OPD_kepalaPenggunaId_fkey`;
ALTER TABLE `OPD` DROP FOREIGN KEY `OPD_pjPenyusunPenggunaId_fkey`;

DROP INDEX `OPD_kepalaPenggunaId_key` ON `OPD`;
DROP INDEX `OPD_pjPenyusunPenggunaId_key` ON `OPD`;

ALTER TABLE `OPD`
  DROP COLUMN `kepalaPenggunaId`,
  DROP COLUMN `pjPenyusunPenggunaId`,
  DROP COLUMN `isPjEvaluatorOrganisasi`;
