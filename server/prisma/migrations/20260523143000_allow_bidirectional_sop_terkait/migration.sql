-- SopTerkait: keterkaitan SOP boleh dua arah. Invariant yang dipertahankan:
-- satu detail SOP tidak boleh menaut ke dirinya sendiri.

DROP TRIGGER IF EXISTS `trg_sop_terkait_insert`;
CREATE TRIGGER `trg_sop_terkait_insert`
BEFORE INSERT ON `SopTerkait`
FOR EACH ROW
BEGIN
  IF NEW.`detailSopId` = NEW.`detailSopTerkaitId` THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SOP terkait tidak boleh merujuk diri sendiri';
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
END;
