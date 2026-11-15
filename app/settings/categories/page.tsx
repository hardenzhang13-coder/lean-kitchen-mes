"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, Ban, CheckCircle2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/app/components/ui/form-controls";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/app/components/ui/select-field";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageHeader } from "@/app/components/ui/page-header";
import { DataTable } from "@/app/components/ui/data-table";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  usePagination,
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
import { toast } from "sonner";

type Category = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

/** 后端引用检查返回的引用明细 */
type CategoryReferences = Record<string, number>;

const statusFilters = [
  { value: "all", label: "全部" },
  { value: "active", label: "启用中" },
  { value: "inactive", label: "已停用" },
];

function EmptyValue() {
  return <span className="text-muted-foreground">—</span>;
}

export default function CategoriesPage() {
  const [data, setData] = useState<Category[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<{ message: string; references?: CategoryReferences } | null>(null);
  const [reordering, setReordering] = useState(false);

  // 排序仅在未搜索时可用（搜索会隐藏部分行，上下移动语义不明确）
  const sortDisabled = !!search.trim() || reordering;

  const refresh = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        // 设置页需要管理停用类别，拉取全量；业务端默认只返回启用中的
        const res = await fetch("/api/dish-categories?page=1&pageSize=100&includeInactive=1");
        const json = await res.json();
        if (alive) setData(json.data || []);
      } catch {
        if (alive) toast.error("获取数据失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data.filter((d) => {
      if (statusFilter === "active" && !d.isActive) return false;
      if (statusFilter === "inactive" && d.isActive) return false;
      if (!s) return true;
      return (
        d.name.toLowerCase().includes(s) ||
        d.code.toLowerCase().includes(s)
      );
    });
  }, [data, search, statusFilter]);

  const {
    currentPage,
    setCurrentPage,
    pageItems,
    totalPages,
    totalItems,
    pageSize,
    setPageSize,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

  const moveRow = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= data.length) return;
    const ids = data.map((d) => d.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setReordering(true);
    try {
      const res = await fetch("/api/dish-categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "调整顺序失败");
        return;
      }
      const newData = [...data];
      [newData[idx], newData[target]] = [newData[target], newData[idx]];
      setData(newData);
      toast.success("顺序已调整");
    } catch {
      toast.error("调整顺序失败");
    } finally {
      setReordering(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (row: Category) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      description: row.description || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("编号和名称不能为空");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description || null,
      };
      const res = editing
        ? await fetch(`/api/dish-categories/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/dish-categories", {
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
      setDialogOpen(false);
      refresh();
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row: Category) => {
    try {
      const res = await fetch(`/api/dish-categories/${row.id}`, {
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
      refresh();
    } catch {
      toast.error("操作失败");
    }
  };

  const openDelete = (row: Category) => {
    setDeleteTarget(row);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/dish-categories/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        // 被引用时展示后端返回的引用明细，引导用户改停用
        setDeleteError({ message: json.error || "删除失败", references: json.references });
        return;
      }
      toast.success("删除成功");
      setDeleteTarget(null);
      refresh();
    } catch {
      setDeleteError({ message: "删除失败，请稍后重试" });
    }
  };

  return (
    <PageShell variant="workspace">
      <PageHeader
        showBack
        title="菜品类别"
        description="管理菜品分类字典；被菜品引用的类别不可删除/改编号，可停用使新单据不再可选"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增
          </Button>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0 pb-0">
          <ListToolbar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setCurrentPage(1);
            }}
            searchPlaceholder="搜索编号或名称..."
            onReset={() => {
              setSearch("");
              setStatusFilter("all");
              setCurrentPage(1);
            }}
            hasFilters={statusFilter !== "all"}
          >
            <SelectField
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
              options={statusFilters}
              className="w-[160px]"
            />
          </ListToolbar>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <DataTable<Category>
            data={pageItems}
            loading={loading}
            onRowClick={openEdit}
            fillHeight
            density="dense"
            tableClassName="min-w-max"
            columns={[
              {
                header: "序号",
                className: "w-[48px]",
                cell: (_, rowIdx) => (
                  <span className="text-muted-foreground">
                    {(currentPage - 1) * pageSize + rowIdx + 1}
                  </span>
                ),
              },
              {
                header: "编号",
                className: "w-[110px]",
                cell: (row) => <span className="font-medium">{row.code}</span>,
              },
              {
                header: "名称",
                className: "w-[150px]",
                cell: (row) => row.name,
              },
              {
                header: "说明",
                className: "w-[220px]",
                cell: (row) =>
                  row.description ? (
                    <span className="whitespace-nowrap text-muted-foreground">
                      {row.description}
                    </span>
                  ) : (
                    <EmptyValue />
                  ),
              },
              {
                header: "状态",
                className: "w-[100px]",
                cell: (row) => (
                  <StatusBadge
                    status={row.isActive ? "启用中" : "已停用"}
                    variant={row.isActive ? "success" : "neutral"}
                  />
                ),
              },
            ]}
            pagination={{
              currentPage,
              totalPages,
              totalItems,
              pageSize,
              onPageChange: setCurrentPage,
              totalLabel: formatPageSummary(currentPage, pageSize, totalItems, "菜品类别"),
              showPageSize: true,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{ title: "暂无数据" }}
            rowActions={(row) => {
              const dataIdx = data.findIndex((d) => d.id === row.id);
              return (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`上移 ${row.name}`}
                    title={sortDisabled ? "搜索时不可排序" : "上移"}
                    disabled={sortDisabled || dataIdx <= 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveRow(dataIdx, -1);
                    }}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`下移 ${row.name}`}
                    title={sortDisabled ? "搜索时不可排序" : "下移"}
                    disabled={sortDisabled || dataIdx >= data.length - 1 || dataIdx < 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveRow(dataIdx, 1);
                    }}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={row.isActive ? `停用菜品类别 ${row.name}` : `启用菜品类别 ${row.name}`}
                    title={row.isActive ? "停用" : "启用"}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleActive(row);
                    }}
                  >
                    {row.isActive ? (
                      <Ban className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`编辑菜品类别 ${row.name}`}
                    title="编辑菜品类别"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEdit(row);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              );
            }}
          />
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AppDialogContent size="form" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">{editing ? "编辑菜品类别" : "新增菜品类别"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <div className="grid gap-2.5">
              <Label htmlFor="code" className="text-base">编号</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="如 PORK"
                className="h-11 text-base px-4"
              />
              {editing && (
                <p className="text-xs text-muted-foreground">
                  被菜品引用后不可修改编号；如不再使用请停用
                </p>
              )}
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="name" className="text-base">名称</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如 猪肉类"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="description" className="text-base">说明</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="可选"
                className="h-11 text-base px-4"
              />
            </div>
          </div>
          <DialogFooter>
            {editing && (
              <Button
                variant="destructive"
                className="h-11 px-6 sm:mr-auto"
                onClick={() => {
                  setDialogOpen(false);
                  openDelete(editing);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-11 px-6">
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="h-11 px-6">
              <span aria-live="polite" className="inline-flex items-center">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </span>
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
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
              确定要删除菜品类别「{deleteTarget?.name}」吗？此操作不可撤销。
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
        </AppDialogContent>
      </Dialog>
    </PageShell>
  );
}
