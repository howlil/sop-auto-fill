-- DropForeignKey
ALTER TABLE `DetailSOP` DROP FOREIGN KEY `DetailSOP_salinDariDetailSopId_fkey`;

-- AlterTable
ALTER TABLE `DetailSOP` DROP COLUMN `salinDariDetailSopId`;
