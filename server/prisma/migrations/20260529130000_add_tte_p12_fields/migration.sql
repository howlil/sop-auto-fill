-- Add TTE P12 credential columns to Pengguna table.
-- tteP12Base64: file sertifikat P12 pengguna (base64 encoded, nullable)
-- tteP12PassphraseEncrypted: passphrase P12 terenkripsi (nullable)

ALTER TABLE `Pengguna`
  ADD COLUMN `tteP12Base64` LONGTEXT NULL,
  ADD COLUMN `tteP12PassphraseEncrypted` VARCHAR(2048) NULL;
