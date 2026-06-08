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
import { SelectField } from "@/app/components/select-field";
import { usePagination, DEFAULT_PAGE_SIZE } from "@/app/lib/use-pagination";
import { toast } from "sonner";

type Sauce = {
  id: number;
  code: string;
  name: string;
  brand: string;
  recipe: string | null;
  storage: string;
  unitPrice: number;
  unit: string;
};

const storages = ["冷藏", "常温", "冷冻"];

export default function SauceIngredientsPage() {
  const [data, setData] = useState<Sauce[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sauce | null>(null);
  const [form, setForm] = useState({
    name: "",
    brand: "",
    recipe: "",
    storage: "常温",
    unitPrice: "",
    unit: "",
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
      const res = await fetch("/api/sauce-ingredients");
      setData(await res.json());
    } catch (e) {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", brand: "", recipe: "", storage: "常温", unitPrice: "", unit: "" });
    setDialogOpen(true);
  };

  const openEdit = (row: Sauce) => {
    setEditing(row);
    setForm({
      name: row.name,
      brand: row.brand,
      recipe: row.recipe || "",
      storage: row.storage,
      unitPrice: String(row.unitPrice),
      unit: row.unit,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (
      !form.name.trim() ||
      !form.brand.trim() ||
      !form.storage.trim() ||
      !form.unit.trim()
    ) {
      toast.error("请填写所有必填项");
      return;
    }
    try {
      const payload = {
        name: form.name,
        brand: form.brand,
        recipe: form.recipe || null,
        storage: form.storage,
        unitPrice: Number(form.unitPrice) || 0,
        unit: form.unit,
      };
      if (editing) {
        await fetch(`/api/sauce-ingredients/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("更新成功");
      } else {
        await fetch("/api/sauce-ingredients", {
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
      await fetch(`/api/sauce-ingredients/${id}`, { method: "DELETE" });
      toast.success("删除成功");
      setDeleteId(null);
      fetchData();
    } catch (e) {
      toast.error("删除失败");
    }
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
          <div className="flex items-center gap-2">
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
            <SkeletonTable cols={9} rows={DEFAULT_PAGE_SIZE} />
          ) : (
            <>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">序号</TableHead>
                      <TableHead>编号</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>品牌</TableHead>
                      <TableHead>配方</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>单位</TableHead>
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
                          colSpan={9}
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
                          <TableCell>{row.brand}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {row.recipe || "—"}
                          </TableCell>
                          <TableCell>¥{row.unitPrice}</TableCell>
                          <TableCell>{row.unit}</TableCell>
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
        <DialogContent className="sm:max-w-[640px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editing ? "编辑酱料" : "新增酱料"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
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
                  placeholder="如 豆瓣酱"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="品牌" required>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="如 郫县豆瓣酱"
                  className="h-11 text-base px-4"
                />
              </FormField>
            </FormSection>
            <FormSection title="配方与价格">
              <FormField label="配方说明">
                <Input
                  value={form.recipe}
                  onChange={(e) => setForm({ ...form, recipe: e.target.value })}
                  placeholder="如 蚕豆、辣椒、盐、小麦粉"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="单价" required>
                <Input
                  type="number"
                  value={form.unitPrice}
                  onChange={(e) =>
                    setForm({ ...form, unitPrice: e.target.value })
                  }
                  placeholder="如 15.00"
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
            </FormSection>
            <FormSection title="储存信息">
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
