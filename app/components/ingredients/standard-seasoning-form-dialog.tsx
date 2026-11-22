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
import { CategoryTag } from "@/app/components/ui/category-tag";
import {
  StandardSeasoningFormData,
  StandardSeasoningFormFields,
  StandardSeasoningSource,
} from "@/app/components/ingredients/standard-seasoning-form-fields";
import {
  useRecordForm,
  type RecordFormErrors,
} from "@/app/components/ui/use-record-form";
import { toast } from "sonner";

export type StandardSeasoningFormItem = {
  id?: number;
  code?: string;
  name?: string;
  packageSpec?: number | null;
  portion?: string | null;
  yieldRate?: number | null;
  processingFeePerJin?: number | null;
  grossMarginRate?: number | null;
  sourceIngredientId?: number | null;
};

interface StandardSeasoningFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 来源调料（新建与编辑都必填，进入弹窗时锁定来源） */
  source: StandardSeasoningSource;
  /** 编辑态初始数据；缺省为新建（转调料） */
  initialData?: StandardSeasoningFormItem;
  onSuccess?: (savedId: number) => void;
  /** 点击「查看已有封装调料」时回调，由外层打开封装调料列表 */
  onViewExisting?: () => void;
}

const DEFAULT_PORTION = "小碗菜·10份";

function buildInitialForm(
  initialData: StandardSeasoningFormItem | undefined,
  source: StandardSeasoningSource
): StandardSeasoningFormData {
  return {
    // 名称沿用来源调料名
    name: initialData?.name ?? source.name ?? "",
    sourceIngredientId: String(initialData?.sourceIngredientId ?? source.id),
    packageSpec:
      initialData?.packageSpec != null ? String(initialData.packageSpec) : "",
    portion: initialData?.portion ?? DEFAULT_PORTION,
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

function validateStandardSeasoningForm(
  values: StandardSeasoningFormData
): RecordFormErrors {
  const next: RecordFormErrors = {};
  if (!values.name.trim()) next.name = "调料名称不能为空";
  const spec = Number(values.packageSpec);
  if (!Number.isFinite(spec) || spec <= 0) {
    next.packageSpec = "请填写包装规格（g）";
  }
  if (!values.portion) next.portion = "请选择份量";
  const yieldRate = Number(values.yieldRate);
  if (!Number.isFinite(yieldRate) || yieldRate <= 0) {
    next.yieldRate = "请填写出成率";
  }
  return next;
}

export function StandardSeasoningFormDialog({
  open,
  onOpenChange,
  source,
  initialData,
  onSuccess,
  onViewExisting,
}: StandardSeasoningFormDialogProps) {
  const isEdit = Boolean(initialData?.id);
  // 该来源调料已有的标准规格数量（头部「查看已有封装调料」入口用）
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
    validate: validateStandardSeasoningForm,
    onSubmit: async (values) => {
      const payload = {
        name: values.name.trim(),
        sourceIngredientId: Number(values.sourceIngredientId),
        packageSpec: Number(values.packageSpec),
        portion: values.portion,
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
          ? `/api/standard-seasonings/${initialData?.id}`
          : "/api/standard-seasonings",
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

      toast.success(isEdit ? "调料规格已更新" : "调料规格已创建");
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
        `/api/standard-seasonings?sourceIngredientId=${source.id}&page=1&pageSize=1`
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
  }, [open, source.id]);

  useEffect(() => {
    void loadExistingCount();
  }, [loadExistingCount]);

  const handleChange = useCallback(
    (field: keyof StandardSeasoningFormData, value: string) => {
      setField(field, value);
    },
    [setField]
  );

  const dialogTitle = isEdit ? "编辑调料规格" : "转调料";

  // 来源调料摘要：与「转净料」弹窗一致
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
        {source.l2Name ? (
          <>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <CategoryTag l2Code="" name={source.l2Name} />
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
          查看已有封装调料
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
          {(errors.sourceIngredientId || errors.l2Code) && (
            <p className="text-xs text-destructive" role="alert">
              {errors.sourceIngredientId || errors.l2Code}
            </p>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
          <StandardSeasoningFormFields
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
