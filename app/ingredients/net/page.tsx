"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
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
import { usePagination, DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { toast } from "sonner";

type NetIngredient = {
  id: number;
  code: string;
  name: string;
  sourceIngredientId: number | null;
  spec: string | null;
  packageSpec: number | null;
  processingFeePerJin: number | null;
  yieldRate: number | null;
  unitPrice: number;
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

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NetIngredientEditItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewing, setViewing] = useState<NetIngredientEditItem | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);

  const [deleteRow, setDeleteRow] = useState<NetIngredient | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [netRes, rawRes, catRes] = await Promise.all([
        fetch("/api/net-ingredients?excludeMinor=true&page=1&pageSize=100"),
        fetch("/api/ingredients?kind=raw&page=1&pageSize=100"),
        fetch("/api/ingredient-categories?page=1&pageSize=100"),
      ]);
      const netJson = await netRes.json();
      setData(netJson.data || []);
      const rawJson = await rawRes.json();
      setRawIngredients(rawJson.data || []);
      const catJson = await catRes.json();
      setCategories(Array.isArray(catJson) ? catJson : catJson.data || []);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchData();
  }, []);
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

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (l1Filter) {
        const parentCode = l2Map[d.l2Code]?.parentCode;
        if (parentCode !== l1Filter) return false;
      }
      if (l2Filter && d.l2Code !== l2Filter) return false;
      if (!search.trim()) return true;
      const s = search.trim().toLowerCase();
      return (
        d.name.toLowerCase().includes(s) ||
        d.code.toLowerCase().includes(s) ||
        (d.sourceIngredient?.name || "").toLowerCase().includes(s)
      );
    });
  }, [data, search, l1Filter, l2Filter, l2Map]);

  useEffect(() => {
    setL2Filter("");
  }, [l1Filter]);

  const {
    currentPage,
    setCurrentPage,
    pageItems,
    totalPages,
    totalItems,
    pageSize,
    setPageSize,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

  const openCreate = () => {
    setCreateDialogOpen(true);
  };

  const buildEditItem = (row: NetIngredient): NetIngredientEditItem => ({
    id: row.id,
    name: row.name,
    packageSpec: row.packageSpec,
    processingFeePerJin: row.processingFeePerJin,
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
    setViewing(buildEditItem(row));
    setViewDialogOpen(true);
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
      fetchData();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "删除失败";
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
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

      <Card>
        <CardHeader className="pb-3">
          <ListToolbar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setCurrentPage(1);
            }}
            searchPlaceholder="搜索编号、名称或来源原料..."
            onReset={() => {
              setSearch("");
              setL1Filter("");
              setL2Filter("");
              setCurrentPage(1);
            }}
            hasFilters={!!(l1Filter || l2Filter)}
          >
            <SelectTileMode
              options={categories.map((c) => ({ value: c.code, label: c.name }))}
              value={l1Filter}
              onChange={(v) => {
                setL1Filter(v);
                setL2Filter("");
                setCurrentPage(1);
              }}
              placeholder="全部一级分类"
              title="选择一级分类"
              searchable={false}
              className="w-[180px]"
            />
            <SelectTileMode
              options={
                l1Filter
                  ? (categories.find((c) => c.code === l1Filter)?.children || []).map((c) => ({
                      value: c.code,
                      label: c.name,
                    }))
                  : categories.flatMap((c) => c.children.map((l2) => ({ value: l2.code, label: l2.name })))
              }
              value={l2Filter}
              onChange={(v) => {
                setL2Filter(v);
                setCurrentPage(1);
              }}
              placeholder="全部二级分类"
              title="选择二级分类"
              searchable={false}
              disabled={!l1Filter}
              className="w-[180px]"
            />
          </ListToolbar>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <SkeletonTable cols={9} rows={20} />
          ) : (
            <DataTable<NetIngredient>
              data={pageItems}
              loading={loading}
              columns={[
                {
                  header: "序号",
                  cell: (_, rowIdx) => (
                    <span className="text-muted-foreground">
                      {(currentPage - 1) * pageSize + rowIdx + 1}
                    </span>
                  ),
                },
                {
                  header: "二级分类",
                  cell: (row) => {
                    const l2Info = l2Map[row.l2Code];
                    return (
                      <CategoryTag l2Code={row.l2Code} name={l2Info?.name || row.l2Code} />
                    );
                  },
                },
                {
                  header: "编号",
                  cell: (row) => (
                    <span className="font-medium">{row.code}</span>
                  ),
                },
                { header: "名称", accessorKey: "name" },
                {
                  header: "封装规格",
                  cell: (row) => (row.packageSpec != null ? `${row.packageSpec}g` : "—"),
                },
                {
                  header: "来源原料",
                  cell: (row) =>
                    row.sourceIngredient?.name || row.sourceIngredientId || "—",
                },
                {
                  header: "出成率",
                  cell: (row) =>
                    row.yieldRate != null ? `${row.yieldRate}%` : "—",
                },
                {
                  header: "净料单价（元/斤）",
                  cell: (row) => `¥${Number(row.unitPrice).toFixed(2)}`,
                },
                {
                  header: "封装加工费",
                  cell: (row) =>
                    row.processingFeePerJin != null
                      ? `¥${Number(row.processingFeePerJin).toFixed(2)}/斤`
                      : "—",
                },
                {
                  header: "毛利率",
                  cell: (row) =>
                    row.grossMarginRate != null ? `${row.grossMarginRate}%` : "—",
                },
                {
                  header: "出库价（元/斤）",
                  cell: (row) =>
                    row.outPricePerJin != null ? (
                      `¥${Number(row.outPricePerJin).toFixed(2)}`
                    ) : (
                      <span title="成本价 ÷ (1 - 毛利率/100)">—</span>
                    ),
                },
                {
                  header: "标准规格价",
                  cell: (row) =>
                    row.standardPackagePrice != null
                      ? `¥${Number(row.standardPackagePrice).toFixed(2)}/份`
                      : "—",
                },
              ]}
              pagination={
                totalItems > 0
                  ? {
                      currentPage,
                      totalPages,
                      totalItems,
                      pageSize,
                      onPageChange: setCurrentPage,
                      onPageSizeChange: setPageSize,
                    }
                  : undefined
              }
              emptyState={{ title: "暂无数据" }}
              rowActions={(row) => (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="查看净料"
                    onClick={() => openView(row)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="编辑净料"
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="删除净料"
                    onClick={() => setDeleteRow(row)}
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
        mode="net"
        categories={categories}
        rawIngredients={rawIngredients}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchData();
        }}
      />

      <NetIngredientEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        initialData={editing}
        categories={categories}
        rawIngredients={rawIngredients}
        onSuccess={fetchData}
      />

      <NetIngredientEditDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        view
        initialData={viewing}
        categories={categories}
        rawIngredients={rawIngredients}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
