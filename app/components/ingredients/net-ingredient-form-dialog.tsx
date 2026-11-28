"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PackageOpen } from "lucide-react";


import { SkeuButton } from "@/app/components/ui/skeu-button";
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { DataTable } from "@/app/components/ui/data-table";
import { FormDialog } from "@/app/components/ui/form-dialog";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { RecordSheet } from "@/app/components/ui/record-sheet";
import {
  IngredientSelectorDialog,
} from "@/app/components/ingredients/ingredient-selector-dialog";
import {
  NetIngredientFormFields,
  NetIngredientFormData,
  CategoryL1,
  RawIngredientOption,
} from "@/app/components/ingredients/net-ingredient-form-fields";
import { toast } from "sonner";
import { EmptyValue } from "@/app/components/ui/empty-value";
import {
  buildNetIngredientDefaultName,
  isDefaultNetIngredientName,
} from "@/lib/shared/net-name";
import { usePortionProfiles } from "@/lib/client/use-portion-profiles";

export type NetIngredientItem = {
  id: number;
  code: string;
  name: string;
  packageSpec: number | null;
  packageMaterial: string | null;
  packageSize: string | null;
  processingFeePerJin: number | null;
  yieldRate: number | null;
  unitPrice: number | null;
  costPricePerJin: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
  grossMarginRate: number | null;
  /** 份量（份量档案标签） */
  portion?: string | null;
  unit: string;
  sourceIngredientId: number | null;
  l2Code: string;
};

/** 净料表单回填数据：复制场景下不带 id，提交时按新建处理 */
export type NetIngredientFormItem = {
  id?: number;
  code?: string;
  name?: string;
  packageSpec?: number | null;
  packageMaterial?: string | null;
  packageSize?: string | null;
  processingFeePerJin?: number | null;
  yieldRate?: number | null;
  unitPrice?: number | null;
  grossMarginRate?: number | null;
  /** 份量（份量档案标签） */
  portion?: string | null;
  sourceIngredientId?: number | null;
  l2Code?: string | null;
};

interface NetIngredientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "net" | "convert";
  sourceIngredientId?: number;
  /** 来源食材名称：转净料时用于生成默认净料名称（食材列表可能分页，不能只靠 rawIngredients 查） */
  sourceIngredientName?: string | null;
  initialData?: NetIngredientFormItem;
  categories: CategoryL1[];
  rawIngredients: RawIngredientOption[];
  onSuccess?: () => void;
  /** 自定义弹窗标题（复制场景：复制净料） */
  title?: string;
}

const RIGHT_LIST_PAGE_SIZE = 20;

const emptyForm: NetIngredientFormData = {
  name: "",
  l1Code: "",
  l2Code: "",
  sourceIngredientId: "",
  packageSpec: "500",
  packageMaterial: "",
  packageSize: "",
  processingFeePerJin: "0.35",
  yieldRate: "",
  unitPrice: "",
  grossMarginRate: "0",
  // 新建净料/转净料默认份量（兜底；打开弹窗时按份量档案覆盖，见 defaultPortionRef）
  portion: "单人份",
};

function formatPackageSpec(value: number | null) {
  return value != null ? `${value}g` : "";
}

function formatPercent(value: number | null) {
  return `${Number(value ?? 0)}%`;
}

function formatPrice(value: number | null, unit: string) {
  return value != null ? `¥${Number(value).toFixed(2)}${unit}` : "";
}

export function NetIngredientFormDialog({
  open,
  onOpenChange,
  mode = "net",
  sourceIngredientId: propSourceId,
  sourceIngredientName,
  initialData,
  categories,
  rawIngredients,
  onSuccess,
  title,
}: NetIngredientFormDialogProps) {
  const [form, setForm] = useState<NetIngredientFormData>(emptyForm);
  // 默认份量读份量档案：优先基本单元行（单人份），档案不可达时兜底「单人份」
  const { profiles } = usePortionProfiles();
  const defaultPortion = useMemo(() => {
    if (profiles) {
      const row =
        profiles.find((p) => p.isActive && p.isBase) ??
        profiles.find((p) => p.isActive && p.multiplier === 1) ??
        profiles.find((p) => p.isActive);
      if (row) return row.portion;
    }
    return "单人份";
  }, [profiles]);
  // 打开重置表单时取当时的默认值；档案异步加载不触发二次重置，避免覆盖用户已选份量
  const defaultPortionRef = useRef(defaultPortion);
  useEffect(() => {
    defaultPortionRef.current = defaultPortion;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [rightList, setRightList] = useState<NetIngredientItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listFailed, setListFailed] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [listPagination, setListPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);
  const [sourceSelectorOpen, setSourceSelectorOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const listRequestSeq = useRef(0);

  const isConvert = mode === "convert";

  const findParentL1 = useCallback(
    (l2Code?: string | null) => {
      if (!l2Code) return undefined;
      return categories.find((category) =>
        category.children.some((child) => child.code === l2Code)
      );
    },
    [categories]
  );

  const getRawIngredient = useCallback(
    (id?: number) => {
      if (!id) return undefined;
      return rawIngredients.find((ingredient) => ingredient.id === id);
    },
    [rawIngredients]
  );

  const selectedSource = getRawIngredient(Number(form.sourceIngredientId));
  const selectedL1 = findParentL1(form.l2Code);
  const selectedL2 = selectedL1?.children.find(
    (category) => category.code === form.l2Code
  );
  // 转化时头部固定展示来源食材的原分类；下方分类随转化目标变化
  const sourceL1 = findParentL1(selectedSource?.l2Code);
  const sourceL2 = sourceL1?.children.find(
    (category) => category.code === selectedSource?.l2Code
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;

    setErrors({});
    setListPage(1);
    setSourceSelectorOpen(false);
    setListOpen(false);

    if (initialData) {
      const parentL1 = findParentL1(initialData.l2Code);
      setForm({
        name: initialData.name || "",
        l1Code: parentL1?.code || "",
        l2Code: initialData.l2Code || "",
        sourceIngredientId: initialData.sourceIngredientId
          ? String(initialData.sourceIngredientId)
          : "",
        packageSpec:
          initialData.packageSpec != null
            ? String(initialData.packageSpec)
            : "",
        packageMaterial: initialData.packageMaterial || "",
        packageSize: initialData.packageSize || "",
        processingFeePerJin:
          initialData.processingFeePerJin != null
            ? String(initialData.processingFeePerJin)
            : "",
        yieldRate:
          initialData.yieldRate != null ? String(initialData.yieldRate) : "",
        unitPrice:
          initialData.unitPrice != null ? String(initialData.unitPrice) : "",
        grossMarginRate:
          initialData.grossMarginRate != null
            ? String(initialData.grossMarginRate)
            : "0",
        portion: initialData.portion || "",
      });
      return;
    }

    if (isConvert && propSourceId) {
      const raw = getRawIngredient(propSourceId);
      const parentL1 = raw ? findParentL1(raw.l2Code) : undefined;
      setForm({
        ...emptyForm,
        portion: defaultPortionRef.current,
        // 默认名称：食材名称•加工方式•500g
        name: buildNetIngredientDefaultName(
          raw?.name ?? sourceIngredientName,
          emptyForm.packageSpec
        ),
        l1Code: parentL1?.code || "",
        l2Code: raw?.l2Code || "",
        sourceIngredientId: String(propSourceId),
        // 出成率预填来源食材的建档默认值，转化时可修改
        yieldRate: raw?.yieldRate != null ? String(raw.yieldRate) : "",
      });
      return;
    }

    // 新增净料先从来源食材开始，不再预选一个无来源的分类。
    setForm({ ...emptyForm, portion: defaultPortionRef.current });
  }, [
    open,
    initialData,
    isConvert,
    propSourceId,
    sourceIngredientName,
    findParentL1,
    getRawIngredient,
    categories,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;

    const seq = ++listRequestSeq.current;
    const l2Code = form.l2Code;
    if (!l2Code) {
      setRightList([]);
      setListPagination(null);
      setLoadingList(false);
      setListFailed(false);
      return;
    }

    const load = async () => {
      setLoadingList(true);
      setListFailed(false);
      setRightList([]);
      setListPagination(null);
      try {
        const url = `/api/net-ingredients?l2Code=${encodeURIComponent(l2Code)}&page=${listPage}&pageSize=${RIGHT_LIST_PAGE_SIZE}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("加载右侧列表失败");

        const json: unknown = await response.json();
        const data =
          typeof json === "object" &&
          json !== null &&
          "data" in json &&
          Array.isArray(json.data)
            ? (json.data as NetIngredientItem[])
            : [];
        const pagination =
          typeof json === "object" &&
          json !== null &&
          "pagination" in json &&
          typeof json.pagination === "object" &&
          json.pagination !== null
            ? (json.pagination as {
                totalItems: number;
                totalPages: number;
              })
            : null;
        if (listRequestSeq.current === seq) {
          setRightList(data);
          setListPagination(pagination);
        }
      } catch {
        if (listRequestSeq.current === seq) setListFailed(true);
      } finally {
        if (listRequestSeq.current === seq) setLoadingList(false);
      }
    };

    load();
  }, [
    open,
    form.l2Code,
    listPage,
    listRefreshKey,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleChange = (
    field: keyof NetIngredientFormData,
    value: string
  ) => {
    setForm((previous) => {
      const next = { ...previous, [field]: value };
      if (field === "l1Code") next.l2Code = "";
      return next;
    });

    if (errors[field]) {
      setErrors((previous) => ({ ...previous, [field]: "" }));
    }
  };

  const handleSourceConfirm = (value: {
    l1Code: string;
    l2Code: string;
    ingredientId: string;
  }) => {
    const sourceName = getRawIngredient(Number(value.ingredientId))?.name;
    setForm((previous) => ({
      ...previous,
      l1Code: value.l1Code,
      l2Code: value.l2Code,
      sourceIngredientId: value.ingredientId,
      // 选定来源食材后自动生成默认名称；用户手工改过就不覆盖
      name:
        !previous.name.trim() || isDefaultNetIngredientName(previous.name)
          ? buildNetIngredientDefaultName(sourceName, previous.packageSpec)
          : previous.name,
    }));
    setListPage(1);
    setSourceSelectorOpen(false);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) {
      next.name = "净料名称不能为空";
    }
    if (!form.l2Code) next.l2Code = "请选择来源食材";
    if (!form.sourceIngredientId) {
      next.sourceIngredientId = "请选择来源食材";
    }

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

    if (!form.packageMaterial.trim() || !form.packageSize.trim()) {
      if (!form.packageMaterial.trim()) {
        next.packageMaterial = "请选择包装名称";
      }
      if (!form.packageSize.trim()) {
        next.packageSize = "请选择包装尺寸";
      }
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

    // 份量：新建必填，与菜品份量共用同一套枚举
    if (!form.portion) {
      next.portion = "请选择份量";
    }

    const sourcePricePerJin =
      selectedSource?.pricePerJin != null
        ? Number(selectedSource.pricePerJin)
        : null;
    const calculatedUnitPrice =
      sourcePricePerJin != null && yieldRate > 0
        ? Number((sourcePricePerJin / (yieldRate / 100)).toFixed(2))
        : null;
    if (calculatedUnitPrice == null) {
      next.unitPrice = "来源食材缺少每斤单价，无法计算净料单价";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
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
        portion: form.portion,
      };

      const url = initialData?.id
        ? `/api/net-ingredients/${initialData.id}`
        : "/api/net-ingredients";
      const method = initialData?.id ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "保存失败";
        toast.error(message);
        return;
      }

      toast.success(
        initialData?.id
          ? "更新成功"
          : "已创建净料",
      );
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error("保存出错");
    } finally {
      setSubmitting(false);
    }
  };

  const dialogTitle = useMemo(() => {
    if (title) return title;
    if (isConvert) return "转化食材";
    if (initialData?.id) return "编辑净料";
    return "新增净料";
  }, [title, initialData, isConvert]);

  const existingCount = listPagination?.totalItems;
  const sourceSummary = (
    <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-h-8 flex-wrap items-center gap-2 text-xs">
        {selectedSource ? (
          <>
            <span className="font-mono font-medium tabular-nums text-muted-foreground">
              {selectedSource.code}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span className="font-medium text-foreground">
              {selectedSource.name}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span className="text-muted-foreground">
              {sourceL1?.name}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <CategoryTag
              l2Code={sourceL2?.code}
              name={sourceL2?.name || "—"}
            />
          </>
        ) : (
          <span className="text-muted-foreground">未选择来源食材</span>
        )}
        {!isConvert && (
          <SkeuButton
            type="button"
            variant={selectedSource ? "outline" : "primary"}
            size="sm"
            className={
              selectedSource
                ? "h-8 px-3 text-xs"
                : "h-9 px-4 text-sm shadow-sm"
            }
            onClick={() => setSourceSelectorOpen(true)}
          >
            {selectedSource ? "更换来源" : "选择来源食材"}
          </SkeuButton>
        )}
      </div>

      <SkeuButton
        type="button"
        variant="outline"
        size="sm"
        className="h-8 rounded-full px-3 text-xs"
        disabled={!form.l2Code}
        onClick={() => setListOpen(true)}
      >
        <PackageOpen className="mr-1.5 h-3.5 w-3.5" />
        查看已有净料
        {existingCount != null ? `（${existingCount}）` : ""}
      </SkeuButton>
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
          <NetIngredientFormFields
            layout="net-dialog"
            form={form}
            onChange={handleChange}
            categories={categories}
            rawIngredients={rawIngredients}
            errors={errors}
            autoSelectFirst={!isConvert}
          />
        </div>

        <DialogFooter className="border-t px-6 pt-4 pb-5">
          <SkeuButton
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            取消
          </SkeuButton>
          <SkeuButton
            onClick={() => {
              void handleSubmit();
            }}
            disabled={submitting}
          >
            <span aria-live="polite" className="inline-flex items-center">
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {initialData?.id
                ? "保存"
                : "创建净料"}
            </span>
          </SkeuButton>
        </DialogFooter>
      </AppDialogContent>

      <RecordSheet
        open={listOpen}
        onOpenChange={setListOpen}
        title="该食材分类下已录入系统的净料"
        meta={
          <span>
            {selectedL1?.name || ""}
            {selectedL1?.name && selectedL2?.name ? " · " : ""}
            {selectedL2?.name || ""}
          </span>
        }
        footer={
          <SkeuButton onClick={() => setListOpen(false)}>
            关闭
          </SkeuButton>
        }
        bodyClassName="overflow-hidden"
      >
        <DataTable<NetIngredientItem>
          data={rightList}
          loading={loadingList}
          fillHeight
          density="compact"
          tableClassName="min-w-max"
          columns={[
            {
              header: "序号",
              className: "w-12 whitespace-nowrap",
              cell: (_, rowIndex) => (
                <span className="text-muted-foreground">
                  {(listPage - 1) * RIGHT_LIST_PAGE_SIZE +
                    rowIndex +
                    1}
                </span>
              ),
            },
            {
              header: "名称",
              className: "whitespace-nowrap",
              cell: (row) => (
                <span className="font-semibold text-primary">
                  {row.name}
                </span>
              ),
            },
            {
              header: "包装规格",
              className: "whitespace-nowrap tabular-nums",
              cell: (row) =>
                row.packageSpec != null ? (
                  formatPackageSpec(row.packageSpec)
                ) : (
                  <EmptyValue />
                ),
            },
            {
              header: "出成率",
              className: "whitespace-nowrap tabular-nums",
              cell: (row) =>
                row.yieldRate != null ? (
                  formatPercent(row.yieldRate)
                ) : (
                  <EmptyValue />
                ),
            },
            {
              header: "毛利率",
              className: "whitespace-nowrap tabular-nums",
              cell: (row) =>
                row.grossMarginRate != null ? (
                  formatPercent(row.grossMarginRate)
                ) : (
                  <EmptyValue />
                ),
            },
            {
              header: "标准规格价",
              className: "whitespace-nowrap tabular-nums",
              cell: (row) =>
                row.standardPackagePrice != null ? (
                  <span className="font-semibold text-primary">
                    {formatPrice(row.standardPackagePrice, "/份")}
                  </span>
                ) : (
                  <EmptyValue />
                ),
            },
          ]}
          pagination={
            listPagination && listPagination.totalItems > 0
              ? {
                  currentPage: listPage,
                  fullControls: false,
                  totalPages: listPagination.totalPages,
                  totalItems: listPagination.totalItems,
                  pageSize: RIGHT_LIST_PAGE_SIZE,
                  onPageChange: setListPage,
                }
              : undefined
          }
          emptyState={
            listFailed
              ? {
                  icon: PackageOpen,
                  title: "列表加载失败",
                  description: "请检查网络后重试",
                  action: {
                    label: "重试",
                    onClick: () =>
                      setListRefreshKey((value) => value + 1),
                  },
                }
              : {
                  icon: PackageOpen,
                  title: "该分类下暂无净料",
                  description: "保存后会自动进入当前分类",
                }
          }
        />
      </RecordSheet>

      <IngredientSelectorDialog
        open={sourceSelectorOpen}
        onOpenChange={setSourceSelectorOpen}
        categories={categories}
        ingredients={rawIngredients}
        initialIngredientId={form.sourceIngredientId}
        onConfirm={handleSourceConfirm}
      />
    </FormDialog>
  );
}