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
import { FormField, FormSection } from "@/app/components/form-field";
import { Pagination } from "@/app/components/pagination";
import { TileSelect } from "@/app/components/tile-select";
import { TileGroup } from "@/app/components/tile-group";
import { usePagination, DEFAULT_PAGE_SIZE } from "@/app/lib/use-pagination";
import { toast } from "sonner";

type NetIngredient = {
  id: number;
  code: string;
  name: string;
  sourceIngredientId: number;
  spec: string | null;
  yieldRate: number;
  unitPrice: number;
  unit: string;
  l2Code: string;
  storage: string;
  sourceIngredient?: { id: number; name: string };
};

type RawIngredient = { id: number; name: string };

type Unit = {
  id: number;
  name: string;
  category: string;
};

const storages = ["冷藏", "常温", "冷冻"];

export default function NetIngredientsPage() {
  const [data, setData] = useState<NetIngredient[]>([]);
  const [rawIngredients, setRawIngredients] = useState<RawIngredient[]>([]);
  const [categories, setCategories] = useState<{code: string, name: string, parentCode: string}[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NetIngredient | null>(null);
  const [form, setForm] = useState({
    name: "",
    sourceIngredientId: "",
    spec: "",
    yieldRate: "",
    unitPrice: "",
    unit: "500g",
    l2Code: "",
    storage: "冷藏",
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.name, label: u.name })),
    [units]
  );

  const l2Map = useMemo(() => new Map(categories.map(c => [c.code, c.name])), [categories]);

  const {
    currentPage,
    setCurrentPage,
    pageItems,
    totalPages,
    start,
    end,
    totalItems,
  } = usePagination(
    useMemo(() => {
      if (!search.trim()) return data;
      const s = search.trim().toLowerCase();
      return data.filter(
        (d) =>
          d.name.toLowerCase().includes(s) ||
          d.code.toLowerCase().includes(s) ||
          (d.sourceIngredient?.name || "").toLowerCase().includes(s)
      );
    }, [data, search]),
    DEFAULT_PAGE_SIZE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [netRes, rawRes, catRes, unitRes] = await Promise.all([
        fetch("/api/net-ingredients"),
        fetch("/api/ingredients"),
        fetch("/api/ingredient-categories?type=l2"),
        fetch("/api/units"),
      ]);
      const netJson = await netRes.json();
      setData(Array.isArray(netJson) ? netJson : netJson.data || []);
      const rawJson = await rawRes.json();
      setRawIngredients(Array.isArray(rawJson) ? rawJson : rawJson.data || []);
      if (catRes.ok) {
        setCategories(await catRes.json());
      }
      if (unitRes.ok) {
        setUnits(await unitRes.json());
      }
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
    setForm({
      name: "",
      sourceIngredientId: "",
      spec: "",
      yieldRate: "",
      unitPrice: "",
      unit: "500g",
      l2Code: "",
      storage: "冷藏",
    });
    setDialogOpen(true);
  };

  const openEdit = (row: NetIngredient) => {
    setEditing(row);
    setForm({
      name: row.name,
      sourceIngredientId: String(row.sourceIngredientId),
      spec: row.spec || "",
      yieldRate: String(row.yieldRate),
      unitPrice: String(row.unitPrice),
      unit: row.unit,
      l2Code: row.l2Code,
      storage: row.storage,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (
      !form.name.trim() ||
      !form.sourceIngredientId ||
      !form.l2Code.trim() ||
      !form.storage.trim()
    ) {
      toast.error("请填写所有必填项");
      return;
    }
    try {
      const payload = {
        name: form.name,
        sourceIngredientId: Number(form.sourceIngredientId),
        spec: form.spec || null,
        yieldRate: Number(form.yieldRate) || 0,
        unitPrice: Number(form.unitPrice) || 0,
        unit: form.unit || "500g",
        l2Code: form.l2Code,
        storage: form.storage,
      };
      if (editing) {
        const res = await fetch(`/api/net-ingredients/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "更新失败");
        }
        toast.success("更新成功");
      } else {
        const res = await fetch("/api/net-ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "创建失败");
        }
        toast.success("创建成功");
      }
      setDialogOpen(false);
      fetchData();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/net-ingredients/${id}`, { method: "DELETE" });
      toast.success("删除成功");
      setDeleteId(null);
      fetchData();
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader showBack
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
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索编号、名称或来源原料..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <SkeletonTable cols={11} rows={DEFAULT_PAGE_SIZE} />
          ) : (
            <>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">序号</TableHead>
                      <TableHead>编号</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>来源原料</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead>出成率</TableHead>
                      <TableHead>净料单价</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>二级分类</TableHead>
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
                          colSpan={11}
                          className="text-center text-muted-foreground"
                        >
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageItems.map((row, idx) => (
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
                            {row.sourceIngredient?.name || row.sourceIngredientId}
                          </TableCell>
                          <TableCell>{row.spec || "—"}</TableCell>
                          <TableCell>{row.yieldRate}%</TableCell>
                          <TableCell>¥{row.unitPrice}</TableCell>
                          <TableCell>{row.unit}</TableCell>
                          <TableCell>{l2Map.get(row.l2Code) || row.l2Code}</TableCell>
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
                      ))
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
        <DialogContent className="sm:max-w-[800px] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg">
              {editing ? "编辑净料" : "新增净料"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 px-6 overflow-y-auto flex-1">
            <FormSection title="基础信息">
              <FormField label="名称" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如 去皮五花肉片"
                  className="h-11 text-base px-4"
                />
              </FormField>
            </FormSection>
            <FormSection title="来源与分类">
              <FormField label="来源原料" required>
                <TileSelect
                  options={rawIngredients.map((ri) => ({ value: String(ri.id), label: ri.name }))}
                  value={form.sourceIngredientId}
                  onChange={(v) => setForm({ ...form, sourceIngredientId: v })}
                  placeholder="请选择来源原料"
                  title="选择来源原料"
                  searchable={false}
                  required
                />
              </FormField>
              <FormField label="二级分类" required>
                <TileSelect
                  options={categories.map((c) => ({ value: c.code, label: c.name }))}
                  value={form.l2Code}
                  onChange={(v) => setForm({ ...form, l2Code: v })}
                  placeholder="请选择二级分类"
                  title="选择二级分类"
                  searchable={false}
                  required
                />
              </FormField>
            </FormSection>
            <FormSection title="规格与价格" cols={4}>
              <FormField label="规格">
                <Input
                  value={form.spec}
                  onChange={(e) => setForm({ ...form, spec: e.target.value })}
                  placeholder="如 0.2cm厚片"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="出成率 (%)" required>
                <Input
                  type="number"
                  value={form.yieldRate}
                  onChange={(e) =>
                    setForm({ ...form, yieldRate: e.target.value })
                  }
                  placeholder="如 85"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="净料单价" required>
                <Input
                  type="number"
                  value={form.unitPrice}
                  onChange={(e) =>
                    setForm({ ...form, unitPrice: e.target.value })
                  }
                  placeholder="如 25.00"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="净料单位" required>
                <TileSelect
                  options={unitOptions}
                  value={form.unit}
                  onChange={(v) => setForm({ ...form, unit: v })}
                  placeholder="请选择净料单位"
                  title="选择净料单位"
                  searchable={false}
                  required
                />
              </FormField>
            </FormSection>
            <FormSection title="储存信息" cols={1}>
              <FormField label="储存方式" required>
                <TileGroup
                  options={storages.map((s) => ({ value: s, label: s }))}
                  value={form.storage}
                  onChange={(v) => setForm({ ...form, storage: v })}
                />
              </FormField>
            </FormSection>
          </div>
          <DialogFooter className="px-6 pt-0 pb-6">
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
            确定要删除这条净料吗？此操作不可撤销。
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
