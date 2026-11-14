"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
  CategoryL1,
  IngredientFormData,
  Unit,
} from "@/app/components/ingredients/ingredient-form-fields";
import {
  type RecordFormErrors,
  useRecordForm,
} from "@/app/components/ui/use-record-form";
import { calcPricePerJin, getDefaultSpec } from "@/lib/shared/spec-parser";
import { buildJinFactors } from "@/lib/shared/unit-conversion";

export type IngredientFormInitialData = {
  id?: number;
  code?: string;
  name?: string;
  l2Code?: string;
  alias?: string | null;
  purchaseSpec?: string | null;
  purchaseUnit?: string | null;
  stockUnit?: string | null;
  unitsPerPurchase?: number | null;
  latestRefPrice?: number | null;
  pricePerJin?: number | null;
  defaultSupplierId?: number | null;
};

export type SavedIngredientRecord = {
  id: number;
  name: string;
  alias?: string | null;
  l2Code: string;
  purchaseSpec?: string | null;
  purchaseUnit?: string | null;
  stockUnit?: string | null;
  unitsPerPurchase?: number | null;
  latestRefPrice?: number | null;
  pricePerJin?: number | null;
  defaultSupplierId?: number | null;
};

type UseIngredientFormOptions = {
  active: boolean;
  autoCalculate?: boolean;
  initialData?: IngredientFormInitialData | null;
  categories: CategoryL1[];
  units: Unit[];
  mode: "ingredient" | "seasoning" | "auto";
  onSaved: (data: SavedIngredientRecord) => void;
};

function findParentL1(categories: CategoryL1[], l2Code?: string) {
  if (!l2Code) return undefined;
  return categories.find((category) =>
    category.children.some((child) => child.code === l2Code)
  );
}

function buildForm(
  initialData: IngredientFormInitialData | null | undefined,
  categories: CategoryL1[],
  mode: UseIngredientFormOptions["mode"]
): IngredientFormData {
  const parentL1 = findParentL1(categories, initialData?.l2Code);
  const isCreate = !initialData?.id && mode !== "seasoning";

  return {
    name: initialData?.name || "",
    l1Code: parentL1?.code || "",
    l2Code: initialData?.l2Code || "",
    alias: initialData?.alias || "",
    purchaseSpec: initialData?.purchaseSpec || (isCreate ? "散称" : ""),
    purchaseUnit: initialData?.purchaseUnit || (isCreate ? "斤" : ""),
    unitsPerPurchase:
      initialData?.unitsPerPurchase != null
        ? String(initialData.unitsPerPurchase)
        : "1",
    latestRefPrice:
      initialData?.latestRefPrice != null
        ? String(initialData.latestRefPrice)
        : "",
    pricePerJin:
      initialData?.pricePerJin != null ? String(initialData.pricePerJin) : "",
    stockUnit: initialData?.stockUnit || (isCreate ? "斤" : ""),
    defaultSupplierId:
      initialData?.defaultSupplierId != null
        ? String(initialData.defaultSupplierId)
        : "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNullableNumber(
  value: unknown,
  fallback: number | null
): number | null {
  if (value == null || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function validateIngredientForm(
  form: IngredientFormData,
  categories: CategoryL1[],
  mode: UseIngredientFormOptions["mode"]
): RecordFormErrors {
  const next: RecordFormErrors = {};
  const parentL1 = findParentL1(categories, form.l2Code);
  const isSeasoning =
    mode === "seasoning" || (mode === "auto" && parentL1?.code === "SEA");

  if (!form.name.trim()) next.name = "名称不能为空";
  if (!form.l1Code) next.l1Code = "请选择一级分类";
  if (!form.l2Code) next.l2Code = "请选择二级分类";
  if (isSeasoning && !form.alias.trim()) {
    next.alias = "调料必须填写商品名称";
  }
  if (!form.purchaseSpec.trim()) {
    next.purchaseSpec = "采购规格不能为空";
  }
  if (!form.purchaseUnit.trim()) {
    next.purchaseUnit = "请选择采购单位";
  }
  if (!form.stockUnit.trim()) {
    next.stockUnit = "请选择入库单位";
  }

  const unitsPerPurchase = Number(form.unitsPerPurchase);
  if (
    !form.unitsPerPurchase ||
    !Number.isInteger(unitsPerPurchase) ||
    unitsPerPurchase < 1
  ) {
    next.unitsPerPurchase = "请填写有效的入库数量（正整数）";
  }

  if (
    form.latestRefPrice &&
    (!Number.isFinite(Number(form.latestRefPrice)) ||
      Number(form.latestRefPrice) < 0)
  ) {
    next.latestRefPrice = "最新参照单价不能为负数";
  }
  if (
    form.pricePerJin &&
    (!Number.isFinite(Number(form.pricePerJin)) ||
      Number(form.pricePerJin) < 0)
  ) {
    next.pricePerJin = "每斤单价不能为负数";
  }

  return next;
}

export function useIngredientForm({
  active,
  autoCalculate = true,
  initialData,
  categories,
  units,
  mode,
  onSaved,
}: UseIngredientFormOptions) {
  const [l2Open, setL2Open] = useState(false);
  const [pricePerJinDirty, setPricePerJinDirty] = useState(false);

  const initialValues = buildForm(initialData, categories, mode);
  const categorySignature = categories
    .map(
      (category) =>
        `${category.code}:${category.children.map((child) => child.code).join(",")}`
    )
    .join("|");
  const resetKey = [
    mode,
    initialData?.id ?? "new",
    initialData?.name ?? "",
    initialData?.l2Code ?? "",
    initialData?.alias ?? "",
    initialData?.purchaseSpec ?? "",
    initialData?.purchaseUnit ?? "",
    initialData?.stockUnit ?? "",
    initialData?.unitsPerPurchase ?? "",
    initialData?.latestRefPrice ?? "",
    initialData?.pricePerJin ?? "",
    initialData?.defaultSupplierId ?? "",
    categorySignature,
  ].join("\u0001");

  const jinFactors = useMemo(() => {
    const factors = buildJinFactors(units);
    return Object.keys(factors).length > 0 ? factors : undefined;
  }, [units]);

  const submitIngredient = async (
    form: IngredientFormData
  ): Promise<boolean> => {
    let nameExists = false;
    try {
      const duplicateResponse = await fetch(
        `/api/ingredients/check-name?name=${encodeURIComponent(form.name.trim())}` +
          (initialData?.id ? `&excludeId=${initialData.id}` : "")
      );
      if (duplicateResponse.status !== 401) {
        const duplicateData: unknown = await duplicateResponse.json();
        nameExists =
          isRecord(duplicateData) && Boolean(duplicateData.exists);
      }
    } catch {
      toast.error("网络异常，请检查网络后重试");
      return false;
    }

    if (nameExists) {
      toast.error("食材名称已存在");
      return false;
    }

    try {
      const latestRefPrice = form.latestRefPrice
        ? Number(form.latestRefPrice)
        : null;
      const pricePerJin = form.pricePerJin
        ? Number(form.pricePerJin)
        : null;
      const purchaseSpec =
        form.purchaseSpec.trim() || getDefaultSpec(form.stockUnit);
      const payload = {
        name: form.name.trim(),
        // 更新时传空字符串才能清空已有品牌；API 会把空字符串落为 null
        alias: form.alias.trim(),
        l2Code: form.l2Code,
        purchaseSpec,
        purchaseUnit: form.purchaseUnit,
        stockUnit: form.stockUnit,
        unitsPerPurchase: Number(form.unitsPerPurchase) || 1,
        ...(latestRefPrice != null && { latestRefPrice }),
        ...(pricePerJin != null && { pricePerJin }),
        defaultSupplierId: form.defaultSupplierId
          ? Number(form.defaultSupplierId)
          : null,
      };

      const response = await fetch(
        initialData?.id
          ? `/api/ingredients/${initialData.id}`
          : "/api/ingredients",
        {
          method: initialData?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const responseData: unknown = await response.json();
      if (!response.ok) {
        const message =
          isRecord(responseData) &&
          (typeof responseData.error === "string" ||
            typeof responseData.message === "string")
            ? String(responseData.error || responseData.message)
            : "保存失败";
        toast.error(message);
        return false;
      }

      const source =
        isRecord(responseData) && isRecord(responseData.data)
          ? responseData.data
          : responseData;
      const record = isRecord(source) ? source : {};
      const saved: SavedIngredientRecord = {
        id: Number(record.id),
        name: readString(record.name, form.name.trim()),
        alias: typeof record.alias === "string" ? record.alias : null,
        l2Code: readString(record.l2Code, form.l2Code),
        purchaseSpec:
          typeof record.purchaseSpec === "string"
            ? record.purchaseSpec
            : purchaseSpec,
        purchaseUnit:
          typeof record.purchaseUnit === "string"
            ? record.purchaseUnit
            : form.purchaseUnit,
        stockUnit:
          typeof record.stockUnit === "string"
            ? record.stockUnit
            : form.stockUnit,
        unitsPerPurchase: readNullableNumber(
          record.unitsPerPurchase,
          Number(form.unitsPerPurchase) || 1
        ),
        latestRefPrice: readNullableNumber(
          record.latestRefPrice,
          latestRefPrice
        ),
        pricePerJin: readNullableNumber(record.pricePerJin, pricePerJin),
        defaultSupplierId: readNullableNumber(
          record.defaultSupplierId,
          form.defaultSupplierId ? Number(form.defaultSupplierId) : null
        ),
      };

      if (!Number.isFinite(saved.id)) {
        toast.error("保存成功，但返回数据异常，请刷新后确认");
        return false;
      }

      toast.success(initialData?.id ? "更新成功" : "创建成功");
      onSaved(saved);
      return true;
    } catch {
      toast.error("保存出错");
      return false;
    }
  };

  const {
    form,
    setForm,
    errors,
    isDirty,
    submitting,
    setField,
    resetForm,
    submit,
  } = useRecordForm({
    active,
    resetKey,
    initialValues,
    validate: (values) => validateIngredientForm(values, categories, mode),
    onSubmit: submitIngredient,
    onReset: () => {
      setL2Open(false);
      setPricePerJinDirty(false);
    },
  });

  useEffect(() => {
    if (!active || !autoCalculate || pricePerJinDirty) return;
    const jin = calcPricePerJin(
      form.latestRefPrice ? Number(form.latestRefPrice) : null,
      form.purchaseSpec,
      jinFactors,
      form.purchaseUnit
    );
    if (jin != null && String(jin) !== form.pricePerJin) {
      setForm((previous) => ({ ...previous, pricePerJin: String(jin) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    autoCalculate,
    form.purchaseSpec,
    form.latestRefPrice,
    form.purchaseUnit,
    jinFactors,
    pricePerJinDirty,
  ]);

  const handleChange = (
    field: keyof IngredientFormData,
    value: string
  ) => {
    setField(field, value);
    if (field === "pricePerJin") setPricePerJinDirty(true);
  };

  return {
    form,
    errors,
    l2Open,
    setL2Open,
    submitting,
    isDirty,
    handleChange,
    submit,
    resetForm,
  };
}
