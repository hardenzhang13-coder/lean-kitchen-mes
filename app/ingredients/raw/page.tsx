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
import { FormField, FormSection } from "@/app/components/form-field";
import { TileSelect } from "@/app/components/tile-select";
import { SelectField } from "@/app/components/select-field";
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
  unit: string;
  priceUnit: string;
  purchaseSpec: string | null;
  season: string;
  storage: string;
};

type CategoryL1 = {
  id: number;
  code: string;
  name: string;
  children: { id: number; code: string; name: string; parentCode: string }[];
};

const seasons = ["四季", "春", "夏", "秋", "冬"];
const storages = ["冷藏", "常温", "冷冻"];

const importFields: ImportField[] = [
  { key: "name", label: "名称", required: true, sample: "带皮五花肉" },
  { key: "alias", label: "别名", sample: "五花肉" },
  { key: "l2Code", label: "二级分类编码", required: true, sample: "MEA-POR" },
  { key: "unit", label: "计量单位", required: true, sample: "斤" },
  { key: "priceUnit", label: "计价单位", required: true, sample: "斤" },
  { key: "purchaseSpec", label: "采购规格", sample: "散称" },
  { key: "season", label: "季节限定", sample: "四季" },
  { key: "storage", label: "储存方式", required: true, sample: "冷藏" },
];

export default function RawIngredientsPage() {
  const [data, setData] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({
    name: "",
    alias: "",
    l1Code: "",
    l2Code: "",
    unit: "",
    priceUnit: "",
    purchaseSpec: "",
    season: "四季",
    storage: "冷藏",
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ingRes, catRes] = await Promise.all([
        fetch("/api/ingredients"),
        fetch("/api/ingredient-categories"),
      ]);
      setData(await ingRes.json());
      setCategories(await catRes.json());
    } catch (e) {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const l2Options = useMemo(() => {
    if (!form.l1Code) return [];
    const l1 = categories.find((c) => c.code === form.l1Code);
    return (
      l1?.children.map((c) => ({
        value: c.code,
        label: c.name,
        description: c.code,
      })) || []
    );
  }, [form.l1Code, categories]);

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
    setForm({
      name: "",
      alias: "",
      l1Code: "",
      l2Code: "",
      unit: "",
      priceUnit: "",
      purchaseSpec: "",
      season: "四季",
      storage: "冷藏",
    });
    setDialogOpen(true);
  };

  const openEdit = (row: Ingredient) => {
    setEditing(row);
    const parentL1 = categories.find((c) =>
      c.children.some((ch) => ch.code === row.l2Code)
    );
    setForm({
      name: row.name,
      alias: row.alias || "",
      l1Code: parentL1?.code || "",
      l2Code: row.l2Code,
      unit: row.unit,
      priceUnit: row.priceUnit,
      purchaseSpec: row.purchaseSpec || "",
      season: row.season,
      storage: row.storage,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (
      !form.name.trim() ||
      !form.l2Code.trim() ||
      !form.unit.trim() ||
      !form.priceUnit.trim() ||
      !form.storage.trim()
    ) {
      toast.error("请填写所有必填项");
      return;
    }
    try {
      const payload = {
        name: form.name,
        alias: form.alias || null,
        l2Code: form.l2Code,
        unit: form.unit,
        priceUnit: form.priceUnit,
        purchaseSpec: form.purchaseSpec || null,
        season: form.season,
        storage: form.storage,
      };
      if (editing) {
        await fetch(`/api/ingredients/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("更新成功");
      } else {
        await fetch("/api/ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("创建成功");
      }
      setDialogOpen(false);
      fetchData();
    } catch (e) {
      toast.error("操作失败");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/ingredients/${id}`, { method: "DELETE" });
      toast.success("删除成功");
      setDeleteId(null);
      fetchData();
    } catch (e) {
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
      if (!row.unit.trim()) errors.push("计量单位不能为空");
      if (!row.priceUnit.trim()) errors.push("计价单位不能为空");
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
          unit: r.unit.trim(),
          priceUnit: r.priceUnit.trim(),
          purchaseSpec: r.purchaseSpec?.trim() || undefined,
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
        <PageHeader showBack
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
            <SkeletonTable cols={12} rows={DEFAULT_PAGE_SIZE} />
          ) : (
            <>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">序号</TableHead>
                      <TableHead>编号</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>别名</TableHead>
                      <TableHead>一级分类</TableHead>
                      <TableHead>二级分类</TableHead>
                      <TableHead>计量单位</TableHead>
                      <TableHead>计价单位</TableHead>
                      <TableHead>采购规格</TableHead>
                      <TableHead>季节限定</TableHead>
                      <TableHead>储存方式</TableHead>
                      <TableHead className="w-[120px] text-right">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={12}
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
                              {l2Name}{" "}
                              <span className="text-muted-foreground text-xs">
                                ({row.l2Code})
                              </span>
                            </TableCell>
                            <TableCell>{row.unit}</TableCell>
                            <TableCell>{row.priceUnit}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.purchaseSpec || "—"}
                            </TableCell>
                            <TableCell>{row.season}</TableCell>
                            <TableCell>
                              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[900px] [&>button]:cursor-pointer p-6">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editing ? "编辑原料" : "新增原料"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <FormSection title="分类信息">
              <FormField label="一级分类" required>
                <SelectField
                  value={form.l1Code}
                  onChange={(v) => setForm({ ...form, l1Code: v, l2Code: "" })}
                  options={[{ value: "", label: "请选择一级分类" }, ...categories.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))]}
                  placeholder="请选择一级分类"
                />
              </FormField>
              <FormField label="二级分类" required>
                <TileSelect
                  options={l2Options}
                  value={form.l2Code}
                  onChange={(v) => setForm({ ...form, l2Code: v })}
                  placeholder={
                    form.l1Code ? "请选择二级分类" : "请先选择一级分类"
                  }
                  title="选择二级分类"
                  searchPlaceholder="搜索分类编码或名称..."
                  disabled={!form.l1Code}
                  required
                />
              </FormField>
            </FormSection>

            <FormSection title="基础信息">
              <FormField label="编号">
                <Input
                  value={editing?.code || "系统自动生成"}
                  disabled
                  className="h-11 text-base px-4 bg-muted"
                />
              </FormField>
              <FormField label="名称" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如 带皮五花肉"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="别名">
                <Input
                  value={form.alias}
                  onChange={(e) => setForm({ ...form, alias: e.target.value })}
                  placeholder="常用别名"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="计量单位" required>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="如 斤"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="计价单位" required>
                <Input
                  value={form.priceUnit}
                  onChange={(e) =>
                    setForm({ ...form, priceUnit: e.target.value })
                  }
                  placeholder="如 斤"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="采购规格">
                <Input
                  value={form.purchaseSpec}
                  onChange={(e) =>
                    setForm({ ...form, purchaseSpec: e.target.value })
                  }
                  placeholder="如 散称、1.9L*6"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="季节限定" required>
                <SelectField
                  value={form.season}
                  onChange={(v) => setForm({ ...form, season: v })}
                  options={seasons.map((s) => ({ value: s, label: s }))}
                />
              </FormField>
              <FormField label="储存方式" required>
                <SelectField
                  value={form.storage}
                  onChange={(v) => setForm({ ...form, storage: v })}
                  options={storages.map((s) => ({ value: s, label: s }))}
                />
              </FormField>
            </FormSection>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button onClick={handleSubmit} className="h-11 px-6">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
