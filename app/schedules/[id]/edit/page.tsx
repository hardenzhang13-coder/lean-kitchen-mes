"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Plus, Minus, Search, Save, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/app/components/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Dish {
  id: number;
  code: string;
  name: string;
  category: { name: string };
}

interface SelectedDish {
  dishId: number;
  name: string;
  code: string;
  categoryName: string;
  quantity: number;
}

export default function EditSchedulePage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [title, setTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scope, setScope] = useState("全部食堂");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selected, setSelected] = useState<SelectedDish[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchSchedule();
    fetchDishes();
  }, [id]);

  const fetchSchedule = async () => {
    try {
      const res = await fetch(`/api/schedules/${id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "获取失败");
        return;
      }
      const schedule = data.data;
      if (schedule.status !== "待生效") {
        toast.error("只有待生效的排程可以修改");
        router.push(`/schedules/${id}`);
        return;
      }
      setTitle(schedule.title);
      setScheduleDate(schedule.scheduleDate.split("T")[0]);
      setScope(schedule.scope);
      setSelected(
        schedule.items.map((it: any) => ({
          dishId: it.dishId,
          name: it.dish.name,
          code: it.dish.code,
          categoryName: it.dish.category?.name || "",
          quantity: it.quantity,
        }))
      );
    } catch {
      toast.error("获取排程数据失败");
    } finally {
      setLoading(false);
    }
  };

  const fetchDishes = async () => {
    try {
      const res = await fetch("/api/dishes");
      const data = await res.json();
      setDishes(data.data || []);
    } catch {
      toast.error("获取菜品数据失败");
    }
  };

  const categories = Array.from(
    new Map(dishes.filter((d) => d.category?.name).map((d) => [d.category.name, d.category.name])).entries()
  ).map(([name]) => name);

  const filteredDishes = dishes.filter((d) => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || d.category?.name === categoryFilter;
    return matchSearch && matchCategory;
  });

  const toggleDish = (dish: Dish) => {
    setSelected((prev) => {
      const exists = prev.find((s) => s.dishId === dish.id);
      if (exists) {
        return prev.filter((s) => s.dishId !== dish.id);
      }
      return [
        ...prev,
        {
          dishId: dish.id,
          name: dish.name,
          code: dish.code,
          categoryName: dish.category?.name || "",
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (dishId: number, delta: number) => {
    setSelected((prev) =>
      prev.map((s) =>
        s.dishId === dishId ? { ...s, quantity: Math.max(1, s.quantity + delta) } : s
      )
    );
  };

  const setQuantity = (dishId: number, qty: number) => {
    setSelected((prev) =>
      prev.map((s) => (s.dishId === dishId ? { ...s, quantity: Math.max(1, qty) } : s))
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("请填写排程标题");
      return;
    }
    if (selected.length === 0) {
      toast.error("请至少选择一道菜品");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          scheduleDate,
          scope,
          items: selected.map((s) => ({ dishId: s.dishId, quantity: s.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "修改失败");
        return;
      }
      toast.success("排程修改成功");
      router.push(`/schedules/${id}`);
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  const totalQuantity = selected.reduce((s, it) => s + it.quantity, 0);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div className="h-[200px] bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="返回排程详情" onClick={() => router.push(`/schedules/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">修改排程</h1>
            <p className="text-sm text-muted-foreground">修改菜品及数量后，切配工单与采购计划将自动重新计算</p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={submitting}>
          <span aria-live="polite" className="inline-flex items-center">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            保存修改
          </span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label>排程标题 <span className="text-destructive">*</span></Label>
          <Input placeholder="如：周一午餐生产计划" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>生产日期 <span className="text-destructive">*</span></Label>
          <DatePicker
            value={scheduleDate}
            onChange={(v) => setScheduleDate(v)}
            placeholder="请选择生产日期"
          />
        </div>
        <div className="space-y-2">
          <Label>使用范围</Label>
          <Select value={scope} onValueChange={(v) => v && setScope(v)}>
            <SelectTrigger className="w-full h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="全部食堂">全部食堂</SelectItem>
              <SelectItem value="珠宝食堂">珠宝食堂</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">已选菜品 ({selected.length})</h3>
            <div className="text-sm text-muted-foreground">共 {totalQuantity} 份</div>
          </div>
          {selected.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <p>请在右侧选择菜品</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {selected.map((s) => (
                <div key={s.dishId} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.code} · {s.categoryName}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(s.dishId, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input type="number" min={1} value={s.quantity} onChange={(e) => setQuantity(s.dishId, Number(e.target.value))} className="w-14 h-7 text-center px-1" />
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(s.dishId, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => toggleDish({ id: s.dishId, name: s.name, code: s.code, category: { name: s.categoryName } } as Dish)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索菜品名称或编码..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
              <SelectTrigger className="w-[140px] h-11">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || categoryFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategoryFilter(""); }}>清除</Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto">
            {filteredDishes.map((dish) => {
              const selectedItem = selected.find((s) => s.dishId === dish.id);
              return (
                <div
                  key={dish.id}
                  className={`relative rounded-lg border p-3 cursor-pointer transition-all ${
                    selectedItem ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleDish(dish)}
                >
                  {selectedItem && (
                    <div className="absolute top-2 right-2">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="font-medium text-sm truncate pr-5">{dish.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{dish.code}</div>
                  <div className="flex items-center gap-1 mt-2">
                    <Badge variant="secondary" className="text-[10px]">{dish.category?.name}</Badge>
                    {selectedItem && (
                      <Badge className="text-[10px] bg-primary text-primary-foreground">{selectedItem.quantity} 份</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
