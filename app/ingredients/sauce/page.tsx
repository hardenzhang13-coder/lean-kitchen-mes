"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { FormField, FormSection } from "@/app/components/form-field";
import { TileGroup } from "@/app/components/tile-group";
import { Badge } from "@/components/ui/badge";
import { usePagination } from "@/app/lib/use-pagination";
import { toast } from "sonner";

type Sauce = {
  id: number;
  code: string;
  name: string;
  brand: string;
  spec: string | null;
  recipe: string | null;
  type: string;
  unitPrice: number;
  unit: string;
};

const SAUCE_TYPES = [
  { value: "自制", label: "自制" },
  { value: "外购", label: "外购" },
];

export default function SauceIngredientsPage() {
  const [data, setData] = useState<Sauce[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sauce | null>(null);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    spec: "",
    recipe: "",
    type: "自制",
    unitPrice: "",
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const s = search.trim().toLowerCase();
    return data.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        d.code.toLowerCase().includes(s) ||
        d.brand.toLowerCase().includes(s)
    );
  }, [data, search]);

  const {
    currentPage,
    setCurrentPage,
    pageItems,
    totalPages,
    totalItems,
  } = usePagination(filtered, 20);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sauce-ingredients");
      const json = await res.json();
      setData(json.data || []);
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
    setForm({ name: "", brand: "", spec: "", recipe: "", type: "自制", unitPrice: "" });
    setDialogOpen(true);
  };

  const openEdit = (row: Sauce) => {
    setEditing(row);
    setForm({
      name: row.name,
      brand: row.brand,
      spec: row.spec || "",
      recipe: row.recipe || "",
      type: row.type,
      unitPrice: String(row.unitPrice),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.spec.trim() || !form.recipe.trim() || !form.unitPrice.trim()) {
      toast.error("请填写所有必填项");
      return;
    }
    try {
      const payload = {
        name: form.name.trim(),
        brand: form.brand.trim(),
        spec: form.spec.trim(),
        recipe: form.recipe.trim() || null,
        type: form.type,
        unitPrice: Number(form.unitPrice) || 0,
      };
      if (editing) {
        const res = await fetch(`/api/sauce-ingredients/${editing.id}`, {
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
        const res = await fetch("/api/sauce-ingredients", {
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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "操作失败";
      toast.error(message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/sauce-ingredients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "删除失败");
      }
      toast.success("删除成功");
      setDeleteId(null);
      fetchData();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "删除失败";
      toast.error(message);
    }
  };

  const typeBadge = (type: string) => {
    if (type === "自制") {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">自制</Badge>;
    }
    if (type === "外购") {
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">外购</Badge>;
    }
    return <Badge>{type}</Badge>;
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader showBack
          title="酱料清单"
          description="复合加工调味半成品"
        />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增酱料
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索编号、名称或品牌..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <SkeletonTable cols={8} rows={20} />
          ) : (
            <DataTable<Sauce>
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
                  header: "编号",
                  cell: (row) => (
                    <span className="font-medium">{row.code}</span>
                  ),
                },
                { header: "名称", accessorKey: "name" },
                { header: "品牌", accessorKey: "brand" },
                { header: "规格", cell: (row) => row.spec || "—" },
                { header: "类型", cell: (row) => typeBadge(row.type) },
                {
                  header: "单价",
                  cell: (row) => `¥${Number(row.unitPrice).toFixed(2)}`,
                },
                { header: "单位", accessorKey: "unit" },
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
                    aria-label="编辑酱料"
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="删除酱料"
                    onClick={() => setDeleteId(row.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg">
              {editing ? "编辑酱料" : "新增酱料"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 px-6 overflow-y-auto flex-1">
            <FormSection title="基础信息" cols={2}>
              <FormField label="名称" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如 豆瓣酱"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="品牌">
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="如 郫县豆瓣酱"
                  className="h-11 text-base px-4"
                />
              </FormField>
            </FormSection>
            <FormSection title="规格与价格" cols={2}>
              <FormField label="规格" required>
                <Input
                  value={form.spec}
                  onChange={(e) => setForm({ ...form, spec: e.target.value })}
                  placeholder="如 500g/瓶"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="单价" required>
                <Input
                  type="number"
                  value={form.unitPrice}
                  onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                  placeholder="如 15.00"
                  className="h-11 text-base px-4"
                />
              </FormField>
            </FormSection>
            <FormSection title="配方说明" cols={1}>
              <FormField label="配方说明" required>
                <Textarea
                  value={form.recipe}
                  onChange={(e) => setForm({ ...form, recipe: e.target.value })}
                  placeholder="如 蚕豆、辣椒、盐、小麦粉"
                  className="min-h-[80px] text-base px-4 py-3"
                />
              </FormField>
            </FormSection>
            <FormSection title="类型与单位" cols={2}>
              <FormField label="类型" required>
                <TileGroup
                  options={SAUCE_TYPES}
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v })}
                />
              </FormField>
              <FormField label="单位">
                <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground">
                  g
                </div>
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
            确定要删除这条酱料吗？此操作不可撤销。
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
