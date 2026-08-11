-- Singleton PJ_EVALUATOR: hanya hitung pengguna aktif (deletedAt IS NULL),
-- selaras dengan findPjEvaluatorOrganisasiOpdId di aplikasi.

DROP TRIGGER IF EXISTS `trg_pengguna_singleton_pj_evaluator_insert`;
CREATE TRIGGER `trg_pengguna_singleton_pj_evaluator_insert`
BEFORE INSERT ON `Pengguna`
FOR EACH ROW
BEGIN
  IF NEW.`peran` = 'PJ_EVALUATOR' THEN
    IF (SELECT COUNT(*) FROM `Pengguna` WHERE `peran` = 'PJ_EVALUATOR' AND `deletedAt` IS NULL) > 0 THEN
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
    IF (
      SELECT COUNT(*) FROM `Pengguna`
      WHERE `peran` = 'PJ_EVALUATOR'
        AND `deletedAt` IS NULL
        AND `penggunaId` <> NEW.`penggunaId`
    ) > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hanya satu pengguna yang boleh memiliki peran PJ_EVALUATOR';
    END IF;
  END IF;
END;
