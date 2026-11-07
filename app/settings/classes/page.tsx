"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2, Ban, CheckCircle2, ArrowUp, ArrowDown } from "lucide-react";
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
import { SelectField } from "@/app/components/ui/select-field";
import { usePagination, DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
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

/** 后端引用检查返回的引用明细 */
type CategoryReferences = Record<string, number>;

const statusFilters = [
  { value: "all", label: "全部" },
  { value: "active", label: "启用中" },
  { value: "inactive", label: "已停用" },
];

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs text-emerald-600">
      <CheckCircle2 className="h-3 w-3" /> 启用中
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
      <Ban className="h-3 w-3" /> 已停用
    </span>
  );
}

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
    start,
    end,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

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
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader showBack title="食材分类" description="管理食材一级和二级分类体系；被食材引用的分类不可删除/改编号，可停用使新单据不再可选" />
        <Button onClick={openCreateL1}>
          <Plus className="mr-2 h-4 w-4" />
          新增一级分类
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
                      <TableHead>编号</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>说明</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="w-[240px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageL1Items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageL1Items.map((l1, l1Idx) => {
                        const isExpanded = expanded.has(l1.id);
                        return (
                          <L1Rows
                            key={l1.id}
                            l1={l1}
                            l1Idx={l1Idx}
                            baseIndex={(currentPage - 1) * DEFAULT_PAGE_SIZE}
                            isExpanded={isExpanded}
                            onToggleExpand={() => toggleExpand(l1.id)}
                            onCreateL2={() => openCreateL2(l1.code)}
                            onEditL1={() => openEditL1(l1)}
                            onDeleteL1={() => openDelete(l1, "l1")}
                            onEditL2={openEditL2}
                            onDeleteL2={(l2) => openDelete(l2, "l2")}
                            onToggleL1={() => toggleActive(l1, "l1")}
                            onToggleL2={(l2) => toggleActive(l2, "l2")}
                            canMoveL1Up={data.findIndex((d) => d.code === l1.code) > 0}
                            canMoveL1Down={data.findIndex((d) => d.code === l1.code) < data.length - 1}
                            onMoveL1={(dir) => moveL1(l1, dir)}
                            onMoveL2={moveL2}
                            sortDisabled={sortDisabled}
                          />
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
        <DialogContent className="sm:max-w-[560px] [&>button]:cursor-pointer">
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
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** 一级分类行 + 展开后的二级分类行 */
function L1Rows({
  l1,
  l1Idx,
  baseIndex,
  isExpanded,
  onToggleExpand,
  onCreateL2,
  onEditL1,
  onDeleteL1,
  onEditL2,
  onDeleteL2,
  onToggleL1,
  onToggleL2,
  canMoveL1Up,
  canMoveL1Down,
  onMoveL1,
  onMoveL2,
  sortDisabled,
}: {
  l1: L1;
  l1Idx: number;
  baseIndex: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCreateL2: () => void;
  onEditL1: () => void;
  onDeleteL1: () => void;
  onEditL2: (l2: L2) => void;
  onDeleteL2: (l2: L2) => void;
  onToggleL1: () => void;
  onToggleL2: (l2: L2) => void;
  canMoveL1Up: boolean;
  canMoveL1Down: boolean;
  onMoveL1: (dir: -1 | 1) => void;
  onMoveL2: (l2: L2, dir: -1 | 1) => void;
  sortDisabled: boolean;
}) {
  return (
    <>
      <TableRow
        className={`bg-muted/30 transition-colors hover:bg-muted/50 ${!l1.isActive ? "opacity-50" : ""}`}
      >
        <TableCell className="text-muted-foreground">
          {baseIndex + l1Idx + 1}
        </TableCell>
        <TableCell className="font-medium">
          <button
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1 mr-1"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {l1.code}
        </TableCell>
        <TableCell className="font-semibold">{l1.name}</TableCell>
        <TableCell className="text-muted-foreground">
          {l1.description || "—"}
        </TableCell>
        <TableCell>
          <StatusBadge isActive={l1.isActive} />
        </TableCell>
        <TableCell className="text-right">
          <Button variant="ghost" size="icon" aria-label="上移" title={sortDisabled ? "搜索时不可排序" : "上移"} disabled={sortDisabled || !canMoveL1Up} onClick={() => onMoveL1(-1)}>
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="下移" title={sortDisabled ? "搜索时不可排序" : "下移"} disabled={sortDisabled || !canMoveL1Down} onClick={() => onMoveL1(1)}>
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={l1.isActive ? "停用一级分类" : "启用一级分类"}
            onClick={onToggleL1}
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
            title="添加二级分类"
            onClick={onCreateL2}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="编辑一级分类" onClick={onEditL1}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="删除一级分类"
            onClick={onDeleteL1}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </TableCell>
      </TableRow>
      {isExpanded &&
        l1.children.map((l2, l2Idx) => (
          <TableRow
            key={l2.id}
            className={`transition-colors hover:bg-muted/30 ${!l2.isActive || !l1.isActive ? "opacity-50" : ""}`}
          >
            <TableCell className="pl-10 text-muted-foreground text-sm">
              {baseIndex + l1Idx + 1}.{l2Idx + 1}
            </TableCell>
            <TableCell className="pl-10 text-muted-foreground">{l2.code}</TableCell>
            <TableCell className="pl-10">{l2.name}</TableCell>
            <TableCell className="pl-10 text-muted-foreground">
              {l2.description || "—"}
            </TableCell>
            <TableCell className="pl-10">
              <StatusBadge isActive={l2.isActive} />
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" aria-label="上移" title={sortDisabled ? "搜索时不可排序" : "上移"} disabled={sortDisabled || l2Idx === 0} onClick={() => onMoveL2(l2, -1)}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="下移" title={sortDisabled ? "搜索时不可排序" : "下移"} disabled={sortDisabled || l2Idx === l1.children.length - 1} onClick={() => onMoveL2(l2, 1)}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={l2.isActive ? "停用二级分类" : "启用二级分类"}
                onClick={() => onToggleL2(l2)}
              >
                {l2.isActive ? (
                  <Ban className="h-4 w-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
              </Button>
              <Button variant="ghost" size="icon" aria-label="编辑二级分类" onClick={() => onEditL2(l2)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="删除二级分类"
                onClick={() => onDeleteL2(l2)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}
