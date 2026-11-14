"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/ui/page-header";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { IngredientFormDialog } from "@/app/components/ingredients/ingredient-form-dialog";
import { NetIngredientFormDialog } from "@/app/components/ingredients/net-ingredient-form-dialog";
import { ImportDialog, ImportField } from "@/app/components/ui/import-dialog";
import { IngredientDetailSheet } from "@/app/components/ingredients/ingredient-detail-sheet";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { DataTable } from "@/app/components/ui/data-table";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
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
  { key: "alias", label: "商品名称", sample: "五花肉" },
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
  const [detailStartInEditMode, setDetailStartInEditMode] = useState(false);

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
    setDetailStartInEditMode(true);
    setDetailOpen(true);
  };

  const openView = (row: Ingredient) => {
    setDetailId(row.id);
    setDetailStartInEditMode(false);
    setDetailOpen(true);
  };

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
    <div className="flex h-dvh min-h-0 flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <PageHeader
          showBack
          title="原料清单"
          description="食材采购入库、库存管理的基本单位"
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            批量导入
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增原料
          </Button>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0 pb-3">
          <ListToolbar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="搜索编号、名称或商品名称..."
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
        <CardContent className="flex min-h-0 flex-1 flex-col p-4">
          <DataTable<Ingredient>
            data={data}
            loading={loading}
            onRowClick={openView}
            fillHeight
            density="dense"
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
                cell: (row) => <span className="font-medium">{row.code}</span>,
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
                header: "商品名称",
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
                      {formatMoney(row.latestRefPrice, row.purchaseUnit)}
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
                <Button
                  variant="default"
                  size="icon"
                  aria-label={`转净料 ${row.name}`}
                  title="转净料"
                  onClick={(event) => {
                    event.stopPropagation();
                    setConvertSourceId(row.id);
                    setConvertDialogOpen(true);
                  }}
                >
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`编辑原料 ${row.name}`}
                  title="编辑原料"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(row);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`删除原料 ${row.name}`}
                  title="删除原料"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteId(row.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
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
        startInEditMode={detailStartInEditMode}
        categoryName={
          detailId
            ? l2Map[data.find((row) => row.id === detailId)?.l2Code || ""]?.name
            : undefined
        }
        onUpdated={fetchData}
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
        onSuccess={() => {
          setDialogOpen(false);
          fetchData();
        }}
      />

      <NetIngredientFormDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        mode="convert"
        sourceIngredientId={convertSourceId ?? undefined}
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
        <DialogContent className="sm:max-w-[400px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除这条原料吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
              className="h-11 px-6"
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
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
    </div>
  );
}
