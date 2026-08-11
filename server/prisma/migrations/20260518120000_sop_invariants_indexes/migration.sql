-- Invariant SOP berlaku, cabang LangkahSOP, dan index operasional.
--
-- Catatan MySQL/MariaDB: trigger pada `DetailSOP` tidak bisa meng-update
-- tabel `DetailSOP` yang sama. Karena itu invariant "maksimal satu BERLAKU"
-- ditegakkan DB dengan generated column + unique index; aplikasi mengganti
-- versi lama menjadi DIGANTIKAN dalam transaksi sebelum versi baru dibuat
-- BERLAKU.

-- ---------------------------------------------------------------------------
-- 1) Bersihkan data historis: bila ada lebih dari satu BERLAKU per SOP,
--    pertahankan versi tertinggi sebagai BERLAKU dan ubah sisanya DIGANTIKAN.
-- ---------------------------------------------------------------------------
UPDATE `DetailSOP` d
JOIN (
  SELECT `sopId`, MAX(`versi`) AS `maxVersi`
  FROM `DetailSOP`
  WHERE `status` = 'BERLAKU'
  GROUP BY `sopId`
  HAVING COUNT(*) > 1
) keepers
  ON keepers.`sopId` = d.`sopId`
SET d.`status` = 'DIGANTIKAN'
WHERE d.`status` = 'BERLAKU'
  AND d.`versi` <> keepers.`maxVersi`;

-- ---------------------------------------------------------------------------
-- 2) DokumenTte.nomorDokumen harus unik global.
--    Gagal eksplisit jika data lama masih punya nomor duplikat.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_assert_dokumentte_nomor_unik`;
CREATE PROCEDURE `sp_assert_dokumentte_nomor_unik`()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM `DokumenTte`
    GROUP BY `nomorDokumen`
    HAVING COUNT(*) > 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DokumenTte.nomorDokumen duplikat; rapikan data sebelum memasang unique index';
  END IF;
END;

CALL `sp_assert_dokumentte_nomor_unik`();
DROP PROCEDURE IF EXISTS `sp_assert_dokumentte_nomor_unik`;

-- ---------------------------------------------------------------------------
-- 3) Validasi data LangkahSOP lama sebelum trigger dipasang.
-- ---------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `sp_assert_langkahsop_cabang_satu_detail`;
CREATE PROCEDURE `sp_assert_langkahsop_cabang_satu_detail`()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM `LangkahSOP` src
    JOIN `LangkahSOP` target
      ON target.`langkahSopId` = src.`langkahSelanjutnyaYaId`
    WHERE src.`langkahSelanjutnyaYaId` IS NOT NULL
      AND target.`detailSopId` <> src.`detailSopId`
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'LangkahSOP.langkahSelanjutnyaYaId lintas DetailSOP; rapikan data sebelum memasang trigger';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM `LangkahSOP` src
    JOIN `LangkahSOP` target
      ON target.`langkahSopId` = src.`langkahSelanjutnyaTidakId`
    WHERE src.`langkahSelanjutnyaTidakId` IS NOT NULL
      AND target.`detailSopId` <> src.`detailSopId`
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'LangkahSOP.langkahSelanjutnyaTidakId lintas DetailSOP; rapikan data sebelum memasang trigger';
  END IF;
END;

CALL `sp_assert_langkahsop_cabang_satu_detail`();
DROP PROCEDURE IF EXISTS `sp_assert_langkahsop_cabang_satu_detail`;

-- ---------------------------------------------------------------------------
-- 4) Index operasional + unique global nomor dokumen.
-- ---------------------------------------------------------------------------
CREATE INDEX `SOP_opdId_idx` ON `SOP`(`opdId`);
CREATE INDEX `DetailSOP_sopId_status_idx` ON `DetailSOP`(`sopId`, `status`);
CREATE INDEX `DetailSOP_status_updatedAt_idx` ON `DetailSOP`(`status`, `updatedAt`);
CREATE INDEX `PengajuanEvaluasi_opdId_status_createdAt_idx` ON `PengajuanEvaluasi`(`opdId`, `status`, `createdAt`);
CREATE INDEX `NilaiEvaluasi_detailSopId_idx` ON `NilaiEvaluasi`(`detailSopId`);
CREATE UNIQUE INDEX `DokumenTte_nomorDokumen_key` ON `DokumenTte`(`nomorDokumen`);

-- Invariant satu BERLAKU per SOP: trigger (hindari generated column — error 1215 di MariaDB).
DROP TRIGGER IF EXISTS `trg_detailsop_one_berlaku_insert`;
CREATE TRIGGER `trg_detailsop_one_berlaku_insert`
BEFORE INSERT ON `DetailSOP`
FOR EACH ROW
BEGIN
  IF NEW.`status` = 'BERLAKU' AND EXISTS (
    SELECT 1
    FROM `DetailSOP` d
    WHERE d.`sopId` = NEW.`sopId`
      AND d.`status` = 'BERLAKU'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hanya satu DetailSOP BERLAKU per SOP';
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_detailsop_one_berlaku_update`;
CREATE TRIGGER `trg_detailsop_one_berlaku_update`
BEFORE UPDATE ON `DetailSOP`
FOR EACH ROW
BEGIN
  IF NEW.`status` = 'BERLAKU' AND EXISTS (
    SELECT 1
    FROM `DetailSOP` d
    WHERE d.`sopId` = NEW.`sopId`
      AND d.`status` = 'BERLAKU'
      AND d.`detailSopId` <> OLD.`detailSopId`
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Hanya satu DetailSOP BERLAKU per SOP';
  END IF;
END;

-- ---------------------------------------------------------------------------
-- 5) LangkahSOP: cabang Ya/Tidak wajib menunjuk langkah pada DetailSOP sama.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS `trg_langkahsop_cabang_detail_insert`;
CREATE TRIGGER `trg_langkahsop_cabang_detail_insert`
BEFORE INSERT ON `LangkahSOP`
FOR EACH ROW
BEGIN
  IF NEW.`langkahSelanjutnyaYaId` IS NOT NULL THEN
    IF (
      SELECT COUNT(*)
      FROM `LangkahSOP` target
      WHERE target.`langkahSopId` = NEW.`langkahSelanjutnyaYaId`
        AND target.`detailSopId` = NEW.`detailSopId`
    ) = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Langkah tujuan cabang Ya harus berada dalam DetailSOP yang sama';
    END IF;
  END IF;

  IF NEW.`langkahSelanjutnyaTidakId` IS NOT NULL THEN
    IF (
      SELECT COUNT(*)
      FROM `LangkahSOP` target
      WHERE target.`langkahSopId` = NEW.`langkahSelanjutnyaTidakId`
        AND target.`detailSopId` = NEW.`detailSopId`
    ) = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Langkah tujuan cabang Tidak harus berada dalam DetailSOP yang sama';
    END IF;
  END IF;
END;

DROP TRIGGER IF EXISTS `trg_langkahsop_cabang_detail_update`;
CREATE TRIGGER `trg_langkahsop_cabang_detail_update`
BEFORE UPDATE ON `LangkahSOP`
FOR EACH ROW
BEGIN
  IF NEW.`langkahSelanjutnyaYaId` IS NOT NULL THEN
    IF (
      SELECT COUNT(*)
      FROM `LangkahSOP` target
      WHERE target.`langkahSopId` = NEW.`langkahSelanjutnyaYaId`
        AND target.`detailSopId` = NEW.`detailSopId`
    ) = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Langkah tujuan cabang Ya harus berada dalam DetailSOP yang sama';
    END IF;
  END IF;

  IF NEW.`langkahSelanjutnyaTidakId` IS NOT NULL THEN
    IF (
      SELECT COUNT(*)
      FROM `LangkahSOP` target
      WHERE target.`langkahSopId` = NEW.`langkahSelanjutnyaTidakId`
        AND target.`detailSopId` = NEW.`detailSopId`
    ) = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Langkah tujuan cabang Tidak harus berada dalam DetailSOP yang sama';
    END IF;
  END IF;
END;
