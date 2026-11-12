import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import type { PlanCuttingRow } from "@/lib/shared/prepped-stock";
import { buildPrepLabels } from "@/lib/shared/prep-label";
import { LabelPrintView } from "./label-print-view";

export default async function ProductionPlanLabelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sourceType?: string | string[];
    sourceId?: string | string[];
    copies?: string | string[];
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const planId = Number(id);
  if (!Number.isInteger(planId) || planId <= 0) notFound();

  const plan = await prisma.productionPlan.findFirst({
    where: { id: planId, deletedAt: null },
    select: { cuttingJson: true },
  });
  if (!plan) notFound();

  const rows = (Array.isArray(plan.cuttingJson) ? plan.cuttingJson : []) as unknown as PlanCuttingRow[];
  const sourceIds = [...new Set(rows.map((row) => row.sourceId))];
  const ingredients = sourceIds.length
    ? await prisma.netIngredient.findMany({
        where: { id: { in: sourceIds }, deletedAt: null },
        select: {
          id: true,
          name: true,
          packageSpec: true,
          packageMaterial: true,
          packageSize: true,
        },
      })
    : [];
  const result = buildPrepLabels(
    rows,
    ingredients.map((item) => ({
      id: item.id,
      name: item.name,
      packageSpec: item.packageSpec,
      packageMaterial: item.packageMaterial,
      packageSize: item.packageSize,
    }))
  );

  const firstValue = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const sourceType = firstValue(query.sourceType);
  const sourceIdText = firstValue(query.sourceId);
  const copiesText = firstValue(query.copies);
  const hasItemSelection = sourceType !== undefined || sourceIdText !== undefined || copiesText !== undefined;

  let labels = result.labels;
  if (hasItemSelection) {
    const sourceId = Number(sourceIdText);
    const copies = Number(copiesText);
    if (
      !sourceType ||
      !Number.isInteger(sourceId) ||
      sourceId <= 0 ||
      !Number.isInteger(copies) ||
      copies <= 0
    ) {
      notFound();
    }

    const selected = result.labels.find(
      (item) => item.sourceType === sourceType && item.sourceId === sourceId
    );
    if (!selected || copies > selected.copies) notFound();
    labels = [{ ...selected, copies }];
  }

  const selectedTotalCopies = labels.reduce((sum, item) => sum + item.copies, 0);
  if (selectedTotalCopies === 0) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <h1 className="text-xl font-bold">无法生成净菜标签</h1>
        <p className="text-sm text-muted-foreground">生产计划单中没有可打印的完整净菜包装。</p>
        {result.skipped.length > 0 && (
          <ul className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {result.skipped.map((item) => (
              <li key={`${item.sourceType}:${item.sourceId}`}>
                {item.itemName}：{item.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <>
      <LabelPrintView labels={labels} />
      {!hasItemSelection && result.skipped.length > 0 && (
        <div className="label-print-warning m-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
          以下净菜未生成标签：
          {result.skipped.map((item) => `${item.itemName}（${item.reason}）`).join("；")}
        </div>
      )}
    </>
  );
}
