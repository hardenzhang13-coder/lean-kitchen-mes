"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { DishCard } from "@/app/components/dish-card";
import { DishCreateWizard } from "@/app/components/dish-create-wizard";
import { toast } from "sonner";

type Dish = {
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
  category?: { id: number; code: string; name: string };
  netDetails: any[];
  seasoningDetails: any[];
  sauceDetails: any[];
  processes: any[];
};

type DishCategory = { id: number; code: string; name: string };
type NetIngredient = { id: number; code: string; name: string; unitPrice: number; unit: string };
type MinorIngredient = { id: number; code: string; name: string; unitPrice: number; unit: string };
type Seasoning = { id: number; code: string; name: string; brand: string; purchasePrice: number; purchaseUnit: string };
type Sauce = { id: number; code: string; name: string; unitPrice: number; unit: string };

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

const meatTypeOptions = [
  { value: "荤菜", label: "荤菜" },
  { value: "素菜", label: "素菜" },
  { value: "小荤菜", label: "小荤菜" },
];

const statusOptions = [
  { value: "published", label: "已发布" },
  { value: "pending", label: "待发布" },
  { value: "draft", label: "草稿" },
];

export default function DishesPage() {
  const router = useRouter();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<DishCategory[]>([]);
  const [netIngredients, setNetIngredients] = useState<NetIngredient[]>([]);
  const [minorIngredients, setMinorIngredients] = useState<MinorIngredient[]>([]);
  const [seasonings, setSeasonings] = useState<Seasoning[]>([]);
  const [sauces, setSauces] = useState<Sauce[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCuisine, setFilterCuisine] = useState("");
  const [filterMeatType, setFilterMeatType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Wizard
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory) params.set("categoryId", filterCategory);
      if (filterCuisine) params.set("cuisine", filterCuisine);
      if (filterMeatType) params.set("meatType", filterMeatType);
      if (filterStatus) params.set("status", filterStatus);
      const [dRes, cRes, nRes, mRes, sRes, saRes] = await Promise.all([
        fetch(`/api/dishes?${params.toString()}`),
        fetch("/api/dish-categories"),
        fetch("/api/net-ingredients"),
        fetch("/api/minor-ingredients"),
        fetch("/api/seasoning-ingredients"),
        fetch("/api/sauce-ingredients"),
      ]);
      const dData = await dRes.json();
      setDishes(dData.data || []);
      setCategories(await cRes.json());
      setNetIngredients(await nRes.json());
      setMinorIngredients(await mRes.json());
      setSeasonings(await sRes.json());
      setSauces(await saRes.json());
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterCategory, filterCuisine, filterMeatType, filterStatus]);

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(s) ||
        d.code.toLowerCase().includes(s) ||
        (d.intro && d.intro.toLowerCase().includes(s))
      );
    });
  }, [dishes, search]);

  const handleStatusChange = async (dish: Dish, newStatus: string) => {
    try {
      const res = await fetch(`/api/dishes/${dish.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dish.name,
          categoryId: dish.categoryId,
          status: newStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "操作失败");
        return;
      }
      toast.success(newStatus === "published" ? "已发布" : "已撤回");
      fetchData();
    } catch {
      toast.error("操作失败");
    }
  };

  const openEdit = (dish: Dish) => {
    setEditingDish(dish);
    setWizardOpen(true);
  };

  const openCreate = () => {
    setEditingDish(null);
    setWizardOpen(true);
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader title="菜品库" description="管理所有菜品及其 BOM 与工艺" />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增菜品
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索菜品名称或编号..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={filterCategory || undefined} onValueChange={(v) => { v && setFilterCategory(v); }}>
              <SelectTrigger className="w-[160px] h-10">
                <SelectValue placeholder="全部类别" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部类别</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCuisine || undefined} onValueChange={(v) => { v && setFilterCuisine(v); }}>
              <SelectTrigger className="w-[140px] h-10">
                <SelectValue placeholder="全部菜系" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部菜系</SelectItem>
                {cuisineOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMeatType || undefined} onValueChange={(v) => { v && setFilterMeatType(v); }}>
              <SelectTrigger className="w-[140px] h-10">
                <SelectValue placeholder="全部荤素" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部荤素</SelectItem>
                {meatTypeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus || undefined} onValueChange={(v) => { v && setFilterStatus(v); }}>
              <SelectTrigger className="w-[140px] h-10">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部状态</SelectItem>
                {statusOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterCategory || filterCuisine || filterMeatType || filterStatus || search) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setFilterCategory("");
                setFilterCuisine("");
                setFilterMeatType("");
                setFilterStatus("");
                setSearch("");
              }}>
                清除筛选
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-card ring-1 ring-foreground/5 p-5 space-y-3 animate-pulse">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-2/3 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">暂无菜品</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filtered.map((d) => (
                <DishCard
                  key={d.id}
                  code={d.code}
                  name={d.name}
                  intro={d.intro}
                  categoryName={d.category?.name || "—"}
                  cuisine={d.cuisine}
                  meatType={d.meatType}
                  portion={d.portion}
                  cost={d.cost != null ? Number(d.cost) : null}
                  status={d.status}
                  onClick={() => router.push(`/dishes/${d.id}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DishCreateWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        categories={categories}
        netIngredients={netIngredients}
        minorIngredients={minorIngredients}
        seasonings={seasonings}
        sauces={sauces}
        editingDish={editingDish}
        onSuccess={fetchData}
      />
    </div>
  );
}
