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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { SkeletonTable } from "@/app/components/skeleton-table";
import { CategoryTag } from "@/app/components/category-tag";
import { IngredientFormDialog } from "@/app/components/ingredient-form-dialog";
import { Pagination } from "@/app/components/pagination";
import { usePagination, DEFAULT_PAGE_SIZE } from "@/app/lib/use-pagination";
import { toast } from "sonner";

type Ingredient = {
  id: number;
  code: string;
  name: string;
  alias: string | null;
  l2Code: string;
  purchaseSpec: string | null;
  purchaseUnit: string | null;
  latestRefPrice: number | null;
  stockUnit: string | null;
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
};

function findSeasoningL2Code(categories: CategoryL1[]) {
  for (const l1 of categories) {
    if (l1.name === "调味品") {
      const l2 = l1.children.find((c) => c.name === "调料");
      if (l2) return l2.code;
    }
  }
  for (const l1 of categories) {
    const l2 = l1.children.find((c) => c.name === "调料");
    if (l2) return l2.code;
  }
  return undefined;
}

export default function SeasoningIngredientsPage() {
  const [data, setData] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const seasoningL2Code = useMemo(
    () => findSeasoningL2Code(categories),
    [categories]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const s = search.trim().toLowerCase();
    return data.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        d.code.toLowerCase().includes(s) ||
        (d.alias && d.alias.toLowerCase().includes(s))
    );
  }, [data, search]);

  const {
    currentPage,
    setCurrentPage,
    pageItems,
    totalPages,
    start,
    end,
    totalItems,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, unitRes, ingRes] = await Promise.all([
        fetch("/api/ingredient-categories"),
        fetch("/api/units"),
        fetch("/api/ingredients"),
      ]);
      const cats = await catRes.json();
      setCategories(cats);
      const seasoningL2Codes = new Set<string>(
        cats
          .flatMap((l1: any) => l1.children)
          .filter((l2: any) => l2.parentCode === "SEA" || l2.code === "GRA-SEA")
          .map((l2: any) => l2.code)
      );
      const allIngredients = await ingRes.json();
      const list = allIngredients.data || allIngredients || [];
      setData(list.filter((i: any) => seasoningL2Codes.has(i.l2Code)));
      if (unitRes.ok) setUnits(await unitRes.json());
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

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row: Ingredient) => {
    setEditing(row);
    setDialogOpen(true);
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
    } catch (e: any) {
      toast.error(e.message || "删除失败");
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
    <div className="flex flex-col gap-6 p-8">
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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索编号、名称或商品名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <SkeletonTable cols={10} rows={DEFAULT_PAGE_SIZE} />
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">序号</TableHead>
                      <TableHead>编号</TableHead>
                      <TableHead>食材名称</TableHead>
                      <TableHead>商品名称</TableHead>
                      <TableHead>二级分类</TableHead>
                      <TableHead>采购规格</TableHead>
                      <TableHead>采购单位</TableHead>
                      <TableHead>最新参照单价</TableHead>
                      <TableHead>入库单位</TableHead>
                      <TableHead className="w-[120px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={10}
                          className="text-center text-muted-foreground"
                        >
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageItems.map((row, idx) => {
                        const l2Info = l2Map[row.l2Code];
                        const l2Name = l2Info?.name || row.l2Code;
                        return (
                          <TableRow
                            key={row.id}
                            className="transition-colors hover:bg-muted/40"
                          >
                            <TableCell className="text-muted-foreground">
                              {(currentPage - 1) * DEFAULT_PAGE_SIZE + idx + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {row.code}
                            </TableCell>
                            <TableCell>{row.name}</TableCell>
                            <TableCell>{row.alias || "—"}</TableCell>
                            <TableCell>
                              <CategoryTag l2Code={row.l2Code} name={l2Name} />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.purchaseSpec || "—"}
                            </TableCell>
                            <TableCell>{row.purchaseUnit || "—"}</TableCell>
                            <TableCell>
                              {row.latestRefPrice != null
                                ? `¥${Number(row.latestRefPrice).toFixed(2)}`
                                : "—"}
                            </TableCell>
                            <TableCell>{row.stockUnit || "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="编辑调料"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="删除调料"
                                onClick={() => setDeleteId(row.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                start={start}
                end={end}
                onPageChange={setCurrentPage}
              />
            </>
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
                latestRefPrice: editing.latestRefPrice ?? null,
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
