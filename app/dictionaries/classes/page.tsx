"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: "l1" | "l2" } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ingredient-categories");
      const json = await res.json();
      setData(json);
    } catch (e) {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const l1Options = useMemo(() => data.map((d) => ({ code: d.code, name: d.name })), [data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    return data
      .map((l1) => {
        const l1Match =
          l1.name.includes(search) || l1.code.toLowerCase().includes(search.toLowerCase());
        const matchedChildren = l1.children.filter(
          (c) =>
            c.name.includes(search) || c.code.toLowerCase().includes(search.toLowerCase())
        );
        if (l1Match) return l1;
        if (matchedChildren.length) return { ...l1, children: matchedChildren };
        return null;
      })
      .filter(Boolean) as L1[];
  }, [data, search]);

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
    try {
      if (editing) {
        await fetch(`/api/ingredient-categories/${editing.id}?type=${dialogType}`, {
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
        toast.success("更新成功");
      } else {
        await fetch("/api/ingredient-categories", {
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
        toast.success("创建成功");
      }
      setDialogOpen(false);
      fetchData();
    } catch (e) {
      toast.error("操作失败");
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
    } catch (e) {
      toast.error("删除失败");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">食材分类</h1>
          <p className="text-muted-foreground">管理食材一级和二级分类体系</p>
        </div>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>编号</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>说明</TableHead>
                <TableHead className="w-[180px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((l1) => {
                  const isExpanded = expanded.has(l1.id);
                  return (
                    <>
                      <TableRow key={`l1-${l1.id}`} className="bg-muted/30">
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
                          <Button variant="ghost" size="icon" onClick={() => openEditL1(l1)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget({ id: l1.id, type: "l1" })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded &&
                        l1.children.map((l2) => (
                          <TableRow key={`l2-${l2.id}`}>
                            <TableCell className="pl-10 text-muted-foreground">{l2.code}</TableCell>
                            <TableCell>{l2.name}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {l2.description || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => openEditL2(l2)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing
                ? `编辑${dialogType === "l1" ? "一级" : "二级"}分类`
                : `新增${dialogType === "l1" ? "一级" : "二级"}分类`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {dialogType === "l2" && (
              <div className="grid gap-2">
                <Label htmlFor="parentCode">所属一级分类</Label>
                <select
                  id="parentCode"
                  value={form.parentCode}
                  onChange={(e) => setForm({ ...form, parentCode: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">请选择</option>
                  {l1Options.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.name} ({opt.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="code">编号</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={dialogType === "l1" ? "如 VEG" : "如 VEG-LEF"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={dialogType === "l1" ? "如 蔬菜" : "如 叶菜"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">说明</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="可选"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            确定要删除这条{deleteTarget?.type === "l1" ? "一级" : "二级"}分类吗？
            {deleteTarget?.type === "l1" && " 将同时删除其下的所有二级分类。"}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
