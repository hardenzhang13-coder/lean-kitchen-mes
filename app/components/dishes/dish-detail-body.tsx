"use client";

import { useMemo } from "react";
import { DataTable } from "@/app/components/ui/data-table";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { MeatTypeTag } from "@/app/components/ui/meat-type-tag";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { SkeuChipTag } from "@/app/components/ui/skeu-chip";
import {
  BOM_TYPE_LABELS,
  BOM_TYPE_TONES,
  calcGrossMarginPercent,
  formatCost,
  type DishDetail,
} from "@/app/components/dish-form/types";
import { buildDishBomRows, sumDishBomCost } from "./dish-bom-rows";
import { cn } from "@/lib/shared/utils";

export const formatDishDateTime = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * 菜品档案预览：路由详情页与列表正面弹窗共用。
 * 只有两块——主字段卡片（名称 + 荤素/类别/份量标签 + 毛利率/售价）+ 菜品用料；
 * 编号与创建时间收进页面/弹窗标题区，这里不再重复。
 */
export function DishDetailBody({ dish }: { dish: DishDetail }) {
  const bomRows = useMemo(() => buildDishBomRows(dish), [dish]);
  const computedCost = useMemo(() => sumDishBomCost(bomRows), [bomRows]);
  const margin = calcGrossMarginPercent(computedCost, dish.price);

  return (
    <div className="space-y-3">
      <div className="skeu-panel flex items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold">{dish.name}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <MeatTypeTag type={dish.meatType} />
            {dish.category ? (
              <CategoryTag l1Code={dish.category.code} name={dish.category.name} />
            ) : (
              <EmptyValue />
            )}
            <PortionTag portion={dish.portion} />
          </div>
        </div>
        <div className="flex shrink-0 items-end gap-6 text-right">
          <div>
            <div className="text-xs font-medium text-muted-foreground">毛利率（%）</div>
            <div
              className={cn(
                "text-base font-bold tabular-nums",
                margin != null && margin < 0 ? "text-destructive" : "text-foreground"
              )}
            >
              {margin != null ? `${margin}%` : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground">售价（元/份）</div>
            <div className="text-xl font-bold tabular-nums text-primary">
              {formatCost(dish.price)}
            </div>
          </div>
        </div>
      </div>

      <section className="skeu-panel overflow-hidden">
        <header className="skeu-surface-muted flex items-center justify-between border-b border-skeu-border px-5 py-3.5">
          <h3 className="text-sm font-semibold">菜品用料</h3>
          <span className="text-sm text-muted-foreground">
            估算成本：
            <span className="text-base font-bold tabular-nums text-primary">
              {formatCost(computedCost)}
            </span>
          </span>
        </header>
        <div className="skeu-panel-body p-4">
          <DataTable
            data={bomRows}
            variant="skeu"
            columns={[
              {
                header: "序号",
                className: "w-[48px]",
                cell: (_, rowIdx) => (
                  <span className="text-muted-foreground">{rowIdx + 1}</span>
                ),
              },
              {
                header: "类型",
                className: "w-[72px]",
                cell: (row) => (
                  <SkeuChipTag tone={BOM_TYPE_TONES[row.type]}>
                    {BOM_TYPE_LABELS[row.type]}
                  </SkeuChipTag>
                ),
              },
              {
                header: "名称",
                cell: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                header: "规格",
                cell: (row) => (
                  <span className="text-muted-foreground">
                    {row.type === "sauce" ? row.productName || "—" : row.spec || "—"}
                  </span>
                ),
              },
              {
                header: "份量",
                className: "w-[110px]",
                cell: (row) =>
                  row.portion ? <PortionTag portion={row.portion} /> : <EmptyValue />,
              },
              {
                header: "用量",
                className: "w-[90px]",
                cell: (row) => (
                  <span className="font-medium tabular-nums">
                    {row.amountG != null ? `${row.amountG}g` : "—"}
                  </span>
                ),
              },
              {
                header: "成本价",
                className: "w-[100px] text-right",
                cell: (row) => (
                  <span className="font-semibold tabular-nums">
                    {formatCost(row.cost)}
                  </span>
                ),
              },
            ]}
            emptyState={{ title: "暂无用料" }}
          />
        </div>
      </section>
    </div>
  );
}
