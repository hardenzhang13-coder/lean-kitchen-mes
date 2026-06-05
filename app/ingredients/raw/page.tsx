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

const seasons = ["四季", "春", "夏", "秋", "冬"];
const storages = ["冷藏", "常温", "冷冻"];

export default function RawIngredientsPage() {
  const [data, setData] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    alias: "",
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
      const res = await fetch("/api/ingredients");
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
        d.code.toLowerCase().includes(search.toLowerCase()) ||
        (d.alias && d.alias.includes(search))
    );
  }, [data, search]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      code: "",
      name: "",
      alias: "",
      l2Code: "",
      unit: "",
      priceUnit: "",
      purchaseSpec: "",
      season: "四季",
      storage: "冷藏",
    });
    setDialogOpen(true);
  };

  const openEdit = (row: Ingredient) => {
    setEditing(row);
    setForm({
      code: row.code,
      name: row.name,
      alias: row.alias || "",
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
    if (!form.code.trim() || !form.name.trim() || !form.l2Code.trim() || !form.unit.trim() || !form.priceUnit.trim() || !form.storage.trim()) {
      toast.error("请填写所有必填项");
      return;
    }
    try {
      const payload = {
        code: form.code,
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
        await fetch(`/api/ingredients/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("更新成功");
      } else {
        await fetch("/api/ingredients", {
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
      await fetch(`/api/ingredients/${id}`, { method: "DELETE" });
      toast.success("删除成功");
      setDeleteId(null);
      fetchData();
    } catch (e) {
      toast.error("删除失败");
    }
  };

  const renderSelect = (id: string, label: string, value: string, options: string[], onChange: (v: string) => void) => (
    <div className="grid gap-2.5">
      <Label htmlFor={id} className="text-base">{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-11 w-full rounded-md border border-input bg-transparent px-4 py-1 text-base shadow-sm transition-all focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)] focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader title="原料清单" description="食材采购入库、库存管理的基本单位" />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增原料
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索编号、名称或别名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
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
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row, idx) => (
                    <TableRow key={row.id} className="transition-colors hover:bg-muted/40">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{row.code}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.alias || "—"}</TableCell>
                      <TableCell>{row.l2Code}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell>{row.priceUnit}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                          {row.storage}
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">{editing ? "编辑原料" : "新增原料"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-5 py-5">
            <div className="grid gap-2.5">
              <Label htmlFor="code" className="text-base">编号</Label>
              <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如 ING-0001" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="name" className="text-base">名称</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如 带皮五花肉" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="alias" className="text-base">别名</Label>
              <Input id="alias" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} placeholder="可选" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="l2Code" className="text-base">二级分类编号</Label>
              <Input id="l2Code" value={form.l2Code} onChange={(e) => setForm({ ...form, l2Code: e.target.value })} placeholder="如 VEG-LEF" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="unit" className="text-base">计量单位</Label>
              <Input id="unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="如 斤" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="priceUnit" className="text-base">计价单位</Label>
              <Input id="priceUnit" value={form.priceUnit} onChange={(e) => setForm({ ...form, priceUnit: e.target.value })} placeholder="如 斤" className="h-11 text-base px-4" />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="purchaseSpec" className="text-base">采购规格</Label>
              <Input id="purchaseSpec" value={form.purchaseSpec} onChange={(e) => setForm({ ...form, purchaseSpec: e.target.value })} placeholder="如 散称、1.9L*6" className="h-11 text-base px-4" />
            </div>
            {renderSelect("season", "季节限定", form.season, seasons, (v) => setForm({ ...form, season: v }))}
            {renderSelect("storage", "储存方式", form.storage, storages, (v) => setForm({ ...form, storage: v }))}
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
