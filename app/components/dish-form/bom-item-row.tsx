"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { BomItem, BomType, formatCost } from "./types";
import { cn } from "@/lib/shared/utils";

interface BomItemRowProps {
  item: BomItem;
  type: BomType;
  index: number;
  onRemove: () => void;
  readOnly?: boolean;
}

const isSauce = (type: BomType) => type === "sauce";

export function BomItemRow({ item, type, index, onRemove, readOnly }: BomItemRowProps) {
  const displayValue = isSauce(type) ? item.productName || "—" : item.spec || "—";
  const displayLabel = isSauce(type) ? "商品名称" : "规格";

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
        {item.portion ? (
          <PortionTag portion={item.portion} />
        ) : (
          <EmptyValue className="text-sm" />
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
