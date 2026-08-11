ALTER TABLE `Pengguna`
  ADD COLUMN `sesiTokenVersion` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `refreshTokenHash` VARCHAR(255) NULL,
  ADD COLUMN `refreshTokenExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `passwordChangedAt` DATETIME(3) NULL;
