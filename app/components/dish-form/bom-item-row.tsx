"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CategoryTag } from "@/app/components/category-tag";
import { BomItem, BomType, calcCost, formatCost } from "./types";
import { cn } from "@/lib/utils";

interface BomItemRowProps {
  item: BomItem;
  type: BomType;
  index: number;
  onChange: (item: BomItem) => void;
  onRemove: () => void;
  readOnly?: boolean;
}

const isSeasoningOrSauce = (type: BomType) => type === "seasoning" || type === "sauce";

export function BomItemRow({ item, type, index, onChange, onRemove, readOnly }: BomItemRowProps) {
  const handleBlur = () => {
    const cost = calcCost(item.unitPrice, item.amountG);
    onChange({ ...item, cost });
  };

  const displayValue = isSeasoningOrSauce(type)
    ? item.productName || "—"
    : item.spec || "—";
  const displayLabel = isSeasoningOrSauce(type) ? "商品名称" : "规格";

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

      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          step={1}
          value={item.amountG}
          onChange={(e) => onChange({ ...item, amountG: e.target.value })}
          onBlur={handleBlur}
          disabled={readOnly}
          className="h-9 text-sm px-2 font-semibold bg-muted/40 w-full"
        />
        <span className="text-sm font-semibold">g</span>
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
