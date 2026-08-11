-- Kolom updatedAt dari migrasi invariant lama yang tidak ada di skema Prisma (@updatedAt).
ALTER TABLE `LogNilaiEvaluasi` DROP COLUMN `updatedAt`;
ALTER TABLE `RiwayatTandaTangan` DROP COLUMN `updatedAt`;
