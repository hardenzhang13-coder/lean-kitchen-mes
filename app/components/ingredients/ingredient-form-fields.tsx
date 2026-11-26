"use client";

import { useMemo } from "react";
import {
  FormField,
  FormLayout,
  FormSection,
} from "@/app/components/ui/form-field";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { SelectField } from "@/app/components/ui/select-field";
import { CategoryCascadeSelect } from "@/app/components/ui/category-cascade-select";
import { calcJinPerPurchaseUnit } from "@/lib/shared/spec-parser";
import { buildJinFactors } from "@/lib/shared/unit-conversion";
import { SupplierSelect } from "@/app/components/ingredients/supplier-select";
import { IngredientFieldInput } from "@/app/components/ingredients/ingredient-field-input";
import { ReadOnlyValue } from "@/app/components/ui/form-controls";
import { SEASONING_PRODUCT_TYPE_OPTIONS } from "@/lib/shared/seasoning-product";

export type CategoryL1 = {
  code: string;
  name: string;
  children: { code: string; name: string }[];
};

export type Unit = {
  id: number;
  name: string;
  category: string;
  gramsPerUnit?: number | string | null;
  isActive?: boolean;
};

export interface IngredientFormData {
  name: string;
  l1Code: string;
  l2Code: string;
  alias: string;
  /** 调味品类型（仅 mode=seasoning）：单品调料/复合调料/成品酱料；转化产物按此归档 */
  seasoningType: string;
  purchaseSpec: string;
  purchaseUnit: string;
  stockUnit: string;
  /** 入库数量：每 1 个采购单位对应的入库单位数（散称 = 1） */
  unitsPerPurchase: string;
  latestRefPrice: string;
  pricePerJin: string;
  /** 出成率（%）：建档默认值，转化净料/调料时预填可改；空 = 未设置 */
  yieldRate: string;
  /** 默认供应商 ID，空字符串 = 未设置 */
  defaultSupplierId: string;
}

export interface IngredientFormFieldsProps {
  form: IngredientFormData;
  onChange: (field: keyof IngredientFormData, value: string) => void;
  errors: Record<string, string>;
  categories: CategoryL1[];
  units: Unit[];
  mode: "ingredient" | "seasoning" | "auto";
  /** 查看模式：所有输入控件只读，仅用于展示 */
  viewMode?: boolean;
  /** 新增弹窗使用三列工作台布局，详情抽屉使用纵向布局 */
  layout?: "workbench" | "sheet";
  /** 食材查看态直接展示供应商名称，避免额外拉取供应商列表 */
  supplierName?: string | null;
}

export function IngredientFormFields({
  form,
  onChange,
  errors,
  categories,
  units,
  mode,
  viewMode = false,
  layout = "workbench",
  supplierName,
}: IngredientFormFieldsProps) {
  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.name, label: u.name })),
    [units]
  );

  const filteredCategories = useMemo(() => {
    // MIN（小料）分类不用于食材/调味品建档：小料是转化品，其采购食材归在蔬菜-香辛料等业务分类
    if (mode === "ingredient" || mode === "auto") {
      return categories.filter((l1) => l1.code !== "MIN");
    }
    // mode === "seasoning"：调味品独立体系不挂食材分类，级联选择整体隐藏
    return categories;
  }, [categories, mode]);

  const isSeasoning = mode === "seasoning";
  const aliasLabel = mode === "ingredient" ? "品牌名称" : "商品名称";
  const hidePlaceholderOnFocus = mode === "ingredient";

  // 规格可换算性即时反馈：换算系数来自单位字典，字典为空时回退内置兜底值
  const jinFactors = useMemo(() => {
    const factors = buildJinFactors(units);
    return Object.keys(factors).length > 0 ? factors : undefined;
  }, [units]);
  const jinPerUnit = useMemo(
    () => calcJinPerPurchaseUnit(form.purchaseSpec, jinFactors),
    [form.purchaseSpec, jinFactors]
  );
  // 按重直采：采购单位本身是重量单位时，参照单价可按字典系数直接换算为每斤单价
  const weightJinPerUnit =
    form.purchaseUnit && jinFactors?.[form.purchaseUnit] != null
      ? jinFactors[form.purchaseUnit]
      : null;
  const convertible = jinPerUnit != null || weightJinPerUnit != null;

  if (mode === "ingredient" || mode === "seasoning") {
    const groupCols = layout === "sheet" ? 3 : 1;

    return (
      <div className="space-y-4">
        <FormSection cols={1}>
          <FormField
            id="ingredient-name"
            label={mode === "seasoning" ? "调味品名称" : "食材名称"}
            required
            readOnly={viewMode}
            error={errors.name}
          >
            {viewMode ? (
              <ReadOnlyValue value={form.name} emphasis />
            ) : (
              <IngredientFieldInput
                value={form.name}
                onChange={(event) => onChange("name", event.target.value)}
                placeholder={
                  mode === "seasoning" ? "如 海天金标生抽" : "如 带皮五花肉"
                }
                className="h-11 text-base px-4"
                hidePlaceholderOnFocus={hidePlaceholderOnFocus}
              />
            )}
          </FormField>
        </FormSection>

        <FormLayout variant={layout}>
          <FormSection title="基础信息" cols={groupCols} className="h-full">
            {!isSeasoning && (
              <FormField
                label="食材分类"
                required
                readOnly={viewMode}
                error={errors.l1Code || errors.l2Code}
              >
                <CategoryCascadeSelect
                  categories={filteredCategories}
                  l1Code={form.l1Code}
                  l2Code={form.l2Code}
                  onChange={(l1, l2) => {
                    onChange("l1Code", l1);
                    onChange("l2Code", l2);
                  }}
                  viewMode={viewMode}
                />
              </FormField>
            )}

            <FormField
              label={aliasLabel}
              readOnly={viewMode}
              error={errors.alias}
              hint="采购包装或标签上的品牌名称，用于采购识别与检索"
            >
              {viewMode ? (
                <ReadOnlyValue value={form.alias} />
              ) : (
                <IngredientFieldInput
                  value={form.alias}
                  onChange={(event) => onChange("alias", event.target.value)}
                  placeholder={
                    mode === "seasoning" ? "如 海天金标生抽" : "如 双汇"
                  }
                  className="h-11 text-base px-4"
                  hidePlaceholderOnFocus={hidePlaceholderOnFocus}
                />
              )}
            </FormField>

            {isSeasoning && (
              <FormField
                label="调料分类"
                readOnly={viewMode}
                error={errors.seasoningType}
                hint="单品调料 / 复合调料 / 成品酱料；转化出的调料按此分类归档，修改会级联已有调料"
              >
                {viewMode ? (
                  <ReadOnlyValue
                    value={
                      SEASONING_PRODUCT_TYPE_OPTIONS.find(
                        (o) => o.value === form.seasoningType
                      )?.label ?? form.seasoningType
                    }
                  />
                ) : (
                  <SelectField
                    value={form.seasoningType}
                    onChange={(value) => onChange("seasoningType", value)}
                    options={SEASONING_PRODUCT_TYPE_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    placeholder="选择调料分类"
                  />
                )}
              </FormField>
            )}

            <FormField
              label={mode === "seasoning" ? "默认供应商" : "供应商名称"}
              readOnly={viewMode}
              hint="用于排程采购计划按供应商拆单打印；不设置则该食材不参与拆单"
            >
              {viewMode ? (
                <ReadOnlyValue value={supplierName} />
              ) : (
                <SupplierSelect
                  value={
                    form.defaultSupplierId
                      ? Number(form.defaultSupplierId)
                      : ""
                  }
                  onChange={(value) =>
                    onChange(
                      "defaultSupplierId",
                      value === "" ? "" : String(value)
                    )
                  }
                  placeholder="选择供应商"
                />
              )}
            </FormField>
          </FormSection>

          <FormSection title="采购与计量" cols={groupCols} className="h-full">
            <FormField
              label="采购规格"
              required
              readOnly={viewMode}
              optionalHint={false}
              error={errors.purchaseSpec}
              hint={
                jinPerUnit != null
                  ? `可自动换算：1${form.purchaseUnit || "个采购单位"} ≈ ${jinPerUnit} 斤`
                  : weightJinPerUnit != null
                    ? `按重直采：1${form.purchaseUnit} = ${weightJinPerUnit} 斤，按参照单价直接换算每斤单价`
                    : "当前规格无法换算为重量，每斤单价需手动填写"
              }
            >
              {viewMode ? (
                <ReadOnlyValue value={form.purchaseSpec} />
              ) : (
                <IngredientFieldInput
                  value={form.purchaseSpec}
                  onChange={(event) =>
                    onChange("purchaseSpec", event.target.value)
                  }
                  placeholder="如 1千克*10袋、5斤/袋、散装称斤"
                  className="h-11 text-base px-4"
                  hidePlaceholderOnFocus={hidePlaceholderOnFocus}
                />
              )}
            </FormField>

            <FormField
              label="采购单位"
              required
              readOnly={viewMode}
              error={errors.purchaseUnit}
            >
              {viewMode ? (
                <ReadOnlyValue value={form.purchaseUnit} />
              ) : (
                <SelectTileMode
                  options={unitOptions}
                  value={form.purchaseUnit}
                  onChange={(value) => onChange("purchaseUnit", value)}
                  placeholder="选择采购单位"
                  title="选择采购单位"
                  searchable={false}
                  cols={3}
                  required
                />
              )}
            </FormField>

            <FormField
              label="入库单位"
              required
              readOnly={viewMode}
              error={errors.stockUnit}
            >
              {viewMode ? (
                <ReadOnlyValue value={form.stockUnit} />
              ) : (
                <SelectTileMode
                  options={unitOptions}
                  value={form.stockUnit}
                  onChange={(value) => onChange("stockUnit", value)}
                  placeholder="选择入库单位"
                  title="选择入库单位"
                  searchable={false}
                  cols={3}
                  required
                />
              )}
            </FormField>
          </FormSection>

          <FormSection title="价格与出成率" cols={groupCols} className="h-full">
            <FormField
              label="最新参照单价"
              readOnly={viewMode}
              optionalHint={false}
              error={errors.latestRefPrice}
            >
              {viewMode ? (
                <ReadOnlyValue
                  value={form.latestRefPrice}
                  numeric
                />
              ) : (
                <IngredientFieldInput
                  numeric
                  step="0.01"
                  value={form.latestRefPrice}
                  onChange={(event) =>
                    onChange("latestRefPrice", event.target.value)
                  }
                  placeholder="可选"
                  className="h-11 text-base px-4"
                  hidePlaceholderOnFocus={hidePlaceholderOnFocus}
                />
              )}
            </FormField>

            <FormField
              label="每斤单价（元/斤）"
              readOnly={viewMode}
              optionalHint={false}
              error={errors.pricePerJin}
              hint={
                convertible
                  ? "= 最新参照单价 ÷ 每采购单位斤数；手动修改后不再自动覆盖"
                  : "建议格式：5斤/袋、1千克*10袋（含重量单位才可自动换算），或采购单位直接用斤/公斤"
              }
            >
              {viewMode ? (
                <ReadOnlyValue
                  value={form.pricePerJin}
                  numeric
                  emphasis
                />
              ) : (
                <IngredientFieldInput
                  numeric
                  step="0.0001"
                  value={form.pricePerJin}
                  onChange={(event) =>
                    onChange("pricePerJin", event.target.value)
                  }
                  placeholder={
                    convertible
                      ? "按采购规格自动计算，可手动修改"
                      : "规格无法换算，请手动填写"
                  }
                  className="h-11 text-base px-4"
                  hidePlaceholderOnFocus={hidePlaceholderOnFocus}
                />
              )}
            </FormField>

            <FormField
              label="出成率（%）"
              readOnly={viewMode}
              optionalHint={false}
              error={errors.yieldRate}
              hint={
                mode === "seasoning"
                  ? "转化调料时默认读取，转化时可修改；不填则转化时手动填写"
                  : "转化净料时默认读取，转化时可修改；不填则转化时手动填写"
              }
            >
              {viewMode ? (
                <ReadOnlyValue
                  value={form.yieldRate ? `${form.yieldRate}%` : ""}
                  numeric
                />
              ) : (
                <IngredientFieldInput
                  numeric
                  min={0.01}
                  max={500}
                  step="0.01"
                  value={form.yieldRate}
                  onChange={(event) =>
                    onChange("yieldRate", event.target.value)
                  }
                  placeholder="可选，如 65"
                  className="h-11 text-base px-4"
                  hidePlaceholderOnFocus={hidePlaceholderOnFocus}
                />
              )}
            </FormField>
          </FormSection>
        </FormLayout>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormSection title="基础信息" cols={2}>
        <FormField
          label="食材分类"
          required
          className="col-span-2"
          error={errors.l1Code || errors.l2Code}
        >
          <CategoryCascadeSelect
            categories={filteredCategories}
            l1Code={form.l1Code}
            l2Code={form.l2Code}
            onChange={(l1, l2) => {
              onChange("l1Code", l1);
              onChange("l2Code", l2);
            }}
            viewMode={viewMode}
          />
        </FormField>
        <FormField label="食材名称" required error={errors.name}>
          <IngredientFieldInput
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="如 带皮五花肉"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>
        <FormField label={aliasLabel} required={isSeasoning} error={errors.alias}>
          <IngredientFieldInput
            value={form.alias}
            onChange={(e) => onChange("alias", e.target.value)}
            placeholder={isSeasoning ? "如 海天金标生抽" : "如 五花肉"}
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>
      </FormSection>

      <FormSection title="采购与入库" cols={2}>
        <FormField
          label="采购规格"
          required
          optionalHint={false}
          error={errors.purchaseSpec}
          hint={
            jinPerUnit != null
              ? `可自动换算：1${form.purchaseUnit || "个采购单位"} ≈ ${jinPerUnit} 斤`
              : weightJinPerUnit != null
                ? `按重直采：1${form.purchaseUnit} = ${weightJinPerUnit} 斤，按参照单价直接换算每斤单价`
                : "当前规格无法换算为重量，每斤单价需手动填写"
          }
        >
          <IngredientFieldInput
            value={form.purchaseSpec}
            onChange={(e) => onChange("purchaseSpec", e.target.value)}
            placeholder="如 1千克*10袋、5斤/袋、散装称斤"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>
        <FormField label="采购单位" required error={errors.purchaseUnit}>
          {viewMode ? (
            <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground">
              {form.purchaseUnit || "—"}
            </div>
          ) : (
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
          )}
        </FormField>
        <FormField label="入库单位" required error={errors.stockUnit}>
          {viewMode ? (
            <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground">
              {form.stockUnit || "—"}
            </div>
          ) : (
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
          )}
        </FormField>
        <FormField
          label="入库数量"
          required
          optionalHint={false}
          error={errors.unitsPerPurchase}
          hint="每 1 个采购单位对应的入库数量，如 200g/袋*10袋 填 10；散称填 1"
        >
          <IngredientFieldInput
            numeric
            min={1}
            step="1"
            value={form.unitsPerPurchase}
            onChange={(e) => onChange("unitsPerPurchase", e.target.value)}
            placeholder="如 10"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>
        <FormField
          label="最新参照单价"
          optionalHint={false}
          error={errors.latestRefPrice}
        >
          <IngredientFieldInput
            numeric
            step="0.01"
            value={form.latestRefPrice}
            onChange={(e) => onChange("latestRefPrice", e.target.value)}
            placeholder="可选"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>
        <FormField
          label="每斤单价（元/斤）"
          optionalHint={false}
          error={errors.pricePerJin}
          hint={
            convertible
              ? "= 最新参照单价 ÷ 每采购单位斤数；手动修改后不再自动覆盖"
              : "建议格式：5斤/袋、1千克*10袋（含重量单位才可自动换算），或采购单位直接用斤/公斤"
          }
        >
          <IngredientFieldInput
            numeric
            step="0.0001"
            value={form.pricePerJin}
            onChange={(e) => onChange("pricePerJin", e.target.value)}
            placeholder={
              convertible
                ? "按采购规格自动计算，可手动修改"
                : "规格无法换算，请手动填写"
            }
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>
        <FormField
          label="默认供应商"
          className="col-span-2"
          hint="用于排程采购计划按供应商拆单打印；不设置则该食材不参与拆单"
        >
          <SupplierSelect
            value={form.defaultSupplierId ? Number(form.defaultSupplierId) : ""}
            onChange={(v) => onChange("defaultSupplierId", v === "" ? "" : String(v))}
            placeholder="选择供应商"
            disabled={viewMode}
          />
        </FormField>
      </FormSection>
    </div>
  );
}
