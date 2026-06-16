-- AlterTable
ALTER TABLE "purchase_receipts" ADD COLUMN     "image_hash" TEXT,
ADD COLUMN     "purchasing_unit" TEXT NOT NULL DEFAULT '切配中心';
