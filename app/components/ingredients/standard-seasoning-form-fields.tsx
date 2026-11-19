"use client";

import { useMemo } from "react";
import {
  BusinessFieldInput,
  ReadOnlyValue,
} from "@/app/components/ui/form-controls";
import { IngredientNumberInput } from "@/app/components/ingredients/ingredient-number-input";
import {
  FormField,
  FormSection,
} from "@/app/components/ui/form-field";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { PORTION_OPTIONS } from "@/lib/shared/portion-scale";
import { deriveStandardSeasoningPrices } from "@/lib/shared/seasoning-spec";

export interface StandardSeasoningFormData {
  /** 调料名称：沿用来源调料名 */
  name: string;
  /** 来源调料 ID（进入弹窗时锁定） */
  sourceIngredientId: string;
  /** 包装规格（g）：调料标准规格统一以 g 计 */
  packageSpec: string;
  /** 份量（小碗菜 / 社区口径）：与净料、小料、菜品共用同一套枚举 */
  portion: string;
  /** 出成率（%） */
  yieldRate: string;
  /** 封装加工费（元/斤） */
  processingFeePerJin: string;
  /** 毛利率（%） */
  grossMarginRate: string;
}

export interface StandardSeasoningSource {
  id: number;
  code: string;
  name: string;
  /** 采购规格（如 1.2kg/瓶），仅作对照展示，不参与计算 */
  purchaseSpec?: string | null;
  /** 来源调料当前每斤单价，用于派生单价 */
  pricePerJin?: number | null;
  /** 来源调料二级分类名称 */
  l2Name?: string | null;
}

export interface StandardSeasoningFormFieldsProps {
  form: StandardSeasoningFormData;
  onChange: (field: keyof StandardSeasoningFormData, value: string) => void;
  source: StandardSeasoningSource;
  errors?: Record<string, string>;
  /** 查看模式：所有输入控件只读 */
  viewMode?: boolean;
}

export function StandardSeasoningFormFields({
  form,
  onChange,
  source,
  errors,
  viewMode = false,
}: StandardSeasoningFormFieldsProps) {
  const portionOptions = useMemo(
    () =>
      PORTION_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        description: option.description,
      })),
    []
  );

  // 价格链路与净料同构，唯一真源在 lib/shared/seasoning-spec.ts
  const prices = useMemo(
    () =>
      deriveStandardSeasoningPrices({
        yieldRate: Number(form.yieldRate),
        processingFeePerJin:
          form.processingFeePerJin === ""
            ? null
            : Number(form.processingFeePerJin),
        grossMarginRate:
          form.grossMarginRate === "" ? null : Number(form.grossMarginRate),
        packageSpec: Number(form.packageSpec),
        sourceIngredient: { pricePerJin: source.pricePerJin ?? null },
      }),
    [
      form.yieldRate,
      form.processingFeePerJin,
      form.grossMarginRate,
      form.packageSpec,
      source.pricePerJin,
    ]
  );

  return (
    <div className="space-y-4">
      <FormSection title="规格指标" cols={1}>
        <FormField
          label="调料"
          required
          readOnly={viewMode}
          optionalHint={false}
          error={errors?.name}
          hint="沿用来源调料名称；同一调料的不同包装规格以此区分"
        >
          {viewMode ? (
            <ReadOnlyValue value={form.name} emphasis />
          ) : (
            <BusinessFieldInput
              value={form.name}
              onChange={(e) => onChange("name", e.target.value)}
              placeholder="如 蒸鱼双椒酱"
              className="h-11 text-base px-4"
            />
          )}
        </FormField>

        <FormField
          label="包装规格（g）"
          required
          readOnly={viewMode}
          optionalHint={false}
          labelClassName="text-primary"
          error={errors?.packageSpec}
          hint="调料标准规格统一以 g 计；菜品 BOM 的调料用量即等于此值"
        >
          {viewMode ? (
            <ReadOnlyValue value={`${form.packageSpec}g`} numeric />
          ) : (
            <IngredientNumberInput
              min={1}
              max={1000000}
              step={1}
              value={form.packageSpec}
              onChange={(e) => onChange("packageSpec", e.target.value)}
              placeholder="如 1200"
              className="h-11 text-base px-4"
              disabled={viewMode}
            />
          )}
        </FormField>

        <FormField
          label="份量"
          required
          readOnly={viewMode}
          optionalHint={false}
          error={errors?.portion}
          hint="与净料、小料、菜品共用同一套份量枚举"
        >
          {viewMode ? (
            <ReadOnlyValue value={form.portion || null} />
          ) : (
            <SelectTileMode
              options={portionOptions}
              value={form.portion}
              onChange={(v) => onChange("portion", v)}
              placeholder="请选择份量"
              title="选择份量"
              searchable={false}
              cols={2}
              required
            />
          )}
        </FormField>
      </FormSection>

      <FormSection title="价格体系" cols={1}>
        <FormField
          label="出成率 (%)"
          required
          readOnly={viewMode}
          optionalHint={false}
          labelClassName="text-primary"
          error={errors?.yieldRate}
          hint="标准化分装的出成率；留空按 100 处理"
        >
          {viewMode ? (
            <ReadOnlyValue value={`${form.yieldRate}%`} numeric />
          ) : (
            <IngredientNumberInput
              min={0.01}
              max={500}
              step="0.01"
              value={form.yieldRate}
              onChange={(e) => onChange("yieldRate", e.target.value)}
              placeholder="如 100"
              className="h-11 text-base px-4"
              disabled={viewMode}
            />
          )}
        </FormField>

        <FormField
          label="调料单价（元/斤）"
          readOnly={viewMode}
          optionalHint={false}
          hint="根据来源调料当前每斤单价和出成率自动计算"
        >
          <ReadOnlyValue
            value={
              prices.unitPrice != null
                ? `¥${prices.unitPrice.toFixed(2)}`
                : null
            }
            numeric
            emptyText="自动计算得出"
          />
        </FormField>

        <FormField
          label="封装加工费（元/斤）"
          readOnly={viewMode}
          optionalHint={false}
          error={errors?.processingFeePerJin}
          hint="分装环节每斤的加工成本，计入成本价；留空 = 0"
        >
          {viewMode ? (
            <ReadOnlyValue
              value={
                prices.costPricePerJin != null && prices.unitPrice != null
                  ? `¥${(prices.costPricePerJin - prices.unitPrice).toFixed(2)}`
                  : null
              }
              numeric
            />
          ) : (
            <IngredientNumberInput
              min={0}
              step="0.01"
              value={form.processingFeePerJin}
              onChange={(e) => onChange("processingFeePerJin", e.target.value)}
              placeholder="留空 = 0"
              className="h-11 text-base px-4"
              disabled={viewMode}
            />
          )}
        </FormField>

        <FormField
          label="毛利率（%）"
          readOnly={viewMode}
          optionalHint={false}
          labelClassName="text-primary"
          error={errors?.grossMarginRate}
          hint="真毛利率口径：出库价 = 成本价 ÷ (1 - 毛利率/100)；默认 0"
        >
          {viewMode ? (
            <ReadOnlyValue value={`${form.grossMarginRate}%`} numeric />
          ) : (
            <IngredientNumberInput
              min={0}
              max={95}
              step="0.01"
              value={form.grossMarginRate}
              onChange={(e) => onChange("grossMarginRate", e.target.value)}
              placeholder="0"
              className="h-11 text-base px-4"
              disabled={viewMode}
            />
          )}
        </FormField>

        <FormField
          label="成本价（元/斤）"
          readOnly
          optionalHint={false}
          hint="= 调料单价 + 封装加工费"
        >
          <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground font-medium">
            {prices.costPricePerJin != null
              ? `¥${prices.costPricePerJin.toFixed(2)}`
              : "—"}
          </div>
        </FormField>

        <FormField
          label="出库价（元/斤）"
          readOnly
          optionalHint={false}
          hint="= 成本价 ÷ (1 - 毛利率/100)，真毛利率口径"
        >
          <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground font-medium">
            {prices.outPricePerJin != null
              ? `¥${prices.outPricePerJin.toFixed(2)}`
              : "—"}
          </div>
        </FormField>

        <FormField
          label="标准规格价（元/份）"
          readOnly
          optionalHint={false}
          hint="= 出库价 × 包装规格 ÷ 500，即每个标准规格的出库价"
        >
          <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground font-medium">
            {prices.standardPackagePrice != null
              ? `¥${prices.standardPackagePrice.toFixed(2)}`
              : "—"}
          </div>
        </FormField>
      </FormSection>
    </div>
  );
}
