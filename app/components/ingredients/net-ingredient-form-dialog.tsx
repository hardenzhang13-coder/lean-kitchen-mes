"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  Maximize2,
  PackageOpen,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { DataTable } from "@/app/components/ui/data-table";
import { FormDialog } from "@/app/components/ui/form-dialog";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { EmptyState } from "@/app/components/ui/empty-state";
import { LoadingState } from "@/app/components/ui/loading-state";
import { RecordSheet } from "@/app/components/ui/record-sheet";
import { TablePreviewDialog } from "@/app/components/ui/table-preview-dialog";
import {
  IngredientSelectorDialog,
} from "@/app/components/ingredients/ingredient-selector-dialog";
import {
  NetIngredientFormFields,
  NetIngredientFormData,
  CategoryL1,
  RawIngredientOption,
} from "@/app/components/ingredients/net-ingredient-form-fields";
import { parseList } from "@/lib/client/api";
import { toast } from "sonner";

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
  unit: string;
  sourceIngredientId: number | null;
  l2Code: string;
};

interface NetIngredientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "net" | "minor" | "convert";
  sourceIngredientId?: number;
  initialData?: NetIngredientItem;
  categories: CategoryL1[];
  rawIngredients: RawIngredientOption[];
  onSuccess?: () => void;
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
  initialData,
  categories,
  rawIngredients,
  onSuccess,
}: NetIngredientFormDialogProps) {
  const [form, setForm] = useState<NetIngredientFormData>(emptyForm);
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sourceSelectorOpen, setSourceSelectorOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const listRequestSeq = useRef(0);

  const isMinor = mode === "minor";
  const isConvert = mode === "convert";
  const usesNetLayout = !isMinor;

  const findParentL1 = useCallback(
    (l2Code?: string) => {
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
        l1Code: isMinor ? "MIN" : parentL1?.code || "",
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
      });
      return;
    }

    if (isConvert && propSourceId) {
      const raw = getRawIngredient(propSourceId);
      const parentL1 = raw ? findParentL1(raw.l2Code) : undefined;
      setForm({
        ...emptyForm,
        l1Code: parentL1?.code || "",
        l2Code: raw?.l2Code || "",
        sourceIngredientId: String(propSourceId),
      });
      return;
    }

    if (isMinor) {
      const minorL1 = categories.find((category) => category.code === "MIN");
      const firstL2 = minorL1?.children[0];
      setForm({
        ...emptyForm,
        l1Code: "MIN",
        l2Code: firstL2?.code || "",
      });
      return;
    }

    // 新增净料先从来源原料开始，不再预选一个无来源的分类。
    setForm({ ...emptyForm });
  }, [
    open,
    initialData,
    isConvert,
    isMinor,
    propSourceId,
    findParentL1,
    getRawIngredient,
    categories,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;

    const seq = ++listRequestSeq.current;
    const sourceId = Number(form.sourceIngredientId);
    const l2Code = form.l2Code;
    if ((isMinor && !sourceId) || (!isMinor && !l2Code)) {
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
        const url = isMinor
          ? `/api/net-ingredients?sourceIngredientId=${sourceId}`
          : `/api/net-ingredients?l2Code=${encodeURIComponent(l2Code)}&page=${listPage}&pageSize=${RIGHT_LIST_PAGE_SIZE}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("加载右侧列表失败");

        if (isMinor) {
          const list = await parseList<NetIngredientItem>(response);
          if (listRequestSeq.current === seq) {
            setRightList(list);
            setListPagination(null);
          }
        } else {
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
    isMinor,
    form.sourceIngredientId,
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
      if (field === "l1Code" && !isMinor) next.l2Code = "";
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
    setForm((previous) => ({
      ...previous,
      l1Code: value.l1Code,
      l2Code: value.l2Code,
      sourceIngredientId: value.ingredientId,
    }));
    setListPage(1);
    setSourceSelectorOpen(false);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "净料名称不能为空";
    if (!form.l2Code) next.l2Code = "请选择来源原料";
    if (!form.sourceIngredientId) {
      next.sourceIngredientId = "请选择来源原料";
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
      if (isMinor) {
        next.packageMaterial = "请选择包装";
      } else {
        if (!form.packageMaterial.trim()) {
          next.packageMaterial = "请选择包装名称";
        }
        if (!form.packageSize.trim()) {
          next.packageSize = "请选择包装尺寸";
        }
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

    const sourcePricePerJin =
      selectedSource?.pricePerJin != null
        ? Number(selectedSource.pricePerJin)
        : null;
    const calculatedUnitPrice =
      sourcePricePerJin != null && yieldRate > 0
        ? Number((sourcePricePerJin / (yieldRate / 100)).toFixed(2))
        : null;
    if (calculatedUnitPrice == null) {
      next.unitPrice = "来源原料缺少每斤单价，无法计算净料单价";
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

      toast.success(initialData?.id ? "更新成功" : "创建成功");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error("保存出错");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditFromList = (row: NetIngredientItem) => {
    const parentL1 = findParentL1(row.l2Code);
    setForm({
      name: row.name || "",
      l1Code: isMinor ? "MIN" : parentL1?.code || "",
      l2Code: row.l2Code || "",
      sourceIngredientId: row.sourceIngredientId
        ? String(row.sourceIngredientId)
        : "",
      packageSpec:
        row.packageSpec != null ? String(row.packageSpec) : "",
      packageMaterial: row.packageMaterial || "",
      packageSize: row.packageSize || "",
      processingFeePerJin:
        row.processingFeePerJin != null
          ? String(row.processingFeePerJin)
          : "",
      yieldRate:
        row.yieldRate != null ? String(row.yieldRate) : "",
      unitPrice: String(row.unitPrice),
      grossMarginRate:
        row.grossMarginRate != null
          ? String(row.grossMarginRate)
          : "0",
    });
  };

  const dialogTitle = useMemo(() => {
    if (isMinor && initialData?.id) return "编辑小料";
    if (isMinor) return "新增小料";
    if (initialData?.id) return "编辑净料";
    if (isConvert) return "转净料";
    return "新增净料";
  }, [isMinor, initialData, isConvert]);

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
              {selectedL1?.name}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <CategoryTag
              l2Code={selectedL2?.code}
              name={selectedL2?.name || "—"}
            />
          </>
        ) : (
          <span className="text-muted-foreground">未选择来源原料</span>
        )}
        {!isConvert && (
          <Button
            type="button"
            variant={selectedSource ? "outline" : "default"}
            size="sm"
            className={
              selectedSource
                ? "h-8 px-3 text-xs"
                : "h-9 px-4 text-sm shadow-sm"
            }
            onClick={() => setSourceSelectorOpen(true)}
          >
            {selectedSource ? "更换来源" : "选择来源原料"}
          </Button>
        )}
      </div>

      <Button
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
      </Button>
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
          {usesNetLayout && sourceSummary}
          {usesNetLayout &&
            (errors.sourceIngredientId || errors.l2Code) && (
              <p className="text-xs text-destructive" role="alert">
                {errors.sourceIngredientId || errors.l2Code}
              </p>
            )}
        </DialogHeader>

        {usesNetLayout ? (
          <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
            <NetIngredientFormFields
              layout="net-dialog"
              form={form}
              onChange={handleChange}
              categories={categories}
              rawIngredients={rawIngredients}
              errors={errors}
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-4 lg:flex-row">
            <div className="min-w-0 flex-1 space-y-4">
              <NetIngredientFormFields
                form={form}
                onChange={handleChange}
                categories={categories}
                rawIngredients={rawIngredients}
                mode="minor"
                errors={errors}
              />
            </div>

            <div className="flex min-h-0 flex-col rounded-lg border bg-card lg:w-[680px]">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  已创建的小料规格
                </h4>
                <Button
                  variant="ghost"
                  size="icon"
                  title="完整预览"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                {loadingList ? (
                  <LoadingState type="table" rows={5} cols={10} />
                ) : rightList.length === 0 ? (
                  <EmptyState
                    icon={PackageOpen}
                    title="暂无小料"
                    description="该原料尚未创建规格"
                  />
                ) : (
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead>编号</TableHead>
                        <TableHead>名称</TableHead>
                        <TableHead>包装规格</TableHead>
                        <TableHead>包装物料</TableHead>
                        <TableHead>包装尺寸</TableHead>
                        <TableHead>出成率</TableHead>
                        <TableHead>净料单价</TableHead>
                        <TableHead>加工费</TableHead>
                        <TableHead>毛利率</TableHead>
                        <TableHead>出库价</TableHead>
                        <TableHead>标准规格价</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rightList.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="whitespace-nowrap text-sm font-medium">
                            {row.code}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {row.name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatPackageSpec(row.packageSpec)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {row.packageMaterial || ""}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {row.packageSize || ""}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatPercent(row.yieldRate)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatPrice(row.unitPrice, "/斤")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatPrice(
                              row.processingFeePerJin,
                              "/斤"
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatPercent(row.grossMarginRate)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatPrice(row.outPricePerJin, "/斤")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatPrice(
                              row.standardPackagePrice,
                              "元/份"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="编辑"
                              onClick={() => handleEditFromList(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="border-t px-6 pt-4 pb-5">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 px-6"
          >
            取消
          </Button>
          <Button
            onClick={() => {
              void handleSubmit();
            }}
            disabled={submitting}
            className="h-11 px-6"
          >
            <span aria-live="polite" className="inline-flex items-center">
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              保存
            </span>
          </Button>
        </DialogFooter>
      </AppDialogContent>

      {usesNetLayout && (
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
            <Button onClick={() => setListOpen(false)}>
              关闭
            </Button>
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
                    <span className="text-muted-foreground">—</span>
                  ),
              },
              {
                header: "出成率",
                className: "whitespace-nowrap tabular-nums",
                cell: (row) =>
                  row.yieldRate != null ? (
                    formatPercent(row.yieldRate)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  ),
              },
              {
                header: "毛利率",
                className: "whitespace-nowrap tabular-nums",
                cell: (row) =>
                  row.grossMarginRate != null ? (
                    formatPercent(row.grossMarginRate)
                  ) : (
                    <span className="text-muted-foreground">—</span>
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
                    <span className="text-muted-foreground">—</span>
                  ),
              },
            ]}
            pagination={
              listPagination && listPagination.totalItems > 0
                ? {
                    currentPage: listPage,
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
      )}

      {usesNetLayout && (
        <IngredientSelectorDialog
          open={sourceSelectorOpen}
          onOpenChange={setSourceSelectorOpen}
          categories={categories}
          ingredients={rawIngredients}
          initialIngredientId={form.sourceIngredientId}
          onConfirm={handleSourceConfirm}
        />
      )}

      <TablePreviewDialog<NetIngredientItem>
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="已创建的小料规格"
        description={
          rightList.length > 0 ? `共 ${rightList.length} 条` : undefined
        }
        emptyTitle="该原料尚未创建规格"
        columns={[
          { header: "编号", accessorKey: "code" },
          { header: "名称", accessorKey: "name" },
          {
            header: "包装规格",
            cell: (row) => formatPackageSpec(row.packageSpec),
          },
          {
            header: "包装物料",
            cell: (row) => row.packageMaterial || "",
          },
          {
            header: "包装尺寸",
            cell: (row) => row.packageSize || "",
          },
          {
            header: "出成率",
            cell: (row) => formatPercent(row.yieldRate),
          },
          {
            header: "净料单价",
            cell: (row) => formatPrice(row.unitPrice, "/斤"),
          },
          {
            header: "加工费",
            cell: (row) =>
              formatPrice(row.processingFeePerJin, "/斤"),
          },
          {
            header: "成本价",
            cell: (row) =>
              formatPrice(row.costPricePerJin, "/斤"),
          },
          {
            header: "毛利率",
            cell: (row) => formatPercent(row.grossMarginRate),
          },
          {
            header: "出库价",
            cell: (row) => formatPrice(row.outPricePerJin, "/斤"),
          },
          {
            header: "标准规格价",
            cell: (row) =>
              formatPrice(row.standardPackagePrice, "/份"),
          },
        ]}
        data={rightList}
      />
    </FormDialog>
  );
}
