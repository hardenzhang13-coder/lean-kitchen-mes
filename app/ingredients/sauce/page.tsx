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
  const [form, setForm] = useState({ code: "", name: "", brand: "", recipe: "", storage: "常温", unitPrice: "", unit: "" });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sauce-ingredients");
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
    return data.filter((d) => d.name.includes(search) || d.code.toLowerCase().includes(search.toLowerCase()) || d.brand.includes(search));
  }, [data, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", brand: "", recipe: "", storage: "常温", unitPrice: "", unit: "" });
    setDialogOpen(true);
  };

  const openEdit = (row: Sauce) => {
    setEditing(row);
    setForm({ code: row.code, name: row.name, brand: row.brand, recipe: row.recipe || "", storage: row.storage, unitPrice: String(row.unitPrice), unit: row.unit });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.brand.trim() || !form.storage.trim() || !form.unit.trim()) {
      toast.error("请填写所有必填项");
      return;
    }
    try {
      const payload = { code: form.code, name: form.name, brand: form.brand, recipe: form.recipe || null, storage: form.storage, unitPrice: Number(form.unitPrice) || 0, unit: form.unit };
      if (editing) {
        await fetch(`/api/sauce-ingredients/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("更新成功");
      } else {
        await fetch("/api/sauce-ingredients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
        <PageHeader title="酱料清单" description="复合加工调味半成品" />
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />新增酱料</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索编号、名称或品牌..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <SkeletonTable cols={8} rows={5} /> : (
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
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">暂无数据</TableCell></TableRow>
                ) : filtered.map((row, idx) => (
                  <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.brand}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{row.recipe || "—"}</TableCell>
                    <TableCell>¥{row.unitPrice}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[540px] [&>button]:cursor-pointer">
          <DialogHeader><DialogTitle className="text-lg">{editing ? "编辑酱料" : "新增酱料"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-5 py-5">
            <div className="grid gap-2.5"><Label htmlFor="code" className="text-base">编号</Label><Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如 SAU-0001" className="h-11 text-base px-4" /></div>
            <div className="grid gap-2.5"><Label htmlFor="name" className="text-base">名称</Label><Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 豆瓣酱" className="h-11 text-base px-4" /></div>
            <div className="grid gap-2.5 col-span-2"><Label htmlFor="brand" className="text-base">品牌</Label><Input id="brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="如 郫县豆瓣酱" className="h-11 text-base px-4" /></div>
            <div className="grid gap-2.5 col-span-2"><Label htmlFor="recipe" className="text-base">配方说明</Label><Input id="recipe" value={form.recipe} onChange={(e) => setForm({ ...form, recipe: e.target.value })} placeholder="如 蚕豆、辣椒、盐、小麦粉" className="h-11 text-base px-4" /></div>
            <div className="grid gap-2.5"><Label htmlFor="unitPrice" className="text-base">单价</Label><Input id="unitPrice" type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} placeholder="如 15.00" className="h-11 text-base px-4" /></div>
            <div className="grid gap-2.5"><Label htmlFor="unit" className="text-base">计量单位</Label><Input id="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="如 斤" className="h-11 text-base px-4" /></div>
            <div className="grid gap-2.5 col-span-2">
              <Label htmlFor="storage" className="text-base">储存方式</Label>
              <select id="storage" value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} className="flex h-11 w-full rounded-md border border-input bg-transparent px-4 py-1 text-base shadow-sm transition-all focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)] focus:outline-none">
                {storages.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-11 px-6">取消</Button>
            <Button onClick={handleSubmit} className="h-11 px-6">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px] [&>button]:cursor-pointer">
          <DialogHeader><DialogTitle className="text-lg">确认删除</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-base">确定要删除这条酱料吗？此操作不可撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="h-11 px-6">取消</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="h-11 px-6">删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
