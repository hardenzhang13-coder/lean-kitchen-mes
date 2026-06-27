"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BomType, BomItem, BOM_TYPE_LABELS, totalBomCost, formatCost, IngredientOption } from "./types";
import { BomItemRow } from "./bom-item-row";
import { BomPickerDialog } from "./bom-picker-dialog";

interface BomEditorProps {
  bom: Record<BomType, BomItem[]>;
  onChange: (bom: Record<BomType, BomItem[]>) => void;
  refs: {
    ingredientCategories: Array<{ code: string; name: string; children?: Array<{ code: string; name: string; parentCode: string }> }>;
  };
  onLoadItems: (params: {
    type: BomType;
    l1Code?: string;
    l2Code?: string;
    q?: string;
  }) => Promise<IngredientOption[]>;
  readOnly?: boolean;
}

export function BomEditor({ bom, onChange, refs, onLoadItems, readOnly }: BomEditorProps) {
  const [pickerType, setPickerType] = useState<BomType | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  const openPicker = (type: BomType) => {
    setPickerType(type);
    setPickerKey((k) => k + 1);
  };

  const updateType = (type: BomType, items: BomItem[]) => {
    onChange({ ...bom, [type]: items });
  };

  const handleUpdate = (type: BomType, index: number, item: BomItem) => {
    const next = [...bom[type]];
    next[index] = item;
    updateType(type, next);
  };

  const handleRemove = (type: BomType, index: number) => {
    const next = [...bom[type]];
    next.splice(index, 1);
    updateType(type, next);
  };

  const totalCost = totalBomCost(bom);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-heading font-medium">菜品用料</CardTitle>
          <span className="text-sm text-muted-foreground">
            估算成本：
            <span className="font-medium text-foreground">{formatCost(totalCost)}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(Object.keys(bom) as BomType[]).map((type) => (
          <BomSection
            key={type}
            type={type}
            items={bom[type]}
            onAdd={() => openPicker(type)}
            onUpdate={(idx, item) => handleUpdate(type, idx, item)}
            onRemove={(idx) => handleRemove(type, idx)}
            readOnly={readOnly}
          />
        ))}
      </CardContent>

      {pickerType && (
        <BomPickerDialog
          key={pickerKey}
          open={pickerType != null}
          onOpenChange={(open) => !open && setPickerType(null)}
          type={pickerType}
          onSelect={(items) => {
            if (!pickerType) return;
            const newItems = items.map(({ option, amountG }) => {
              const amount = Number(amountG) || 100;
              return {
                id: `${pickerType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                sourceId: option.id,
                name: option.name,
                productName: option.productName,
                spec: option.spec,
                amountG: String(amount),
                unitPrice: option.unitPrice ?? 0,
                unit: option.unit || "g",
                cost: option.unitPrice != null
                  ? Number((option.unitPrice * amount / 1000).toFixed(4))
                  : null,
                l1Code: option.l1Code,
                l2Code: option.l2Code,
              } as BomItem;
            });
            updateType(pickerType, [...bom[pickerType], ...newItems]);
            setPickerType(null);
          }}
          refs={refs}
          onLoadItems={onLoadItems}
        />
      )}
    </Card>
  );
}

function BomSection({
  type,
  items,
  onAdd,
  onUpdate,
  onRemove,
  readOnly,
}: {
  type: BomType;
  items: BomItem[];
  onAdd: () => void;
  onUpdate: (index: number, item: BomItem) => void;
  onRemove: (index: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{BOM_TYPE_LABELS[type]}</span>
          <Badge variant="outline" className="text-xs">{items.length} 项</Badge>
        </div>
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={onAdd} className="h-8 text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" />
            添加
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-1">
            暂无{BOM_TYPE_LABELS[type]}
          </p>
        ) : (
          items.map((item, idx) => (
            <BomItemRow
              key={item.id}
              type={type}
              index={idx}
              item={item}
              onChange={(next) => onUpdate(idx, next)}
              onRemove={() => onRemove(idx)}
              readOnly={readOnly}
            />
          ))
        )}
      </div>
    </div>
  );
}
