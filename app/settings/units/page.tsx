"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
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
import { PageHeader } from "@/app/components/page-header";
import { SkeletonTable } from "@/app/components/skeleton-table";
import { toast } from "sonner";

type Unit = {
  id: number;
  name: string;
  category: string;
};

const categories = [
  { value: "weight", label: "重量" },
  { value: "volume", label: "体积" },
  { value: "count", label: "计数" },
];

export default function UnitsPage() {
  const [data, setData] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Unit | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "weight" });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", category: "weight" });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/units");
      const json = await res.json();
      setData(json);
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

  const filtered = useMemo(() => {
    return data.filter(
      (d) =>
        d.name.includes(search) ||
        d.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const openEdit = (row: Unit) => {
    setEditing(row);
    setEditForm({ name: row.name, category: row.category });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm({ name: "", category: "weight" });
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      toast.error("名称不能为空");
      return;
    }
    try {
      await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      toast.success("创建成功");
      setCreateForm({ name: "", category: "weight" });
      setShowCreate(false);
      fetchData();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) {
      toast.error("名称不能为空");
      return;
    }
    try {
      await fetch(`/api/units/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      toast.success("更新成功");
      closeEdit();
      fetchData();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/units/${id}`, { method: "DELETE" });
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
        <PageHeader showBack title="单位" description="管理重量、体积、计数等单位字典" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索名称或分类..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <SkeletonTable cols={4} rows={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">序号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row, idx) => (
                    <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs">
                          {categories.find((c) => c.value === row.category)?.label || row.category}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {!loading && (
            <>
              {!showCreate ? (
                <button
                  type="button"
                  onClick={() => setShowCreate(true)}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> 新增单位
                </button>
              ) : (
                <div className="rounded-md border p-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2.5">
                      <Label htmlFor="create-name" className="text-base">名称</Label>
                      <Input
                        id="create-name"
                        value={createForm.name}
                        onChange={(e) =>
                          setCreateForm({ ...createForm, name: e.target.value })
                        }
                        placeholder="如 斤"
                        className="h-11 text-base px-4"
                      />
                    </div>
                    <div className="grid gap-2.5">
                      <Label htmlFor="create-category" className="text-base">分类</Label>
                      <Select
                        value={createForm.category}
                        onValueChange={(v) => v && setCreateForm({ ...createForm, category: v })}
                      >
                        <SelectTrigger id="create-category" className="h-11">
                          <SelectValue />
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
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCreate(false);
                        setCreateForm({ name: "", category: "weight" });
                      }}
                    >
                      取消
                    </Button>
                    <Button size="sm" onClick={handleCreate}>保存</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={() => editing && closeEdit()}>
        <DialogContent className="sm:max-w-[540px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">编辑单位</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <div className="grid gap-2.5">
              <Label htmlFor="edit-name" className="text-base">名称</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="如 斤"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="edit-category" className="text-base">分类</Label>
              <Select value={editForm.category} onValueChange={(v) => v && setEditForm({ ...editForm, category: v })}>
                <SelectTrigger id="edit-category" className="h-11">
                  <SelectValue />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} className="h-11 px-6">
              取消
            </Button>
            <Button onClick={handleUpdate} className="h-11 px-6">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">确定要删除这条记录吗？此操作不可撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="h-11 px-6">
              取消
            </Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="h-11 px-6">
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
