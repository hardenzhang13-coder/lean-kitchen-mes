"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import type {
  CategoryL1,
  NetIngredientFormData,
  RawIngredientOption,
} from "@/app/components/ingredients/net-ingredient-form-fields";
import { useRecordForm } from "@/app/components/ui/use-record-form";
import { calcNetUnitPrice } from "@/lib/shared/spec-parser";

export type NetIngredientFormInitialData = {
  id?: number;
  name?: string | null;
  packageSpec?: number | null;
  packageMaterial?: string | null;
  packageSize?: string | null;
  processingFeePerJin?: number | null;
  yieldRate?: number | null;
  unitPrice?: number | string | null;
  grossMarginRate?: number | null;
  sourceIngredientId?: number | null;
  l2Code?: string | null;
};

type UseNetIngredientFormOptions = {
  active: boolean;
  initialData?: NetIngredientFormInitialData | null;
  categories: CategoryL1[];
  rawIngredients?: RawIngredientOption[];
  sourcePricePerJin?: number | null;
  mode?: "net" | "minor";
  onSaved: () => void;
};

function findParentL1(categories: CategoryL1[], l2Code?: string | null) {
  if (!l2Code) return undefined;
  return categories.find((category) =>
    category.children.some((child) => child.code === l2Code)
  );
}

function buildForm(
  initialData: NetIngredientFormInitialData | null | undefined,
  categories: CategoryL1[],
  mode: "net" | "minor"
): NetIngredientFormData {
  const parentL1 = findParentL1(categories, initialData?.l2Code);

  return {
    name: initialData?.name || "",
    l1Code: mode === "minor" ? "MIN" : parentL1?.code || "",
    l2Code: initialData?.l2Code || "",
    sourceIngredientId:
      initialData?.sourceIngredientId != null
        ? String(initialData.sourceIngredientId)
        : "",
    packageSpec:
      initialData?.packageSpec != null ? String(initialData.packageSpec) : "",
    packageMaterial: initialData?.packageMaterial || "",
    packageSize: initialData?.packageSize || "",
    processingFeePerJin:
      initialData?.processingFeePerJin != null
        ? String(initialData.processingFeePerJin)
        : "",
    yieldRate:
      initialData?.yieldRate != null ? String(initialData.yieldRate) : "",
    unitPrice:
      initialData?.unitPrice != null ? String(initialData.unitPrice) : "",
    grossMarginRate:
      initialData?.grossMarginRate != null
        ? String(initialData.grossMarginRate)
        : "0",
  };
}

function validateNetIngredientForm(
  form: NetIngredientFormData,
  mode: "net" | "minor",
  sourcePricePerJin: number | null
) {
  const next: Record<string, string> = {};
  const label = mode === "minor" ? "小料" : "净料";

  if (!form.name.trim()) next.name = `${label}名称不能为空`;
  if (!form.l2Code) next.l2Code = "请选择二级分类";
  if (!form.sourceIngredientId) next.sourceIngredientId = "请选择来源原料";

  const yieldRate = Number(form.yieldRate);
  if (!form.yieldRate || yieldRate <= 0 || yieldRate > 500) {
    next.yieldRate =
      "出成率必须在 0.01-500 之间（上浆/挂糊类可超过 100）";
  }

  const packageSpec = Number(form.packageSpec);
  if (
    !form.packageSpec ||
    !Number.isInteger(packageSpec) ||
    packageSpec < 1
  ) {
    next.packageSpec = "请填写有效的包装规格（g）";
  }

  if (!form.packageMaterial.trim()) {
    next.packageMaterial =
      mode === "minor" ? "请选择包装" : "请选择包装名称";
  }
  if (!form.packageSize.trim()) {
    next.packageSize =
      mode === "minor" ? "请选择包装" : "请选择包装尺寸";
  }

  if (
    form.processingFeePerJin &&
    Number(form.processingFeePerJin) < 0
  ) {
    next.processingFeePerJin = "封装加工费不能为负数";
  }

  if (
    form.grossMarginRate !== "" &&
    (Number.isNaN(Number(form.grossMarginRate)) ||
      Number(form.grossMarginRate) < 0 ||
      Number(form.grossMarginRate) >= 100)
  ) {
    next.grossMarginRate = "毛利率必须在 0-95 之间";
  }

  const unitPrice = calcNetUnitPrice({
    pricePerJin: sourcePricePerJin,
    yieldRate,
  });
  if (unitPrice == null) {
    next.unitPrice = "来源原料缺少每斤单价，无法计算净料单价";
  }

  return next;
}

/**
 * 净料/小料编辑共用的表单状态与提交口径。
 * 新增和转净料仍由 NetIngredientFormDialog 负责来源选择与自动换算。
 */
export function useNetIngredientForm({
  active,
  initialData,
  categories,
  rawIngredients = [],
  sourcePricePerJin,
  mode = "net",
  onSaved,
}: UseNetIngredientFormOptions) {
  const initialValues = useMemo(
    () => buildForm(initialData, categories, mode),
    [categories, initialData, mode]
  );
  const resolvedSourcePrice = useMemo(() => {
    if (sourcePricePerJin != null) return sourcePricePerJin;
    const source = rawIngredients.find(
      (item) => String(item.id) === String(initialData?.sourceIngredientId)
    );
    return source?.pricePerJin != null ? Number(source.pricePerJin) : null;
  }, [initialData?.sourceIngredientId, rawIngredients, sourcePricePerJin]);

  const resetKey = [
    mode,
    initialData?.id ?? "new",
    initialData?.name ?? "",
    initialData?.l2Code ?? "",
    initialData?.sourceIngredientId ?? "",
    initialData?.packageSpec ?? "",
    initialData?.packageMaterial ?? "",
    initialData?.packageSize ?? "",
    initialData?.processingFeePerJin ?? "",
    initialData?.yieldRate ?? "",
    initialData?.unitPrice ?? "",
    initialData?.grossMarginRate ?? "",
  ].join("\u0001");

  const submit = async (form: NetIngredientFormData) => {
    if (!initialData?.id) {
      toast.error("缺少待编辑记录");
      return false;
    }

    try {
      const payload = {
        name: form.name.trim(),
        l2Code: form.l2Code,
        sourceIngredientId: Number(form.sourceIngredientId),
        yieldRate: Number(form.yieldRate),
        packageSpec: Number(form.packageSpec),
        packageMaterial: form.packageMaterial.trim() || null,
        packageSize: form.packageSize.trim() || null,
        processingFeePerJin: form.processingFeePerJin
          ? Number(form.processingFeePerJin)
          : null,
        grossMarginRate:
          form.grossMarginRate !== ""
            ? Number(form.grossMarginRate)
            : 0,
      };

      const response = await fetch(
        `/api/net-ingredients/${initialData.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "更新失败";
        toast.error(message);
        return false;
      }

      toast.success("更新成功");
      onSaved();
      return true;
    } catch {
      toast.error("更新出错");
      return false;
    }
  };

  const formState = useRecordForm({
    active,
    resetKey,
    initialValues,
    validate: (values) =>
      validateNetIngredientForm(values, mode, resolvedSourcePrice),
    onSubmit: submit,
  });

  return {
    ...formState,
    handleChange: (
      field: keyof NetIngredientFormData,
      value: string
    ) => {
      formState.setField(field, value);
      if (field === "l1Code" && mode !== "minor") {
        formState.setField("l2Code", "");
      }
    },
  };
}
