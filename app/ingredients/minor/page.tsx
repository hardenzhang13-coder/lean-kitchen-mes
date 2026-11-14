"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
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
import { SkeletonTable } from "@/app/components/ui/skeleton-table";
import { DataTable } from "@/app/components/ui/data-table";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { CategoryTag } from "@/app/components/ui/category-tag";
import {
  NetIngredientFormDialog,
} from "@/app/components/ingredients/net-ingredient-form-dialog";
import {
  NetIngredientEditDialog,
  NetIngredientEditItem,
} from "@/app/components/ingredients/net-ingredient-edit-dialog";
import { IngredientDetailSheet } from "@/app/components/ingredients/ingredient-detail-sheet";
import { DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { toast } from "sonner";
import { formatMoney, formatPercent } from "@/lib/shared/display-format";

type NetIngredient = {
  id: number;
  code: string;
  name: string;
  sourceIngredientId: number | null;
  packageSpec: number | null;
  packageMaterial: string | null;
  packageSize: string | null;
  processingFeePerJin: number | null;
  yieldRate: number | null;
  unitPrice: number | null;
  grossMarginRate: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
  unit: string | null;
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

export default function MinorIngredientsPage() {
  const [data, setData] = useState<NetIngredient[]>([]);
  const [rawIngredients, setRawIngredients] = useState<RawIngredientOption[]>([]);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [l2Filter, setL2Filter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NetIngredientEditItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [deleteRow, setDeleteRow] = useState<NetIngredient | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchMeta = async () => {
    try {
      const [catRes, rawRes] = await Promise.all([
        fetch("/api/ingredient-categories?page=1&pageSize=100"),
        fetch("/api/ingredients?kind=raw&page=1&pageSize=100"),
      ]);
      const catJson = await catRes.json();
      setCategories(Array.isArray(catJson) ? catJson : catJson.data || []);
      const rawJson = await rawRes.json();
      setRawIngredients(rawJson.data || []);
    } catch {
      toast.error("获取筛选数据失败");
    }
  };

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        l1Code: "MIN",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("q", search.trim());
      if (l2Filter) params.set("l2Code", l2Filter);
      const res = await fetch(`/api/net-ingredients?${params.toString()}`);
      const json = await res.json();
      setData(json.data || []);
      setPagination(json.pagination || null);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [l2Filter, page, pageSize, search]);

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

  const openCreate = () => {
    setCreateDialogOpen(true);
  };

  const buildEditItem = (row: NetIngredient): NetIngredientEditItem => ({
    id: row.id,
    name: row.name,
    packageSpec: row.packageSpec ?? null,
    packageMaterial: row.packageMaterial ?? null,
    packageSize: row.packageSize ?? null,
    processingFeePerJin: row.processingFeePerJin ?? null,
    yieldRate: row.yieldRate,
    unitPrice: row.unitPrice,
    grossMarginRate: row.grossMarginRate,
    sourceIngredientId: row.sourceIngredientId,
    l2Code: row.l2Code,
  });

  const openEdit = (row: NetIngredient) => {
    setEditing(buildEditItem(row));
    setEditDialogOpen(true);
  };

  const openView = (row: NetIngredient) => {
    setDetailId(row.id);
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
          title="小料清单"
          description="原料初加工转化的增香/去腥/提味食材，与净料同口径"
        />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增小料
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
            searchPlaceholder="搜索编号、名称..."
            onReset={() => {
              setSearch("");
              setL2Filter("");
              setPage(1);
            }}
            hasFilters={!!l2Filter}
          >
            <SelectTileMode
              options={
                (categories.find((c) => c.code === "MIN")?.children || []).map((c) => ({
                  value: c.code,
                  label: c.name,
                }))
              }
              value={l2Filter}
              onChange={(v) => {
                setL2Filter(v);
                setPage(1);
              }}
              placeholder="全部二级分类"
              title="选择二级分类"
              searchable={false}
              className="w-[180px]"
            />
          </ListToolbar>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-4">
          {loading ? (
            <SkeletonTable cols={14} rows={pageSize} />
          ) : (
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
                  header: "二级分类",
                  className: "w-[90px]",
                  cell: (row) => {
                    const l2Info = l2Map[row.l2Code];
                    return (
                      <CategoryTag l2Code={row.l2Code} name={l2Info?.name || row.l2Code} />
                    );
                  },
                },
                {
                  header: "编号",
                  className: "w-[85px]",
                  cell: (row) => <span className="font-medium">{row.code}</span>,
                },
                {
                  header: "名称",
                  className: "w-[170px]",
                  cell: (row) => (
                    <span className="font-medium">
                      {row.name}
                    </span>
                  ),
                },
                {
                  header: "包装规格",
                  className: "w-[80px]",
                  cell: (row) =>
                    row.packageSpec != null ? `${row.packageSpec}g` : "—",
                },
                {
                  header: "来源原料",
                  className: "w-[130px]",
                  cell: (row) =>
                    row.sourceIngredient?.name || row.sourceIngredientId || "—",
                },
                {
                  header: "出成率",
                  className: "w-[70px]",
                  cell: (row) =>
                    row.yieldRate != null ? `${row.yieldRate}%` : "—",
                },
                {
                  header: "净料单价",
                  className: "w-[120px]",
                  cell: (row) => (
                    <span className="tabular-nums">
                      {formatMoney(row.unitPrice, "斤")}
                    </span>
                  ),
                },
                {
                  header: "封装加工费",
                  className: "w-[110px]",
                  cell: (row) =>
                    row.processingFeePerJin != null
                      ? `¥${Number(row.processingFeePerJin).toFixed(2)}/斤`
                      : "—",
                },
                {
                  header: "毛利率",
                  className: "w-[70px]",
                  cell: (row) => (
                    <span className="tabular-nums">
                      {formatPercent(row.grossMarginRate)}
                    </span>
                  ),
                },
                {
                  header: "出库价",
                  className: "w-[120px]",
                  cell: (row) => (
                    <span className="tabular-nums">
                      {formatMoney(row.outPricePerJin, "斤")}
                    </span>
                  ),
                },
                {
                  header: "标准规格价",
                  className: "w-[110px]",
                  cell: (row) => (
                    <span className="font-semibold tabular-nums text-primary">
                      {formatMoney(row.standardPackagePrice, "份")}
                    </span>
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
                    aria-label={`编辑小料 ${row.name}`}
                    title="编辑小料"
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
                    aria-label={`删除小料 ${row.name}`}
                    title="删除小料"
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
          )}
        </CardContent>
      </Card>

      <NetIngredientFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="minor"
        categories={categories}
        rawIngredients={rawIngredients}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchIngredients();
        }}
      />

      <NetIngredientEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="minor"
        initialData={editing}
        categories={categories}
        rawIngredients={rawIngredients}
        onSuccess={fetchIngredients}
      />

      <IngredientDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        kind="minor"
        ingredientId={detailId}
        categoryName={
          detailId
            ? l2Map[data.find((row) => row.id === detailId)?.l2Code || ""]?.name
            : undefined
        }
        onEdit={(id) => {
          const row = data.find((item) => item.id === id);
          if (!row) return;
          setDetailOpen(false);
          openEdit(row);
        }}
        onDelete={(id) => {
          const row = data.find((item) => item.id === id);
          if (!row) return;
          setDetailOpen(false);
          setDeleteRow(row);
        }}
      />

      <Dialog
        open={deleteRow !== null}
        onOpenChange={() => setDeleteRow(null)}
      >
        <DialogContent className="sm:max-w-[400px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除小料“{deleteRow?.name}”吗？此操作不可撤销。
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
