-- Perbaiki trigger evaluator agar memakai kolom OPD terbaru:
-- isPjEvaluatorOrganisasi (sebelumnya isBiroOrganisasi).

DROP TRIGGER IF EXISTS `trg_pengguna_evaluator_from_biro_insert`;
CREATE TRIGGER `trg_pengguna_evaluator_from_biro_insert`
BEFORE INSERT ON `Pengguna`
FOR EACH ROW
BEGIN
  IF NEW.`peran` IN ('PJ_EVALUATOR','EVALUATOR') THEN
    IF (SELECT `isPjEvaluatorOrganisasi` FROM `OPD` WHERE `opdId` = NEW.`opdId`) <> TRUE THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pengguna dengan peran evaluator harus berasal dari OPD PJ Evaluator Organisasi';
    END IF;
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_pengguna_evaluator_from_biro_update`;
CREATE TRIGGER `trg_pengguna_evaluator_from_biro_update`
BEFORE UPDATE ON `Pengguna`
FOR EACH ROW
BEGIN
  IF NEW.`peran` IN ('PJ_EVALUATOR','EVALUATOR') THEN
    IF (SELECT `isPjEvaluatorOrganisasi` FROM `OPD` WHERE `opdId` = NEW.`opdId`) <> TRUE THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pengguna dengan peran evaluator harus berasal dari OPD PJ Evaluator Organisasi';
    END IF;
  END IF;
END;
