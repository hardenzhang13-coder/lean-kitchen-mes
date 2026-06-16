-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."cutting_orders" (
    "id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "spec" TEXT,
    "required_qty" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "actual_qty" DECIMAL(10,2),
    "item_name" TEXT NOT NULL,
    "l1_code" TEXT,
    "l2_code" TEXT,
    "source_id" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL,

    CONSTRAINT "cutting_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dish_categories" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "dish_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dish_net_details" (
    "id" SERIAL NOT NULL,
    "dish_id" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "net_ing_id" INTEGER NOT NULL,
    "amount_g" DECIMAL(10,2) NOT NULL,
    "spec" TEXT,
    "cost" DECIMAL(10,2),

    CONSTRAINT "dish_net_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dish_processes" (
    "id" SERIAL NOT NULL,
    "dish_id" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "step_no" INTEGER NOT NULL,
    "object" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "tool" TEXT,
    "standard" TEXT,

    CONSTRAINT "dish_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dish_sauce_details" (
    "id" SERIAL NOT NULL,
    "dish_id" INTEGER NOT NULL,
    "sauce_id" INTEGER NOT NULL,
    "amount_g" DECIMAL(10,2) NOT NULL,
    "brand" TEXT,
    "cost" DECIMAL(10,2),

    CONSTRAINT "dish_sauce_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dish_seasoning_details" (
    "id" SERIAL NOT NULL,
    "dish_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "source_id" INTEGER NOT NULL,
    "amount_g" DECIMAL(10,2) NOT NULL,
    "brand" TEXT,
    "cost" DECIMAL(10,2),

    CONSTRAINT "dish_seasoning_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dishes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "intro" TEXT,
    "category_id" INTEGER NOT NULL,
    "cuisine" TEXT,
    "technique" TEXT,
    "taste" TEXT,
    "portion" TEXT NOT NULL DEFAULT '正餐份量',
    "season" TEXT NOT NULL DEFAULT '四季',
    "meat_type" TEXT,
    "cost" DECIMAL(10,2),
    "operator" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingredient_categories_l1" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ingredient_categories_l1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingredient_categories_l2" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_code" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "ingredient_categories_l2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ingredients" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alias" TEXT,
    "l2_code" TEXT NOT NULL,
    "price_unit" TEXT NOT NULL,
    "purchase_spec" TEXT,
    "season" TEXT NOT NULL DEFAULT '四季',
    "storage" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "brand" TEXT,
    "latest_ref_price" DECIMAL(10,2),
    "purchase_unit" TEXT,
    "stock_unit" TEXT,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory" (
    "id" SERIAL NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "current_qty" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."inventory_ledger" (
    "id" SERIAL NOT NULL,
    "ingredient_id" INTEGER NOT NULL,
    "change_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "change_type" TEXT NOT NULL,
    "change_qty" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL,
    "source" TEXT NOT NULL,
    "operator" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settlement_status" TEXT NOT NULL DEFAULT '待结算',

    CONSTRAINT "inventory_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."minor_ingredients" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "origin" TEXT,
    "spec" TEXT,
    "storage" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '10g',
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "minor_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."net_ingredients" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source_ingredient_id" INTEGER NOT NULL,
    "spec" TEXT,
    "yield_rate" DECIMAL(5,2) NOT NULL,
    "l2_code" TEXT NOT NULL,
    "storage" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '500g',
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "net_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."operation_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" INTEGER,
    "description" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_plans" (
    "id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "gross_need" DECIMAL(10,2) NOT NULL,
    "stock_deducted" DECIMAL(10,2) NOT NULL,
    "suggested_purchase" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "actual_amount" DECIMAL(10,2),
    "actual_purchase" DECIMAL(10,2),
    "item_name" TEXT NOT NULL,
    "l2_code" TEXT,
    "price_unit" TEXT,
    "purchase_spec" TEXT,
    "source_id" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL,

    CONSTRAINT "purchase_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_receipt_items" (
    "id" SERIAL NOT NULL,
    "receipt_id" INTEGER NOT NULL,
    "ingredient_id" INTEGER,
    "item_name" TEXT NOT NULL,
    "spec" TEXT,
    "qty" DECIMAL(10,2) NOT NULL,
    "price_unit" TEXT NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "stock_unit" TEXT NOT NULL,
    "stock_in_qty" DECIMAL(10,2) NOT NULL,
    "storage" TEXT NOT NULL,
    "brand" TEXT,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "l2_code" TEXT,
    "l2_name" TEXT,
    "purchase_unit" TEXT,
    "seasoning_ingredient_id" INTEGER,

    CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_receipts" (
    "id" SERIAL NOT NULL,
    "receipt_date" DATE NOT NULL,
    "supplier_id" INTEGER,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "operator" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT '待结算',
    "summary" TEXT,
    "supplier_name" TEXT,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."purchase_reimbursements" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "receipt_ids" INTEGER[],
    "total_amount" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "operator" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_reimbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sauce_ingredients" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "recipe" TEXT,
    "storage" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "sauce_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."schedule_items" (
    "id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "dish_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."schedules" (
    "id" SERIAL NOT NULL,
    "schedule_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT '待生效',
    "operator" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '全部食堂',
    "title" TEXT NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."seasoning_ingredients" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "product_spec" TEXT,
    "product_unit" TEXT,
    "purchase_price" DECIMAL(10,2) NOT NULL,
    "purchase_unit" TEXT NOT NULL,
    "retail_price" DECIMAL(10,2),
    "storage" TEXT NOT NULL,
    "l2_code" TEXT,
    "latest_ref_price" DECIMAL(10,2),
    "stock_unit" TEXT,

    CONSTRAINT "seasoning_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."suppliers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "remark" TEXT,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."units" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "role" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dish_categories_code_key" ON "public"."dish_categories"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "dishes_code_key" ON "public"."dishes"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_categories_l1_code_key" ON "public"."ingredient_categories_l1"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ingredient_categories_l2_code_key" ON "public"."ingredient_categories_l2"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_code_key" ON "public"."ingredients"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_ingredient_id_key" ON "public"."inventory"("ingredient_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "minor_ingredients_code_key" ON "public"."minor_ingredients"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "net_ingredients_code_key" ON "public"."net_ingredients"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "sauce_ingredients_code_key" ON "public"."sauce_ingredients"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "seasoning_ingredients_code_key" ON "public"."seasoning_ingredients"("code" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "units_name_key" ON "public"."units"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username" ASC);

-- AddForeignKey
ALTER TABLE "public"."cutting_orders" ADD CONSTRAINT "cutting_orders_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dish_net_details" ADD CONSTRAINT "dish_net_details_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dish_net_details" ADD CONSTRAINT "dish_net_details_net_ing_id_fkey" FOREIGN KEY ("net_ing_id") REFERENCES "public"."net_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dish_processes" ADD CONSTRAINT "dish_processes_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dish_sauce_details" ADD CONSTRAINT "dish_sauce_details_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dish_sauce_details" ADD CONSTRAINT "dish_sauce_details_sauce_id_fkey" FOREIGN KEY ("sauce_id") REFERENCES "public"."sauce_ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dish_seasoning_details" ADD CONSTRAINT "dish_seasoning_details_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dishes" ADD CONSTRAINT "dishes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."dish_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ingredient_categories_l2" ADD CONSTRAINT "ingredient_categories_l2_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "public"."ingredient_categories_l1"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory" ADD CONSTRAINT "inventory_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."net_ingredients" ADD CONSTRAINT "net_ingredients_source_ingredient_id_fkey" FOREIGN KEY ("source_ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."operation_logs" ADD CONSTRAINT "operation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_plans" ADD CONSTRAINT "purchase_plans_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "public"."purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_seasoning_ingredient_id_fkey" FOREIGN KEY ("seasoning_ingredient_id") REFERENCES "public"."seasoning_ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."purchase_receipts" ADD CONSTRAINT "purchase_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."schedule_items" ADD CONSTRAINT "schedule_items_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."schedule_items" ADD CONSTRAINT "schedule_items_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

