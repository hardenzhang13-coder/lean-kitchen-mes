-- DropForeignKey
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_seasoning_ingredient_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_ledger" DROP CONSTRAINT "inventory_ledger_seasoning_ingredient_id_fkey";

-- DropForeignKey
ALTER TABLE "purchase_receipt_items" DROP CONSTRAINT "purchase_receipt_items_seasoning_ingredient_id_fkey";

-- DropIndex
DROP INDEX "inventory_seasoning_ingredient_id_key";

-- AlterTable
ALTER TABLE "ingredients" DROP COLUMN "brand",
DROP COLUMN "price_unit",
DROP COLUMN "unit",
ALTER COLUMN "storage" SET DEFAULT '常温';

-- AlterTable
ALTER TABLE "inventory" DROP COLUMN "seasoning_ingredient_id";

-- AlterTable
ALTER TABLE "inventory_ledger" DROP COLUMN "seasoning_ingredient_id";

-- AlterTable
ALTER TABLE "purchase_receipt_items" DROP COLUMN "seasoning_ingredient_id";

-- DropTable
DROP TABLE "seasoning_ingredients";

