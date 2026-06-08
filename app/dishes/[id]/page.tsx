"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Save, Trash2, ArrowLeft, Plus, Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
import { IngredientPicker } from "@/app/components/ingredient-picker";
import { ProcessTimeline } from "@/app/components/process-timeline";
import { FormField, FormSection } from "@/app/components/form-field";
import { toast } from "sonner";

type DishDetail = {
  id: number;
  code: string;
  name: string;
  intro: string | null;
  categoryId: number;
  cuisine: string | null;
  technique: string | null;
  taste: string | null;
  portion: string;
  season: string;
  meatType: string | null;
  cost: number | null;
  status: string;
  operator: string | null;
  category?: { id: number; code: string; name: string };
  netDetails: Array<any>;
  seasoningDetails: Array<any>;
  sauceDetails: Array<any>;
  processes: Array<any>;
};

const cuisineOptions = [
  { value: "川菜", label: "川菜" },
  { value: "粤菜", label: "粤菜" },
  { value: "湘菜", label: "湘菜" },
  { value: "鲁菜", label: "鲁菜" },
  { value: "苏菜", label: "苏菜" },
  { value: "浙菜", label: "浙菜" },
  { value: "闽菜", label: "闽菜" },
  { value: "徽菜", label: "徽菜" },
  { value: "家常菜", label: "家常菜" },
];

const techniqueOptions = [
  { value: "爆炒", label: "爆炒" },
  { value: "红烧", label: "红烧" },
  { value: "清蒸", label: "清蒸" },
  { value: "炖煮", label: "炖煮" },
  { value: "煎炸", label: "煎炸" },
  { value: "凉拌", label: "凉拌" },
  { value: "干锅", label: "干锅" },
  { value: "烧烤", label: "烧烤" },
  { value: "卤制", label: "卤制" },
  { value: "煲汤", label: "煲汤" },
  { value: "烩", label: "烩" },
  { value: "熘", label: "熘" },
  { value: "扒", label: "扒" },
  { value: "焗", label: "焗" },
];

const tasteOptions = [
  { value: "麻辣", label: "麻辣" },
  { value: "咸鲜", label: "咸鲜" },
  { value: "酸甜", label: "酸甜" },
  { value: "酸辣", label: "酸辣" },
  { value: "香辣", label: "香辣" },
  { value: "清淡", label: "清淡" },
  { value: "酱香", label: "酱香" },
  { value: "蒜香", label: "蒜香" },
  { value: "椒盐", label: "椒盐" },
  { value: "糖醋", label: "糖醋" },
  { value: "鱼香", label: "鱼香" },
  { value: "蚝油", label: "蚝油" },
];

const meatTypeOptions = [
  { value: "荤菜", label: "荤菜" },
  { value: "素菜", label: "素菜" },
  { value: "小荤菜", label: "小荤菜" },
];

const seasonOptions = ["四季", "春", "夏", "秋", "冬"].map((s) => ({ value: s, label: s }));
const portionOptions = ["正餐份量", "小份", "大份", "例份"].map((s) => ({ value: s, label: s }));

type BomDraft = {
  main: Array<{ netIngId: string; amountG: string; spec: string }>;
  support: Array<{ netIngId: string; amountG: string; spec: string }>;
  minor: Array<{ sourceId: string; amountG: string; brand: string }>;
  seasoning: Array<{ sourceId: string; amountG: string; brand: string }>;
  sauce: Array<{ sauceId: string; amountG: string; brand: string }>;
};

export default function DishDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dishId = Number(params.id);

  const [dish, setDish] = useState<DishDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [netIngredients, setNetIngredients] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [minorIngredients, setMinorIngredients] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [seasonings, setSeasonings] = useState<Array<{ id: number; code: string; name: string; brand: string }>>([]);
  const [sauces, setSauces] = useState<Array<{ id: number; code: string; name: string }>>([]);

  const [editBasicOpen, setEditBasicOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const [activeBomTab, setActiveBomTab] = useState<"main" | "support" | "minor" | "seasoning" | "sauce">("main");
  const [bomDraft, setBomDraft] = useState<BomDraft>({ main: [], support: [], minor: [], seasoning: [], sauce: [] });
  const [bomEditing, setBomEditing] = useState(false);

  const fetchDish = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dishes/${dishId}`);
      const data = await res.json();
      setDish(data);
    } catch {
      toast.error("获取菜品详情失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchRefs = async () => {
    const [cRes, nRes, mRes, sRes, saRes] = await Promise.all([
      fetch("/api/dish-categories"),
      fetch("/api/net-ingredients"),
      fetch("/api/minor-ingredients"),
      fetch("/api/seasoning-ingredients"),
      fetch("/api/sauce-ingredients"),
    ]);
    setCategories(await cRes.json());
    setNetIngredients(await nRes.json());
    setMinorIngredients(await mRes.json());
    setSeasonings(await sRes.json());
    setSauces(await saRes.json());
  };

  useEffect(() => {
    fetchDish();
    fetchRefs();
  }, [dishId]);

  useEffect(() => {
    if (dish) {
      setEditForm({
        name: dish.name,
        intro: dish.intro || "",
        categoryId: String(dish.categoryId),
        cuisine: dish.cuisine || "",
        technique: dish.technique || "",
        taste: dish.taste || "",
        portion: dish.portion,
        season: dish.season,
        meatType: dish.meatType || "",
      });
    }
  }, [dish]);

  const handleUpdateBasic = async () => {
    if (!editForm.name.trim()) { toast.error("菜品名称不能为空"); return; }
    if (!editForm.categoryId) { toast.error("请选择菜品类别"); return; }
    if (!editForm.cuisine) { toast.error("请选择菜系"); return; }
    if (!editForm.technique) { toast.error("请选择做法"); return; }
    if (!editForm.taste) { toast.error("请选择口味"); return; }
    if (!editForm.meatType) { toast.error("请选择荤素类型"); return; }

    try {
      await fetch(`/api/dishes/${dishId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          intro: editForm.intro,
          categoryId: Number(editForm.categoryId),
          cuisine: editForm.cuisine,
          technique: editForm.technique,
          taste: editForm.taste,
          portion: editForm.portion,
          season: editForm.season,
          meatType: editForm.meatType,
        }),
      });
      toast.success("更新成功");
      setEditBasicOpen(false);
      fetchDish();
    } catch {
      toast.error("更新失败");
    }
  };

  const handleUpdateBom = async () => {
    const netDetails = [
      ...bomDraft.main
        .filter((x: any) => x.netIngId && x.amountG)
        .map((x: any) => ({ role: "main", netIngId: Number(x.netIngId), amountG: Number(x.amountG), spec: x.spec || null })),
      ...bomDraft.support
        .filter((x: any) => x.netIngId && x.amountG)
        .map((x: any) => ({ role: "support", netIngId: Number(x.netIngId), amountG: Number(x.amountG), spec: x.spec || null })),
    ];
    const seasoningDetails = [
      ...bomDraft.minor
        .filter((x: any) => x.sourceId && x.amountG)
        .map((x: any) => ({ type: "minor", sourceId: Number(x.sourceId), amountG: Number(x.amountG), brand: x.brand || null })),
      ...bomDraft.seasoning
        .filter((x: any) => x.sourceId && x.amountG)
        .map((x: any) => ({ type: "seasoning", sourceId: Number(x.sourceId), amountG: Number(x.amountG), brand: x.brand || null })),
    ];
    const sauceDetails = bomDraft.sauce
      .filter((x: any) => x.sauceId && x.amountG)
      .map((x: any) => ({ sauceId: Number(x.sauceId), amountG: Number(x.amountG), brand: x.brand || null }));

    try {
      await fetch(`/api/dishes/${dishId}/bom`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ netDetails, seasoningDetails, sauceDetails }),
      });
      toast.success("BOM 保存成功");
      setBomEditing(false);
      fetchDish();
    } catch {
      toast.error("保存失败");
    }
  };

  const handleUpdateProcesses = async (steps: any[]) => {
    try {
      await fetch(`/api/dishes/${dishId}/processes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processes: steps }),
      });
      toast.success("工艺保存成功");
      fetchDish();
    } catch {
      toast.error("保存失败");
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定删除这道菜吗？此操作不可撤销。")) return;
    try {
      await fetch(`/api/dishes/${dishId}`, { method: "DELETE" });
      toast.success("删除成功");
      router.push("/dishes");
    } catch {
      toast.error("删除失败");
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/dishes/${dishId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dish?.name,
          categoryId: dish?.categoryId,
          status: newStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "操作失败");
        return;
      }
      toast.success(newStatus === "published" ? "已发布" : "已撤回");
      fetchDish();
    } catch {
      toast.error("操作失败");
    }
  };

  const startBomEdit = () => {
    if (!dish) return;
    setBomDraft({
      main: dish.netDetails
        .filter((d: any) => d.role === "main")
        .map((d: any) => ({ netIngId: String(d.netIngId), amountG: String(d.amountG), spec: d.spec || "" })),
      support: dish.netDetails
        .filter((d: any) => d.role === "support")
        .map((d: any) => ({ netIngId: String(d.netIngId), amountG: String(d.amountG), spec: d.spec || "" })),
      minor: dish.seasoningDetails
        .filter((d: any) => d.type === "minor")
        .map((d: any) => ({ sourceId: String(d.sourceId), amountG: String(d.amountG), brand: d.brand || "" })),
      seasoning: dish.seasoningDetails
        .filter((d: any) => d.type === "seasoning")
        .map((d: any) => ({ sourceId: String(d.sourceId), amountG: String(d.amountG), brand: d.brand || "" })),
      sauce: dish.sauceDetails.map((d: any) => ({ sauceId: String(d.sauceId), amountG: String(d.amountG), brand: d.brand || "" })),
    });
    setBomEditing(true);
  };

  const addBomRow = (type: keyof BomDraft) => {
    const defaults: Record<keyof BomDraft, any> = {
      main: { netIngId: "", amountG: "", spec: "" },
      support: { netIngId: "", amountG: "", spec: "" },
      minor: { sourceId: "", amountG: "", brand: "" },
      seasoning: { sourceId: "", amountG: "", brand: "" },
      sauce: { sauceId: "", amountG: "", brand: "" },
    };
    setBomDraft((prev) => ({ ...prev, [type]: [...prev[type], defaults[type]] }));
  };

  const removeBomRow = (type: keyof BomDraft, index: number) => {
    setBomDraft((prev) => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  };

  const updateBomRow = (type: keyof BomDraft, index: number, field: string, value: string) => {
    setBomDraft((prev) => {
      const rows = [...prev[type]];
      rows[index] = { ...rows[index], [field]: value };
      return { ...prev, [type]: rows };
    });
  };

  const netOptions = useMemo(() => netIngredients.map((i) => ({ value: String(i.id), label: i.name, subLabel: i.code })), [netIngredients]);
  const minorOptions = useMemo(() => minorIngredients.map((i) => ({ value: String(i.id), label: i.name, subLabel: i.code })), [minorIngredients]);
  const seasoningOptions = useMemo(() => seasonings.map((i) => ({ value: String(i.id), label: i.name, subLabel: i.brand })), [seasonings]);
  const sauceOptions = useMemo(() => sauces.map((i) => ({ value: String(i.id), label: i.name, subLabel: i.code })), [sauces]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <div className="h-[500px] bg-muted rounded animate-pulse" />
          <div className="h-[500px] bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!dish) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <p className="text-muted-foreground">菜品不存在</p>
      </div>
    );
  }

  const bomTabs = [
    { key: "main" as const, label: `主料 (${dish.netDetails.filter((d: any) => d.role === "main").length})` },
    { key: "support" as const, label: `辅料 (${dish.netDetails.filter((d: any) => d.role === "support").length})` },
    { key: "minor" as const, label: `小料 (${dish.seasoningDetails.filter((d: any) => d.type === "minor").length})` },
    { key: "seasoning" as const, label: `调料 (${dish.seasoningDetails.filter((d: any) => d.type === "seasoning").length})` },
    { key: "sauce" as const, label: `酱料 (${dish.sauceDetails.length})` },
  ];

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader title={dish.name} description={`${dish.code} · ${dish.category?.name || "—"}`} />
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              dish.status === "published"
                ? "bg-green-100 text-green-700"
                : dish.status === "draft"
                ? "bg-gray-100 text-gray-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {dish.status === "published" ? "已发布" : dish.status === "draft" ? "草稿" : "待发布"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {dish.status === "published" ? (
            <Button variant="outline" onClick={() => handleStatusChange("pending")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              撤回
            </Button>
          ) : (
            <Button variant="outline" onClick={() => handleStatusChange("published")}>
              <Send className="mr-2 h-4 w-4" />
              发布
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push("/dishes")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回列表
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            删除菜品
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* Left: Basic Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">基础信息</h3>
                <Button variant="ghost" size="sm" onClick={() => setEditBasicOpen(true)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  编辑
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">编号</span>
                <span className="font-medium">{dish.code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">名称</span>
                <span className="font-medium">{dish.name}</span>
              </div>
              {dish.intro && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">描述</span>
                  <span className="text-right max-w-[200px] whitespace-pre-wrap">{dish.intro}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">类别</span>
                <Badge variant="secondary">{dish.category?.name}</Badge>
              </div>
              {dish.cuisine && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">菜系</span>
                  <span>{dish.cuisine}</span>
                </div>
              )}
              {dish.technique && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">做法</span>
                  <span>{dish.technique}</span>
                </div>
              )}
              {dish.taste && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">口味</span>
                  <span>{dish.taste}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">份量</span>
                <span>{dish.portion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">季节</span>
                <span>{dish.season}</span>
              </div>
              {dish.meatType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">荤素</span>
                  <span>{dish.meatType}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t">
                <span className="text-muted-foreground">成本</span>
                <span className="font-semibold text-green-600">
                  {dish.cost != null ? `¥${Number(dish.cost).toFixed(2)}` : "—"}
                </span>
              </div>
              {dish.operator && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">操作人</span>
                  <span>{dish.operator}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: BOM + Process */}
        <div className="space-y-6">
          {/* BOM */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">BOM 清单</h3>
                {!bomEditing ? (
                  <Button variant="ghost" size="sm" onClick={startBomEdit}>
                    <Pencil className="h-4 w-4 mr-1" />
                    编辑 BOM
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setBomEditing(false)}>
                      取消
                    </Button>
                    <Button size="sm" onClick={handleUpdateBom}>
                      <Save className="h-4 w-4 mr-1" />
                      保存
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Tabs */}
              <div className="flex items-center gap-1 mb-4 border-b">
                {bomTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveBomTab(tab.key)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeBomTab === tab.key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* BOM Content */}
              {!bomEditing ? (
                <BomReadOnly dish={dish} activeTab={activeBomTab} />
              ) : (
                <BomEditor
                  type={activeBomTab}
                  rows={bomDraft[activeBomTab] || []}
                  options={
                    activeBomTab === "main" || activeBomTab === "support" ? netOptions :
                    activeBomTab === "minor" ? minorOptions :
                    activeBomTab === "seasoning" ? seasoningOptions :
                    sauceOptions
                  }
                  onAdd={() => addBomRow(activeBomTab)}
                  onRemove={(idx) => removeBomRow(activeBomTab, idx)}
                  onUpdate={(idx, field, value) => updateBomRow(activeBomTab, idx, field, value)}
                />
              )}
            </CardContent>
          </Card>

          {/* Process */}
          <Card>
            <CardHeader className="pb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">加工工艺流程</h3>
            </CardHeader>
            <CardContent>
              <ProcessTimeline steps={dish.processes || []} onChange={handleUpdateProcesses} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Basic Dialog */}
      <Dialog open={editBasicOpen} onOpenChange={setEditBasicOpen}>
        <DialogContent className="sm:max-w-[640px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">编辑基础信息</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <FormSection title="基础信息">
              <FormField label="菜品名称" required>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="h-11 text-base px-4" />
              </FormField>
              <FormField label="菜品描述">
                <Textarea value={editForm.intro} onChange={(e) => setEditForm({ ...editForm, intro: e.target.value })} className="min-h-[80px] text-base px-4 py-3" />
              </FormField>
              <FormField label="菜品类别" required>
                <Select value={editForm.categoryId || undefined} onValueChange={(v) => v && setEditForm({ ...editForm, categoryId: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="菜系" required>
                <Select value={editForm.cuisine || undefined} onValueChange={(v) => v && setEditForm({ ...editForm, cuisine: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cuisineOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="做法" required>
                <Select value={editForm.technique || undefined} onValueChange={(v) => v && setEditForm({ ...editForm, technique: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {techniqueOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="口味" required>
                <Select value={editForm.taste || undefined} onValueChange={(v) => v && setEditForm({ ...editForm, taste: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tasteOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="份量" required>
                <Select value={editForm.portion || undefined} onValueChange={(v) => v && setEditForm({ ...editForm, portion: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {portionOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="季节" required>
                <Select value={editForm.season || undefined} onValueChange={(v) => v && setEditForm({ ...editForm, season: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {seasonOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="荤素类型" required>
                <Select value={editForm.meatType || undefined} onValueChange={(v) => v && setEditForm({ ...editForm, meatType: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {meatTypeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </FormSection>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBasicOpen(false)} className="h-11 px-6">取消</Button>
            <Button onClick={handleUpdateBasic} className="h-11 px-6">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BomReadOnly({ dish, activeTab }: { dish: DishDetail; activeTab: string }) {
  let data: any[] = [];
  if (activeTab === "main") data = dish.netDetails.filter((d: any) => d.role === "main");
  else if (activeTab === "support") data = dish.netDetails.filter((d: any) => d.role === "support");
  else if (activeTab === "minor") data = dish.seasoningDetails.filter((d: any) => d.type === "minor");
  else if (activeTab === "seasoning") data = dish.seasoningDetails.filter((d: any) => d.type === "seasoning");
  else if (activeTab === "sauce") data = dish.sauceDetails;

  if (data.length === 0) {
    return <div className="text-center text-sm text-muted-foreground py-8">暂无数据</div>;
  }

  const isNet = activeTab === "main" || activeTab === "support";
  const isSauce = activeTab === "sauce";

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>食材</TableHead>
            <TableHead>用量(g)</TableHead>
            {isNet ? <TableHead>规格</TableHead> : <TableHead>品牌</TableHead>}
            <TableHead>成本</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row: any, idx: number) => (
            <TableRow key={idx}>
              <TableCell>
                {isNet
                  ? row.netIngredient?.name
                  : isSauce
                  ? row.sauce?.name
                  : row.name || `ID:${row.sourceId}`}
              </TableCell>
              <TableCell>{row.amountG}</TableCell>
              {isNet ? <TableCell>{row.spec || "—"}</TableCell> : <TableCell>{row.brand || "—"}</TableCell>}
              <TableCell>{row.cost != null ? `¥${Number(row.cost).toFixed(2)}` : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function BomEditor({
  type,
  rows,
  options,
  onAdd,
  onRemove,
  onUpdate,
}: {
  type: string;
  rows: any[];
  options: Array<{ value: string; label: string; subLabel?: string }>;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: string, value: string) => void;
}) {
  const idField =
    type === "main" || type === "support"
      ? "netIngId"
      : type === "minor" || type === "seasoning"
      ? "sourceId"
      : "sauceId";
  const showSpec = type === "main" || type === "support";

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1" />
        添加行
      </Button>
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <IngredientPicker
            options={options}
            value={row[idField] || ""}
            onChange={(v) => onUpdate(idx, idField, v)}
            placeholder="选择食材"
            className="flex-1"
          />
          <Input
            value={row.amountG || ""}
            onChange={(e) => onUpdate(idx, "amountG", e.target.value)}
            placeholder="g"
            type="number"
            className="w-[80px] h-9 text-sm"
          />
          {showSpec ? (
            <Input
              value={row.spec || ""}
              onChange={(e) => onUpdate(idx, "spec", e.target.value)}
              placeholder="规格"
              className="w-[90px] h-9 text-sm"
            />
          ) : (
            <Input
              value={row.brand || ""}
              onChange={(e) => onUpdate(idx, "brand", e.target.value)}
              placeholder="品牌"
              className="w-[90px] h-9 text-sm"
            />
          )}
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemove(idx)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
