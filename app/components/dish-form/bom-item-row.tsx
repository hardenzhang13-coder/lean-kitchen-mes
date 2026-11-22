"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/app/components/ui/form-controls";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { BomItem, BomType, calcCost, formatCost } from "./types";
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
    <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_100px_80px_28px] items-center gap-2 rounded-md border p-2 min-h-[44px]">
      <span className="text-center text-sm text-muted-foreground">{index + 1}</span>

      <div className="min-w-0">
        <CategoryTag l2Code={item.l2Code} name={item.name} />
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
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>

      <span
        className={cn(
          "text-sm text-right",
          item.cost == null ? "text-muted-foreground" : "font-medium text-foreground"
        )}
      >
        {formatCost(item.cost)}
      </span>

      {!readOnly && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-7 w-7 text-destructive shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
