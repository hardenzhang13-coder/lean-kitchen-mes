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
import { CategoryTag } from "@/app/components/ui/category-tag";
import { IngredientFormDialog } from "@/app/components/ingredients/ingredient-form-dialog";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
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
  stockUnit: string | null;
  unitsPerPurchase: number | null;
  latestRefPrice: number | null;
  pricePerJin: number | null;
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

// 新建调料默认分类：SEA（调味品）下第一个二级分类（分类接口默认只返回启用中的）
function findDefaultSeasoningL2Code(categories: CategoryL1[]) {
  const sea = categories.find((l1) => l1.code === "SEA");
  return sea?.children[0]?.code;
}

export default function SeasoningIngredientsPage() {
  const [data, setData] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [l2Filter, setL2Filter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [viewing, setViewing] = useState<Ingredient | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const seasoningL2Code = useMemo(
    () => findDefaultSeasoningL2Code(categories),
    [categories]
  );

  const fetchMeta = async () => {
    try {
      const [catRes, unitRes] = await Promise.all([
        fetch("/api/ingredient-categories?page=1&pageSize=100"),
        fetch("/api/units?page=1&pageSize=100"),
      ]);
      const cats = await catRes.json();
      const categoryList = Array.isArray(cats) ? cats : cats.data || [];
      setCategories(categoryList);
      const unitsData = await unitRes.json();
      if (unitRes.ok) setUnits(Array.isArray(unitsData) ? unitsData : unitsData.data || []);
    } catch {
      toast.error("获取筛选数据失败");
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        kind: "seasoning",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("q", search.trim());
      if (l2Filter) params.set("l2Code", l2Filter);
      const ingRes = await fetch(`/api/ingredients?${params.toString()}`);
      const json = await ingRes.json();
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
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: Ingredient) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const openView = (row: Ingredient) => {
    setViewing(row);
    setViewDialogOpen(true);
  };

  // 调料二级分类选项 = SEA（调味品）下的启用子分类
  const seasoningL2Options = useMemo(() => {
    const sea = categories.find((l1) => l1.code === "SEA");
    return (sea?.children || []).map((c) => ({ value: c.code, label: c.name }));
  }, [categories]);

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
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const l2Map = useMemo(() => {
    const map: Record<string, { name: string; parentCode: string }> = {};
    categories.forEach((l1) => {
      l1.children.forEach((l2) => {
        map[l2.code] = { name: l2.name, parentCode: l1.code };
      });
    });
    return map;
  }, [categories]);

  return (
    <div className="flex h-dvh min-h-0 flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <PageHeader
          showBack
          title="调料清单"
          description="标准化产品形态的基础调味品"
        />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增调料
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
            searchPlaceholder="搜索编号、名称或商品名称..."
            onReset={() => {
              setSearch("");
              setL2Filter("");
              setPage(1);
            }}
            hasFilters={!!l2Filter}
          >
            <SelectTileMode
              options={seasoningL2Options}
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
            <SkeletonTable cols={11} rows={pageSize} />
          ) : (
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
                  className: "w-[150px]",
                  cell: (row) => (
                    <span className="font-medium">
                      {row.name}
                    </span>
                  ),
                },
                {
                  header: "商品名称",
                  className: "w-[100px]",
                  cell: (row) => row.alias || "—",
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
                  header: "采购规格",
                  className: "w-[120px]",
                  cell: (row) => row.purchaseSpec || "—",
                },
                {
                  header: "采购单位",
                  className: "w-[80px]",
                  cell: (row) => row.purchaseUnit || "—",
                },
                {
                  header: "最新参照单价",
                  className: "w-[100px]",
                  cell: (row) =>
                    row.latestRefPrice != null
                      ? formatMoney(row.latestRefPrice, row.purchaseUnit)
                      : "—",
                },
                {
                  header: "入库单位",
                  className: "w-[80px]",
                  cell: (row) => row.stockUnit || "—",
                },
                {
                  header: "入库数量",
                  className: "w-[70px]",
                  cell: (row) => <span className="font-medium">{row.unitsPerPurchase ?? 1}</span>,
                },
                {
                  header: "每斤单价",
                  className: "w-[100px]",
                  cell: (row) =>
                    row.pricePerJin != null
                      ? <span className="font-medium tabular-nums">{formatMoney(row.pricePerJin, "斤")}</span>
                      : "—",
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
                    aria-label={`编辑调料 ${row.name}`}
                    title="编辑调料"
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
                    aria-label={`删除调料 ${row.name}`}
                    title="删除调料"
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
          )}
        </CardContent>
      </Card>

      <IngredientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={
          editing
            ? {
                id: editing.id,
                code: editing.code,
                name: editing.name,
                l2Code: editing.l2Code,
                alias: editing.alias,
                purchaseSpec: editing.purchaseSpec,
                purchaseUnit: editing.purchaseUnit || undefined,
                stockUnit: editing.stockUnit || undefined,
                unitsPerPurchase: editing.unitsPerPurchase ?? null,
                latestRefPrice: editing.latestRefPrice ?? null,
                pricePerJin: editing.pricePerJin ?? null,
                defaultSupplierId: editing.defaultSupplierId ?? null,
              }
            : {
                l2Code: seasoningL2Code,
              }
        }
        categories={categories}
        units={units}
        mode="seasoning"
        onSuccess={() => {
          setDialogOpen(false);
          fetchData();
        }}
      />

      <IngredientFormDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        initialData={
          viewing
            ? {
                id: viewing.id,
                code: viewing.code,
                name: viewing.name,
                l2Code: viewing.l2Code,
                alias: viewing.alias,
                purchaseSpec: viewing.purchaseSpec,
                purchaseUnit: viewing.purchaseUnit || undefined,
                stockUnit: viewing.stockUnit || undefined,
                unitsPerPurchase: viewing.unitsPerPurchase ?? null,
                latestRefPrice: viewing.latestRefPrice ?? null,
                pricePerJin: viewing.pricePerJin ?? null,
                defaultSupplierId: viewing.defaultSupplierId ?? null,
              }
            : undefined
        }
        categories={categories}
        units={units}
        mode="seasoning"
        view
        onSuccess={() => {}}
      />

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除这条调料吗？此操作不可撤销。
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
    </div>
  );
}
