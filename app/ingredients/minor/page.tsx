"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { SkeletonTable } from "@/app/components/skeleton-table";
import { DataTable } from "@/app/components/data-table";
import { CategoryTag } from "@/app/components/category-tag";
import {
  NetIngredientFormDialog,
} from "@/app/components/net-ingredient-form-dialog";
import {
  NetIngredientEditDialog,
  NetIngredientEditItem,
} from "@/app/components/net-ingredient-edit-dialog";
import { usePagination } from "@/app/lib/use-pagination";
import { SelectTileMode } from "@/app/components/select-tile-mode";
import { toast } from "sonner";

type NetIngredient = {
  id: number;
  code: string;
  name: string;
  sourceIngredientId: number | null;
  spec: string | null;
  yieldRate: number | null;
  unitPrice: number;
  unit: string | null;
  l2Code: string;
  sourceIngredient?: { id: number; name: string } | null;
};

type CategoryL1 = {
  code: string;
  name: string;
  children: { code: string; name: string }[];
};

export default function MinorIngredientsPage() {
  const [data, setData] = useState<NetIngredient[]>([]);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [l2Filter, setL2Filter] = useState("");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NetIngredientEditItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [deleteRow, setDeleteRow] = useState<NetIngredient | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [res, catRes] = await Promise.all([
        fetch("/api/net-ingredients?l1Code=MIN"),
        fetch("/api/ingredient-categories?page=1&pageSize=100"),
      ]);
      const json = await res.json();
      setData(json.data || []);
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
      if (l2Filter && d.l2Code !== l2Filter) return false;
      if (!search.trim()) return true;
      const s = search.trim().toLowerCase();
      return (
        d.name.toLowerCase().includes(s) || d.code.toLowerCase().includes(s)
      );
    });
  }, [data, search, l2Filter]);

  const {
    currentPage,
    setCurrentPage,
    pageItems,
    totalPages,
    totalItems,
  } = usePagination(filtered, 20);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, l2Filter, setCurrentPage]);

  const openCreate = () => {
    setCreateDialogOpen(true);
  };

  const openEdit = (row: NetIngredient) => {
    setEditing({
      id: row.id,
      name: row.name,
      spec: row.spec,
      yieldRate: row.yieldRate,
      unitPrice: row.unitPrice,
      sourceIngredientId: row.sourceIngredientId,
      l2Code: row.l2Code,
    });
    setEditDialogOpen(true);
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
          title="小料清单"
          description="用量极小的增香/去腥/提味食材"
        />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增小料
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索编号、名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <SelectTileMode
              options={
                (categories.find((c) => c.code === "MIN")?.children || []).map((c) => ({
                  value: c.code,
                  label: c.name,
                }))
              }
              value={l2Filter}
              onChange={setL2Filter}
              placeholder="全部二级分类"
              title="选择二级分类"
              searchable={false}
              className="w-[180px]"
            />
            {(search || l2Filter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setL2Filter("");
                }}
              >
                清除筛选
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <SkeletonTable cols={8} rows={20} />
          ) : (
            <DataTable<NetIngredient>
              data={pageItems}
              loading={loading}
              columns={[
                {
                  header: "序号",
                  cell: (_, rowIdx) => (
                    <span className="text-muted-foreground">
                      {(currentPage - 1) * 20 + rowIdx + 1}
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
                { header: "规格", cell: (row) => row.spec || "—" },
                {
                  header: "单价",
                  cell: (row) => `¥${Number(row.unitPrice).toFixed(2)}`,
                },
                {
                  header: "单位",
                  cell: (row) => row.unit || "10g",
                },
              ]}
              pagination={
                totalItems > 0
                  ? {
                      currentPage,
                      totalPages,
                      totalItems,
                      pageSize: 20,
                      onPageChange: setCurrentPage,
                    }
                  : undefined
              }
              emptyState={{ title: "暂无数据" }}
              rowActions={(row) => (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="编辑小料"
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="删除小料"
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
        mode="minor"
        categories={categories}
        rawIngredients={[]}
        onSuccess={() => {
          setCreateDialogOpen(false);
          fetchData();
        }}
      />

      <NetIngredientEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="minor"
        initialData={editing}
        categories={categories}
        rawIngredients={[]}
        onSuccess={fetchData}
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
