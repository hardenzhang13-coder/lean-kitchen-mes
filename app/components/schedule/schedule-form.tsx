"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Minus, Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/app/components/ui/form-controls";
import { FormField, FormSection } from "@/app/components/ui/form-field";
import { DatePicker } from "@/app/components/ui/date-picker";
import { SelectField } from "@/app/components/ui/select-field";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { dayOffsetInputValue } from "@/lib/shared/date-format";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";

interface DishOption {
  id: number;
  code: string;
  name: string;
  category: { name: string } | null;
  portion: string;
  meatType: string | null;
  price: number | null;
}

export interface ScheduleFormDish {
  dishId: number;
  quantity: number;
  name: string;
  code: string;
  categoryName: string;
  portion?: string | null;
  meatType?: string | null;
  price?: number | null;
}

interface ScheduleFormProps {
  mode: "create" | "edit";
  scheduleId?: number;
  initialDate?: string;
  initialStoreId?: number | null;
  initialItems?: ScheduleFormDish[];
  backHref: string;
}

export function ScheduleForm({
  mode,
  scheduleId,
  initialDate,
  initialStoreId,
  initialItems = [],
  backHref,
}: ScheduleFormProps) {
  const router = useRouter();
  const [scheduleDate, setScheduleDate] = useState(
    initialDate ?? dayOffsetInputValue(1)
  );
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [storeId, setStoreId] = useState(
    initialStoreId != null ? String(initialStoreId) : ""
  );
  const [dishes, setDishes] = useState<DishOption[]>([]);
  const [selected, setSelected] = useState<ScheduleFormDish[]>(initialItems);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/stores?pageSize=100");
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
        if (alive) setStores(list);
      } catch {
        if (alive) toast.error("获取门店失败");
      }
      try {
        const res = await fetch("/api/dishes?status=published&pageSize=100");
        const data = await res.json();
        if (alive) setDishes(data.data || []);
      } catch {
        if (alive) toast.error("获取菜品数据失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const categories = Array.from(
    new Set(dishes.map((dish) => dish.category?.name).filter((name): name is string => !!name))
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filteredDishes = dishes.filter((dish) => {
    const matchSearch =
      !normalizedSearch ||
      dish.name.toLowerCase().includes(normalizedSearch) ||
      dish.code.toLowerCase().includes(normalizedSearch);
    const matchCategory = !categoryFilter || dish.category?.name === categoryFilter;
    return matchSearch && matchCategory;
  });

  const toggleDish = (dish: DishOption) => {
    setSelected((previous) => {
      if (previous.some((item) => item.dishId === dish.id)) {
        return previous.filter((item) => item.dishId !== dish.id);
      }
      return [
        ...previous,
        {
          dishId: dish.id,
          quantity: 1,
          name: dish.name,
          code: dish.code,
          categoryName: dish.category?.name ?? "",
          portion: dish.portion,
          meatType: dish.meatType,
          price: dish.price,
        },
      ];
    });
  };

  const changeQuantity = (dishId: number, next: number) => {
    setSelected((previous) =>
      previous.map((item) =>
        item.dishId === dishId
          ? { ...item, quantity: Math.max(1, Number.isFinite(next) ? next : 1) }
          : item
      )
    );
  };

  const removeDish = (dishId: number) => {
    setSelected((previous) => previous.filter((item) => item.dishId !== dishId));
  };

  const totalQuantity = selected.reduce((sum, item) => sum + item.quantity, 0);

  const handleSubmit = async () => {
    if (!storeId) {
      toast.error("请选择门店");
      return;
    }
    if (selected.length === 0) {
      toast.error("请至少选择一道菜品");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        mode === "create" ? "/api/schedules" : `/api/schedules/${scheduleId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleDate,
            storeId: Number(storeId),
            items: selected.map((item) => ({
              dishId: item.dishId,
              quantity: item.quantity,
            })),
          }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || (mode === "create" ? "创建失败" : "修改失败"));
        return;
      }
      const targetId = mode === "create" ? data?.data?.id : scheduleId;
      toast.success(mode === "create" ? "排程创建成功" : "排程修改成功");
      router.push(targetId ? `/schedules/${targetId}` : "/schedules");
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        showBack
        backHref={backHref}
        backLabel="返回"
        title={mode === "create" ? "新建排程" : "修改排程"}
        description="选择门店、售卖日期与菜品份数；保存后系统在同一事务内生成切配工单与采购计划"
        actions={
          <>
            <Button variant="outline" onClick={() => router.push(backHref)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || loading}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {mode === "create" ? "创建排程" : "保存修改"}
            </Button>
          </>
        }
      />

      <FormSection cols={2}>
        <FormField id="schedule-store" label="选择门店" required optionalHint={false}>
          <SelectField
            value={storeId}
            onChange={setStoreId}
            placeholder="请选择门店"
            options={stores.map((store) => ({
              value: String(store.id),
              label: store.name,
            }))}
          />
        </FormField>
        <FormField id="schedule-date" label="售卖日期" required optionalHint={false}>
          <DatePicker
            value={scheduleDate}
            onChange={(value) => setScheduleDate(value)}
            placeholder="请选择售卖日期"
            showWeekday
          />
        </FormField>
      </FormSection>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex flex-col rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold">已选菜品</h3>
              <span className="text-xs text-muted-foreground">
                {selected.length} 道 · {totalQuantity} 份
              </span>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-3">
              {selected.length === 0 ? (
                <p className="py-16 text-center text-sm text-muted-foreground">
                  请在右侧选择菜品
                </p>
              ) : (
                <ul className="space-y-2">
                  {selected.map((item) => (
                    <li key={item.dishId} className="rounded-md border px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {item.name}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {item.code}
                            {item.categoryName ? ` · ${item.categoryName}` : ""}
                          </div>
                          {(item.portion || item.meatType) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {item.portion && <PortionTag portion={item.portion} />}
                              {item.meatType && <CategoryTag name={item.meatType} />}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground"
                          aria-label={`移除 ${item.name}`}
                          onClick={() => removeDish(item.dishId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`减少 ${item.name} 份数`}
                          onClick={() => changeQuantity(item.dishId, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) =>
                            changeQuantity(item.dishId, Number(event.target.value))
                          }
                          className="h-7 w-14 text-center font-mono"
                          aria-label={`${item.name} 份数`}
                        />
                        <span className="text-xs text-muted-foreground">份</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={`增加 ${item.name} 份数`}
                          onClick={() => changeQuantity(item.dishId, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="搜索菜品名称或编码..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="min-w-[200px] max-w-xs"
            />
            <SelectField
              value={categoryFilter}
              onChange={setCategoryFilter}
              className="w-[160px]"
              options={[
                { value: "", label: "全部分类" },
                ...categories.map((name) => ({ value: name, label: name })),
              ]}
            />
            {(search || categoryFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter("");
                }}
              >
                清除
              </Button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filteredDishes.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              未找到匹配的已发布菜品
            </p>
          ) : (
            <div className="grid max-h-[560px] grid-cols-2 content-start gap-3 overflow-y-auto sm:grid-cols-3">
              {filteredDishes.map((dish) => {
                const picked = selected.find((item) => item.dishId === dish.id);
                return (
                  <button
                    key={dish.id}
                    type="button"
                    aria-pressed={!!picked}
                    onClick={() => toggleDish(dish)}
                    className={cn(
                      "relative rounded-lg border p-3 text-left transition-colors",
                      picked
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "hover:bg-muted/50"
                    )}
                  >
                    {picked && (
                      <span className="absolute right-2 top-2">
                        <Check className="h-4 w-4 text-primary" />
                      </span>
                    )}
                    <div className="truncate pr-5 text-sm font-medium">{dish.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{dish.code}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {dish.category?.name && <CategoryTag name={dish.category.name} />}
                      <PortionTag portion={dish.portion} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
