"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Upload } from "lucide-react";
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
import { ImportDialog, ImportField } from "@/app/components/import-dialog";
import { TileSelect } from "@/app/components/tile-select";
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

const importFields: ImportField[] = [
  { key: "name", label: "食材名称", required: true, sample: "带皮五花肉" },
  { key: "alias", label: "商品名称", sample: "五花肉" },
  { key: "l2Code", label: "二级分类编码", required: true, sample: "MEA-POR" },
  { key: "purchaseSpec", label: "采购规格", sample: "散称" },
  { key: "purchaseUnit", label: "采购单位", required: true, sample: "斤" },
  { key: "stockUnit", label: "入库单位", required: true, sample: "斤" },
  { key: "latestRefPrice", label: "最新参照单价", sample: "18.50" },
];

export default function RawIngredientsPage() {
  const [data, setData] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [l1Filter, setL1Filter] = useState("");
  const [l2Filter, setL2Filter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ingRes, catRes, unitRes] = await Promise.all([
        fetch("/api/ingredients"),
        fetch("/api/ingredient-categories"),
        fetch("/api/units"),
      ]);
      const ingData = await ingRes.json();
      setData(ingData.data || []);
      setCategories(await catRes.json());
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

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (l2Filter && d.l2Code !== l2Filter) return false;
      if (l1Filter) {
        const parentCode = categories.find((l1) =>
          l1.children.some((l2) => l2.code === d.l2Code)
        )?.code;
        if (parentCode !== l1Filter) return false;
      }
      if (!search.trim()) return true;
      const s = search.trim().toLowerCase();
      return (
        d.name.toLowerCase().includes(s) ||
        d.code.toLowerCase().includes(s) ||
        (d.alias && d.alias.toLowerCase().includes(s)) ||
        d.l2Code.toLowerCase().includes(s)
      );
    });
  }, [data, search, l1Filter, l2Filter, categories]);

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
  }, [search, l1Filter, l2Filter, setCurrentPage]);

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
    <div className="flex flex-col gap-6 p-8">
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

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="搜索编号、名称或商品名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 w-[320px]">
              <TileSelect
                options={categories.map((c) => ({
                  value: c.code,
                  label: c.name,
                }))}
                value={l1Filter}
                onChange={(v) => {
                  setL1Filter(v);
                  setL2Filter("");
                  setCurrentPage(1);
                }}
                placeholder="全部一级分类"
                title="选择一级分类"
                searchable={false}
              />
              <TileSelect
                options={l2FilterOptions}
                value={l2Filter}
                onChange={(v) => {
                  setL2Filter(v);
                  setCurrentPage(1);
                }}
                placeholder="全部二级分类"
                title="选择二级分类"
                disabled={!l1Filter}
                searchable={false}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <SkeletonTable cols={11} rows={DEFAULT_PAGE_SIZE} />
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
                      <TableHead>一级分类</TableHead>
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
                          colSpan={11}
                          className="text-center text-muted-foreground"
                        >
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageItems.map((row, idx) => {
                        const l2Info = l2Map[row.l2Code];
                        const l1Name = l2Info
                          ? l1Map[l2Info.parentCode] || "—"
                          : "—";
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
                            <TableCell className="text-muted-foreground">
                              {row.alias || "—"}
                            </TableCell>
                            <TableCell>{l1Name}</TableCell>
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
                                aria-label="编辑原料"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="删除原料"
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
            : undefined
        }
        categories={categories}
        units={units}
        mode="ingredient"
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
