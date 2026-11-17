"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
import { DatePicker } from "@/app/components/ui/date-picker";
import { SelectField } from "@/app/components/ui/select-field";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { LoadingState } from "@/app/components/ui/loading-state";
import { dayOffsetInputValue } from "@/lib/shared/date-format";
import { parseObject } from "@/lib/client/api";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";

interface DishOption {
  id: number;
  code: string;
  name: string;
  category: { name: string } | null;
  portion: string;
}

interface SelectedDish {
  dishId: number;
  quantity: number;
  name: string;
  code: string;
  categoryName: string;
}

interface SourceSchedule {
  storeId?: number;
  store?: { id: number; name: string } | null;
  items: Array<{
    dishId: number;
    quantity: number;
    dish: {
      name: string;
      code: string;
      category?: { name: string } | null;
    };
  }>;
}

interface ScheduleCreateDialogProps {
  copyFromId?: number | null;
  /** 指定进入时的售卖日期（工作台按日期新增时使用） */
  presetDate?: string | null;
  onClose: () => void;
  onCreated: (id: number) => void;
}

/**
 * 菜品排程的新建弹窗：门店 + 售卖日期一行，下面 4:6 分「已选菜品 / 菜品库」。
 * 标题由门店与售卖日期自动生成，不在表单里填写。
 */
export function ScheduleCreateDialog({
  copyFromId,
  presetDate,
  onClose,
  onCreated,
}: ScheduleCreateDialogProps) {
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [storeId, setStoreId] = useState("");
  const [scheduleDate, setScheduleDate] = useState(presetDate || dayOffsetInputValue(1));
  const [dishes, setDishes] = useState<DishOption[]>([]);
  const [selected, setSelected] = useState<SelectedDish[]>([]);
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
      }
      if (copyFromId) {
        try {
          const res = await fetch(`/api/schedules/${copyFromId}`);
          const source = await parseObject<SourceSchedule>(res);
          if (source && alive) {
            setStoreId(
              source.store?.id != null ? String(source.store.id) : String(source.storeId ?? "")
            );
            setSelected(
              source.items.map((item) => ({
                dishId: item.dishId,
                quantity: item.quantity,
                name: item.dish.name,
                code: item.dish.code,
                categoryName: item.dish.category?.name ?? "",
              }))
            );
          }
        } catch {
          if (alive) toast.error("复制失败，已打开空白表单");
        }
      }
      if (alive) setLoading(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [copyFromId]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          dishes
            .map((dish) => dish.category?.name)
            .filter((name): name is string => !!name)
        )
      ),
    [dishes]
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

  const totalQuantity = selected.reduce((sum, item) => sum + item.quantity, 0);
  const canSubmit = !!storeId && !!scheduleDate && selected.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleDate,
          storeId: Number(storeId),
          items: selected.map((item) => ({
            dishId: item.dishId,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error || "创建失败");
        return;
      }
      toast.success("菜品排程单已创建");
      onCreated(data?.data?.id);
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <AppDialogContent
        size="workbench"
        className="[&>button]:cursor-pointer p-0 flex flex-col max-h-[calc(100dvh-24px)]"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-lg">菜品排程</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <LoadingState type="card-grid" rows={2} />
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-10">
              <div className="flex flex-wrap items-end gap-4 lg:col-span-10">
                <FormField
                  id="schedule-store"
                  label="选择门店"
                  required
                  optionalHint={false}
                >
                  <SelectField
                    value={storeId}
                    onChange={setStoreId}
                    placeholder="请选择门店"
                    className="w-[320px]"
                    options={stores.map((store) => ({
                      value: String(store.id),
                      label: store.name,
                    }))}
                  />
                </FormField>
                <FormField
                  id="schedule-date"
                  label="售卖日期"
                  required
                  optionalHint={false}
                >
                  <DatePicker
                    value={scheduleDate}
                    onChange={setScheduleDate}
                    placeholder="请选择售卖日期"
                    className="w-[260px]"
                    showWeekday
                  />
                </FormField>
              </div>

              <div className="lg:col-span-4">
                <div className="flex flex-col rounded-lg border bg-card">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h4 className="text-sm font-semibold text-foreground">已选菜品</h4>
                    <span className="text-xs text-muted-foreground">
                      {selected.length} 道 · {totalQuantity} 份
                    </span>
                  </div>
                  <div className="h-[360px] overflow-y-auto p-3">
                    {selected.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        请在右侧选择菜品
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {selected.map((item) => (
                          <li
                            key={item.dishId}
                            className="rounded-md border px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                  {item.name}
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {item.code}
                                  {item.categoryName ? ` · ${item.categoryName}` : ""}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground"
                                aria-label={`移除 ${item.name}`}
                                onClick={() =>
                                  setSelected((previous) =>
                                    previous.filter((row) => row.dishId !== item.dishId)
                                  )
                                }
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="mt-2 flex items-center justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`减少 ${item.name} 份数`}
                                onClick={() =>
                                  changeQuantity(item.dishId, item.quantity - 1)
                                }
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
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                aria-label={`增加 ${item.name} 份数`}
                                onClick={() =>
                                  changeQuantity(item.dishId, item.quantity + 1)
                                }
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <span className="ml-1 text-xs text-muted-foreground">份</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="flex flex-col rounded-lg border bg-card">
                  <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                    <Input
                      placeholder="搜索菜品名称或编码..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="w-[220px]"
                    />
                    <SelectField
                      value={categoryFilter}
                      onChange={setCategoryFilter}
                      className="w-[140px]"
                      options={[
                        { value: "", label: "全部分类" },
                        ...categories.map((name) => ({ value: name, label: name })),
                      ]}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setCategoryFilter("");
                      }}
                      className={search || categoryFilter ? undefined : "invisible"}
                      aria-hidden={!(search || categoryFilter)}
                      tabIndex={search || categoryFilter ? undefined : -1}
                    >
                      清除
                    </Button>
                    <span className="ml-auto text-xs text-muted-foreground">
                      共 {filteredDishes.length} 道可选
                    </span>
                  </div>
                  <div className="h-[360px] overflow-y-auto p-3">
                    {filteredDishes.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        未找到匹配的已发布菜品
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        {filteredDishes.map((dish) => {
                          const picked = selected.some(
                            (item) => item.dishId === dish.id
                          );
                          return (
                            <button
                              key={dish.id}
                              type="button"
                              aria-pressed={picked}
                              onClick={() => toggleDish(dish)}
                              className={cn(
                                "relative rounded-md border p-3 text-left transition-colors",
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
                              <div className="truncate pr-5 text-sm font-medium">
                                {dish.name}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {dish.code}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {dish.category?.name && (
                                  <CategoryTag name={dish.category.name} />
                                )}
                                <PortionTag portion={dish.portion} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 pb-5 pt-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {!storeId
                ? "请先选择门店"
                : !scheduleDate
                  ? "请先选择售卖日期"
                  : selected.length === 0
                    ? "请至少选择一道菜品"
                    : `将生成 ${selected.length} 道菜品 / ${totalQuantity} 份`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="h-11 px-6"
              >
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit} className="h-11 px-6">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                完成
              </Button>
            </div>
          </div>
        </DialogFooter>
      </AppDialogContent>
    </Dialog>
  );
}
