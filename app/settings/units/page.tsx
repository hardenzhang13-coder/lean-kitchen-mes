"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/ui/page-header";
import { SkeletonTable } from "@/app/components/ui/skeleton-table";
import { Pagination } from "@/app/components/ui/pagination";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { usePagination, DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
import { toast } from "sonner";

type Unit = {
  id: number;
  name: string;
  category: string;
  gramsPerUnit: number | string | null;
  isActive: boolean;
};

/** 后端引用检查返回的引用明细 */
type UnitReferences = Record<string, number>;

const categories = [
  { value: "weight", label: "重量" },
  { value: "volume", label: "体积" },
  { value: "count", label: "计数" },
  { value: "other", label: "其他" },
];

const statusFilters = [
  { value: "all", label: "全部" },
  { value: "active", label: "启用中" },
  { value: "inactive", label: "已停用" },
];

const emptyForm = { name: "", category: "weight", gramsPerUnit: "" };

export default function UnitsPage() {
  const [data, setData] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deleteError, setDeleteError] = useState<{ message: string; references?: UnitReferences } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 设置页需要管理停用单位，拉取全量；业务端默认只返回启用中的
      const res = await fetch("/api/units?page=1&pageSize=100&includeInactive=1");
      const json = await res.json();
      setData(json.data || []);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data.filter((d) => {
      if (statusFilter === "active" && !d.isActive) return false;
      if (statusFilter === "inactive" && d.isActive) return false;
      if (!s) return true;
      return (
        d.name.toLowerCase().includes(s) ||
        d.category.toLowerCase().includes(s)
      );
    });
  }, [data, search, statusFilter]);

  const {
    currentPage,
    setCurrentPage,
    pageItems,
    totalPages,
    totalItems,
    start,
    end,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: Unit) => {
    setEditing(row);
    setForm({
      name: row.name,
      category: row.category,
      gramsPerUnit: row.gramsPerUnit != null ? String(Number(row.gramsPerUnit)) : "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("名称不能为空");
      return;
    }
    if (form.category === "weight") {
      const grams = Number(form.gramsPerUnit);
      if (!form.gramsPerUnit.trim() || !Number.isFinite(grams) || grams <= 0) {
        toast.error("重量类单位必须填写换算克数（1 单位合多少克）");
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        gramsPerUnit:
          form.category === "weight" ? Number(form.gramsPerUnit) : null,
      };
      const res = editing
        ? await fetch(`/api/units/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/units", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "操作失败");
        return;
      }
      toast.success(editing ? "更新成功" : "创建成功");
      closeDialog();
      fetchData();
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row: Unit) => {
    try {
      const res = await fetch(`/api/units/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "操作失败");
        return;
      }
      toast.success(row.isActive ? `已停用「${row.name}」` : `已启用「${row.name}」`);
      fetchData();
    } catch {
      toast.error("操作失败");
    }
  };

  const openDelete = (row: Unit) => {
    setDeleteTarget(row);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/units/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        // 被引用时展示后端返回的引用明细，引导用户改停用
        setDeleteError({ message: json.error || "删除失败", references: json.references });
        return;
      }
      toast.success("删除成功");
      setDeleteTarget(null);
      fetchData();
    } catch {
      setDeleteError({ message: "删除失败，请稍后重试" });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader showBack title="单位" description="管理重量、体积、计数等单位字典；重量类单位的换算克数驱动全系统斤/克换算" />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增
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
            searchPlaceholder="搜索名称或分类..."
            onReset={() => {
              setSearch("");
              setStatusFilter("all");
              setCurrentPage(1);
            }}
            hasFilters={statusFilter !== "all"}
          >
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                if (v) setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue>
                  {statusFilters.find((s) => s.value === statusFilter)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statusFilters.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ListToolbar>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable cols={6} rows={DEFAULT_PAGE_SIZE} />
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">序号</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead>换算（克/单位）</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="w-[160px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageItems.map((row, idx) => (
                        <TableRow key={row.id} className={`transition-colors hover:bg-muted/40 ${!row.isActive ? "opacity-50" : ""}`}>
                          <TableCell className="text-muted-foreground">
                            {(currentPage - 1) * DEFAULT_PAGE_SIZE + idx + 1}
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs">
                              {categories.find((c) => c.value === row.category)?.label || row.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.category === "weight"
                              ? row.gramsPerUnit != null
                                ? `${Number(row.gramsPerUnit)} g`
                                : "未设置"
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {row.isActive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" /> 启用中
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                                <Ban className="h-3 w-3" /> 已停用
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" aria-label={row.isActive ? "停用单位" : "启用单位"} onClick={() => toggleActive(row)}>
                              {row.isActive ? (
                                <Ban className="h-4 w-4 text-amber-500" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="编辑单位" onClick={() => openEdit(row)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="删除单位" onClick={() => openDelete(row)}>
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

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[560px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">{editing ? "编辑单位" : "新增单位"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <div className="grid gap-2.5">
              <Label htmlFor="name" className="text-base">名称</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如 斤"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="category" className="text-base">分类</Label>
              <Select
                value={form.category}
                onValueChange={(v) => v && setForm({ ...form, category: v })}
              >
                <SelectTrigger id="category" className="h-11">
                  <SelectValue>
                    {categories.find((c) => c.value === form.category)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.category === "weight" && (
              <div className="grid gap-2.5">
                <Label htmlFor="gramsPerUnit" className="text-base">
                  换算克数 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="gramsPerUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.gramsPerUnit}
                  onChange={(e) => setForm({ ...form, gramsPerUnit: e.target.value })}
                  placeholder="1 单位合多少克，如 斤 = 500"
                  className="h-11 text-base px-4"
                />
                <p className="text-xs text-muted-foreground">
                  驱动全系统斤/克换算（采购规格换算、每斤单价、切配展示）
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="h-11 px-6">
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="h-11 px-6">
              <span aria-live="polite" className="inline-flex items-center">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[440px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {deleteError ? "无法删除" : "确认删除"}
            </DialogTitle>
          </DialogHeader>
          {deleteError ? (
            <div className="grid gap-3">
              <p className="text-muted-foreground text-base">{deleteError.message}</p>
              {deleteError.references && Object.keys(deleteError.references).length > 0 && (
                <ul className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground grid gap-1">
                  {Object.entries(deleteError.references).map(([entity, count]) => (
                    <li key={entity}>
                      {entity}：{count} 条
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-muted-foreground">
                建议改用「停用」：停用后新单据不再可选，历史数据不受影响。
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-base">
              确定要删除单位「{deleteTarget?.name}」吗？此操作不可撤销。
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="h-11 px-6">
              {deleteError ? "知道了" : "取消"}
            </Button>
            {!deleteError && (
              <Button variant="destructive" onClick={handleDelete} className="h-11 px-6">
                删除
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
