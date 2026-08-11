-- Invariant: DokumenTte tepat satu parent; SopTerkait anti-self & anti-pasangan terbalik;
-- Pelaksana swimlane/langkah harus se-OPD dengan SOP; slot OPD wajib peran KEPALA_OPD / PJ_PENYUSUN;
-- cegah ubah peran pengguna saat masih menempati slot.

-- ---------------------------------------------------------------------------
-- 1) DokumenTte: perbaiki data lalu CHECK XOR (tepat satu FK parent)
-- ---------------------------------------------------------------------------
UPDATE `DokumenTte`
SET `detailSopId` = NULL
WHERE `jenisDokumen` = 'BERITA_ACARA_EVALUASI'
  AND `pengajuanEvaluasiId` IS NOT NULL
  AND `detailSopId` IS NOT NULL;

UPDATE `DokumenTte`
SET `pengajuanEvaluasiId` = NULL
WHERE `jenisDokumen` = 'SOP_BERLAKU'
  AND `detailSopId` IS NOT NULL
  AND `pengajuanEvaluasiId` IS NOT NULL;

DELETE d FROM `DokumenTte` d
LEFT JOIN `RiwayatTandaTangan` r ON r.`dokumenTteId` = d.`dokumenTteId`
WHERE d.`detailSopId` IS NULL
  AND d.`pengajuanEvaluasiId` IS NULL
  AND r.`userId` IS NULL;

DROP TRIGGER IF EXISTS `trg_dokumentte_satu_parent_insert`;
CREATE TRIGGER `trg_dokumentte_satu_parent_insert`
BEFORE INSERT ON `DokumenTte`
FOR EACH ROW
BEGIN
  IF NOT (
    (NEW.`detailSopId` IS NOT NULL AND NEW.`pengajuanEvaluasiId` IS NULL)
    OR (NEW.`detailSopId` IS NULL AND NEW.`pengajuanEvaluasiId` IS NOT NULL)
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DokumenTte wajib punya tepat satu parent: DetailSOP atau PengajuanEvaluasi';
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_dokumentte_satu_parent_update`;
CREATE TRIGGER `trg_dokumentte_satu_parent_update`
BEFORE UPDATE ON `DokumenTte`
FOR EACH ROW
BEGIN
  IF NOT (
    (NEW.`detailSopId` IS NOT NULL AND NEW.`pengajuanEvaluasiId` IS NULL)
    OR (NEW.`detailSopId` IS NULL AND NEW.`pengajuanEvaluasiId` IS NOT NULL)
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DokumenTte wajib punya tepat satu parent: DetailSOP atau PengajuanEvaluasi';
  END IF;
END;

-- ---------------------------------------------------------------------------
-- 2) SopTerkait: trigger anti-self & anti pasangan (A,B) jika (B,A) ada
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_sop_terkait_insert`;
CREATE TRIGGER `trg_sop_terkait_insert`
BEFORE INSERT ON `SopTerkait`
FOR EACH ROW
BEGIN
  IF NEW.`detailSopId` = NEW.`detailSopTerkaitId` THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SOP terkait tidak boleh merujuk diri sendiri';
  END IF;
  IF EXISTS (
    SELECT 1 FROM `SopTerkait` st
    WHERE st.`detailSopId` = NEW.`detailSopTerkaitId`
      AND st.`detailSopTerkaitId` = NEW.`detailSopId`
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Relasi SOP terkait sudah ada arah terbalik; hapus pasangan yang ada terlebih dahulu';
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_sop_terkait_update`;
CREATE TRIGGER `trg_sop_terkait_update`
BEFORE UPDATE ON `SopTerkait`
FOR EACH ROW
BEGIN
  IF NEW.`detailSopId` = NEW.`detailSopTerkaitId` THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SOP terkait tidak boleh merujuk diri sendiri';
  END IF;
  IF EXISTS (
    SELECT 1 FROM `SopTerkait` st
    WHERE st.`detailSopId` = NEW.`detailSopTerkaitId`
      AND st.`detailSopTerkaitId` = NEW.`detailSopId`
      AND NOT (st.`detailSopId` = OLD.`detailSopId` AND st.`detailSopTerkaitId` = OLD.`detailSopTerkaitId`)
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Relasi SOP terkait bentrok dengan arah terbalik yang sudah ada';
  END IF;
END;

-- ---------------------------------------------------------------------------
-- 3) DetailSOPPelaksana & LangkahSOP: Pelaksana harus se-OPD dengan SOP pemilik DetailSOP
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_detailsoppelaksana_pelaksana_opd_insert`;
CREATE TRIGGER `trg_detailsoppelaksana_pelaksana_opd_insert`
BEFORE INSERT ON `DetailSOPPelaksana`
FOR EACH ROW
BEGIN
  IF (
    SELECT p.`opdId`
    FROM `Pelaksana` p
    WHERE p.`pelaksanaId` = NEW.`pelaksanaId`
  ) <> (
    SELECT s.`opdId`
    FROM `DetailSOP` d
    JOIN `SOP` s ON s.`sopId` = d.`sopId`
    WHERE d.`detailSopId` = NEW.`detailSopId`
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pelaksana swimlane harus dari OPD yang sama dengan SOP';
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_detailsoppelaksana_pelaksana_opd_update`;
CREATE TRIGGER `trg_detailsoppelaksana_pelaksana_opd_update`
BEFORE UPDATE ON `DetailSOPPelaksana`
FOR EACH ROW
BEGIN
  IF (
    SELECT p.`opdId`
    FROM `Pelaksana` p
    WHERE p.`pelaksanaId` = NEW.`pelaksanaId`
  ) <> (
    SELECT s.`opdId`
    FROM `DetailSOP` d
    JOIN `SOP` s ON s.`sopId` = d.`sopId`
    WHERE d.`detailSopId` = NEW.`detailSopId`
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pelaksana swimlane harus dari OPD yang sama dengan SOP';
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_langkahsop_pelaksana_opd_insert`;
CREATE TRIGGER `trg_langkahsop_pelaksana_opd_insert`
BEFORE INSERT ON `LangkahSOP`
FOR EACH ROW
BEGIN
  IF (
    SELECT p.`opdId`
    FROM `Pelaksana` p
    WHERE p.`pelaksanaId` = NEW.`pelaksanaId`
  ) <> (
    SELECT s.`opdId`
    FROM `DetailSOP` d
    JOIN `SOP` s ON s.`sopId` = d.`sopId`
    WHERE d.`detailSopId` = NEW.`detailSopId`
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pelaksana langkah harus dari OPD yang sama dengan SOP';
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_langkahsop_pelaksana_opd_update`;
CREATE TRIGGER `trg_langkahsop_pelaksana_opd_update`
BEFORE UPDATE ON `LangkahSOP`
FOR EACH ROW
BEGIN
  IF (
    SELECT p.`opdId`
    FROM `Pelaksana` p
    WHERE p.`pelaksanaId` = NEW.`pelaksanaId`
  ) <> (
    SELECT s.`opdId`
    FROM `DetailSOP` d
    JOIN `SOP` s ON s.`sopId` = d.`sopId`
    WHERE d.`detailSopId` = NEW.`detailSopId`
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pelaksana langkah harus dari OPD yang sama dengan SOP';
  END IF;
END;

-- ---------------------------------------------------------------------------
-- 4) OPD slot: tambah validasi peran (ganti isi trigger 2.3)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_opd_kepala_pj_konsisten_insert`;
CREATE TRIGGER `trg_opd_kepala_pj_konsisten_insert`
BEFORE INSERT ON `OPD`
FOR EACH ROW
BEGIN
  IF NEW.`kepalaPenggunaId` IS NOT NULL THEN
    IF (SELECT `opdId` FROM `Pengguna` WHERE `penggunaId` = NEW.`kepalaPenggunaId`) <> NEW.`opdId` THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Kepala OPD harus pengguna yang bertugas di OPD ini';
    END IF;
    IF (SELECT `peran` FROM `Pengguna` WHERE `penggunaId` = NEW.`kepalaPenggunaId`) <> 'KEPALA_OPD' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Slot Kepala OPD hanya boleh diisi pengguna berperan KEPALA_OPD';
    END IF;
  END IF;
  IF NEW.`pjPenyusunPenggunaId` IS NOT NULL THEN
    IF (SELECT `opdId` FROM `Pengguna` WHERE `penggunaId` = NEW.`pjPenyusunPenggunaId`) <> NEW.`opdId` THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PJ Penyusun OPD harus pengguna yang bertugas di OPD ini';
    END IF;
    IF (SELECT `peran` FROM `Pengguna` WHERE `penggunaId` = NEW.`pjPenyusunPenggunaId`) <> 'PJ_PENYUSUN' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Slot PJ Penyusun hanya boleh diisi pengguna berperan PJ_PENYUSUN';
    END IF;
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_opd_kepala_pj_konsisten_update`;
CREATE TRIGGER `trg_opd_kepala_pj_konsisten_update`
BEFORE UPDATE ON `OPD`
FOR EACH ROW
BEGIN
  IF NEW.`kepalaPenggunaId` IS NOT NULL THEN
    IF (SELECT `opdId` FROM `Pengguna` WHERE `penggunaId` = NEW.`kepalaPenggunaId`) <> NEW.`opdId` THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Kepala OPD harus pengguna yang bertugas di OPD ini';
    END IF;
    IF (SELECT `peran` FROM `Pengguna` WHERE `penggunaId` = NEW.`kepalaPenggunaId`) <> 'KEPALA_OPD' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Slot Kepala OPD hanya boleh diisi pengguna berperan KEPALA_OPD';
    END IF;
  END IF;
  IF NEW.`pjPenyusunPenggunaId` IS NOT NULL THEN
    IF (SELECT `opdId` FROM `Pengguna` WHERE `penggunaId` = NEW.`pjPenyusunPenggunaId`) <> NEW.`opdId` THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PJ Penyusun OPD harus pengguna yang bertugas di OPD ini';
    END IF;
    IF (SELECT `peran` FROM `Pengguna` WHERE `penggunaId` = NEW.`pjPenyusunPenggunaId`) <> 'PJ_PENYUSUN' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Slot PJ Penyusun hanya boleh diisi pengguna berperan PJ_PENYUSUN';
    END IF;
  END IF;
END;

-- ---------------------------------------------------------------------------
-- 5) Pengguna: cegah ubah peran menjauhi slot yang sedang dipegang
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_pengguna_peran_slot_konsisten_update`;
CREATE TRIGGER `trg_pengguna_peran_slot_konsisten_update`
BEFORE UPDATE ON `Pengguna`
FOR EACH ROW
BEGIN
  IF NEW.`peran` <> OLD.`peran` THEN
    IF (SELECT COUNT(*) FROM `OPD` WHERE `kepalaPenggunaId` = OLD.`penggunaId`) > 0
       AND NEW.`peran` <> 'KEPALA_OPD' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lepas slot Kepala OPD sebelum mengubah peran pengguna';
    END IF;
    IF (SELECT COUNT(*) FROM `OPD` WHERE `pjPenyusunPenggunaId` = OLD.`penggunaId`) > 0
       AND NEW.`peran` <> 'PJ_PENYUSUN' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Lepas slot PJ Penyusun sebelum mengubah peran pengguna';
    END IF;
  END IF;
END;
