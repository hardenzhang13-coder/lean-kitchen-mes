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
import { ImportDialog, ImportField, ImportRow } from "@/app/components/import-dialog";
import { Pagination } from "@/app/components/pagination";
import { usePagination, DEFAULT_PAGE_SIZE } from "@/app/lib/use-pagination";
import { toast } from "sonner";

type Ingredient = {
  id: number;
  code: string;
  name: string;
  alias: string | null;
  l2Code: string;
  brand: string | null;
  purchaseSpec: string | null;
  purchaseUnit: string | null;
  latestRefPrice: number | null;
  stockUnit: string | null;
  season: string;
  storage: string;
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

const seasons = ["四季", "春", "夏", "秋", "冬"];
const storages = ["冷藏", "常温", "冷冻", "干货"];

const importFields: ImportField[] = [
  { key: "name", label: "名称", required: true, sample: "带皮五花肉" },
  { key: "alias", label: "别名", sample: "五花肉" },
  { key: "l2Code", label: "二级分类编码", required: true, sample: "MEA-POR" },
  { key: "purchaseSpec", label: "采购规格", sample: "散称" },
  { key: "purchaseUnit", label: "采购单位", required: true, sample: "斤" },
  { key: "stockUnit", label: "入库单位", required: true, sample: "斤" },
  { key: "latestRefPrice", label: "最新参照单价", sample: "18.50" },
  { key: "season", label: "季节限定", sample: "四季" },
  { key: "storage", label: "储存方式", required: true, sample: "冷藏" },
];

export default function RawIngredientsPage() {
  const [data, setData] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
      setData(await ingRes.json());
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
    if (!search.trim()) return data;
    const s = search.trim().toLowerCase();
    return data.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        d.code.toLowerCase().includes(s) ||
        (d.alias && d.alias.toLowerCase().includes(s)) ||
        d.l2Code.toLowerCase().includes(s)
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
      await fetch(`/api/ingredients/${id}`, { method: "DELETE" });
      toast.success("删除成功");
      setDeleteId(null);
      fetchData();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleValidateImport = (
    rows: Record<string, string>[]
  ): ImportRow<Record<string, string>>[] => {
    const l2Set = new Set(Object.keys(l2Map));
    return rows.map((row, index) => {
      const errors: string[] = [];
      if (!row.name.trim()) errors.push("名称不能为空");
      if (!row.l2Code.trim()) errors.push("二级分类编码不能为空");
      else if (!l2Set.has(row.l2Code.trim()))
        errors.push("二级分类编码不存在");
      if (!row.purchaseUnit.trim()) errors.push("采购单位不能为空");
      if (!row.stockUnit.trim()) errors.push("入库单位不能为空");
      if (!row.storage.trim()) errors.push("储存方式不能为空");
      else if (!storages.includes(row.storage.trim()))
        errors.push(`储存方式只能是 ${storages.join("/")}`);
      if (row.season && !seasons.includes(row.season.trim()))
        errors.push(`季节限定只能是 ${seasons.join("/")}`);
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
          season: r.season?.trim() || "四季",
          storage: r.storage.trim(),
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
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索编号、名称或别名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <SkeletonTable cols={13} rows={DEFAULT_PAGE_SIZE} />
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">序号</TableHead>
                      <TableHead>编号</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>别名</TableHead>
                      <TableHead>一级分类</TableHead>
                      <TableHead>二级分类</TableHead>
                      <TableHead>采购规格</TableHead>
                      <TableHead>采购单位</TableHead>
                      <TableHead>最新参照单价</TableHead>
                      <TableHead>入库单位</TableHead>
                      <TableHead>季节限定</TableHead>
                      <TableHead>储存方式</TableHead>
                      <TableHead className="w-[120px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={13}
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
                            <TableCell>{row.season}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs">
                                {row.storage}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
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
                season: editing.season,
                storage: editing.storage,
              }
            : undefined
        }
        categories={categories}
        units={units}
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
