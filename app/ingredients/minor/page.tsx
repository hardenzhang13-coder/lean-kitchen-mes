"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FormField, FormSection } from "@/app/components/form-field";
import { toast } from "sonner";

type MinorIngredient = {
  id: number;
  code: string;
  name: string;
  spec: string | null;
  unitPrice: number;
  unit: string;
  origin: string | null;
  storage: string;
};

const storages = ["冷藏", "常温", "冷冻"];

export default function MinorIngredientsPage() {
  const [data, setData] = useState<MinorIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MinorIngredient | null>(null);
  const [form, setForm] = useState({ name: "", spec: "", unitPrice: "", unit: "10g", origin: "", storage: "冷藏" });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/minor-ingredients");
      setData(await res.json());
    } catch (e) {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return data.filter((d) => d.name.includes(search) || d.code.toLowerCase().includes(search.toLowerCase()));
  }, [data, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", spec: "", unitPrice: "", unit: "10g", origin: "", storage: "冷藏" });
    setDialogOpen(true);
  };

  const openEdit = (row: MinorIngredient) => {
    setEditing(row);
    setForm({ name: row.name, spec: row.spec || "", unitPrice: String(row.unitPrice), unit: row.unit, origin: row.origin || "", storage: row.storage });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.storage.trim()) {
      toast.error("请填写所有必填项");
      return;
    }
    try {
      const payload = { name: form.name, spec: form.spec || null, unitPrice: Number(form.unitPrice) || 0, unit: form.unit || "10g", origin: form.origin || null, storage: form.storage };
      if (editing) {
        await fetch(`/api/minor-ingredients/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("更新成功");
      } else {
        await fetch("/api/minor-ingredients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
      await fetch(`/api/minor-ingredients/${id}`, { method: "DELETE" });
      toast.success("删除成功");
      setDeleteId(null);
      fetchData();
    } catch (e) {
      toast.error("删除失败");
    }
  };

  const selectClass = "flex h-11 w-full rounded-md border border-input bg-transparent px-4 py-1 text-base shadow-sm transition-all focus:border-[#007AFF] focus:shadow-[0_0_0_4px_rgba(0,122,255,0.06)] focus:outline-none";

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader title="小料清单" description="用量极小的增香/去腥/提味食材" />
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />新增小料</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索编号或名称..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
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
                  <TableHead>规格</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>储存方式</TableHead>
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
                    <TableCell className="text-muted-foreground">{row.spec || "—"}</TableCell>
                    <TableCell>¥{row.unitPrice}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell><span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">{row.storage}</span></TableCell>
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
          <DialogHeader><DialogTitle className="text-lg">{editing ? "编辑小料" : "新增小料"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <FormSection title="基础信息">
              <FormField label="编号"><Input value={editing?.code || "系统自动生成"} disabled className="h-11 text-base px-4 bg-muted" /></FormField>
              <FormField label="名称" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 蒜末" className="h-11 text-base px-4" /></FormField>
            </FormSection>
            <FormSection title="规格与价格">
              <FormField label="规格"><Input value={form.spec} onChange={(e) => setForm({ ...form, spec: e.target.value })} placeholder="如 切末" className="h-11 text-base px-4" /></FormField>
              <FormField label="单价" required><Input type="number" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} placeholder="如 2.50" className="h-11 text-base px-4" /></FormField>
              <FormField label="单位" required><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="如 10g" className="h-11 text-base px-4" /></FormField>
              <FormField label="产地/品牌"><Input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder="如 山东" className="h-11 text-base px-4" /></FormField>
            </FormSection>
            <FormSection title="储存信息">
              <FormField label="储存方式" required>
                <select value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} className={selectClass}>
                  {storages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
            </FormSection>
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
          <p className="text-muted-foreground text-base">确定要删除这条小料吗？此操作不可撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="h-11 px-6">取消</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="h-11 px-6">删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
