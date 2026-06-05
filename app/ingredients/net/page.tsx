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

type NetIngredient = {
  id: number;
  code: string;
  name: string;
  sourceIngredientId: number;
  spec: string | null;
  yieldRate: number;
  unitPrice: number;
  unit: string;
  l2Code: string;
  storage: string;
  sourceIngredient?: { id: number; name: string };
};

type RawIngredient = { id: number; name: string };

const storages = ["冷藏", "常温", "冷冻"];

export default function NetIngredientsPage() {
  const [data, setData] = useState<NetIngredient[]>([]);
  const [rawIngredients, setRawIngredients] = useState<RawIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NetIngredient | null>(null);
  const [form, setForm] = useState({
    code: "", name: "", sourceIngredientId: "", spec: "", yieldRate: "", unitPrice: "", unit: "500g", l2Code: "", storage: "冷藏",
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [netRes, rawRes] = await Promise.all([
        fetch("/api/net-ingredients"),
        fetch("/api/ingredients"),
      ]);
      const netJson = await netRes.json();
      const rawJson = await rawRes.json();
      setData(netJson);
      setRawIngredients(rawJson);
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
        d.code.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name: "", sourceIngredientId: "", spec: "", yieldRate: "", unitPrice: "", unit: "500g", l2Code: "", storage: "冷藏" });
    setDialogOpen(true);
  };

  const openEdit = (row: NetIngredient) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      sourceIngredientId: String(row.sourceIngredientId),
      spec: row.spec || "",
      yieldRate: String(row.yieldRate),
      unitPrice: String(row.unitPrice),
      unit: row.unit,
      l2Code: row.l2Code,
      storage: row.storage,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.sourceIngredientId || !form.l2Code.trim() || !form.storage.trim()) {
      toast.error("请填写所有必填项");
      return;
    }
    try {
      const payload = {
        code: form.code,
        name: form.name,
        sourceIngredientId: Number(form.sourceIngredientId),
        spec: form.spec || null,
        yieldRate: Number(form.yieldRate) || 0,
        unitPrice: Number(form.unitPrice) || 0,
        unit: form.unit || "500g",
        l2Code: form.l2Code,
        storage: form.storage,
      };
      if (editing) {
        await fetch(`/api/net-ingredients/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("更新成功");
      } else {
        await fetch("/api/net-ingredients", {
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
      await fetch(`/api/net-ingredients/${id}`, { method: "DELETE" });
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
        <PageHeader title="净料清单" description="原料经初加工后的规格化半成品" />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增净料
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索编号或名称..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable cols={9} rows={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">序号</TableHead>
                  <TableHead>编号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>来源原料</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>出成率</TableHead>
                  <TableHead>净料单价</TableHead>
                  <TableHead>储存方式</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">暂无数据</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row, idx) => (
                    <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.sourceIngredient?.name || row.sourceIngredientId}</TableCell>
                      <TableCell>{row.spec || "—"}</TableCell>
                      <TableCell>{row.yieldRate}%</TableCell>
                      <TableCell>¥{row.unitPrice}</TableCell>
                      <TableCell><span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">{row.storage}</span></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto [&>button]:cursor-pointer">
          <DialogHeader><DialogTitle className="text-lg">{editing ? "编辑净料" : "新增净料"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-5 py-5">
            <div className="grid gap-2.5">
              <Label htmlFor="code" className="text-base">编号</Label>
              <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如 PRD-0001" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="name" className="text-base">名称</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 去皮五花肉片" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5 col-span-2">
              <Label htmlFor="sourceIngredientId" className="text-base">来源原料</Label>
              <select id="sourceIngredientId" value={form.sourceIngredientId} onChange={(e) => setForm({ ...form, sourceIngredientId: e.target.value })} className="flex h-11 w-full rounded-md border border-input bg-transparent px-4 py-1 text-base shadow-sm transition-all focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)] focus:outline-none">
                <option value="">请选择来源原料</option>
                {rawIngredients.map((ri) => (
                  <option key={ri.id} value={ri.id}>{ri.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="spec" className="text-base">规格</Label>
              <Input id="spec" value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} placeholder="如 0.2cm厚片" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="yieldRate" className="text-base">出成率 (%)</Label>
              <Input id="yieldRate" type="number" value={form.yieldRate} onChange={(e) => setForm({ ...form, yieldRate: e.target.value })} placeholder="如 85" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="unitPrice" className="text-base">净料单价</Label>
              <Input id="unitPrice" type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} placeholder="如 25.00" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="unit" className="text-base">净料单位</Label>
              <Input id="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="如 500g" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="l2Code" className="text-base">二级分类</Label>
              <Input id="l2Code" value={form.l2Code} onChange={(e) => setForm({ ...form, l2Code: e.target.value })} placeholder="如 VEG-LEF" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
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
          <p className="text-muted-foreground text-base">确定要删除这条净料吗？此操作不可撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="h-11 px-6">取消</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="h-11 px-6">删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
