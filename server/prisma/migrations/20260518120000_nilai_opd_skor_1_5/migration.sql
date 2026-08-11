-- Normalisasi nilaiOPD ke skala 1–5 (selaras SelesaiEvaluasiDto dan UI evaluator).
-- Data lama skala 0–100 dipetakan dengan ROUND(nilaiOPD / 20); evaluasi MANDIRI tidak memakai skor OPD.

UPDATE `PengajuanEvaluasi`
SET `nilaiOPD` = NULL
WHERE `jenis` = 'MANDIRI'
  AND `nilaiOPD` IS NOT NULL;

UPDATE `PengajuanEvaluasi`
SET `nilaiOPD` = LEAST(5, GREATEST(1, ROUND(`nilaiOPD` / 20)))
WHERE `jenis` = 'TERJADWAL'
  AND `nilaiOPD` IS NOT NULL
  AND (`nilaiOPD` < 1 OR `nilaiOPD` > 5);
