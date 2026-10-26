-- ============================================================
-- 2026-10-26: 补齐 Schema 与数据库不一致的列
-- 根因：迁移脚本未覆盖 NetIngredient / SauceIngredient 的时间字段
-- 影响：阿里云部署后 /ingredients 页面 Prisma 查询报错
-- ============================================================

-- === net_ingredients ===
-- source_ingredient_id: Schema 定义为 Int? (可空)，但数据库为 NOT NULL
ALTER TABLE "net_ingredients" ALTER COLUMN "source_ingredient_id" DROP NOT NULL;

-- yield_rate: Schema 定义为 Decimal? (可空)，但数据库为 NOT NULL
ALTER TABLE "net_ingredients" ALTER COLUMN "yield_rate" DROP NOT NULL;

-- 缺失时间字段
ALTER TABLE "net_ingredients" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "net_ingredients" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL;
ALTER TABLE "net_ingredients" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- 补齐索引（Schema 定义了 @@index，但迁移没创建）
CREATE INDEX IF NOT EXISTS "net_ingredients_source_ingredient_id_idx" ON "net_ingredients"("source_ingredient_id");
CREATE INDEX IF NOT EXISTS "net_ingredients_deleted_at_idx" ON "net_ingredients"("deleted_at");
CREATE INDEX IF NOT EXISTS "net_ingredients_l2_code_idx" ON "net_ingredients"("l2_code");

-- === sauce_ingredients ===
-- 缺失 spec 字段
ALTER TABLE "sauce_ingredients" ADD COLUMN "spec" TEXT;

-- 缺失 type 字段
ALTER TABLE "sauce_ingredients" ADD COLUMN "type" TEXT NOT NULL;

-- 数据库残留 storage 字段（Schema 已移除）
ALTER TABLE "sauce_ingredients" DROP COLUMN IF EXISTS "storage";

-- unit 默认值修正为 'g'（Schema 定义 @default("g")）
ALTER TABLE "sauce_ingredients" ALTER COLUMN "unit" SET DEFAULT 'g';

-- 缺失时间字段
ALTER TABLE "sauce_ingredients" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sauce_ingredients" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL;
