"use client";

import { X } from "lucide-react";
import { Input } from "@/app/components/ui/form-controls";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { SkeuChipTag } from "@/app/components/ui/skeu-chip";
import { SkeuIconAction } from "@/app/components/ui/skeu-row-action";
import { BomItem, BomType, BOM_TYPE_TONES, calcCost, formatCost } from "./types";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { cn } from "@/lib/shared/utils";

interface BomItemRowProps {
  item: BomItem;
  type: BomType;
  index: number;
  onRemove: () => void;
  /** 行内编辑回调（调料改克数时回传新行） */
  onChange?: (item: BomItem) => void;
  readOnly?: boolean;
}

const isSauce = (type: BomType) => type === "sauce";
/** 调料按克需求手填；净料/小料用量取档案封装规格，酱料取配方克数 */
const isSeasoning = (type: BomType) => type === "seasoning";

export function BomItemRow({
  item,
  type,
  index,
  onRemove,
  onChange,
  readOnly,
}: BomItemRowProps) {
  const displayValue = isSauce(type) ? item.productName || "—" : item.spec || "—";
  const displayLabel = isSauce(type) ? "商品名称" : "规格";

  const handleAmountChange = (value: string) => {
    if (!onChange) return;
    const amount = Number(value);
    const valid = Number.isFinite(amount) && amount > 0 ? amount : 0;
    // 调料成本 = 每斤单价（元/斤）× 克需求 ÷ 500
    onChange({ ...item, amountG: value, cost: calcCost(type, item.costPrice ?? null, valid) });
  };

  return (
    <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_100px_80px_40px] items-center gap-2 rounded-md border p-2 min-h-[44px]">
      <span className="text-center text-sm text-muted-foreground">{index + 1}</span>

      <div className="min-w-0">
        {/* 名称胶囊按用料类型着色（主蓝/辅绿/小料琥珀/调料紫/酱红），不再用灰色系分类胶囊 */}
        <SkeuChipTag tone={BOM_TYPE_TONES[type]} className="max-w-full">
          <span className="truncate">{item.name}</span>
        </SkeuChipTag>
      </div>

      <span
        className="text-sm text-muted-foreground truncate"
        title={`${displayLabel}：${displayValue}`}
      >
        {displayValue}
      </span>

      <div className="min-w-0">
        {isSeasoning(type) ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              step={1}
              value={item.amountG}
              onChange={(e) => handleAmountChange(e.target.value)}
              disabled={readOnly || !onChange}
              aria-label={`${item.name} 用量`}
              className="h-8 w-[62px] px-2 text-sm tabular-nums"
            />
            <span className="text-sm text-muted-foreground">g</span>
          </div>
        ) : item.portion ? (
          <PortionTag portion={item.portion} />
        ) : (
          <EmptyValue className="text-sm" />
        )}
      </div>

      <span
        className={cn(
          "text-sm text-right",
          item.cost == null ? "text-muted-foreground" : "font-semibold text-foreground"
        )}
      >
        {formatCost(item.cost)}
      </span>

      {!readOnly && (
        <SkeuIconAction
          label={`移除 ${item.name}`}
          tip="移除"
          icon={<X className="h-4 w-4" />}
          onClick={onRemove}
          className="text-destructive"
        />
      )}
    </div>
  );
}
