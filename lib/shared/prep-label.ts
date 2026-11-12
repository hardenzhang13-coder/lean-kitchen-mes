import type { PlanCuttingRow } from "./prepped-stock";

export interface PrepLabelIngredient {
  id: number;
  name: string;
  packageSpec: number | null;
  packageMaterial: string | null;
  packageSize: string | null;
}

export interface PrepLabelItem {
  sourceType: string;
  sourceId: number;
  itemName: string;
  packageSpec: number;
  packageMaterial: string | null;
  packageSize: string | null;
  copies: number;
}

export interface SkippedPrepLabel {
  sourceType: string;
  sourceId: number;
  itemName: string;
  reason: string;
}

export interface PrepLabelBuildResult {
  labels: PrepLabelItem[];
  skipped: SkippedPrepLabel[];
  totalCopies: number;
}

type LabelSourceRow = Pick<
  PlanCuttingRow,
  "sourceType" | "sourceId" | "sourceCode" | "itemName" | "requiredQty"
>;

/** 标签张数按完整标准包装计算；生产数据应保证用量与包装规格整除。 */
export function calculatePrepLabelCopies(requiredQty: number, packageSpec: number): number {
  if (!Number.isFinite(requiredQty) || !Number.isFinite(packageSpec) || packageSpec <= 0) {
    return 0;
  }

  const copies = Math.round(requiredQty / packageSpec);
  return copies > 0 ? copies : 0;
}

/** 标签名称和包装规格直接取净料/小料档案；计划行只提供本次生产用量。 */
export function buildPrepLabels(
  rows: LabelSourceRow[],
  ingredients: PrepLabelIngredient[]
): PrepLabelBuildResult {
  const ingredientById = new Map(ingredients.map((item) => [item.id, item]));
  const labels: PrepLabelItem[] = [];
  const skipped: SkippedPrepLabel[] = [];

  for (const row of rows) {
    const ingredient = ingredientById.get(row.sourceId);
    if (!ingredient) {
      skipped.push({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        itemName: row.itemName,
        reason: "净料/小料档案不存在或已停用",
      });
      continue;
    }

    const packageSpec = ingredient.packageSpec;
    const copies = packageSpec == null ? 0 : calculatePrepLabelCopies(row.requiredQty, packageSpec);
    if (packageSpec == null || packageSpec <= 0) {
      skipped.push({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        itemName: ingredient.name,
        reason: "缺少有效包装规格",
      });
      continue;
    }
    if (copies === 0) {
      skipped.push({
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        itemName: ingredient.name,
        reason: "计划用量不足一个完整包装",
      });
      continue;
    }

    labels.push({
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      itemName: ingredient.name,
      packageSpec,
      packageMaterial: ingredient.packageMaterial,
      packageSize: ingredient.packageSize,
      copies,
    });
  }

  return {
    labels,
    skipped,
    totalCopies: labels.reduce((sum, item) => sum + item.copies, 0),
  };
}

/** 生产日期取实际打印日期时间，精确到分；默认浏览器/服务器本地时区。 */
export function formatPrepLabelDate(date: Date, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")} ${values.get("hour")}:${values.get("minute")}`;
}
