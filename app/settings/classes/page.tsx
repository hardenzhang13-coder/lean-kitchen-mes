"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2, Ban, CheckCircle2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/app/components/ui/form-controls";
import { Label } from "@/components/ui/label";
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
import { SelectField } from "@/app/components/ui/select-field";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  usePagination,
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { toast } from "sonner";

type L1 = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  children: L2[];
};

type L2 = {
  id: number;
  code: string;
  name: string;
  parentCode: string;
  description: string | null;
  isActive: boolean;
};

/** DataTable 逐行渲染：一级分类 + 展开后的二级分类 */
type DisplayRow =
  | { kind: "l1"; l1: L1; l1Idx: number }
  | { kind: "l2"; l1: L1; l1Idx: number; l2: L2; l2Idx: number };

/** 后端引用检查返回的引用明细 */
type CategoryReferences = Record<string, number>;

const statusFilters = [
  { value: "all", label: "全部" },
  { value: "active", label: "启用中" },
  { value: "inactive", label: "已停用" },
];

export default function ClassesPage() {
  const [data, setData] = useState<L1[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"l1" | "l2">("l1");
  const [editing, setEditing] = useState<L1 | L2 | null>(null);
  const [form, setForm] = useState({ code: "", name: "", parentCode: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: "l1" | "l2"; name: string } | null>(null);
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
        // 设置页需要管理停用分类，拉取全量；业务端默认只返回启用中的
        const res = await fetch("/api/ingredient-categories?includeInactive=1");
        const json = await res.json();
        if (alive) setData(json.data?.items || json.data || []);
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
    return data
      .map((l1) => {
        const l1StatusOk =
          statusFilter === "all" ||
          (statusFilter === "active" ? l1.isActive : !l1.isActive);
        const matchedChildren = l1.children.filter((c) => {
          const cStatusOk =
            statusFilter === "all" ||
            (statusFilter === "active" ? c.isActive : !c.isActive);
          if (!cStatusOk) return false;
          if (!s) return true;
          return c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s);
        });
        const l1Match =
          l1.name.toLowerCase().includes(s) || l1.code.toLowerCase().includes(s);
        if (!l1StatusOk && matchedChildren.length === 0) return null;
        if (s) {
          if (l1Match && l1StatusOk) return l1;
          if (matchedChildren.length) return { ...l1, children: matchedChildren };
          return null;
        }
        return { ...l1, children: matchedChildren };
      })
      .filter(Boolean) as L1[];
  }, [data, search, statusFilter]);

  const {
    currentPage,
    setCurrentPage,
    pageItems: pageL1Items,
    totalPages,
    totalItems,
    pageSize,
    setPageSize,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

  const displayRows = useMemo(() => {
    const rows: DisplayRow[] = [];
    pageL1Items.forEach((l1, l1Idx) => {
      rows.push({ kind: "l1", l1, l1Idx });
      if (expanded.has(l1.id)) {
        l1.children.forEach((l2, l2Idx) => {
          rows.push({ kind: "l2", l1, l1Idx, l2, l2Idx });
        });
      }
    });
    return rows;
  }, [pageL1Items, expanded]);

  const l1Options = useMemo(
    () => data.map((d) => ({ value: d.code, label: d.name, description: d.code })),
    [data]
  );

  const toggleExpand = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const openCreateL1 = () => {
    setDialogType("l1");
    setEditing(null);
    setForm({ code: "", name: "", parentCode: "", description: "" });
    setDialogOpen(true);
  };

  const openCreateL2 = (parentCode: string) => {
    setDialogType("l2");
    setEditing(null);
    setForm({ code: "", name: "", parentCode, description: "" });
    setDialogOpen(true);
  };

  const openEditL1 = (row: L1) => {
    setDialogType("l1");
    setEditing(row);
    setForm({ code: row.code, name: row.name, parentCode: "", description: row.description || "" });
    setDialogOpen(true);
  };

  const openEditL2 = (row: L2) => {
    setDialogType("l2");
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      parentCode: row.parentCode,
      description: row.description || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("编号和名称不能为空");
      return;
    }
    if (dialogType === "l2" && !form.parentCode) {
      toast.error("请选择所属一级分类");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        type: dialogType,
        code: form.code,
        name: form.name,
        parentCode: dialogType === "l2" ? form.parentCode : undefined,
        description: form.description || null,
      };
      const res = editing
        ? await fetch(`/api/ingredient-categories/${editing.id}?type=${dialogType}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/ingredient-categories", {
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

  const toggleActive = async (row: L1 | L2, type: "l1" | "l2") => {
    try {
      const payload =
        type === "l2"
          ? { type, code: row.code, name: row.name, parentCode: (row as L2).parentCode, isActive: !row.isActive }
          : { type, code: row.code, name: row.name, isActive: !row.isActive };
      const res = await fetch(`/api/ingredient-categories/${row.id}?type=${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const moveL1 = async (l1: L1, dir: -1 | 1) => {
    const idx = data.findIndex((d) => d.code === l1.code);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= data.length) return;
    const ids = data.map((d) => d.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setReordering(true);
    try {
      const res = await fetch("/api/ingredient-categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "l1", ids }),
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

  const moveL2 = async (l2: L2, dir: -1 | 1) => {
    const parent = data.find((d) => d.code === l2.parentCode);
    if (!parent) return;
    const children = parent.children;
    const idx = children.findIndex((c) => c.id === l2.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= children.length) return;
    const ids = children.map((c) => c.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setReordering(true);
    try {
      const res = await fetch("/api/ingredient-categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "l2", ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "调整顺序失败");
        return;
      }
      const newChildren = [...children];
      [newChildren[idx], newChildren[target]] = [newChildren[target], newChildren[idx]];
      setData(data.map((d) => (d.code === l2.parentCode ? { ...d, children: newChildren } : d)));
      toast.success("顺序已调整");
    } catch {
      toast.error("调整顺序失败");
    } finally {
      setReordering(false);
    }
  };

  const openDelete = (row: L1 | L2, type: "l1" | "l2") => {
    setDeleteTarget({ id: row.id, type, name: row.name });
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/ingredient-categories/${deleteTarget.id}?type=${deleteTarget.type}`, {
        method: "DELETE",
      });
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
        title="食材分类"
        description="管理食材一级和二级分类体系；被食材引用的分类不可删除/改编号，可停用使新单据不再可选"
        actions={
          <Button onClick={openCreateL1}>
            <Plus className="mr-2 h-4 w-4" />
            新增一级分类
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
          <DataTable<DisplayRow>
            data={displayRows}
            loading={loading}
            onRowClick={(row) =>
              row.kind === "l1" ? openEditL1(row.l1) : openEditL2(row.l2)
            }
            fillHeight
            density="dense"
            tableClassName="min-w-max"
            columns={[
              {
                header: "序号",
                className: "w-[64px]",
                cell: (row) => (
                  <span className="text-muted-foreground">
                    {row.kind === "l1"
                      ? (currentPage - 1) * pageSize + row.l1Idx + 1
                      : `${(currentPage - 1) * pageSize + row.l1Idx + 1}.${row.l2Idx + 1}`}
                  </span>
                ),
              },
              {
                header: "编号",
                className: "w-[150px]",
                cell: (row) =>
                  row.kind === "l1" ? (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <button
                        type="button"
                        aria-label={expanded.has(row.l1.id) ? `收起 ${row.l1.name}` : `展开 ${row.l1.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleExpand(row.l1.id);
                        }}
                      >
                        {expanded.has(row.l1.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      {row.l1.code}
                    </span>
                  ) : (
                    <span className="inline-block pl-6 text-muted-foreground">
                      {row.l2.code}
                    </span>
                  ),
              },
              {
                header: "名称",
                className: "w-[160px]",
                cell: (row) =>
                  row.kind === "l1" ? (
                    <span className="font-semibold">{row.l1.name}</span>
                  ) : (
                    <span className="inline-block pl-6">{row.l2.name}</span>
                  ),
              },
              {
                header: "说明",
                className: "w-[220px]",
                cell: (row) =>
                  row.kind === "l1" ? (
                    <span className="whitespace-nowrap text-muted-foreground">
                      {row.l1.description || "—"}
                    </span>
                  ) : (
                    <span className="inline-block whitespace-nowrap pl-6 text-muted-foreground">
                      {row.l2.description || "—"}
                    </span>
                  ),
              },
              {
                header: "状态",
                className: "w-[110px]",
                cell: (row) => (
                  <StatusBadge
                    status={
                      (row.kind === "l1" ? row.l1 : row.l2).isActive ? "启用中" : "已停用"
                    }
                    variant={
                      (row.kind === "l1" ? row.l1 : row.l2).isActive ? "success" : "neutral"
                    }
                    className={row.kind === "l2" ? "ml-6" : undefined}
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
              totalLabel: formatPageSummary(currentPage, pageSize, totalItems, "一级分类"),
              showPageSize: true,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{ title: "暂无数据" }}
            rowActions={(row) => {
              if (row.kind === "l1") {
                const l1 = row.l1;
                const dataIdx = data.findIndex((d) => d.code === l1.code);
                return (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`上移 ${l1.name}`}
                      title={sortDisabled ? "搜索时不可排序" : "上移"}
                      disabled={sortDisabled || dataIdx <= 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveL1(l1, -1);
                      }}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`下移 ${l1.name}`}
                      title={sortDisabled ? "搜索时不可排序" : "下移"}
                      disabled={sortDisabled || dataIdx >= data.length - 1 || dataIdx < 0}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveL1(l1, 1);
                      }}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={l1.isActive ? `停用一级分类 ${l1.name}` : `启用一级分类 ${l1.name}`}
                      title={l1.isActive ? "停用" : "启用"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleActive(l1, "l1");
                      }}
                    >
                      {l1.isActive ? (
                        <Ban className="h-4 w-4 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`为 ${l1.name} 添加二级分类`}
                      title="添加二级分类"
                      onClick={(event) => {
                        event.stopPropagation();
                        openCreateL2(l1.code);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`编辑一级分类 ${l1.name}`}
                      title="编辑一级分类"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditL1(l1);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </>
                );
              }

              const l2 = row.l2;
              return (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`上移 ${l2.name}`}
                    title={sortDisabled ? "搜索时不可排序" : "上移"}
                    disabled={sortDisabled || row.l2Idx === 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveL2(l2, -1);
                    }}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`下移 ${l2.name}`}
                    title={sortDisabled ? "搜索时不可排序" : "下移"}
                    disabled={sortDisabled || row.l2Idx === row.l1.children.length - 1}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveL2(l2, 1);
                    }}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={l2.isActive ? `停用二级分类 ${l2.name}` : `启用二级分类 ${l2.name}`}
                    title={l2.isActive ? "停用" : "启用"}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleActive(l2, "l2");
                    }}
                  >
                    {l2.isActive ? (
                      <Ban className="h-4 w-4 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`编辑二级分类 ${l2.name}`}
                    title="编辑二级分类"
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditL2(l2);
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AppDialogContent size="form" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editing
                ? `编辑${dialogType === "l1" ? "一级" : "二级"}分类`
                : `新增${dialogType === "l1" ? "一级" : "二级"}分类`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            {dialogType === "l2" && (
              <div className="grid gap-2.5">
                <Label htmlFor="parentCode" className="text-base">所属一级分类</Label>
                <SelectTileMode
                  options={l1Options}
                  value={form.parentCode}
                  onChange={(v) => setForm({ ...form, parentCode: v })}
                  placeholder="请选择一级分类"
                  title="选择所属一级分类"
                  searchPlaceholder="搜索一级分类..."
                  required
                />
              </div>
            )}
            <div className="grid gap-2.5">
              <Label htmlFor="code" className="text-base">编号</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={dialogType === "l1" ? "如 VEG" : "如 VEG-LEF"}
                className="h-11 text-base px-4"
              />
              {editing && (
                <p className="text-xs text-muted-foreground">
                  {dialogType === "l1"
                    ? "修改编号将同步更新其下二级分类的归属"
                    : "被食材引用后不可修改编号；如不再使用请停用"}
                </p>
              )}
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="name" className="text-base">名称</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={dialogType === "l1" ? "如 蔬菜" : "如 叶菜"}
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
                  openDelete(editing, dialogType);
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
              确定要删除这条{deleteTarget?.type === "l1" ? "一级" : "二级"}分类吗？
              {deleteTarget?.type === "l1" && " 将同时删除其下的所有二级分类。"}
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
