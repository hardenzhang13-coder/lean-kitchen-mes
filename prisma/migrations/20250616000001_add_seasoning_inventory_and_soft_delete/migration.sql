-- DropForeignKey
ALTER TABLE "inventory" DROP CONSTRAINT "inventory_ingredient_id_fkey";

-- DropForeignKey
ALTER TABLE "inventory_ledger" DROP CONSTRAINT "inventory_ledger_ingredient_id_fkey";

-- AlterTable
ALTER TABLE "ingredients" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "seasoning_ingredient_id" INTEGER,
ALTER COLUMN "ingredient_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "inventory_ledger" ADD COLUMN     "seasoning_ingredient_id" INTEGER,
ALTER COLUMN "ingredient_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "seasoning_ingredients" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_seasoning_ingredient_id_key" ON "inventory"("seasoning_ingredient_id");

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_seasoning_ingredient_id_fkey" FOREIGN KEY ("seasoning_ingredient_id") REFERENCES "seasoning_ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_ledger" ADD CONSTRAINT "inventory_ledger_seasoning_ingredient_id_fkey" FOREIGN KEY ("seasoning_ingredient_id") REFERENCES "seasoning_ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

