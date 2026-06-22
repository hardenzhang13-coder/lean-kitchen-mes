"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField, FormSection } from "@/app/components/form-field";
import { SelectTileMode } from "@/app/components/select-tile-mode";
import {
  IngredientSelectorDialog,
  CategoryL1 as SelectorCategoryL1,
  IngredientForSelector,
} from "@/app/components/ingredient-selector-dialog";

export type CategoryL1 = SelectorCategoryL1;

export type RawIngredientOption = IngredientForSelector;

export interface NetIngredientFormData {
  name: string;
  l1Code: string;
  l2Code: string;
  sourceIngredientId: string;
  spec: string;
  yieldRate: string;
  unitPrice: string;
}

export interface NetIngredientFormFieldsProps {
  form: NetIngredientFormData;
  onChange: (field: keyof NetIngredientFormData, value: string) => void;
  categories: CategoryL1[];
  rawIngredients: RawIngredientOption[];
  mode?: "net" | "minor";
  readOnly?: {
    l1Code?: boolean;
    l2Code?: boolean;
    sourceIngredientId?: boolean;
  };
  errors?: Record<string, string>;
}

export function NetIngredientFormFields({
  form,
  onChange,
  categories,
  rawIngredients,
  mode = "net",
  readOnly,
  errors,
}: NetIngredientFormFieldsProps) {
  const [l2Open, setL2Open] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const isMinor = mode === "minor";

  const l1Options = useMemo(
    () => categories.map((c) => ({ value: c.code, label: c.name })),
    [categories]
  );

  const l2Options = useMemo(() => {
    if (isMinor) {
      const minorL1 = categories.find((c) => c.code === "MIN");
      return (minorL1?.children || []).map((c) => ({ value: c.code, label: c.name }));
    }
    if (!form.l1Code) return [];
    const l1 = categories.find((c) => c.code === form.l1Code);
    return (l1?.children || []).map((c) => ({ value: c.code, label: c.name }));
  }, [form.l1Code, categories, isMinor]);

  const selectedL1 = l1Options.find((o) => o.value === form.l1Code);
  const selectedL2 = l2Options.find((o) => o.value === form.l2Code);
  const selectedSource = useMemo(
    () =>
      rawIngredients.find(
        (ri) => String(ri.id) === form.sourceIngredientId
      ),
    [rawIngredients, form.sourceIngredientId]
  );

  const sourceLocked =
    readOnly?.l1Code && readOnly?.l2Code && readOnly?.sourceIngredientId;

  const handleSelectorConfirm = (value: {
    l1Code: string;
    l2Code: string;
    ingredientId: string;
  }) => {
    onChange("l1Code", value.l1Code);
    onChange("l2Code", value.l2Code);
    onChange("sourceIngredientId", value.ingredientId);
  };

  const renderSourceInfo = () => {
    if (isMinor) return null;

    if (!form.sourceIngredientId) {
      return (
        <Button
          type="button"
          variant="outline"
          onClick={() => setSelectorOpen(true)}
          className="h-11 w-full sm:w-auto px-6"
        >
          选择来源原料
        </Button>
      );
    }

    return (
      <div className="space-y-3">
        <div className="relative">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <FormField label="一级分类" readOnly error={sourceLocked ? undefined : errors?.l1Code}>
              <div className="h-11 flex items-center px-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 text-muted-foreground">
                {selectedL1?.label || "请选择来源原料"}
              </div>
            </FormField>

            <FormField label="二级分类" readOnly error={sourceLocked ? undefined : errors?.l2Code}>
              <div className="h-11 flex items-center px-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 text-muted-foreground">
                {selectedL2?.label || "请选择来源原料"}
              </div>
            </FormField>

            <FormField label="来源原料" readOnly error={sourceLocked ? undefined : errors?.sourceIngredientId}>
              <div className="h-11 flex items-center px-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 text-muted-foreground">
                {selectedSource?.name || "请选择来源原料"}
              </div>
            </FormField>
          </div>
          {!sourceLocked && (
            <button
              type="button"
              onClick={() => {
                onChange("sourceIngredientId", "");
                onChange("l1Code", "");
                onChange("l2Code", "");
              }}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-muted-foreground/30 bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 shadow-sm"
              aria-label="清空来源原料"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {!isMinor && (
        <FormSection title="来源信息" cols={1}>
          {renderSourceInfo()}
        </FormSection>
      )}

      {isMinor && (
        <FormSection title="分类信息" cols={1}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="一级分类" readOnly>
              <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground">
                小料
              </div>
            </FormField>

            <FormField label="二级分类" required error={errors?.l2Code}>
              <SelectTileMode
                options={l2Options}
                value={form.l2Code}
                onChange={(v) => onChange("l2Code", v)}
                placeholder="请选择"
                title="选择二级分类"
                searchable={false}
                required
                open={l2Open}
                onOpenChange={setL2Open}
              />
            </FormField>
          </div>
        </FormSection>
      )}

      <FormSection title={isMinor ? "小料信息" : "净料信息"} cols={2}>
        <FormField label={isMinor ? "小料名称" : "净料名称"} required error={errors?.name}>
          <Input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder={isMinor ? "如 蒜末" : "如 去皮五花肉片"}
            className="h-11 text-base px-4"
          />
        </FormField>

        <FormField label="规格" error={errors?.spec}>
          <Input
            value={form.spec}
            onChange={(e) => onChange("spec", e.target.value)}
            placeholder={isMinor ? "如 切末" : "如 0.2cm厚片"}
            className="h-11 text-base px-4"
          />
        </FormField>

        {!isMinor && (
          <FormField label="出成率 (%)" required error={errors?.yieldRate}>
            <Input
              type="number"
              min={1}
              max={100}
              step="0.01"
              value={form.yieldRate}
              onChange={(e) => onChange("yieldRate", e.target.value)}
              placeholder="如 85"
              className="h-11 text-base px-4"
            />
          </FormField>
        )}

        <FormField label={isMinor ? "单价" : "净料单价"} required error={errors?.unitPrice}>
          <Input
            type="number"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => onChange("unitPrice", e.target.value)}
            placeholder="如 2.50"
            className="h-11 text-base px-4"
          />
        </FormField>

        <FormField label="单位">
          <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground">
            {isMinor ? "10g" : "500g"}
          </div>
        </FormField>
      </FormSection>

      {!isMinor && (
        <IngredientSelectorDialog
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          categories={categories}
          ingredients={rawIngredients}
          initialL1Code={form.l1Code}
          initialL2Code={form.l2Code}
          initialIngredientId={form.sourceIngredientId}
          onConfirm={handleSelectorConfirm}
        />
      )}
    </div>
  );
}
