"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { FormField, FormSection } from "@/app/components/form-field";
import { SelectTileMode } from "@/app/components/select-tile-mode";

export type CategoryL1 = {
  code: string;
  name: string;
  children: { code: string; name: string }[];
};

export type Unit = {
  id: number;
  name: string;
  category: string;
};

export interface IngredientFormData {
  name: string;
  l1Code: string;
  l2Code: string;
  alias: string;
  purchaseSpec: string;
  purchaseUnit: string;
  stockUnit: string;
  latestRefPrice: string;
}

export interface IngredientFormFieldsProps {
  form: IngredientFormData;
  onChange: (field: keyof IngredientFormData, value: string) => void;
  errors: Record<string, string>;
  categories: CategoryL1[];
  units: Unit[];
  mode: "ingredient" | "seasoning" | "auto";
  l2Open: boolean;
  onL2OpenChange: (open: boolean) => void;
}

export function IngredientFormFields({
  form,
  onChange,
  errors,
  categories,
  units,
  mode,
  l2Open,
  onL2OpenChange,
}: IngredientFormFieldsProps) {
  const [l1Open, setL1Open] = useState(false);
  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.name, label: u.name })),
    [units]
  );

  const filteredCategories = useMemo(() => {
    if (mode === "auto") return categories;
    return categories
      .map((l1) => {
        const isSeasoningL1 = l1.code === "SEA" || l1.name === "调味品";
        if (mode === "ingredient" && isSeasoningL1) return null;
        if (mode === "ingredient") {
          const filteredChildren = l1.children.filter(
            (c) => c.code !== "GRA-SEA"
          );
          if (filteredChildren.length === 0) return null;
          return { ...l1, children: filteredChildren };
        }
        if (mode === "seasoning" && !isSeasoningL1) return null;
        return l1;
      })
      .filter((l1): l1 is CategoryL1 => l1 !== null);
  }, [categories, mode]);

  const l2Options = useMemo(() => {
    if (!form.l1Code) return [];
    const l1 = filteredCategories.find((c) => c.code === form.l1Code);
    return (l1?.children || []).map((c) => ({ value: c.code, label: c.name }));
  }, [form.l1Code, filteredCategories]);

  const selectedL2 = (() => {
    if (!form.l2Code) return undefined;
    for (const l1 of categories) {
      const l2 = l1.children.find((c) => c.code === form.l2Code);
      if (l2) return { ...l2, parentName: l1.name, parentCode: l1.code };
    }
    return undefined;
  })();

  const isSeasoning =
    mode === "seasoning" ||
    (mode === "auto" &&
      (selectedL2?.name === "调料" || selectedL2?.parentName === "调味品"));
  const aliasLabel = "商品名称";

  const l1Options = useMemo(
    () => filteredCategories.map((c) => ({ value: c.code, label: c.name })),
    [filteredCategories]
  );

  return (
    <div className="space-y-4">
      <FormSection title="基础信息" cols={2}>
        <FormField
          label="食材分类"
          required
          className="col-span-2"
          error={errors.l2Code}
        >
          <div className="grid grid-cols-2 gap-3">
            {!isSeasoning && (
              <SelectTileMode
                options={l1Options}
                value={form.l1Code}
                onChange={(v) => {
                  onChange("l1Code", v);
                  onChange("l2Code", "");
                  setL1Open(false);
                  onL2OpenChange(true);
                }}
                placeholder="请选择"
                title="选择一级分类"
                searchable={false}
                required
                open={l1Open}
                onOpenChange={setL1Open}
                cascade={{
                  enabled: true,
                  onLevelSelected: () => onL2OpenChange(true),
                }}
              />
            )}
            <SelectTileMode
              options={l2Options}
              value={form.l2Code}
              onChange={(v) => {
                onChange("l2Code", v);
                onL2OpenChange(false);
              }}
              placeholder="请选择"
              title="选择二级分类"
              open={l2Open}
              onOpenChange={onL2OpenChange}
              disabled={!form.l1Code && !isSeasoning}
              searchable={false}
              required
            />
          </div>
        </FormField>
        <FormField label="食材名称" required error={errors.name}>
          <Input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="如 带皮五花肉"
            className="h-11 text-base px-4"
          />
        </FormField>
        <FormField label={aliasLabel} required={isSeasoning} error={errors.alias}>
          <Input
            value={form.alias}
            onChange={(e) => onChange("alias", e.target.value)}
            placeholder={isSeasoning ? "如 海天金标生抽" : "如 五花肉"}
            className="h-11 text-base px-4"
          />
        </FormField>
      </FormSection>

      <FormSection title="采购与入库" cols={2}>
        <FormField label="采购规格" required error={errors.purchaseSpec}>
          <Input
            value={form.purchaseSpec}
            onChange={(e) => onChange("purchaseSpec", e.target.value)}
            placeholder="如 1千克*10袋、散装称斤"
            className="h-11 text-base px-4"
          />
        </FormField>
        <FormField label="采购单位" required error={errors.purchaseUnit}>
          <SelectTileMode
            options={unitOptions}
            value={form.purchaseUnit}
            onChange={(v) => onChange("purchaseUnit", v)}
            placeholder="选择采购单位"
            title="选择采购单位"
            searchable={false}
            cols={3}
            required
          />
        </FormField>
        <FormField label="入库单位" required error={errors.stockUnit}>
          <SelectTileMode
            options={unitOptions}
            value={form.stockUnit}
            onChange={(v) => onChange("stockUnit", v)}
            placeholder="选择入库单位"
            title="选择入库单位"
            searchable={false}
            cols={3}
            required
          />
        </FormField>
        <FormField label="最新参照单价" error={errors.latestRefPrice}>
          <Input
            type="number"
            step="0.01"
            value={form.latestRefPrice}
            onChange={(e) => onChange("latestRefPrice", e.target.value)}
            placeholder="可选"
            className="h-11 text-base px-4"
          />
        </FormField>
      </FormSection>
    </div>
  );
}
