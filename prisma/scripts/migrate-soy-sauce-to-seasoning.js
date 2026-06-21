require("dotenv/config");
const { Client } = require("pg");

const TARGET_L2_CODE = "SEA-NET";
const TARGET_NAME = "生抽";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[migrate] DATABASE_URL is not set");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("BEGIN");

    const { rows: sourceRows } = await client.query(
      "SELECT id, code, name, alias, l2_code, purchase_spec, purchase_unit, stock_unit, latest_ref_price FROM ingredients WHERE name = $1 AND deleted_at IS NULL ORDER BY id ASC LIMIT 1",
      [TARGET_NAME]
    );
    if (sourceRows.length === 0) {
      throw new Error(`未找到名称为"${TARGET_NAME}"的原料`);
    }
    const source = sourceRows[0];

    const { rows: catRows } = await client.query(
      "SELECT code, name FROM ingredient_categories_l2 WHERE code = $1",
      [TARGET_L2_CODE]
    );
    if (catRows.length === 0) {
      throw new Error(`调料分类 ${TARGET_L2_CODE} 不存在`);
    }

    if (source.l2_code === TARGET_L2_CODE) {
      await client.query("COMMIT");
      console.log("[migrate] 无需迁移");
      console.log(`  id: ${source.id}`);
      console.log(`  code: ${source.code}`);
      console.log(`  name: ${source.name}`);
      console.log(`  l2_code: ${source.l2_code} (${catRows[0].name})`);
      console.log("  原因：该记录已处于调料分类");
      return;
    }

    await client.query(
      "UPDATE ingredients SET l2_code = $1 WHERE id = $2",
      [TARGET_L2_CODE, source.id]
    );

    await client.query("COMMIT");
    console.log("[migrate] 迁移成功");
    console.log(`  id: ${source.id}`);
    console.log(`  code: ${source.code}`);
    console.log(`  name: ${source.name}`);
    console.log(`  old l2_code: ${source.l2_code}`);
    console.log(`  new l2_code: ${TARGET_L2_CODE} (${catRows[0].name})`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[migrate] 迁移失败:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[migrate] 未捕获异常:", error);
  process.exit(1);
});
