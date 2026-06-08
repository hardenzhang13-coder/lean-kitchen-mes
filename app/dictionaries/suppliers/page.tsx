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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { SkeletonTable } from "@/app/components/skeleton-table";
import { toast } from "sonner";

type Supplier = {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  remark: string | null;
};

export default function SuppliersPage() {
  const [data, setData] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", phone: "", remark: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/suppliers");
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

  const filtered = useMemo(() => {
    return data.filter(
      (d) =>
        d.name.includes(search) ||
        (d.contact && d.contact.includes(search)) ||
        (d.phone && d.phone.includes(search))
    );
  }, [data, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", contact: "", phone: "", remark: "" });
    setDialogOpen(true);
  };

  const openEdit = (row: Supplier) => {
    setEditing(row);
    setForm({
      name: row.name,
      contact: row.contact || "",
      phone: row.phone || "",
      remark: row.remark || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("名称不能为空");
      return;
    }
    try {
      const payload = {
        name: form.name,
        contact: form.contact || null,
        phone: form.phone || null,
        remark: form.remark || null,
      };
      if (editing) {
        await fetch(`/api/suppliers/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("更新成功");
      } else {
        await fetch("/api/suppliers", {
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
      await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
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
        <PageHeader showBack title="供应商" description="管理采购供应商信息" />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索名称、联系人或电话..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable cols={6} rows={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">序号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>联系人</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row, idx) => (
                    <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>{row.contact || "—"}</TableCell>
                      <TableCell>{row.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {row.remark || "—"}
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[540px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">{editing ? "编辑供应商" : "新增供应商"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <div className="grid gap-2.5">
              <Label htmlFor="name" className="text-base">名称</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="供应商名称"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="contact" className="text-base">联系人</Label>
              <Input
                id="contact"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="可选"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="phone" className="text-base">电话</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="可选"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="remark" className="text-base">备注</Label>
              <Input
                id="remark"
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                placeholder="可选"
                className="h-11 text-base px-4"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-11 px-6">
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
