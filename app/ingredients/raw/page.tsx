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

type Ingredient = {
  id: number;
  code: string;
  name: string;
  alias: string | null;
  l2Code: string;
  unit: string;
  priceUnit: string;
  purchaseSpec: string | null;
  season: string;
  storage: string;
};

type CategoryL1 = {
  id: number;
  code: string;
  name: string;
  children: { id: number; code: string; name: string; parentCode: string }[];
};

const seasons = ["四季", "春", "夏", "秋", "冬"];
const storages = ["冷藏", "常温", "冷冻"];

export default function RawIngredientsPage() {
  const [data, setData] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({
    name: "",
    alias: "",
    l1Code: "",
    l2Code: "",
    unit: "",
    priceUnit: "",
    purchaseSpec: "",
    season: "四季",
    storage: "冷藏",
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ingRes, catRes] = await Promise.all([
        fetch("/api/ingredients"),
        fetch("/api/ingredient-categories"),
      ]);
      setData(await ingRes.json());
      setCategories(await catRes.json());
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
        d.code.toLowerCase().includes(search.toLowerCase()) ||
        (d.alias && d.alias.includes(search))
    );
  }, [data, search]);

  const l2Options = useMemo(() => {
    if (!form.l1Code) return [];
    const l1 = categories.find((c) => c.code === form.l1Code);
    return l1?.children || [];
  }, [form.l1Code, categories]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", alias: "", l1Code: "", l2Code: "", unit: "", priceUnit: "", purchaseSpec: "", season: "四季", storage: "冷藏" });
    setDialogOpen(true);
  };

  const openEdit = (row: Ingredient) => {
    setEditing(row);
    // Find parent L1 code from L2 code
    const parentL1 = categories.find((c) => c.children.some((ch) => ch.code === row.l2Code));
    setForm({
      name: row.name,
      alias: row.alias || "",
      l1Code: parentL1?.code || "",
      l2Code: row.l2Code,
      unit: row.unit,
      priceUnit: row.priceUnit,
      purchaseSpec: row.purchaseSpec || "",
      season: row.season,
      storage: row.storage,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.l2Code.trim() || !form.unit.trim() || !form.priceUnit.trim() || !form.storage.trim()) {
      toast.error("请填写所有必填项");
      return;
    }
    try {
      const payload = {
        name: form.name,
        alias: form.alias || null,
        l2Code: form.l2Code,
        unit: form.unit,
        priceUnit: form.priceUnit,
        purchaseSpec: form.purchaseSpec || null,
        season: form.season,
        storage: form.storage,
      };
      if (editing) {
        await fetch(`/api/ingredients/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("更新成功");
      } else {
        await fetch("/api/ingredients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
      await fetch(`/api/ingredients/${id}`, { method: "DELETE" });
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
        <PageHeader title="原料清单" description="食材采购入库、库存管理的基本单位" />
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />新增原料</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索编号、名称或别名..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <SkeletonTable cols={9} rows={5} /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">序号</TableHead>
                  <TableHead>编号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>别名</TableHead>
                  <TableHead>二级分类</TableHead>
                  <TableHead>计量单位</TableHead>
                  <TableHead>计价单位</TableHead>
                  <TableHead>储存方式</TableHead>
                  <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">暂无数据</TableCell></TableRow>
                ) : filtered.map((row, idx) => (
                  <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.alias || "—"}</TableCell>
                    <TableCell>{row.l2Code}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell>{row.priceUnit}</TableCell>
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
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto [&>button]:cursor-pointer">
          <DialogHeader><DialogTitle className="text-lg">{editing ? "编辑原料" : "新增原料"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            {/* 基础信息 */}
            <FormSection title="基础信息">
              <FormField label="编号">
                <Input value={editing?.code || "系统自动生成"} disabled className="h-11 text-base px-4 bg-muted" />
              </FormField>
              <FormField label="名称" required>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 带皮五花肉" className="h-11 text-base px-4" />
              </FormField>
              <FormField label="别名">
                <Input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} placeholder="常用别名" className="h-11 text-base px-4" />
              </FormField>
            </FormSection>

            {/* 分类信息 */}
            <FormSection title="分类信息">
              <FormField label="一级分类" required>
                <select value={form.l1Code} onChange={(e) => setForm({ ...form, l1Code: e.target.value, l2Code: "" })} className={selectClass}>
                  <option value="">请选择一级分类</option>
                  {categories.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                </select>
              </FormField>
              <FormField label="二级分类" required>
                <select value={form.l2Code} onChange={(e) => setForm({ ...form, l2Code: e.target.value })} className={selectClass} disabled={!form.l1Code}>
                  <option value="">{form.l1Code ? "请选择二级分类" : "请先选择一级分类"}</option>
                  {l2Options.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                </select>
              </FormField>
            </FormSection>

            {/* 规格与单位 */}
            <FormSection title="规格与单位">
              <FormField label="计量单位" required>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="如 斤" className="h-11 text-base px-4" />
              </FormField>
              <FormField label="计价单位" required>
                <Input value={form.priceUnit} onChange={(e) => setForm({ ...form, priceUnit: e.target.value })} placeholder="如 斤" className="h-11 text-base px-4" />
              </FormField>
              <FormField label="采购规格">
                <Input value={form.purchaseSpec} onChange={(e) => setForm({ ...form, purchaseSpec: e.target.value })} placeholder="如 散称、1.9L*6" className="h-11 text-base px-4" />
              </FormField>
            </FormSection>

            {/* 储存信息 */}
            <FormSection title="储存信息">
              <FormField label="季节限定" required>
                <select value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })} className={selectClass}>
                  {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </FormField>
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
          <p className="text-muted-foreground text-base">确定要删除这条原料吗？此操作不可撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="h-11 px-6">取消</Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="h-11 px-6">删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
