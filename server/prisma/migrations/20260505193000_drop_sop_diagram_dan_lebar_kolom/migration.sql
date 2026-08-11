-- Drop MODUL 4 (diagram SOP) — tidak dipakai aplikasi; layout diagram di klien.
DROP TABLE IF EXISTS `TitikSisiDiagram`;
DROP TABLE IF EXISTS `SisiDiagram`;
DROP TABLE IF EXISTS `PosisiNodeDiagram`;
DROP TABLE IF EXISTS `TataLetakDiagram`;

-- Kolom lebar tabel prosedur tidak pernah ditulis / dipakai UI.
ALTER TABLE `DetailSOP` DROP COLUMN `lebarKolomKegiatan`,
    DROP COLUMN `lebarKolomPelaksana`,
    DROP COLUMN `lebarKolomKelengkapan`,
    DROP COLUMN `lebarKolomWaktu`,
    DROP COLUMN `lebarKolomOutput`,
    DROP COLUMN `lebarKolomKeterangan`;
