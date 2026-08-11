-- Hapus tabel singleton PenugasanPjEvaluator; invariant "tepat satu PJ_EVALUATOR"
-- dipindah ke trigger pada kolom Pengguna.peran (sesuai domain bisnis).

DROP TABLE IF EXISTS `PenugasanPjEvaluator`;

-- =========================================================================
-- Singleton global: maksimal satu baris dengan peran PJ_EVALUATOR
-- =========================================================================
DROP TRIGGER IF EXISTS `trg_pengguna_singleton_pj_evaluator_insert`;
CREATE TRIGGER `trg_pengguna_singleton_pj_evaluator_insert`
BEFORE INSERT ON `Pengguna`
FOR EACH ROW
BEGIN
  IF NEW.`peran` = 'PJ_EVALUATOR' THEN
    IF (SELECT COUNT(*) FROM `Pengguna` WHERE `peran` = 'PJ_EVALUATOR') > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hanya satu pengguna yang boleh memiliki peran PJ_EVALUATOR';
    END IF;
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_pengguna_singleton_pj_evaluator_update`;
CREATE TRIGGER `trg_pengguna_singleton_pj_evaluator_update`
BEFORE UPDATE ON `Pengguna`
FOR EACH ROW
BEGIN
  IF NEW.`peran` = 'PJ_EVALUATOR' THEN
    IF (SELECT COUNT(*) FROM `Pengguna` WHERE `peran` = 'PJ_EVALUATOR' AND `penggunaId` <> NEW.`penggunaId`) > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hanya satu pengguna yang boleh memiliki peran PJ_EVALUATOR';
    END IF;
  END IF;
END;
