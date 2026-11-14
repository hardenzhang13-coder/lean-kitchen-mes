"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/ui/page-header";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { DataTable } from "@/app/components/ui/data-table";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { CategoryTag } from "@/app/components/ui/category-tag";
import {
  NetIngredientFormDialog,
} from "@/app/components/ingredients/net-ingredient-form-dialog";
import { IngredientDetailSheet } from "@/app/components/ingredients/ingredient-detail-sheet";
import {
  NetLabelPrintDialog,
  NetLabelTarget,
} from "@/app/components/ingredients/net-label-print-dialog";
import { DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { toast } from "sonner";
import { formatMoney, formatPercent } from "@/lib/shared/display-format";

type NetIngredient = {
  id: number;
  code: string;
  name: string;
  sourceIngredientId: number | null;
  spec: string | null;
  packageSpec: number | null;
  packageMaterial: string | null;
  packageSize: string | null;
  processingFeePerJin: number | null;
  yieldRate: number | null;
  unitPrice: number | null;
  grossMarginRate: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
  unit: string;
  l2Code: string;
  sourceIngredient?: { id: number; name: string } | null;
};

type CategoryL1 = {
  code: string;
  name: string;
  children: { code: string; name: string }[];
};

type RawIngredientOption = {
  id: number;
  code: string;
  name: string;
  alias?: string | null;
  l2Code?: string;
  purchaseSpec?: string | null;
  purchaseUnit?: string | null;
  latestRefPrice?: number | null;
  pricePerJin?: number | null;
};

function EmptyValue() {
  return <span className="text-muted-foreground">—</span>;
}

export default function NetIngredientsPage() {
  const [data, setData] = useState<NetIngredient[]>([]);
  const [rawIngredients, setRawIngredients] = useState<RawIngredientOption[]>(
    []
  );
  const [categories, setCategories] = useState<CategoryL1[]>([]);
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

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStartInEditMode, setDetailStartInEditMode] = useState(false);
  const [labelTarget, setLabelTarget] = useState<NetLabelTarget | null>(null);

  const [deleteRow, setDeleteRow] = useState<NetIngredient | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchMeta = async () => {
    try {
      const [rawRes, catRes] = await Promise.all([
        fetch("/api/ingredients?kind=raw&page=1&pageSize=100"),
        fetch("/api/ingredient-categories?page=1&pageSize=100"),
      ]);
      const rawJson = await rawRes.json();
      setRawIngredients(rawJson.data || []);
      const catJson = await catRes.json();
      setCategories(Array.isArray(catJson) ? catJson : catJson.data || []);
    } catch {
      toast.error("获取筛选数据失败");
    }
  };

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        excludeMinor: "true",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("q", search.trim());
      if (l1Filter) params.set("l1Code", l1Filter);
      if (l2Filter) params.set("l2Code", l2Filter);
      const netRes = await fetch(`/api/net-ingredients?${params.toString()}`);
      const netJson = await netRes.json();
      setData(netJson.data || []);
      setPagination(netJson.pagination || null);
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
    const timer = setTimeout(fetchIngredients, 300);
    return () => clearTimeout(timer);
  }, [fetchIngredients]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const l2Map = useMemo(() => {
    const map: Record<string, { name: string; parentCode: string }> = {};
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
    const l1 = categories.find((category) => category.code === l1Filter);
    return (l1?.children || []).map((category) => ({
      value: category.code,
      label: category.name,
    }));
  }, [categories, l1Filter]);

  const openCreate = () => {
    setCreateDialogOpen(true);
  };

  const openEdit = (row: NetIngredient) => {
    setDetailId(row.id);
    setDetailStartInEditMode(true);
    setDetailOpen(true);
  };

  const openView = (row: NetIngredient) => {
    setDetailId(row.id);
    setDetailStartInEditMode(false);
    setDetailOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/net-ingredients/${deleteRow.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "删除失败");
      }
      toast.success("删除成功");
      setDeleteRow(null);
      fetchIngredients();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "删除失败";
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex h-dvh min-h-0 flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <PageHeader
          showBack
          title="净料清单"
          description="原料经初加工后的规格化半成品"
        />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增净料
        </Button>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0 pb-3">
          <ListToolbar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="搜索编号或名称..."
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
                  // 净料清单不混入小料转化分类与调料分类
                  .filter((c) => c.code !== "MIN" && c.code !== "SEA")
                  .map((c) => ({ value: c.code, label: c.name }))}
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
                searchable={false}
                disabled={!l1Filter}
              />
            </div>
          </ListToolbar>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-4">
          <DataTable<NetIngredient>
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
                cell: (row) => (
                  <span className="font-medium">{row.code}</span>
                ),
              },
              {
                header: "名称",
                className: "w-[180px]",
                cell: (row) => (
                  <span className="font-semibold text-primary">
                    {row.name}
                  </span>
                ),
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
                  return (
                    <CategoryTag
                      l2Code={row.l2Code}
                      name={l2Info?.name || row.l2Code}
                    />
                  );
                },
              },
              {
                header: "来源原料",
                className: "w-[130px]",
                cell: (row) =>
                  row.sourceIngredient?.name || <EmptyValue />,
              },
              {
                header: "包装规格",
                className: "w-[90px]",
                cell: (row) =>
                  row.packageSpec != null ? (
                    <span className="tabular-nums">{row.packageSpec}g</span>
                  ) : (
                    <EmptyValue />
                  ),
              },
              {
                header: "出成率",
                className: "w-[80px]",
                cell: (row) =>
                  row.yieldRate != null ? (
                    <span className="tabular-nums">{row.yieldRate}%</span>
                  ) : (
                    <EmptyValue />
                  ),
              },
              {
                header: "净料单价",
                className: "w-[125px]",
                cell: (row) => (
                  <span className="tabular-nums">
                    {formatMoney(row.unitPrice, "斤")}
                  </span>
                ),
              },
              {
                header: "毛利率",
                className: "w-[80px]",
                cell: (row) =>
                  <span className="tabular-nums">
                    {formatPercent(row.grossMarginRate)}
                  </span>
              },
              {
                header: "标准规格价",
                className: "w-[115px]",
                cell: (row) =>
                  row.standardPackagePrice != null ? (
                    <span className="font-semibold tabular-nums text-primary">
                      {formatMoney(row.standardPackagePrice, "份")}
                    </span>
                  ) : (
                    <EmptyValue />
                  ),
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
                  variant="ghost"
                  size="icon"
                  aria-label={`打印净料标签 ${row.name}`}
                  title={
                    row.packageSpec != null && row.packageSpec > 0
                      ? "打印标签"
                      : "缺少包装规格，无法打印标签"
                  }
                  disabled={row.packageSpec == null || row.packageSpec <= 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    setLabelTarget({
                      id: row.id,
                      name: row.name,
                      packageSpec: row.packageSpec,
                    });
                  }}
                >
                  <Printer className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`编辑净料 ${row.name}`}
                  title="编辑净料"
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
                  aria-label={`删除净料 ${row.name}`}
                  title="删除净料"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteRow(row);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          />
        </CardContent>
      </Card>

      <NetIngredientFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="net"
        categories={categories}
        rawIngredients={rawIngredients}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchIngredients();
        }}
      />

      <IngredientDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        kind="net"
        ingredientId={detailId}
        categories={categories}
        rawIngredients={rawIngredients}
        inlineEdit
        startInEditMode={detailStartInEditMode}
        onUpdated={fetchIngredients}
        onPrintLabel={(id) => {
          const row = data.find((item) => item.id === id);
          if (!row) return;
          setDetailOpen(false);
          setLabelTarget({
            id: row.id,
            name: row.name,
            packageSpec: row.packageSpec,
          });
        }}
        categoryName={
          detailId
            ? l2Map[data.find((row) => row.id === detailId)?.l2Code || ""]?.name
            : undefined
        }
        onDelete={(id) => {
          const row = data.find((item) => item.id === id);
          if (!row) return;
          setDetailOpen(false);
          setDeleteRow(row);
        }}
      />

      <NetLabelPrintDialog
        target={labelTarget}
        onOpenChange={(open) => {
          if (!open) setLabelTarget(null);
        }}
      />

      <Dialog
        open={deleteRow !== null}
        onOpenChange={() => setDeleteRow(null)}
      >
        <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除净料“{deleteRow?.name}”吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRow(null)}
              disabled={deleteLoading}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="h-11 px-6"
            >
              删除
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </div>
  );
}
