"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { BomType, BomItem, BOM_TYPE_LABELS, BOM_TYPE_TONES, totalBomCost, formatCost, calcCost, IngredientOption } from "./types";
import { BomItemRow } from "./bom-item-row";
import { BomPickerDialog } from "./bom-picker-dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuChipTag } from "@/app/components/ui/skeu-chip";

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

  const handleRemove = (type: BomType, index: number) => {
    const next = [...bom[type]];
    next.splice(index, 1);
    updateType(type, next);
  };

  /** 行内编辑（调料改克数）：合并补丁并即时重算行成本 */
  const handleUpdateItem = (
    type: BomType,
    index: number,
    patch: Partial<BomItem>
  ) => {
    const next = [...bom[type]];
    const current = next[index];
    if (!current) return;
    next[index] = { ...current, ...patch };
    updateType(type, next);
  };

  const totalCost = totalBomCost(bom);

  return (
    <section className="skeu-panel">
      <header className="skeu-surface-muted flex items-center justify-between border-b border-skeu-border px-5 py-3.5">
        <h3 className="text-sm font-semibold">菜品用料</h3>
        <span className="text-sm text-muted-foreground">
          估算成本：
          <span className="text-base font-bold tabular-nums text-primary">
            {formatCost(totalCost)}
          </span>
        </span>
      </header>
      <div className="space-y-3 p-4">
        {(Object.keys(bom) as BomType[]).map((type) => (
          <BomSection
            key={type}
            type={type}
            items={bom[type]}
            onAdd={() => openPicker(type)}
            onRemove={(idx) => handleRemove(type, idx)}
            onUpdate={(idx, patch) => handleUpdateItem(type, idx, patch)}
            readOnly={readOnly}
          />
        ))}
      </div>

      {pickerType && (
        <BomPickerDialog
          key={pickerKey}
          open={pickerType != null}
          onOpenChange={(open) => !open && setPickerType(null)}
          type={pickerType}
          onSelect={(items) => {
            if (!pickerType) return;
            const newItems = items.map(({ option, amountG }) => {
              // 调料产物按克需求手填（弹窗默认值 10g）；其余类型沿用食材规格
              const parsed = Number(amountG);
              const fallback = pickerType === "seasoning" ? 10 : 100;
              const amount =
                Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
              // 统一元/斤口径：净料/小料 = 出库价、调料产物 = 出库价（旧口径行 = 每斤单价）
              const costBase = option.costPrice ?? null;
              return {
                id: `${pickerType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                sourceId: option.id,
                // 调料产物行：option.id 即 SeasoningProduct.id
                specId: pickerType === "seasoning" ? option.id : null,
                name: option.name,
                productName: option.productName,
                spec: option.spec,
                amountG: String(amount),
                unitPrice: option.unitPrice ?? 0,
                unit: option.unit || "g",
                costPrice: option.costPrice ?? null,
                cost: calcCost(pickerType, costBase, amount),
                portion: option.portion ?? null,
                productType: option.productType ?? null,
                sourceMode: option.sourceMode ?? null,
                l1Code: option.l1Code,
                l2Code: option.l2Code,
              } as BomItem;
            });
            updateType(pickerType, [...bom[pickerType], ...newItems]);
            setPickerType(null);
          }}
          refs={refs}
          onLoadItems={onLoadItems}
          // 调料按克需求手填：弹窗底部给出默认克数（10g），行内仍可改
          showAmountInput={pickerType === "seasoning"}
          defaultAmountG="10"
          singleSelect
        />
      )}
    </section>
  );
}

function BomSection({
  type,
  items,
  onAdd,
  onRemove,
  onUpdate,
  readOnly,
}: {
  type: BomType;
  items: BomItem[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<BomItem>) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="skeu-surface-muted rounded-lg border border-skeu-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{BOM_TYPE_LABELS[type]}</span>
          <SkeuChipTag tone={BOM_TYPE_TONES[type]}>{items.length} 项</SkeuChipTag>
        </div>
        {/* 酱料机制已业务剥离：存量行只读展示，不再提供添加入口 */}
        {!readOnly && type !== "sauce" && (
          <SkeuButton type="button" variant="outline" size="sm" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
            添加
          </SkeuButton>
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
              onRemove={() => onRemove(idx)}
              onChange={(next) => onUpdate(idx, next)}
              readOnly={readOnly}
            />
          ))
        )}
      </div>
    </div>
  );
}
