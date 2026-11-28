"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  BusinessFieldInput,
  BusinessNumberInput,
  Input,
  ReadOnlyValue,
} from "@/app/components/ui/form-controls";
import { IngredientNumberInput } from "@/app/components/ingredients/ingredient-number-input";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import {
  FormField,
  FormLayout,
  FormSection,
} from "@/app/components/ui/form-field";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { SelectField } from "@/app/components/ui/select-field";
import { CategoryCascadeSelect } from "@/app/components/ui/category-cascade-select";
import {
  IngredientSelectorDialog,
  CategoryL1 as SelectorCategoryL1,
  IngredientForSelector,
} from "@/app/components/ingredients/ingredient-selector-dialog";
import { NetPackagingSelect } from "@/app/components/ingredients/net-packaging-select";
import {
  calcCostPricePerJin,
  calcOutPricePerJin,
  calcStandardPackagePrice,
} from "@/lib/shared/net-price";
import { calcNetUnitPrice } from "@/lib/shared/spec-parser";
import { LEGACY_PORTION_OPTIONS } from "@/lib/shared/portion-scale";
import { usePortionProfiles, toPortionOptions } from "@/lib/client/use-portion-profiles";
import { formatPercent } from "@/lib/shared/display-format";

export type CategoryL1 = SelectorCategoryL1;

export type RawIngredientOption = IngredientForSelector;

export interface NetIngredientFormData {
  name: string;
  l1Code: string;
  l2Code: string;
  /** 三级分类（可选，不做强限制）；空字符串 = 不限三级 */
  l3Code: string;
  sourceIngredientId: string;
  /** 包装规格（g），净料必填 */
  packageSpec: string;
  /** 包装物料，如 密封袋 */
  packageMaterial: string;
  /** 包装尺寸，如 35cm×30cm */
  packageSize: string;
  /** 封装加工费（元/斤），留空 = 0 */
  processingFeePerJin: string;
  yieldRate: string;
  /** 净料单价（元/斤）：只读派生，仅保留表单兼容字段 */
  unitPrice: string;
  /** 毛利率（%）：默认 0；真毛利率口径，出库价 = 成本价 ÷ (1 - 毛利率/100) */
  grossMarginRate: string;
  /** 份量（份量档案标签）：与菜品份量共用同一套档案 */
  portion: string;
}

export interface NetIngredientFormFieldsProps {
  form: NetIngredientFormData;
  onChange: (field: keyof NetIngredientFormData, value: string) => void;
  categories: CategoryL1[];
  rawIngredients: RawIngredientOption[];
  /** 编辑详情时直接传入来源食材当前价格，不依赖分页列表是否包含来源行 */
  sourcePricePerJin?: number | null;
  readOnly?: {
    l1Code?: boolean;
    l2Code?: boolean;
    sourceIngredientId?: boolean;
  };
  /** 查看模式：所有输入控件只读，仅用于展示 */
  viewMode?: boolean;
  errors?: Record<string, string>;
  layout?: "legacy" | "net-dialog" | "sheet";
  /** 包装是否自动选中第一个启用项；转净料场景传 false */
  autoSelectFirst?: boolean;
}

export function NetIngredientFormFields({
  form,
  onChange,
  categories,
  rawIngredients,
  sourcePricePerJin,
  readOnly,
  viewMode = false,
  errors,
  layout = "legacy",
  autoSelectFirst = true,
}: NetIngredientFormFieldsProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);

  const l1Options = useMemo(
    () => categories.map((c) => ({ value: c.code, label: c.name })),
    [categories]
  );

  // 份量选项唯一来源：份量档案（设置模块）；接口失败时降级历史兜底，不写回
  const { profiles } = usePortionProfiles();
  const portionOptions = useMemo(
    () =>
      profiles
        ? toPortionOptions(profiles)
        : Object.values(LEGACY_PORTION_OPTIONS),
    [profiles]
  );

  const l2Options = useMemo(() => {
    if (!form.l1Code) return [];
    const l1 = categories.find((c) => c.code === form.l1Code);
    return (l1?.children || []).map((c) => ({ value: c.code, label: c.name }));
  }, [form.l1Code, categories]);

  const selectedL1 = l1Options.find((o) => o.value === form.l1Code);
  const selectedL2 = l2Options.find((o) => o.value === form.l2Code);

  // 三级分类（可选层）：选项取当前二级分类的子级；一二级由来源食材锁定，三级可改
  const l3Children = useMemo(() => {
    if (!form.l1Code || !form.l2Code) return [];
    const l1 = categories.find((c) => c.code === form.l1Code);
    const l2 = l1?.children.find((c) => c.code === form.l2Code);
    return l2?.children ?? [];
  }, [categories, form.l1Code, form.l2Code]);
  const selectedL3Name = useMemo(
    () => l3Children.find((c) => c.code === form.l3Code)?.name ?? "",
    [l3Children, form.l3Code]
  );
  // 级联选择复用标准三级样式，但一二级由来源食材锁定：过滤树只保留当前一二级
  const lockedCascadeTree = useMemo(
    () =>
      categories
        .filter((c) => c.code === form.l1Code)
        .map((c) => ({
          ...c,
          children: c.children.filter((l2) => l2.code === form.l2Code),
        })),
    [categories, form.l1Code, form.l2Code]
  );
  // Radix Select 不接受空字符串选项值，用哨兵值表示「不限三级」
  const L3_NONE = "__none__";
  const l3Options = useMemo(
    () => [
      { value: L3_NONE, label: "不限三级" },
      ...l3Children.map((c) => ({ value: c.code, label: c.name })),
    ],
    [l3Children]
  );
  const selectedSource = useMemo(
    () =>
      rawIngredients.find(
        (ri) => String(ri.id) === form.sourceIngredientId
      ),
    [rawIngredients, form.sourceIngredientId]
  );
  const currentSourcePricePerJin =
    sourcePricePerJin != null
      ? sourcePricePerJin
      : selectedSource?.pricePerJin != null
        ? Number(selectedSource.pricePerJin)
        : null;
  const derivedUnitPrice = useMemo(
    () =>
      calcNetUnitPrice({
        pricePerJin: currentSourcePricePerJin,
        yieldRate: Number(form.yieldRate),
      }),
    [currentSourcePricePerJin, form.yieldRate]
  );

  // 净料编辑：分类与来源锁定（分类继承自来源食材）
  const sourceLocked = readOnly?.l1Code && readOnly?.l2Code && readOnly?.sourceIngredientId;

  // 价格体系实时计算：成本价 = 净料单价 + 封装加工费；出库价 = 成本价 ÷ (1 - 毛利率/100)；标准规格价格 = 出库价 × 包装规格 ÷ 500
  const costPricePerJin = useMemo(
    () =>
      calcCostPricePerJin(
        derivedUnitPrice,
        form.processingFeePerJin !== "" ? Number(form.processingFeePerJin) : null
      ),
    [derivedUnitPrice, form.processingFeePerJin]
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
    onChange("l1Code", value.l1Code);
    onChange("l2Code", value.l2Code);
    onChange("sourceIngredientId", value.ingredientId);
  };

  if (layout === "net-dialog" || layout === "sheet") {
    const isSheet = layout === "sheet";
    const sectionCols = isSheet ? 3 : 1;
    const fieldGridClassName = isSheet
      ? "p-4 sm:p-4 [&>div:last-child]:gap-4"
      : "p-4 sm:p-4 [&>div:last-child]:gap-3";

    const sections = (
      <>
        <FormSection
          title="规格指标"
          cols={sectionCols}
          className={fieldGridClassName}
        >
          <FormField
            label="包装规格（g）"
            required
            readOnly={viewMode}
            optionalHint={false}
            labelClassName="text-primary"
            error={errors?.packageSpec}
          >
            {viewMode ? (
              <ReadOnlyValue value={form.packageSpec || null} numeric />
            ) : (
              <BusinessNumberInput
                min={1}
                step="1"
                value={form.packageSpec}
                onChange={(event) =>
                  onChange("packageSpec", event.target.value)
                }
                placeholder="如 500"
                className="h-11 text-base px-4"
              />
            )}
          </FormField>

          <NetPackagingSelect
            variant="split"
            viewMode={viewMode}
            autoSelectFirst={autoSelectFirst}
            packageMaterial={form.packageMaterial}
            packageSize={form.packageSize}
            onChange={(name, size) => {
              onChange("packageMaterial", name);
              onChange("packageSize", size);
            }}
            nameError={errors?.packageMaterial}
            sizeError={errors?.packageSize}
          />

          <FormField
            label="份量"
            required
            readOnly={viewMode}
            optionalHint={false}
            error={errors?.portion}
            hint="净料档案的份量口径，与菜品份量共用同一套份量档案"
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

        <FormSection
          title="加工指标"
          cols={sectionCols}
          className={fieldGridClassName}
        >
          <FormField
            label="出成率（%）"
            required
            readOnly={viewMode}
            optionalHint={false}
            labelClassName="text-primary"
            error={errors?.yieldRate}
            hint="上浆/挂糊类食材出成率可超过 100（如 120 = 1 斤食材出 1.2 斤成品，单价低于食材价）"
          >
            {viewMode ? (
              <ReadOnlyValue
                value={
                  form.yieldRate !== "" ? `${form.yieldRate}%` : null
                }
                numeric
              />
            ) : (
              <BusinessNumberInput
                min={0.01}
                max={500}
                step="0.01"
                value={form.yieldRate}
                onChange={(event) =>
                  onChange("yieldRate", event.target.value)
                }
                placeholder="如 85"
                className="h-11 text-base px-4"
              />
            )}
          </FormField>

          <FormField
            label="净料单价（元/斤）"
            readOnly={viewMode}
            optionalHint={false}
            error={errors?.unitPrice}
            hint="根据来源食材当前每斤单价和出成率自动计算"
          >
            <ReadOnlyValue
              value={
                derivedUnitPrice != null
                  ? `¥${derivedUnitPrice.toFixed(2)}`
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
                  form.processingFeePerJin !== ""
                    ? `¥${Number(form.processingFeePerJin).toFixed(2)}`
                    : null
                }
                numeric
              />
            ) : (
              <BusinessNumberInput
                min={0}
                step="0.01"
                value={form.processingFeePerJin}
                onChange={(event) =>
                  onChange("processingFeePerJin", event.target.value)
                }
                placeholder="留空 = 0"
                className="h-11 text-base px-4"
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
              <ReadOnlyValue
                value={formatPercent(form.grossMarginRate)}
                numeric
              />
            ) : (
              <BusinessNumberInput
                min={0}
                max={95}
                step="0.01"
                value={form.grossMarginRate}
                onChange={(event) =>
                  onChange("grossMarginRate", event.target.value)
                }
                placeholder="0"
                className="h-11 text-base px-4"
                onBlur={() => {
                  if (form.grossMarginRate === "") {
                    onChange("grossMarginRate", "0");
                  }
                }}
              />
            )}
          </FormField>
        </FormSection>

        <FormSection
          title="价格指标"
          cols={sectionCols}
          className={fieldGridClassName}
        >
          <FormField
            label="成本价（元/斤）"
            readOnly={viewMode}
            optionalHint={false}
            hint="= 净料单价 + 封装加工费"
          >
            <ReadOnlyValue
              value={
                costPricePerJin != null
                  ? `¥${costPricePerJin.toFixed(2)}`
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
                outPricePerJin != null
                  ? `¥${outPricePerJin.toFixed(2)}`
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
            hint="= 出库价 × 包装规格 ÷ 500，即每包装单位的出库价"
          >
            <ReadOnlyValue
              value={
                standardPackagePrice != null
                  ? `¥${standardPackagePrice.toFixed(2)}`
                  : null
              }
              numeric
              emphasis
              emptyText="自动计算得出"
            />
          </FormField>
        </FormSection>
      </>
    );

    return (
      <div className="space-y-4">
        <FormSection
          cols={2}
          className="p-4 sm:p-4 [&>div:last-child]:gap-3"
        >
          <FormField
            label="净料名称"
            required
            readOnly={viewMode}
            error={errors?.name}
          >
            {viewMode ? (
              <ReadOnlyValue value={form.name} emphasis />
            ) : (
              <BusinessFieldInput
                value={form.name}
                onChange={(event) => onChange("name", event.target.value)}
                placeholder="如 平包菜•称重•500g"
                className="h-11 text-base px-4"
              />
            )}
          </FormField>

          <FormField
            label="三级分类"
            readOnly={viewMode}
            optionalHint={false}
            hint="可选，不做强限制；默认继承来源食材，可修改"
          >
            {viewMode ? (
              <ReadOnlyValue value={selectedL3Name || null} />
            ) : (
              <CategoryCascadeSelect
                categories={lockedCascadeTree}
                l1Code={form.l1Code}
                l2Code={form.l2Code}
                l3Code={form.l3Code}
                onChange={(_l1, _l2, l3) => onChange("l3Code", l3)}
                placeholder={form.l2Code ? "不限三级" : "选择来源食材后可设置"}
                disabled={!form.l2Code}
              />
            )}
          </FormField>
        </FormSection>

        {isSheet ? (
          <div className="space-y-4">{sections}</div>
        ) : (
          <FormLayout variant="workbench">{sections}</FormLayout>
        )}
      </div>
    );
  }

  const renderSourceInfo = () => {
    if (!form.sourceIngredientId) {
      return (
        <SkeuButton
          type="button"
          variant="outline"
          onClick={() => setSelectorOpen(true)}
          className="h-11 w-full sm:w-auto px-6"
        >
          选择来源食材
        </SkeuButton>
      );
    }

    return (
      <div className="space-y-3">
        <div className="relative">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <FormField label="一级分类" readOnly error={sourceLocked ? undefined : errors?.l1Code}>
              <div className="h-11 flex items-center px-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 text-muted-foreground">
                {selectedL1?.label || "请选择来源食材"}
              </div>
            </FormField>

            <FormField label="二级分类" readOnly error={sourceLocked ? undefined : errors?.l2Code}>
              <div className="h-11 flex items-center px-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 text-muted-foreground">
                {selectedL2?.label || "请选择来源食材"}
              </div>
            </FormField>

            <FormField
              label="来源食材"
              readOnly
              error={sourceLocked ? undefined : errors?.sourceIngredientId}
            >
              <div className="h-11 flex items-center px-4 rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 text-muted-foreground">
                {selectedSource?.name || "请选择来源食材"}
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
                onChange("l3Code", "");
              }}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-muted-foreground/30 bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 shadow-sm"
              aria-label="清空来源食材"
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

      <FormSection
        title="净料信息"
        cols={2}
      >
        <FormField label="净料名称" required error={errors?.name}>
          <Input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="如 平包菜•称重•500g"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>

        <FormField
          label="三级分类"
          optionalHint={false}
          hint="可选，不做强限制；默认继承来源食材，可修改"
        >
          {viewMode ? (
            <ReadOnlyValue value={selectedL3Name || null} />
          ) : (
            <SelectField
              value={form.l3Code || L3_NONE}
              onChange={(v) => onChange("l3Code", v === L3_NONE ? "" : v)}
              options={l3Options}
              placeholder={form.l2Code ? "不限三级" : "选择来源食材后可设置"}
              disabled={!form.l2Code || l3Children.length === 0}
            />
          )}
        </FormField>

        <FormField
          label="包装规格（g）"
          required
          optionalHint={false}
          labelClassName="text-primary"
          error={errors?.packageSpec}
          hint="标准包装单位的克数，如 500g/袋填 500"
        >
          <IngredientNumberInput
            min={1}
            step="1"
            value={form.packageSpec}
            onChange={(e) => onChange("packageSpec", e.target.value)}
            placeholder="如 500"
            className="h-11 text-base px-4"
            disabled={viewMode}
          />
        </FormField>

        <NetPackagingSelect
          packageMaterial={form.packageMaterial}
          packageSize={form.packageSize}
          onChange={(name, size) => {
            onChange("packageMaterial", name);
            onChange("packageSize", size);
          }}
          viewMode={viewMode}
          autoSelectFirst={autoSelectFirst}
          error={errors?.packageMaterial}
        />

        <FormField
          label="份量"
          required
          readOnly={viewMode}
          optionalHint={false}
          error={errors?.portion}
          hint="净料档案的份量口径，与菜品份量共用同一套份量档案"
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

        <FormField
          label="出成率 (%)"
          required
          optionalHint={false}
          labelClassName="text-primary"
          error={errors?.yieldRate}
          hint="上浆/挂糊类食材出成率可超过 100（如 120 = 1 斤食材出 1.2 斤成品，单价低于食材价）"
        >
          <IngredientNumberInput
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
          label="净料单价（元/斤）"
          optionalHint={false}
          error={errors?.unitPrice}
          hint="根据来源食材当前每斤单价和出成率自动计算"
        >
          <ReadOnlyValue
            value={
              derivedUnitPrice != null
                ? `¥${derivedUnitPrice.toFixed(2)}`
                : null
            }
            numeric
            emptyText="自动计算得出"
          />
        </FormField>

        <FormField
          label="封装加工费（元/斤）"
          optionalHint={false}
          error={errors?.processingFeePerJin}
          hint="封装环节每斤的加工成本，计入成本价；留空 = 0"
        >
          <IngredientNumberInput
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
          labelClassName="text-primary"
          error={errors?.grossMarginRate}
          hint="真毛利率口径：出库价 = 成本价 ÷ (1 - 毛利率/100)；默认 0"
        >
          <IngredientNumberInput
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
          hint="= 出库价 × 包装规格 ÷ 500，即每包装单位的出库价"
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
        initialIngredientId={form.sourceIngredientId}
        onConfirm={handleSelectorConfirm}
      />
    </div>
  );
}
