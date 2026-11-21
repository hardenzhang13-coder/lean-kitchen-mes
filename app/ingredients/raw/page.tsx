"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Upload,
  ArrowRightLeft,
  Copy,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import {
  SkeuActionButton,
  SkeuIconAction,
} from "@/app/components/ui/skeu-row-action";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { IngredientFormDialog } from "@/app/components/ingredients/ingredient-form-dialog";
import { NetIngredientFormDialog } from "@/app/components/ingredients/net-ingredient-form-dialog";
import { ImportDialog, ImportField } from "@/app/components/ui/import-dialog";
import { IngredientDetailSheet } from "@/app/components/ingredients/ingredient-detail-sheet";
import type { RawDetail } from "@/app/components/ingredients/ingredient-detail-sheet";
import type { IngredientFormInitialData } from "@/app/components/ingredients/use-ingredient-form";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { DataTable } from "@/app/components/ui/data-table";
import { CodeText } from "@/app/components/ui/code-text";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import {
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
import { useRecordCopy } from "@/lib/client/use-record-copy";
import { toast } from "sonner";
import { formatMoney } from "@/lib/shared/display-format";

type Ingredient = {
  id: number;
  code: string;
  name: string;
  alias: string | null;
  l2Code: string;
  purchaseSpec: string | null;
  purchaseUnit: string | null;
  latestRefPrice: number | null;
  pricePerJin: number | null;
  stockUnit: string | null;
  unitsPerPurchase: number | null;
  defaultSupplierId: number | null;
};

type CategoryL1 = {
  id: number;
  code: string;
  name: string;
  children: { id: number; code: string; name: string; parentCode: string }[];
};

type Unit = {
  id: number;
  name: string;
  category: string;
  gramsPerUnit?: number | string | null;
  isActive?: boolean;
};

const importFields: ImportField[] = [
  { key: "name", label: "食材名称", required: true, sample: "带皮五花肉" },
  { key: "alias", label: "品牌名称", sample: "五花肉" },
  { key: "l2Code", label: "二级分类编码", required: true, sample: "MEA-POR" },
  { key: "purchaseSpec", label: "采购规格", sample: "散称" },
  { key: "purchaseUnit", label: "采购单位", required: true, sample: "斤" },
  { key: "stockUnit", label: "入库单位", required: true, sample: "斤" },
  { key: "unitsPerPurchase", label: "入库数量", sample: "10" },
  { key: "latestRefPrice", label: "最新参照单价", sample: "18.50" },
];

function EmptyValue({ title }: { title?: string }) {
  return (
    <span className="text-muted-foreground" title={title}>
      —
    </span>
  );
}

export default function RawIngredientsPage() {
  const [data, setData] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [l1Filter, setL1Filter] = useState("");
  const [l2Filter, setL2Filter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [convertSourceId, setConvertSourceId] = useState<number | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchMeta = async () => {
    try {
      const [catRes, unitRes] = await Promise.all([
        fetch("/api/ingredient-categories?page=1&pageSize=100"),
        fetch("/api/units?page=1&pageSize=100"),
      ]);
      const cJson = await catRes.json();
      setCategories(Array.isArray(cJson) ? cJson : cJson.data || []);
      const unitData = await unitRes.json();
      if (unitRes.ok) setUnits(Array.isArray(unitData) ? unitData : unitData.data || []);
    } catch {
      toast.error("获取筛选数据失败");
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        kind: "raw",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("q", search.trim());
      if (l1Filter) params.set("l1Code", l1Filter);
      if (l2Filter) params.set("l2Code", l2Filter);
      const ingRes = await fetch(`/api/ingredients?${params.toString()}`);
      const ingData = await ingRes.json();
      setData(ingData.data || []);
      setPagination(ingData.pagination || null);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [l1Filter, l2Filter, page, pageSize, search]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchMeta();
  }, []);
  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const l2Map = useMemo(() => {
    const map: Record<
      string,
      { name: string; parentCode: string }
    > = {};
    categories.forEach((l1) => {
      l1.children.forEach((l2) => {
        map[l2.code] = { name: l2.name, parentCode: l1.code };
      });
    });
    return map;
  }, [categories]);

  const l1Map = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((l1) => {
      map[l1.code] = l1.name;
    });
    return map;
  }, [categories]);

  const l2FilterOptions = useMemo(() => {
    if (!l1Filter) return [];
    const l1 = categories.find((c) => c.code === l1Filter);
    return (l1?.children || []).map((c) => ({ value: c.code, label: c.name }));
  }, [l1Filter, categories]);

  const openCreate = () => {
    setDialogOpen(true);
  };

  const openEdit = (row: Ingredient) => {
    setDetailId(row.id);
    setDetailOpen(true);
  };

  // 复制：以现有档案为模板新建一条，名称默认加「-副本」避免重名校验拦截
  const { openCopy, copyDialogProps } = useRecordCopy<
    Ingredient | RawDetail,
    IngredientFormInitialData
  >({
    buildInitialData: (row) => ({
      alias: row.alias,
      l2Code: row.l2Code,
      purchaseSpec: row.purchaseSpec,
      purchaseUnit: row.purchaseUnit,
      stockUnit: row.stockUnit,
      unitsPerPurchase: row.unitsPerPurchase ?? 1,
      latestRefPrice: row.latestRefPrice,
      pricePerJin: row.pricePerJin,
      defaultSupplierId: row.defaultSupplierId,
    }),
    title: "复制原料",
    onCopySuccess: () => {
      setDetailOpen(false);
      fetchData();
    },
  });

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/ingredients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "删除失败");
      }
      toast.success("删除成功");
      setDeleteId(null);
      fetchData();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "删除失败";
      toast.error(message);
    }
  };

  const handleValidateImport = (
    rows: Record<string, string>[]
  ) => {
    const l2Set = new Set(Object.keys(l2Map));
    return rows.map((row, index) => {
      const errors: string[] = [];
      if (!row.name.trim()) errors.push("名称不能为空");
      if (!row.l2Code.trim()) errors.push("二级分类编码不能为空");
      else if (!l2Set.has(row.l2Code.trim()))
        errors.push("二级分类编码不存在");
      if (!row.purchaseUnit.trim()) errors.push("采购单位不能为空");
      if (!row.stockUnit.trim()) errors.push("入库单位不能为空");
      return { index, data: row, errors };
    });
  };

  const handleImport = async (rows: Record<string, string>[]) => {
    const res = await fetch("/api/ingredients/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((r) => ({
          name: r.name.trim(),
          alias: r.alias?.trim() || undefined,
          l2Code: r.l2Code.trim(),
          purchaseSpec: r.purchaseSpec?.trim() || undefined,
          purchaseUnit: r.purchaseUnit.trim(),
          stockUnit: r.stockUnit.trim(),
          unitsPerPurchase: r.unitsPerPurchase?.trim()
            ? Number(r.unitsPerPurchase.trim())
            : undefined,
          latestRefPrice: r.latestRefPrice?.trim()
            ? Number(r.latestRefPrice.trim())
            : undefined,
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "导入失败");
      throw new Error(err.error);
    }
    fetchData();
  };

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          showBack
          title="原料清单"
          description="食材采购入库、库存管理的基本单位"
          actions={
            <div className="flex items-center gap-2">
              <SkeuButton
                variant="outline"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="h-4 w-4" />
                批量导入
              </SkeuButton>
              <SkeuButton onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新增原料
              </SkeuButton>
            </div>
          }
        />
      }
    >
      <Card className="skeu-panel flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0 ring-0">
        <CardHeader className="skeu-panel-toolbar shrink-0 px-5 py-4">
          <ListToolbar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="搜索名称..."
            onReset={() => {
              setSearch("");
              setL1Filter("");
              setL2Filter("");
              setPage(1);
            }}
            hasFilters={!!(l1Filter || l2Filter)}
          >
            <div className="grid grid-cols-2 gap-3 w-[320px]">
              <SelectTileMode
                options={categories
                  // 原料清单的分类边界：排除 SEA（调料）与 MIN（小料转化品分类）
                  .filter((c) => c.code !== "MIN" && c.code !== "SEA")
                  .map((c) => ({
                    value: c.code,
                    label: c.name,
                  }))}
                value={l1Filter}
                onChange={(v) => {
                  setL1Filter(v);
                  setL2Filter("");
                  setPage(1);
                }}
                placeholder="全部一级分类"
                title="选择一级分类"
                searchable={false}
              />
              <SelectTileMode
                options={l2FilterOptions}
                value={l2Filter}
                onChange={(v) => {
                  setL2Filter(v);
                  setPage(1);
                }}
                placeholder="全部二级分类"
                title="选择二级分类"
                disabled={!l1Filter}
                searchable={false}
              />
            </div>
          </ListToolbar>
        </CardHeader>
        <CardContent className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
          <DataTable<Ingredient>
            data={data}
            loading={loading}
            fillHeight
            variant="skeu"
            actionsWidth="w-[220px]"
            tableClassName="min-w-max"
            columns={[
              {
                header: "序号",
                className: "w-[48px]",
                cell: (_, rowIdx) => (
                  <span className="text-muted-foreground">
                    {(page - 1) * pageSize + rowIdx + 1}
                  </span>
                ),
              },
              {
                header: "编号",
                className: "w-[85px]",
                cell: (row) => <CodeText>{row.code}</CodeText>,
              },
              {
                header: "食材名称",
                className: "w-[160px]",
                cell: (row) => (
                  <span className="font-semibold text-primary">
                    {row.name}
                  </span>
                ),
              },
              {
                header: "品牌名称",
                className: "w-[100px]",
                cell: (row) =>
                  row.alias ? row.alias : <EmptyValue />,
              },
              {
                header: "一级分类",
                className: "w-[90px]",
                cell: (row) => {
                  const l2Info = l2Map[row.l2Code];
                  return l2Info ? (
                    l1Map[l2Info.parentCode] || <EmptyValue />
                  ) : (
                    <EmptyValue />
                  );
                },
              },
              {
                header: "二级分类",
                className: "w-[90px]",
                cell: (row) => {
                  const l2Info = l2Map[row.l2Code];
                  const l2Name = l2Info?.name || row.l2Code;
                  return <CategoryTag l2Code={row.l2Code} name={l2Name} />;
                },
              },
              {
                header: "采购规格",
                className: "w-[120px]",
                cell: (row) =>
                  row.purchaseSpec ? row.purchaseSpec : <EmptyValue />,
              },
              {
                header: "采购单位",
                className: "w-[80px]",
                cell: (row) =>
                  row.purchaseUnit ? row.purchaseUnit : <EmptyValue />,
              },
              {
                header: "最新参照单价",
                className: "w-[100px]",
                cell: (row) => (
                  row.latestRefPrice != null ? (
                    <span className="tabular-nums">
                      {formatMoney(row.latestRefPrice)}
                    </span>
                  ) : (
                    <EmptyValue />
                  )
                ),
              },
              {
                header: "每斤单价",
                className: "w-[100px]",
                cell: (row) =>
                  row.pricePerJin != null ? (
                    <span className="font-semibold tabular-nums text-primary">
                      ¥{Number(row.pricePerJin).toFixed(2)}/斤
                    </span>
                  ) : (
                    <EmptyValue title="未填写，可在编辑中按规格换算或手动填写" />
                  ),
              },
              {
                header: "入库单位",
                className: "w-[80px]",
                cell: (row) =>
                  row.stockUnit ? row.stockUnit : <EmptyValue />,
              },
            ]}
            pagination={
              pagination && pagination.totalItems > 0
                ? {
                    currentPage: page,
                    totalPages: pagination.totalPages,
                    totalItems: pagination.totalItems,
                    pageSize,
                    onPageChange: setPage,
                    totalLabel: formatPageSummary(
                      page,
                      pageSize,
                      pagination.totalItems,
                      "原料"
                    ),
                    showPageSize: true,
                    onPageSizeChange: (size) => {
                      setPageSize(size);
                      setPage(1);
                    },
                  }
                : undefined
            }
            emptyState={{ title: "暂无数据" }}
            rowActions={(row) => (
              <>
                <SkeuIconAction
                  label={`复制原料 ${row.name}`}
                  tip="复制原料"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    openCopy(row);
                  }}
                />
                <SkeuIconAction
                  label={`删除原料 ${row.name}`}
                  tip="删除原料"
                  icon={<Trash2 className="h-4 w-4 text-destructive" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteId(row.id);
                  }}
                />
                <SkeuIconAction
                  label={`编辑原料 ${row.name}`}
                  tip="编辑原料"
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(row);
                  }}
                />
                <SkeuActionButton
                  label="转净料"
                  tone="primary"
                  icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    setConvertSourceId(row.id);
                    setConvertDialogOpen(true);
                  }}
                />
              </>
            )}
          />
        </CardContent>
      </Card>

      <IngredientDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        kind="raw"
        ingredientId={detailId}
        categories={categories}
        units={units}
        inlineEdit
        startInEditMode
        categoryName={
          detailId
            ? l2Map[data.find((row) => row.id === detailId)?.l2Code || ""]?.name
            : undefined
        }
        onUpdated={fetchData}
        onCopy={(record) => {
          openCopy(record as RawDetail);
        }}
        onConvert={(id) => {
          setDetailOpen(false);
          setConvertSourceId(id);
          setConvertDialogOpen(true);
        }}
        onDelete={(id) => {
          setDetailOpen(false);
          setDeleteId(id);
        }}
      />

      <IngredientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        units={units}
        mode="ingredient"
        allowContinue
        onSuccess={() => {
          fetchData();
        }}
      />

      <IngredientFormDialog
        {...copyDialogProps}
        categories={categories}
        units={units}
        mode="ingredient"
      />

      <NetIngredientFormDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        mode="convert"
        sourceIngredientId={convertSourceId ?? undefined}
        sourceIngredientName={
          data.find((d) => d.id === convertSourceId)?.name ?? null
        }
        categories={categories}
        rawIngredients={data.map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          alias: d.alias,
          l2Code: d.l2Code,
          purchaseSpec: d.purchaseSpec,
          purchaseUnit: d.purchaseUnit,
          latestRefPrice: d.latestRefPrice,
          // 转净料单价自动换算的数据源，缺失会导致弹窗无法自动计算
          pricePerJin: d.pricePerJin,
        }))}
        onSuccess={() => {
          setConvertDialogOpen(false);
          setConvertSourceId(null);
          fetchData();
        }}
      />

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除这条原料吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <SkeuButton
              variant="outline"
              onClick={() => setDeleteId(null)}
            >
              取消
            </SkeuButton>
            <SkeuButton
              variant="danger"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              删除
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="批量导入原料"
        fields={importFields}
        templateFilename="原料导入模板.csv"
        onValidate={handleValidateImport}
        onImport={handleImport}
      />
    </PageShell>
  );
}
