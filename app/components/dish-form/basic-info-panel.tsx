"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/app/components/ui/form-controls";
import { FormField, FormSection } from "@/app/components/ui/form-field";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { DishFormData, calcPriceByMargin } from "./types";
import { PORTION_OPTIONS } from "@/lib/shared/portion-scale";
import {
  CUISINE_OPTIONS as cuisineOptions,
  MEAT_TYPE_OPTIONS as meatTypeOptions,
  SEASON_OPTIONS as seasonOptions,
  TASTE_OPTIONS as tasteOptions,
  TECHNIQUE_OPTIONS as techniqueOptions,
} from "@/lib/shared/dish-enums";

interface BasicInfoPanelProps {
  data: DishFormData;
  onChange: (data: DishFormData) => void;
  categories: Array<{ id: number; code: string; name: string }>;
  /** 当前菜品成本（BOM 估算值），用于毛利率 ↔ 售价联动计算 */
  cost?: number | null;
  readOnly?: boolean;
}

// 份量与净料/小料档案共用同一套枚举（lib/shared/portion-scale.ts），避免建档时填错口径
const portionOptions = PORTION_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
  description: option.description,
}));

export function BasicInfoPanel({ data, onChange, categories, cost, readOnly }: BasicInfoPanelProps) {
  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: c.name }));

  // 毛利率本地编辑态：null 表示跟随售价派生显示；编辑中保留原始输入，避免派生值归一化打断输入/清空
  const [marginInput, setMarginInput] = useState<string | null>(null);
  // 标记本次售价变化来自毛利率输入，避免 effect 重置编辑态
  const marginFromInputRef = useRef(false);

  useEffect(() => {
    if (marginFromInputRef.current) {
      marginFromInputRef.current = false;
      return;
    }
    setMarginInput(null);
  }, [data.price]);

  const priceNum = data.price ? parseFloat(data.price) : null;
  const marginDerived =
    cost != null && priceNum != null && priceNum > 0
      ? Number((((priceNum - cost) / priceNum) * 100).toFixed(1))
      : null;
  const marginValue =
    marginInput !== null ? marginInput : marginDerived != null ? String(marginDerived) : "";

  const update = (patch: Partial<DishFormData>) => {
    onChange({ ...data, ...patch });
  };

  return (
    <div className="space-y-3">
      <FormSection
        title="基本信息"
        cols={2}
        className="p-4 sm:p-4 [&>div:last-child]:gap-4"
      >
        <FormField id="name" label="菜品名称" required readOnly={readOnly}>
          <Input
            id="name"
            value={data.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="请输入菜品名称"
            disabled={readOnly}
            className="h-11 text-base px-4"
          />
        </FormField>

        <FormField id="portion" label="份量" required readOnly={readOnly}>
          <SelectTileMode
            options={portionOptions}
            value={data.portion || "小碗菜"}
            onChange={(v) => update({ portion: v })}
            placeholder="请选择份量"
            title="选择份量"
            searchable={false}
            disabled={readOnly}
          />
        </FormField>

        <FormField id="price" label="售价（元/份）" optionalHint={false} readOnly={readOnly}>
          <Input
            id="price"
            type="number"
            min="0"
            step="0.01"
            value={data.price}
            onChange={(e) => update({ price: e.target.value })}
            placeholder="如 15.00"
            disabled={readOnly}
            className="h-11 text-base px-4"
          />
        </FormField>

        <FormField id="grossMargin" label="毛利率（%）" optionalHint={false} readOnly={readOnly}>
          <Input
            id="grossMargin"
            type="number"
            min="0"
            max="99.9"
            step="0.1"
            value={marginValue}
            onChange={(e) => {
              const raw = e.target.value;
              setMarginInput(raw);
              if (raw === "") {
                marginFromInputRef.current = true;
                update({ price: "" });
                return;
              }
              const m = parseFloat(raw);
              if (Number.isNaN(m) || cost == null) return;
              const nextPrice = calcPriceByMargin(cost, m);
              if (nextPrice != null) {
                marginFromInputRef.current = true;
                update({ price: String(nextPrice) });
              }
            }}
            placeholder={cost != null ? "如 60" : "请先填写菜品用料"}
            disabled={readOnly || cost == null}
            className="h-11 text-base px-4"
          />
        </FormField>
      </FormSection>

      <FormSection
        title="菜品描述"
        cols={2}
        className="p-4 sm:p-4 [&>div:last-child]:gap-4"
      >
        <FormField id="meatType" label="荤素类型" required readOnly={readOnly}>
          <SelectTileMode
            options={meatTypeOptions}
            value={data.meatType}
            onChange={(v) => update({ meatType: v })}
            placeholder="请选择荤素类型"
            title="选择荤素类型"
            searchable={false}
            disabled={readOnly}
          />
        </FormField>

        <FormField id="categoryId" label="菜品类别" required readOnly={readOnly}>
          <SelectTileMode
            options={categoryOptions}
            value={data.categoryId}
            onChange={(v) => update({ categoryId: v })}
            placeholder="请选择菜品类别"
            title="选择菜品类别"
            disabled={readOnly}
          />
        </FormField>

        <FormField id="cuisine" label="菜系" required readOnly={readOnly}>
          <SelectTileMode
            options={cuisineOptions}
            value={data.cuisine}
            onChange={(v) => update({ cuisine: v })}
            placeholder="请选择菜系"
            title="选择菜系"
            disabled={readOnly}
          />
        </FormField>

        <FormField id="technique" label="做法" required readOnly={readOnly}>
          <SelectTileMode
            options={techniqueOptions}
            value={data.technique}
            onChange={(v) => update({ technique: v })}
            placeholder="请选择做法"
            title="选择做法"
            disabled={readOnly}
          />
        </FormField>

        <FormField id="taste" label="口味" required readOnly={readOnly}>
          <SelectTileMode
            options={tasteOptions}
            value={data.taste}
            onChange={(v) => update({ taste: v })}
            placeholder="请选择口味"
            title="选择口味"
            disabled={readOnly}
          />
        </FormField>

        <FormField id="season" label="季节" required readOnly={readOnly}>
          <SelectTileMode
            options={seasonOptions}
            value={data.season || "四季"}
            onChange={(v) => update({ season: v })}
            placeholder="请选择季节"
            title="选择季节"
            searchable={false}
            disabled={readOnly}
          />
        </FormField>

        <FormField id="intro" label="菜品描述" readOnly={readOnly} className="col-span-2">
          <Input
            id="intro"
            value={data.intro}
            onChange={(e) => update({ intro: e.target.value })}
            placeholder="请输入菜品描述"
            disabled={readOnly}
            className="h-11 text-base px-4"
          />
        </FormField>
      </FormSection>
    </div>
  );
}
