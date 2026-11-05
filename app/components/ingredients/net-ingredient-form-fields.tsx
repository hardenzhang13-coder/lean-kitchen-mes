"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField, FormSection } from "@/app/components/ui/form-field";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import {
  IngredientSelectorDialog,
  CategoryL1 as SelectorCategoryL1,
  IngredientForSelector,
} from "@/app/components/ingredients/ingredient-selector-dialog";
import {
  calcCostPricePerJin,
  calcOutPricePerJin,
  calcStandardPackagePrice,
} from "@/lib/shared/net-price";

export type CategoryL1 = SelectorCategoryL1;

export type RawIngredientOption = IngredientForSelector;

export interface NetIngredientFormData {
  name: string;
  l1Code: string;
  l2Code: string;
  sourceIngredientId: string;
  /** 封装规格（g），净料/小料必填 */
  packageSpec: string;
  /** 封装加工费（元/斤），留空 = 0；净料/小料使用 */
  processingFeePerJin: string;
  yieldRate: string;
  /** 净料单价（元/斤，原料每斤单价 ÷ 出成率）；净料/小料同口径 */
  unitPrice: string;
  /** 毛利率（%）：留空 = 0；真毛利率口径，出库价 = 成本价 ÷ (1 - 毛利率/100) */
  grossMarginRate: string;
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
  /** 查看模式：所有输入控件只读，仅用于展示 */
  viewMode?: boolean;
  errors?: Record<string, string>;
}

export function NetIngredientFormFields({
  form,
  onChange,
  categories,
  rawIngredients,
  mode = "net",
  readOnly,
  viewMode = false,
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

  // 净料编辑：分类与来源锁定（分类继承自来源原料）
  const sourceLocked = readOnly?.l1Code && readOnly?.l2Code && readOnly?.sourceIngredientId;

  // 价格体系实时计算（净料/小料同口径）：成本价 = 净料单价 + 封装加工费；出库价 = 成本价 ÷ (1 - 毛利率/100)；标准规格价格 = 出库价 × 封装规格 ÷ 500
  const costPricePerJin = useMemo(
    () =>
      calcCostPricePerJin(
        form.unitPrice !== "" ? Number(form.unitPrice) : null,
        form.processingFeePerJin !== "" ? Number(form.processingFeePerJin) : null
      ),
    [form.unitPrice, form.processingFeePerJin]
  );
  const outPricePerJin = useMemo(
    () =>
      calcOutPricePerJin(
        costPricePerJin,
        form.grossMarginRate !== "" ? Number(form.grossMarginRate) : null
      ),
    [costPricePerJin, form.grossMarginRate]
  );
  const standardPackagePrice = useMemo(
    () =>
      outPricePerJin == null
        ? null
        : calcStandardPackagePrice(
            outPricePerJin,
            form.packageSpec !== "" ? Number(form.packageSpec) : null
          ),
    [outPricePerJin, form.packageSpec]
  );

  const handleSelectorConfirm = (value: {
    l1Code: string;
    l2Code: string;
    ingredientId: string;
  }) => {
    if (isMinor) {
      // 小料的二级分类固定为 MIN 子树，仅取来源原料
      onChange("sourceIngredientId", value.ingredientId);
      return;
    }
    onChange("l1Code", value.l1Code);
    onChange("l2Code", value.l2Code);
    onChange("sourceIngredientId", value.ingredientId);
  };

  const renderSourceInfo = () => {
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
            {!isMinor && (
              <>
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
              </>
            )}

            <FormField
              label="来源原料"
              readOnly
              error={sourceLocked ? undefined : errors?.sourceIngredientId}
              className={isMinor ? "sm:col-span-3" : undefined}
            >
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
                if (!isMinor) {
                  onChange("l1Code", "");
                  onChange("l2Code", "");
                }
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
      <FormSection title="来源信息" cols={1}>
        {renderSourceInfo()}
      </FormSection>

      {isMinor && (
        <FormSection title="分类信息" cols={1}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="一级分类" readOnly>
              <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground">
                小料
              </div>
            </FormField>

            <FormField label="二级分类" required error={errors?.l2Code}>
              {viewMode ? (
                <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground">
                  {selectedL2?.label || "—"}
                </div>
              ) : (
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
              )}
            </FormField>
          </div>
        </FormSection>
      )}

      <FormSection title={isMinor ? "小料信息" : "净料信息"} cols={2}>
        <FormField label={isMinor ? "小料名称" : "净料名称"} required error={errors?.name}>
          <Input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder={isMinor ? "如 蒜末" : "如 平包菜•称重•500g"}
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>

        <FormField
          label="封装规格（g）"
          required
          optionalHint={false}
          error={errors?.packageSpec}
          hint="标准封装单位的克数，如 500g/袋填 500"
        >
          <Input
            type="number"
            min={1}
            step="1"
            value={form.packageSpec}
            onChange={(e) => onChange("packageSpec", e.target.value)}
            placeholder="如 500"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>

        <FormField
          label="出成率 (%)"
          required
          optionalHint={false}
          error={errors?.yieldRate}
          hint="上浆/挂糊类食材出成率可超过 100（如 120 = 1 斤原料出 1.2 斤成品，单价低于原料价）"
        >
          <Input
            type="number"
            min={0.01}
            max={500}
            step="0.01"
            value={form.yieldRate}
            onChange={(e) => onChange("yieldRate", e.target.value)}
            placeholder="如 85"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>

        <FormField
          label={isMinor ? "小料单价（元/斤）" : "净料单价（元/斤）"}
          required
          optionalHint={false}
          error={errors?.unitPrice}
          hint="= 原料每斤单价 ÷（出成率% ÷ 100）。出成率 60 即 ÷0.6：每出 1 斤消耗更多原料，单价高于原料价；手动修改后不再自动覆盖"
        >
          <Input
            type="number"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => onChange("unitPrice", e.target.value)}
            placeholder="如 2.50"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>

        <FormField
          label="封装加工费（元/斤）"
          optionalHint={false}
          error={errors?.processingFeePerJin}
          hint="封装环节每斤的加工成本，计入成本价；留空 = 0"
        >
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.processingFeePerJin}
            onChange={(e) => onChange("processingFeePerJin", e.target.value)}
            placeholder="留空 = 0"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>

        <FormField
          label="毛利率（%）"
          optionalHint={false}
          error={errors?.grossMarginRate}
          hint="真毛利率口径：出库价 = 成本价 ÷ (1 - 毛利率/100)；留空 = 0"
        >
          <Input
            type="number"
            min={0}
            max={95}
            step="0.01"
            value={form.grossMarginRate}
            onChange={(e) => onChange("grossMarginRate", e.target.value)}
            placeholder="留空 = 0"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>

        <FormField
          label="成本价（元/斤）"
          optionalHint={false}
          hint="= 净料单价 + 封装加工费"
        >
          <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground font-medium">
            {costPricePerJin != null ? `¥${costPricePerJin.toFixed(2)}` : "—"}
          </div>
        </FormField>
        <FormField
          label="出库价（元/斤）"
          optionalHint={false}
          hint="= 成本价 ÷ (1 - 毛利率/100)，真毛利率口径"
        >
          <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground font-medium">
            {outPricePerJin != null ? `¥${outPricePerJin.toFixed(2)}` : "—"}
          </div>
        </FormField>
        <FormField
          label="标准规格价（元/份）"
          optionalHint={false}
          hint="= 出库价 × 封装规格 ÷ 500，即每封装单位的出库价"
        >
          <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground font-medium">
            {standardPackagePrice != null ? `¥${standardPackagePrice.toFixed(2)}` : "—"}
          </div>
        </FormField>
      </FormSection>

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
    </div>
  );
}
