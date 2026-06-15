"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Minus, Search, Save, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  cuisine: string | null;
  cost: number | null;
}

interface SelectedDish {
  dishId: number;
  name: string;
  code: string;
  categoryName: string;
  quantity: number;
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export default function NewSchedulePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [scheduleDate, setScheduleDate] = useState(getTomorrow);
  const [scope, setScope] = useState("全部食堂");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selected, setSelected] = useState<SelectedDish[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDishes();
  }, []);

  const fetchDishes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dishes");
      const data = await res.json();
      setDishes(data.data || []);
    } catch {
      toast.error("获取菜品数据失败");
    } finally {
      setLoading(false);
    }
  };

  // 提取所有分类
  const categories = Array.from(
    new Map(dishes.filter((d) => d.category?.name).map((d) => [d.category.name, d.category.name])).entries()
  ).map(([name]) => name);

  const filteredDishes = dishes.filter((d) => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.code.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || d.category?.name === categoryFilter;
    return matchSearch && matchCategory;
  });

  const isSelected = (dishId: number) => selected.some((s) => s.dishId === dishId);

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
        s.dishId === dishId
          ? { ...s, quantity: Math.max(1, s.quantity + delta) }
          : s
      )
    );
  };

  const setQuantity = (dishId: number, qty: number) => {
    setSelected((prev) =>
      prev.map((s) =>
        s.dishId === dishId ? { ...s, quantity: Math.max(1, qty) } : s
      )
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
      const res = await fetch("/api/schedules", {
        method: "POST",
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
        toast.error(data.error || "创建失败");
        return;
      }
      toast.success("排程创建成功");
      router.push(`/schedules/${data.data?.id}`);
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  const totalQuantity = selected.reduce((s, it) => s + it.quantity, 0);

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/schedules")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">新建排程</h1>
            <p className="text-sm text-muted-foreground">选择菜品及数量，系统自动生成切配工单与采购计划</p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          创建排程
        </Button>
      </div>

      {/* 基础信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label>排程标题 <span className="text-red-500">*</span></Label>
          <Input
            placeholder="如：周一午餐生产计划"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>生产日期 <span className="text-red-500">*</span></Label>
          <DatePicker
            value={scheduleDate}
            onChange={(v) => setScheduleDate(v)}
            placeholder="请选择生产日期"
          />
        </div>
        <div className="space-y-2">
          <Label>使用范围</Label>
          <Select value={scope} onValueChange={(v) => v && setScope(v)}>
            <SelectTrigger className="w-full h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="全部食堂">全部食堂</SelectItem>
              <SelectItem value="珠宝食堂">珠宝食堂</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 菜品选择区 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：已选清单 */}
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
                    <Input
                      type="number"
                      min={1}
                      value={s.quantity}
                      onChange={(e) => setQuantity(s.dishId, Number(e.target.value))}
                      className="w-14 h-7 text-center px-1"
                    />
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(s.dishId, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => toggleDish({ id: s.dishId, name: s.name, code: s.code, category: { name: s.categoryName }, cuisine: null, cost: null } as Dish)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧：菜品网格 */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索菜品名称或编码..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={categoryFilter} onValueChange={(v) => v && setCategoryFilter(v)}>
              <SelectTrigger className="w-[140px] h-10">
                <SelectValue placeholder="全部分类" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(search || categoryFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategoryFilter(""); }}>
                清除
              </Button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredDishes.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <p>未找到匹配的菜品</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto">
              {filteredDishes.map((dish) => {
                const selectedItem = selected.find((s) => s.dishId === dish.id);
                return (
                  <div
                    key={dish.id}
                    className={`relative rounded-lg border p-3 cursor-pointer transition-all ${
                      selectedItem
                        ? "border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleDish(dish)}
                  >
                    {selectedItem && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-indigo-500" />
                      </div>
                    )}
                    <div className="font-medium text-sm truncate pr-5">{dish.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{dish.code}</div>
                    <div className="flex items-center gap-1 mt-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {dish.category?.name}
                      </Badge>
                      {selectedItem && (
                        <Badge className="text-[10px] bg-indigo-500 text-white">
                          {selectedItem.quantity} 份
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
