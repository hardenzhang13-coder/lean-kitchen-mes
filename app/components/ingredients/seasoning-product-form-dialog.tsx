"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { FormDialog } from "@/app/components/ui/form-dialog";
import {
  SeasoningProductFormData,
  SeasoningProductFormFields,
  SeasoningProductSource,
} from "@/app/components/ingredients/seasoning-product-form-fields";
import {
  useRecordForm,
  type RecordFormErrors,
} from "@/app/components/ui/use-record-form";
import { toast } from "sonner";
import { usePortionProfiles } from "@/lib/client/use-portion-profiles";
import type { SeasoningProductType } from "@/lib/shared/seasoning-product";

export type SeasoningProductFormItem = {
  id?: number;
  code?: string;
  name?: string;
  productType?: string | null;
  sourceMode?: string | null;
  packageSpec?: number | null;
  portion?: string | null;
  yieldRate?: number | null;
  processingFeePerJin?: number | null;
  grossMarginRate?: number | null;
  sourceIngredientId?: number | null;
  brand?: string | null;
  purchaseSpec?: string | null;
  purchaseUnit?: string | null;
  latestRefPrice?: number | null;
  pricePerJin?: number | null;
};

interface SeasoningProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 锁定的来源调味品（原料层「转化」进入时传入，来源方式锁定为转化） */
  source?: SeasoningProductSource | null;
  /** 锁定产物类型（产物页某 Tab 内新建时传入） */
  fixedProductType?: SeasoningProductType;
  /** 编辑态初始数据；缺省为新建 */
  initialData?: SeasoningProductFormItem;
  onSuccess?: (savedId: number) => void;
  /** 点击「查看已有产物」时回调，由外层打开产物列表抽屉（转化场景） */
  onViewExisting?: () => void;
}

const DEFAULT_PORTION = "单人份";
const DEFAULT_PRODUCT_TYPE: SeasoningProductType = "单品调料";

function buildInitialForm(
  initialData: SeasoningProductFormItem | undefined,
  source: SeasoningProductSource | null | undefined,
  defaultPortion: string,
  fixedProductType: SeasoningProductType | undefined
): SeasoningProductFormData {
  const sourceMode = initialData?.sourceMode ?? "transform";
  const isEdit = Boolean(initialData?.id);
  return {
    name: initialData?.name ?? source?.name ?? "",
    productType: initialData?.productType ?? fixedProductType ?? DEFAULT_PRODUCT_TYPE,
    sourceMode,
    sourceIngredientId: String(
      initialData?.sourceIngredientId ?? source?.id ?? ""
    ),
    packageSpec:
      initialData?.packageSpec != null ? String(initialData.packageSpec) : "500",
    portion: initialData?.portion ?? defaultPortion,
    yieldRate:
      initialData?.yieldRate != null ? String(initialData.yieldRate) : "100",
    processingFeePerJin:
      initialData?.processingFeePerJin != null
        ? String(initialData.processingFeePerJin)
        : "",
    grossMarginRate:
      initialData?.grossMarginRate != null
        ? String(initialData.grossMarginRate)
        : "0",
    brand: initialData?.brand ?? "",
    purchaseSpec: initialData?.purchaseSpec ?? "",
    purchaseUnit: initialData?.purchaseUnit ?? "",
    latestRefPrice:
      initialData?.latestRefPrice != null ? String(initialData.latestRefPrice) : "",
    pricePerJin:
      initialData?.pricePerJin != null && isEdit
        ? String(initialData.pricePerJin)
        : "",
  };
}

function validateSeasoningProductForm(
  values: SeasoningProductFormData
): RecordFormErrors {
  const next: RecordFormErrors = {};
  if (!values.name.trim()) next.name = "产物名称不能为空";
  if (!values.productType) next.productType = "请选择产物类型";
  const spec = Number(values.packageSpec);
  if (!Number.isFinite(spec) || spec <= 0) {
    next.packageSpec = "请填写包装规格（g）";
  }
  if (!values.portion) next.portion = "请选择份量";
  if (values.sourceMode === "transform") {
    if (!values.sourceIngredientId) {
      next.sourceIngredientId = "转化口径必须选择来源调味品";
    }
    const yieldRate = Number(values.yieldRate);
    if (!Number.isFinite(yieldRate) || yieldRate <= 0) {
      next.yieldRate = "请填写出成率";
    }
  } else {
    const pricePerJin = Number(values.pricePerJin);
    if (!Number.isFinite(pricePerJin) || pricePerJin <= 0) {
      next.pricePerJin = "外购口径必须填写每斤单价";
    }
  }
  return next;
}

export function SeasoningProductFormDialog({
  open,
  onOpenChange,
  source,
  fixedProductType,
  initialData,
  onSuccess,
  onViewExisting,
}: SeasoningProductFormDialogProps) {
  const isEdit = Boolean(initialData?.id);
  const sourceLocked = Boolean(source?.id);
  // 默认份量读份量档案：倍率=10 的首个启用行（单人份口径），档案不可达时兜底
  const { profiles } = usePortionProfiles();
  const defaultPortion = useMemo(() => {
    if (profiles) {
      const row =
        profiles.find((p) => p.isActive && p.multiplier === 10) ??
        profiles.find((p) => p.isActive);
      if (row) return row.portion;
    }
    return DEFAULT_PORTION;
  }, [profiles]);

  // 该来源调味品已有的产物数量（头部「查看已有产物」入口用）
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const initialValues = useMemo(
    () =>
      buildInitialForm(initialData, source, defaultPortion, fixedProductType),
    [initialData, source, defaultPortion, fixedProductType]
  );
  // defaultPortion 入 resetKey：份量档案异步返回后表单以档案默认值重建
  const resetKey = `${source?.id ?? "free"}-${fixedProductType ?? ""}-${initialData?.id ?? "new"}-${defaultPortion}`;

  const { form, errors, submitting, setField, submit } = useRecordForm({
    active: open,
    resetKey,
    initialValues,
    validate: validateSeasoningProductForm,
    onSubmit: async (values) => {
      const isTransform = values.sourceMode === "transform";
      const payload = {
        name: values.name.trim(),
        productType: values.productType,
        sourceMode: values.sourceMode,
        packageSpec: Number(values.packageSpec),
        portion: values.portion,
        processingFeePerJin:
          values.processingFeePerJin === ""
            ? null
            : Number(values.processingFeePerJin),
        grossMarginRate:
          values.grossMarginRate === "" ? null : Number(values.grossMarginRate),
        ...(isTransform
          ? {
              sourceIngredientId: Number(values.sourceIngredientId),
              yieldRate: Number(values.yieldRate),
            }
          : {
              brand: values.brand.trim() || null,
              purchaseSpec: values.purchaseSpec.trim() || null,
              purchaseUnit: values.purchaseUnit.trim() || null,
              latestRefPrice:
                values.latestRefPrice === "" ? null : Number(values.latestRefPrice),
              pricePerJin: Number(values.pricePerJin),
            }),
      };

      const res = await fetch(
        isEdit
          ? `/api/seasoning-products/${initialData?.id}`
          : "/api/seasoning-products",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error?: unknown }).error ?? "保存失败")
            : "保存失败";
        toast.error(message);
        return false;
      }

      const data =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data?: { id?: number } }).data
          : undefined;

      toast.success(isEdit ? "产物已更新" : "产物已创建");
      void loadExistingCount();
      onSuccess?.(Number(data?.id ?? 0));
      onOpenChange(false);
      return true;
    },
  });

  const loadExistingCount = useCallback(async () => {
    if (!open || !source?.id) return;
    try {
      const res = await fetch(
        `/api/seasoning-products?sourceIngredientId=${source.id}&page=1&pageSize=1`
      );
      const json: unknown = await res.json();
      const pagination =
        typeof json === "object" && json !== null && "pagination" in json
          ? (json as { pagination?: { totalItems?: number } }).pagination
          : undefined;
      setExistingCount(pagination?.totalItems ?? null);
    } catch {
      setExistingCount(null);
    }
  }, [open, source]);

  useEffect(() => {
    void loadExistingCount();
  }, [loadExistingCount]);

  const handleChange = useCallback(
    (field: keyof SeasoningProductFormData, value: string) => {
      setField(field, value);
    },
    [setField]
  );

  const typeLabel = fixedProductType ?? form.productType ?? "调料产物";
  const dialogTitle = isEdit
    ? `编辑${typeLabel}`
    : sourceLocked
      ? `转化为${typeLabel}`
      : `新增${typeLabel}`;

  // 来源调味品摘要（转化入口进入时展示）
  const sourceSummary = source?.id ? (
    <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-h-8 flex-wrap items-center gap-2 text-xs">
        <span className="font-mono font-medium tabular-nums text-muted-foreground">
          {source.code}
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          ·
        </span>
        <span className="font-medium text-foreground">{source.name}</span>
        {source.purchaseSpec ? (
          <>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span className="text-muted-foreground">
              采购规格 {source.purchaseSpec}
            </span>
          </>
        ) : null}
      </div>

      {onViewExisting ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          onClick={onViewExisting}
        >
          <PackageOpen className="mr-1.5 h-3.5 w-3.5" />
          查看已有产物
          {existingCount != null ? `（${existingCount}）` : ""}
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="workbench"
        className="[&>button]:cursor-pointer p-0 flex flex-col max-h-[calc(100dvh-24px)]"
      >
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-lg">{dialogTitle}</DialogTitle>
          {sourceSummary}
          {errors.sourceIngredientId && (
            <p className="text-xs text-destructive" role="alert">
              {errors.sourceIngredientId}
            </p>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
          <SeasoningProductFormFields
            form={form}
            onChange={handleChange}
            source={source}
            fixedProductType={fixedProductType}
            errors={errors}
          />
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <SkeuButton
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </SkeuButton>
          <SkeuButton
            onClick={() => {
              void submit();
            }}
            disabled={submitting}
          >
            <span aria-live="polite" className="inline-flex items-center">
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              保存
            </span>
          </SkeuButton>
        </DialogFooter>
      </AppDialogContent>
    </FormDialog>
  );
}
