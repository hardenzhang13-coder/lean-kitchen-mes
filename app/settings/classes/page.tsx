"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
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
import { PageHeader } from "@/app/components/page-header";
import { SkeletonTable } from "@/app/components/skeleton-table";
import { Pagination } from "@/app/components/pagination";
import { usePagination, DEFAULT_PAGE_SIZE } from "@/app/lib/use-pagination";
import { TileSelect } from "@/app/components/tile-select";
import { toast } from "sonner";

type L1 = {
  id: number;
  code: string;
  name: string;
  children: L2[];
};

type L2 = {
  id: number;
  code: string;
  name: string;
  parentCode: string;
  description: string | null;
};

export default function ClassesPage() {
  const [data, setData] = useState<L1[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"l1" | "l2">("l1");
  const [editing, setEditing] = useState<L1 | L2 | null>(null);
  const [form, setForm] = useState({ code: "", name: "", parentCode: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: "l1" | "l2" } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ingredient-categories");
      const json = await res.json();
      setData(json);
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
    if (!s) return data;
    return data
      .map((l1) => {
        const l1Match =
          l1.name.toLowerCase().includes(s) || l1.code.toLowerCase().includes(s);
        const matchedChildren = l1.children.filter(
          (c) =>
            c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s)
        );
        if (l1Match) return l1;
        if (matchedChildren.length) return { ...l1, children: matchedChildren };
        return null;
      })
      .filter(Boolean) as L1[];
  }, [data, search]);

  const {
    currentPage,
    setCurrentPage,
    pageItems: pageL1Items,
    totalPages,
    totalItems,
    start,
    end,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, setCurrentPage]);

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
    setForm({ code: row.code, name: row.name, parentCode: "", description: "" });
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
      if (editing) {
        const res = await fetch(`/api/ingredient-categories/${editing.id}?type=${dialogType}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: dialogType,
            code: form.code,
            name: form.name,
            parentCode: dialogType === "l2" ? form.parentCode : undefined,
            description: form.description || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "更新失败");
          return;
        }
        toast.success("更新成功");
      } else {
        const res = await fetch("/api/ingredient-categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: dialogType,
            code: form.code,
            name: form.name,
            parentCode: dialogType === "l2" ? form.parentCode : undefined,
            description: form.description || null,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "创建失败");
          return;
        }
        toast.success("创建成功");
      }
      setDialogOpen(false);
      fetchData();
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/ingredient-categories/${deleteTarget.id}?type=${deleteTarget.type}`, {
        method: "DELETE",
      });
      toast.success("删除成功");
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader showBack title="食材分类" description="管理食材一级和二级分类体系" />
        <Button onClick={openCreateL1}>
          <Plus className="mr-2 h-4 w-4" />
          新增一级分类
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索编号或名称..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable cols={5} rows={DEFAULT_PAGE_SIZE} />
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
                      <TableHead className="w-[180px] text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageL1Items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          暂无数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageL1Items.map((l1, l1Idx) => {
                        const isExpanded = expanded.has(l1.id);
                        return (
                          <>
                            <TableRow
                              key={`l1-${l1.id}`}
                              className="bg-muted/30 transition-colors hover:bg-muted/50"
                            >
                              <TableCell className="text-muted-foreground">
                                {(currentPage - 1) * DEFAULT_PAGE_SIZE + l1Idx + 1}
                              </TableCell>
                              <TableCell className="font-medium">
                                <button
                                  onClick={() => toggleExpand(l1.id)}
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
                              <TableCell className="text-muted-foreground">—</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" onClick={() => openCreateL2(l1.code)}>
                                  <Plus className="h-3 w-3 mr-1" />
                                  二级
                                </Button>
                                <Button variant="ghost" size="icon" aria-label="编辑一级分类" onClick={() => openEditL1(l1)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="删除一级分类"
                                  onClick={() => setDeleteTarget({ id: l1.id, type: "l1" })}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                            {isExpanded &&
                              l1.children.map((l2, l2Idx) => (
                                <TableRow
                                  key={`l2-${l2.id}`}
                                  className="transition-colors hover:bg-muted/30"
                                >
                                  <TableCell className="pl-10 text-muted-foreground text-sm">
                                    {(currentPage - 1) * DEFAULT_PAGE_SIZE + l1Idx + 1}.{l2Idx + 1}
                                  </TableCell>
                                  <TableCell className="pl-10 text-muted-foreground">{l2.code}</TableCell>
                                  <TableCell className="pl-10">{l2.name}</TableCell>
                                  <TableCell className="pl-10 text-muted-foreground">
                                    {l2.description || "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" aria-label="编辑二级分类" onClick={() => openEditL2(l2)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      aria-label="删除二级分类"
                                      onClick={() => setDeleteTarget({ id: l2.id, type: "l2" })}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </>
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
        <DialogContent className="sm:max-w-[540px] [&>button]:cursor-pointer">
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
                <TileSelect
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

      <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除这条{deleteTarget?.type === "l1" ? "一级" : "二级"}分类吗？
            {deleteTarget?.type === "l1" && " 将同时删除其下的所有二级分类。"}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="h-11 px-6">
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} className="h-11 px-6">
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
