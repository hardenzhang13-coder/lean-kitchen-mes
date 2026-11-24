"use client";

import { useMemo } from "react";
import {
  BusinessFieldInput,
  BusinessNumberInput,
  ReadOnlyValue,
} from "@/app/components/ui/form-controls";
import {
  FormField,
  FormLayout,
  FormSection,
} from "@/app/components/ui/form-field";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { LEGACY_PORTION_OPTIONS } from "@/lib/shared/portion-scale";
import { usePortionProfiles, toPortionOptions } from "@/lib/client/use-portion-profiles";
import { deriveStandardSeasoningPrices } from "@/lib/shared/seasoning-spec";

export interface StandardSeasoningFormData {
  /** 调料名称：沿用来源调料名 */
  name: string;
  /** 来源调料 ID（进入弹窗时锁定） */
  sourceIngredientId: string;
  /** 包装规格（g）：调料标准规格统一以 g 计 */
  packageSpec: string;
  /** 份量（份量档案标签）：与净料、小料、菜品共用同一套档案 */
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

/**
 * 调料标准规格表单。
 * 版式与「转净料」弹窗完全一致：顶部一行基本信息 + 三列并排（规格指标 / 加工指标 / 价格指标）。
 */
export function StandardSeasoningFormFields({
  form,
  onChange,
  source,
  errors,
  viewMode = false,
}: StandardSeasoningFormFieldsProps) {
  // 份量选项唯一来源：份量档案（设置模块）；接口失败时降级历史兜底，不写回
  const { profiles } = usePortionProfiles();
  const portionOptions = useMemo(
    () =>
      profiles
        ? toPortionOptions(profiles)
        : Object.values(LEGACY_PORTION_OPTIONS),
    [profiles]
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

  const sectionClassName = "p-4 sm:p-4 [&>div:last-child]:gap-3";

  return (
    <div className="space-y-4">
      <FormSection cols={1} className={sectionClassName}>
        <FormField
          label="调料"
          required
          readOnly={viewMode}
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
      </FormSection>

      <FormLayout variant="workbench">
        <FormSection title="规格指标" cols={1} className={sectionClassName}>
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
              <BusinessNumberInput
                min={1}
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
            hint="与净料、小料、菜品共用同一套份量档案"
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

        <FormSection title="加工指标" cols={1} className={sectionClassName}>
          <FormField
            label="出成率（%）"
            required
            readOnly={viewMode}
            optionalHint={false}
            labelClassName="text-primary"
            error={errors?.yieldRate}
            hint="标准化分装的出成率；留空按 100 处理"
          >
            {viewMode ? (
              <ReadOnlyValue
                value={form.yieldRate !== "" ? `${form.yieldRate}%` : null}
                numeric
              />
            ) : (
              <BusinessNumberInput
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
            error={errors?.unitPrice}
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
            hint="封装环节每斤的加工成本，计入成本价；留空 = 0"
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
              <BusinessNumberInput
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
              <BusinessNumberInput
                min={0}
                max={95}
                step="0.01"
                value={form.grossMarginRate}
                onChange={(e) => onChange("grossMarginRate", e.target.value)}
                placeholder="0"
                className="h-11 text-base px-4"
                disabled={viewMode}
                onBlur={() => {
                  if (form.grossMarginRate === "") {
                    onChange("grossMarginRate", "0");
                  }
                }}
              />
            )}
          </FormField>
        </FormSection>

        <FormSection title="价格指标" cols={1} className={sectionClassName}>
          <FormField
            label="成本价（元/斤）"
            readOnly={viewMode}
            optionalHint={false}
            hint="= 调料单价 + 封装加工费"
          >
            <ReadOnlyValue
              value={
                prices.costPricePerJin != null
                  ? `¥${prices.costPricePerJin.toFixed(2)}`
                  : null
              }
              numeric
              emptyText="自动计算得出"
            />
          </FormField>

          <FormField
            label="出库价（元/斤）"
            readOnly={viewMode}
            optionalHint={false}
            hint="= 成本价 ÷ (1 - 毛利率/100)，真毛利率口径"
          >
            <ReadOnlyValue
              value={
                prices.outPricePerJin != null
                  ? `¥${prices.outPricePerJin.toFixed(2)}`
                  : null
              }
              numeric
              emptyText="自动计算得出"
            />
          </FormField>

          <FormField
            label="标准规格价（元/份）"
            readOnly={viewMode}
            optionalHint={false}
            hint="= 出库价 × 包装规格 ÷ 500，即每个标准规格的出库价"
          >
            <ReadOnlyValue
              value={
                prices.standardPackagePrice != null
                  ? `¥${prices.standardPackagePrice.toFixed(2)}`
                  : null
              }
              numeric
              emphasis
              emptyText="自动计算得出"
            />
          </FormField>
        </FormSection>
      </FormLayout>
    </div>
  );
}
