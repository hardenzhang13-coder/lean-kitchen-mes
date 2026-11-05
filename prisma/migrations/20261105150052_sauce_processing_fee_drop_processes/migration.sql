/*
  Warnings:

  - You are about to drop the `sauce_processes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `sauce_processes` DROP FOREIGN KEY `sauce_processes_sauce_id_fkey`;

-- AlterTable
ALTER TABLE `sauce_ingredients` ADD COLUMN `processing_fee_per_jin` DECIMAL(10, 2) NULL;

-- DropTable
DROP TABLE `sauce_processes`;
