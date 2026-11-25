"use client";

import { useEffect, useMemo, useState } from "react";
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
import { SelectField } from "@/app/components/ui/select-field";
import { LEGACY_PORTION_OPTIONS } from "@/lib/shared/portion-scale";
import { usePortionProfiles, toPortionOptions } from "@/lib/client/use-portion-profiles";
import {
  SEASONING_PRODUCT_TYPE_OPTIONS,
  SEASONING_SOURCE_MODE_OPTIONS,
  type SeasoningSourceMode,
} from "@/lib/shared/seasoning-product";
import { deriveSeasoningProductPrices } from "@/lib/shared/seasoning-spec";

export interface SeasoningProductFormData {
  /** 产物名称：转化默认沿用来源调味品名，可改 */
  name: string;
  /** 产物类型：单品调料/复合调料/成品酱料 */
  productType: string;
  /** 来源方式：transform=转化 / purchase=外购 */
  sourceMode: string;
  /** 来源调味品 ID（转化口径） */
  sourceIngredientId: string;
  /** 包装规格（g）：新建默认 500 */
  packageSpec: string;
  /** 份量（份量档案标签）：新建默认单人份（档案倍率=10 行） */
  portion: string;
  /** 出成率（%，转化口径） */
  yieldRate: string;
  /** 封装加工费（元/斤） */
  processingFeePerJin: string;
  /** 毛利率（%） */
  grossMarginRate: string;
  /** 品牌（外购口径） */
  brand: string;
  /** 采购规格（外购口径，如 500g/瓶） */
  purchaseSpec: string;
  /** 采购单位（外购口径） */
  purchaseUnit: string;
  /** 最新参照单价（外购口径，元/采购单位） */
  latestRefPrice: string;
  /** 手填每斤单价（外购口径，元/斤） */
  pricePerJin: string;
}

export interface SeasoningProductSource {
  id: number;
  code: string;
  name: string;
  /** 采购规格（如 1.2kg/瓶），仅作对照展示，不参与计算 */
  purchaseSpec?: string | null;
  /** 来源调味品当前每斤单价，用于派生单价 */
  pricePerJin?: number | null;
}

export interface SeasoningProductFormFieldsProps {
  form: SeasoningProductFormData;
  onChange: (field: keyof SeasoningProductFormData, value: string) => void;
  /** 锁定的来源调味品（从原料层「转化」进入时必传）；缺省时转化口径展示来源选择下拉 */
  source?: SeasoningProductSource | null;
  /** 锁定产物类型（产物页某 Tab 内新建时传入），隐藏类型切换 */
  fixedProductType?: string;
  errors?: Record<string, string>;
  /** 查看模式：所有输入控件只读 */
  viewMode?: boolean;
}

type SourceOption = {
  id: number;
  code: string;
  name: string;
  pricePerJin: number | null;
};

/**
 * 调料产物标准规格表单（单品调料/复合调料/成品酱料同构）。
 * 版式与「转净料」弹窗一致：顶部一行基本信息 + 三列并排（规格指标 / 加工指标 / 价格指标）。
 * 转化口径 = 来源调味品 + 出成率派生单价；外购口径 = 品牌/采购规格 + 手填每斤单价。
 */
export function SeasoningProductFormFields({
  form,
  onChange,
  source,
  fixedProductType,
  errors,
  viewMode = false,
}: SeasoningProductFormFieldsProps) {
  const sourceMode = (form.sourceMode || "transform") as SeasoningSourceMode;
  const isTransform = sourceMode === "transform";
  const sourceLocked = Boolean(source?.id);

  // 份量选项唯一来源：份量档案（设置模块）；接口失败时降级历史兜底，不写回
  const { profiles } = usePortionProfiles();
  const portionOptions = useMemo(
    () =>
      profiles
        ? toPortionOptions(profiles)
        : Object.values(LEGACY_PORTION_OPTIONS),
    [profiles]
  );

  // 未锁定来源时（产物页直接新建转化产物），拉取调味品原料清单供选择
  const [sourceOptions, setSourceOptions] = useState<SourceOption[]>([]);
  useEffect(() => {
    if (viewMode || sourceLocked || !isTransform) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch("/api/ingredients?kind=seasoning&page=1&pageSize=100");
        const json: unknown = await res.json();
        if (cancelled || !res.ok) return;
        const list = Array.isArray(json) ? json : (json as { data?: unknown[] }).data;
        if (!Array.isArray(list)) return;
        setSourceOptions(
          list
            .map((item) => {
              if (item == null || typeof item !== "object") return null;
              const record = item as Record<string, unknown>;
              const id = Number(record.id);
              if (Number.isNaN(id)) return null;
              return {
                id,
                code: String(record.code || ""),
                name: String(record.name || ""),
                pricePerJin:
                  record.pricePerJin != null ? Number(record.pricePerJin) : null,
              };
            })
            .filter((item): item is SourceOption => item != null)
        );
      } catch {
        // 来源选择拉取失败时保留空列表，表单校验会拦截提交
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [viewMode, sourceLocked, isTransform]);

  // 价格链路与净料同构，唯一真源在 lib/shared/seasoning-spec.ts
  const selectedSourcePrice = sourceLocked
    ? (source?.pricePerJin ?? null)
    : (sourceOptions.find((o) => String(o.id) === form.sourceIngredientId)
        ?.pricePerJin ?? null);
  const prices = useMemo(
    () =>
      deriveSeasoningProductPrices({
        sourceMode,
        yieldRate: isTransform ? Number(form.yieldRate) : null,
        processingFeePerJin:
          form.processingFeePerJin === ""
            ? null
            : Number(form.processingFeePerJin),
        grossMarginRate:
          form.grossMarginRate === "" ? null : Number(form.grossMarginRate),
        packageSpec: Number(form.packageSpec),
        pricePerJin:
          !isTransform && form.pricePerJin !== ""
            ? Number(form.pricePerJin)
            : null,
        sourceIngredient: { pricePerJin: selectedSourcePrice },
      }),
    [
      sourceMode,
      form.yieldRate,
      form.processingFeePerJin,
      form.grossMarginRate,
      form.packageSpec,
      form.pricePerJin,
      isTransform,
      selectedSourcePrice,
    ]
  );

  const sectionClassName = "p-4 sm:p-4 [&>div:last-child]:gap-3";

  return (
    <div className="space-y-4">
      <FormSection cols={1} className={sectionClassName}>
        <FormField
          label="产物名称"
          required
          readOnly={viewMode}
          error={errors?.name}
          hint="转化默认沿用来源调味品名称；同一调味品的不同规格产物以此区分"
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

      <FormSection cols={2} className={sectionClassName}>
        <FormField
          label="产物类型"
          required
          readOnly={viewMode || Boolean(fixedProductType)}
          error={errors?.productType}
          hint="单品调料 / 复合调料 / 成品酱料只是产物叫法，价格链路同构"
        >
          {viewMode || fixedProductType ? (
            <ReadOnlyValue
              value={
                SEASONING_PRODUCT_TYPE_OPTIONS.find(
                  (o) => o.value === (fixedProductType ?? form.productType)
                )?.label ?? form.productType
              }
            />
          ) : (
            <SelectField
              value={form.productType}
              onChange={(value) => onChange("productType", value)}
              options={SEASONING_PRODUCT_TYPE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              placeholder="选择产物类型"
            />
          )}
        </FormField>

        <FormField
          label="来源方式"
          required
          readOnly={viewMode || sourceLocked}
          error={errors?.sourceMode}
          hint={
            sourceLocked
              ? "从原料层「转化」进入：来源方式锁定为转化"
              : "转化 = 来源调味品 × 出成率派生；外购 = 成品采购手填每斤单价"
          }
        >
          {viewMode || sourceLocked ? (
            <ReadOnlyValue
              value={
                SEASONING_SOURCE_MODE_OPTIONS.find((o) => o.value === sourceMode)
                  ?.label ?? sourceMode
              }
            />
          ) : (
            <SelectField
              value={sourceMode}
              onChange={(value) => onChange("sourceMode", value)}
              options={SEASONING_SOURCE_MODE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              placeholder="选择来源方式"
            />
          )}
        </FormField>
      </FormSection>

      {isTransform && (
        <FormSection cols={1} className={sectionClassName}>
          <FormField
            label="来源调味品"
            required
            readOnly={viewMode || sourceLocked}
            error={errors?.sourceIngredientId}
            hint={
              sourceLocked
                ? `来源每斤单价 ¥${(source?.pricePerJin ?? 0).toFixed(2)}，随原料价格实时派生产物单价`
                : "选择要转化的调味品原料"
            }
          >
            {viewMode || sourceLocked ? (
              <ReadOnlyValue
                value={source ? `${source.code} · ${source.name}` : form.sourceIngredientId}
              />
            ) : (
              <SelectField
                value={form.sourceIngredientId}
                onChange={(value) => onChange("sourceIngredientId", value)}
                options={sourceOptions.map((o) => ({
                  value: String(o.id),
                  label: `${o.code} · ${o.name}`,
                }))}
                placeholder="选择来源调味品"
              />
            )}
          </FormField>
        </FormSection>
      )}

      <FormLayout variant="workbench">
        <FormSection title="规格指标" cols={1} className={sectionClassName}>
          <FormField
            label="包装规格（g）"
            required
            readOnly={viewMode}
            optionalHint={false}
            labelClassName="text-primary"
            error={errors?.packageSpec}
            hint="标准包装装多少克；新建默认 500g"
          >
            {viewMode ? (
              <ReadOnlyValue value={`${form.packageSpec}g`} numeric />
            ) : (
              <BusinessNumberInput
                min={1}
                step={1}
                value={form.packageSpec}
                onChange={(e) => onChange("packageSpec", e.target.value)}
                placeholder="如 500"
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
            hint="与净料、小料、菜品共用同一套份量档案；新建默认单人份"
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

        {isTransform ? (
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
              label="产物单价（元/斤）"
              readOnly={viewMode}
              optionalHint={false}
              error={errors?.unitPrice}
              hint="根据来源调味品当前每斤单价和出成率自动计算"
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
        ) : (
          <FormSection title="外购信息" cols={1} className={sectionClassName}>
            <FormField
              label="品牌"
              readOnly={viewMode}
              error={errors?.brand}
              hint="采购包装或标签上的品牌名称，用于采购识别与检索"
            >
              {viewMode ? (
                <ReadOnlyValue value={form.brand} />
              ) : (
                <BusinessFieldInput
                  value={form.brand}
                  onChange={(e) => onChange("brand", e.target.value)}
                  placeholder="如 某牌"
                  className="h-11 text-base px-4"
                />
              )}
            </FormField>

            <FormField
              label="采购规格"
              readOnly={viewMode}
              error={errors?.purchaseSpec}
              hint="如 500g/瓶、2kg/桶"
            >
              {viewMode ? (
                <ReadOnlyValue value={form.purchaseSpec} />
              ) : (
                <BusinessFieldInput
                  value={form.purchaseSpec}
                  onChange={(e) => onChange("purchaseSpec", e.target.value)}
                  placeholder="如 500g/瓶"
                  className="h-11 text-base px-4"
                />
              )}
            </FormField>

            <FormField
              label="采购单位"
              readOnly={viewMode}
              error={errors?.purchaseUnit}
            >
              {viewMode ? (
                <ReadOnlyValue value={form.purchaseUnit} />
              ) : (
                <BusinessFieldInput
                  value={form.purchaseUnit}
                  onChange={(e) => onChange("purchaseUnit", e.target.value)}
                  placeholder="如 瓶 / 桶 / 袋"
                  className="h-11 text-base px-4"
                />
              )}
            </FormField>

            <FormField
              label="最新参照单价（元）"
              readOnly={viewMode}
              optionalHint={false}
              error={errors?.latestRefPrice}
              hint="每采购单位的零售参考价，仅作对照展示"
            >
              {viewMode ? (
                <ReadOnlyValue value={form.latestRefPrice} numeric />
              ) : (
                <BusinessNumberInput
                  min={0}
                  step="0.01"
                  value={form.latestRefPrice}
                  onChange={(e) => onChange("latestRefPrice", e.target.value)}
                  placeholder="可选"
                  className="h-11 text-base px-4"
                  disabled={viewMode}
                />
              )}
            </FormField>

            <FormField
              label="每斤单价（元/斤）"
              required
              readOnly={viewMode}
              optionalHint={false}
              labelClassName="text-primary"
              error={errors?.pricePerJin}
              hint="外购产物成本口径：按实际采购价手填"
            >
              {viewMode ? (
                <ReadOnlyValue value={form.pricePerJin} numeric emphasis />
              ) : (
                <BusinessNumberInput
                  min={0}
                  step="0.0001"
                  value={form.pricePerJin}
                  onChange={(e) => onChange("pricePerJin", e.target.value)}
                  placeholder="如 9.6"
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
        )}

        <FormSection title="价格指标" cols={1} className={sectionClassName}>
          <FormField
            label="成本价（元/斤）"
            readOnly={viewMode}
            optionalHint={false}
            hint={
              isTransform
                ? "= 产物单价 + 封装加工费"
                : "= 手填每斤单价（+ 封装加工费）"
            }
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
            hint="= 成本价 ÷ (1 - 毛利率/100)，真毛利率口径；菜品 BOM 按克计价用它"
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
            hint="= 出库价 × 包装规格 ÷ 500，即每个标准包装的出库价"
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
