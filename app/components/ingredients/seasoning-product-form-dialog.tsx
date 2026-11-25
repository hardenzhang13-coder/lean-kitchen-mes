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

export type SeasoningProductFormItem = {
  id?: number;
  code?: string;
  name?: string;
  productType?: string | null;
  packageSpec?: number | null;
  yieldRate?: number | null;
  processingFeePerJin?: number | null;
  grossMarginRate?: number | null;
};

interface SeasoningProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 来源调味品（转化入口必传；产物类型继承来源，不在表单内选择） */
  source: SeasoningProductSource;
  /** 编辑态初始数据；缺省为新建 */
  initialData?: SeasoningProductFormItem;
  onSuccess?: (savedId: number) => void;
  /** 点击「查看已有产物」时回调，由外层打开产物列表抽屉（转化场景） */
  onViewExisting?: () => void;
}

function buildInitialForm(
  initialData: SeasoningProductFormItem | undefined,
  source: SeasoningProductSource
): SeasoningProductFormData {
  return {
    name: initialData?.name ?? source.name ?? "",
    packageSpec:
      initialData?.packageSpec != null ? String(initialData.packageSpec) : "500",
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
  };
}

function validateSeasoningProductForm(
  values: SeasoningProductFormData
): RecordFormErrors {
  const next: RecordFormErrors = {};
  if (!values.name.trim()) next.name = "调料名称不能为空";
  const spec = Number(values.packageSpec);
  if (!Number.isFinite(spec) || spec <= 0) {
    next.packageSpec = "请填写包装规格（g）";
  }
  const yieldRate = Number(values.yieldRate);
  if (!Number.isFinite(yieldRate) || yieldRate <= 0) {
    next.yieldRate = "请填写出成率";
  }
  return next;
}

export function SeasoningProductFormDialog({
  open,
  onOpenChange,
  source,
  initialData,
  onSuccess,
  onViewExisting,
}: SeasoningProductFormDialogProps) {
  const isEdit = Boolean(initialData?.id);

  // 该来源调味品已有的产物数量（头部「查看已有产物」入口用）
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const initialValues = useMemo(
    () => buildInitialForm(initialData, source),
    [initialData, source]
  );
  const resetKey = `${source.id}-${initialData?.id ?? "new"}`;

  const { form, errors, submitting, setField, submit } = useRecordForm({
    active: open,
    resetKey,
    initialValues,
    validate: validateSeasoningProductForm,
    onSubmit: async (values) => {
      const payload = {
        name: values.name.trim(),
        sourceIngredientId: source.id,
        packageSpec: Number(values.packageSpec),
        yieldRate: Number(values.yieldRate),
        processingFeePerJin:
          values.processingFeePerJin === ""
            ? null
            : Number(values.processingFeePerJin),
        grossMarginRate:
          values.grossMarginRate === "" ? null : Number(values.grossMarginRate),
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

      toast.success(isEdit ? "调料已更新" : "调料已创建");
      void loadExistingCount();
      onSuccess?.(Number(data?.id ?? 0));
      onOpenChange(false);
      return true;
    },
  });

  const loadExistingCount = useCallback(async () => {
    if (!open || !source.id) return;
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

  // 产物类型继承来源调味品的 seasoningType，标题直接点明转化目标类型
  const typeLabel =
    initialData?.productType ?? source.seasoningType ?? "调料";
  const dialogTitle = isEdit ? `编辑${typeLabel}` : `转化为${typeLabel}`;

  // 来源调味品摘要（头部展示）
  const sourceSummary = (
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
          查看已有调料
          {existingCount != null ? `（${existingCount}）` : ""}
        </Button>
      ) : null}
    </div>
  );

  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="workbench"
        className="[&>button]:cursor-pointer p-0 flex flex-col max-h-[calc(100dvh-24px)]"
      >
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-lg">{dialogTitle}</DialogTitle>
          {sourceSummary}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
          <SeasoningProductFormFields
            form={form}
            onChange={handleChange}
            source={source}
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
