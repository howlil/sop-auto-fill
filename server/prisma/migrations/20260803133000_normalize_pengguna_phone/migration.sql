-- Bersihkan separator yang sebelumnya dapat lolos karena DTO hanya memeriksa panjang.
UPDATE `Pengguna`
SET `nohp` = REPLACE(
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(TRIM(`nohp`), ' ', ''),
          '+',
          ''
        ),
        '(',
        ''
      ),
      ')',
      ''
    ),
    '-',
    ''
  ),
  '.',
  ''
);

-- Ubah format lokal/legacy menjadi satu format kanonik E.164 tanpa tanda plus.
UPDATE `Pengguna`
SET `nohp` = CONCAT('62', SUBSTRING(`nohp`, 2))
WHERE `nohp` REGEXP '^08[0-9]{7,12}$';

UPDATE `Pengguna`
SET `nohp` = CONCAT('62', `nohp`)
WHERE `nohp` REGEXP '^8[0-9]{7,12}$';

-- Migrasi sengaja gagal jika masih ada data invalid agar nomor tidak diubah secara diam-diam.
ALTER TABLE `Pengguna`
  MODIFY `nohp` VARCHAR(15) NOT NULL,
  ADD CONSTRAINT `Pengguna_nohp_format_chk`
    CHECK (`nohp` REGEXP '^628[0-9]{7,12}$');
