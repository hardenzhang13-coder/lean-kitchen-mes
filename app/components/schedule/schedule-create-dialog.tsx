"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Info, Loader2, Minus, Plus, SlidersHorizontal, X } from "lucide-react";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuSearch } from "@/app/components/ui/skeu-search";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
import { DatePicker } from "@/app/components/ui/date-picker";
import { SelectField } from "@/app/components/ui/select-field";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { LoadingState } from "@/app/components/ui/loading-state";
import { RecordSheet } from "@/app/components/ui/record-sheet";
import { dayOffsetInputValue, getWeekDay } from "@/lib/shared/date-format";
import { formatMoney } from "@/lib/shared/display-format";
import { getPortionOption } from "@/lib/shared/portion-scale";
import { usePortionProfiles } from "@/lib/client/use-portion-profiles";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";

interface DishOption {
  id: number;
  code: string;
  name: string;
  category: { id: number; code: string; name: string } | null;
  portion: string;
  price: number | null;
}

interface SelectedDish {
  dishId: number;
  quantity: number;
  name: string;
  code: string;
  categoryName: string;
  portion: string;
  price: number | null;
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
  /** 编辑态：加载该排程并回填，保存时走 PUT（仅待生效可改） */
  editId?: number | null;
  /** 指定进入时的售卖日期（工作台按日期新增时使用） */
  presetDate?: string | null;
  onClose: () => void;
  onCreated: (id: number) => void;
  /** 编辑保存成功后的回调（关闭弹窗并刷新列表） */
  onEdited?: () => void;
}

const PRICE_FILTERS = [
  { value: "all", label: "全部" },
  { value: "low", label: "¥10 以下" },
  { value: "mid", label: "¥10 - ¥20" },
  { value: "high", label: "¥20 以上" },
] as const;

type PriceFilter = (typeof PRICE_FILTERS)[number]["value"];

function matchPriceFilter(price: number | null, filter: PriceFilter) {
  const value = price ?? 0;
  if (filter === "low") return value < 10;
  if (filter === "mid") return value >= 10 && value <= 20;
  if (filter === "high") return value > 20;
  return true;
}

/**
 * 去排菜弹窗：门店 + 售卖日期一行，下面 4:6 分「已排菜单 / 菜品库」。
 * 已排菜单按「最新选中在前」排序；提交前经「预览菜单」二次确认。
 */
export function ScheduleCreateDialog({
  copyFromId,
  editId,
  presetDate,
  onClose,
  onCreated,
  onEdited,
}: ScheduleCreateDialogProps) {
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [storeId, setStoreId] = useState("");
  const [scheduleDate, setScheduleDate] = useState(presetDate || dayOffsetInputValue(1));
  const [dishes, setDishes] = useState<DishOption[]>([]);
  const [selected, setSelected] = useState<SelectedDish[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [portionFilter, setPortionFilter] = useState("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
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
      let dishList: DishOption[] = [];
      try {
        const res = await fetch("/api/dishes?status=published&pageSize=100");
        const data = await res.json();
        dishList = data.data || [];
        if (alive) setDishes(dishList);
      } catch {
        if (alive) toast.error("获取菜品数据失败");
      }
      const sourceId = editId ?? copyFromId;
      if (sourceId) {
        try {
          const res = await fetch(`/api/schedules/${sourceId}`);
          const source = await parseObject<SourceSchedule>(res);
          if (source && alive) {
            setStoreId(
              source.store?.id != null ? String(source.store.id) : String(source.storeId ?? "")
            );
            setSelected(
              source.items.map((item) => {
                const dish = dishList.find((row) => row.id === item.dishId);
                return {
                  dishId: item.dishId,
                  quantity: item.quantity,
                  name: item.dish.name,
                  code: item.dish.code,
                  categoryName: item.dish.category?.name ?? dish?.category?.name ?? "",
                  portion: dish?.portion ?? "",
                  price: dish?.price ?? null,
                };
              })
            );
          }
        } catch {
          if (alive) toast.error(editId ? "获取排程失败，已打开空白表单" : "复制失败，已打开空白表单");
        }
      }
      if (alive) setLoading(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [copyFromId, editId]);

  // 编辑 / 复制来源的菜品已在上面的加载流程里用菜品库数据回填（价格 / 份量）

  const categoryOptions = useMemo(
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

  const { profiles } = usePortionProfiles();
  const portionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          dishes
            .map((dish) => getPortionOption(dish.portion, profiles)?.label)
            .filter((label): label is string => !!label)
        )
      ),
    [dishes, profiles]
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filteredDishes = dishes.filter((dish) => {
    const matchSearch =
      !normalizedSearch ||
      dish.name.toLowerCase().includes(normalizedSearch) ||
      dish.code.toLowerCase().includes(normalizedSearch);
    const matchCategory =
      categoryFilter === "all" || dish.category?.name === categoryFilter;
    const matchPortion =
      portionFilter === "all" || getPortionOption(dish.portion, profiles)?.label === portionFilter;
    const matchPrice = matchPriceFilter(dish.price, priceFilter);
    return matchSearch && matchCategory && matchPortion && matchPrice;
  });

  const activeFilterCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (portionFilter !== "all" ? 1 : 0) +
    (priceFilter !== "all" ? 1 : 0);

  const toggleDish = (dish: DishOption) => {
    setSelected((previous) => {
      if (previous.some((item) => item.dishId === dish.id)) {
        return previous.filter((item) => item.dishId !== dish.id);
      }
      // 最新选中的排最前，方便继续调整
      return [
        {
          dishId: dish.id,
          quantity: 1,
          name: dish.name,
          code: dish.code,
          categoryName: dish.category?.name ?? "",
          portion: dish.portion,
          price: dish.price,
        },
        ...previous,
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
  const totalAmount = selected.reduce(
    (sum, item) => sum + (item.price ?? 0) * item.quantity,
    0
  );
  const canSubmit = !!storeId && !!scheduleDate && selected.length > 0 && !submitting;
  const storeName = stores.find((store) => String(store.id) === storeId)?.name ?? "";
  const validationText = !storeId
    ? "请先选择门店"
    : !scheduleDate
      ? "请先选择售卖日期"
      : selected.length === 0
        ? "请至少选择一道菜品"
        : `将生成 ${selected.length} 道菜品 / ${totalQuantity} 份`;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        editId ? `/api/schedules/${editId}` : "/api/schedules",
        {
          method: editId ? "PUT" : "POST",
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
        toast.error(data?.error || (editId ? "修改失败" : "创建失败"));
        return;
      }
      if (editId) {
        toast.success("排程已修改");
        onEdited?.();
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

  const filterChip = (
    value: string,
    active: boolean,
    onPick: () => void
  ) => (
    <button
      key={value}
      type="button"
      aria-pressed={active}
      data-on={active}
      onClick={onPick}
      className="skeu-fchip"
    >
      {value}
    </button>
  );

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <AppDialogContent
        size="workbench"
        className="flex h-[min(780px,calc(100dvh-24px))] flex-col p-0 [&>button]:cursor-pointer"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-lg">{editId ? "改菜单" : "去排菜"}</DialogTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {editId
              ? "调整门店、售卖日期或菜品份数；保存后切配工单与采购计划将按新菜单重新生成。"
              : "先确认门店与售卖日期，再从已发布菜品中组成当日菜单。"}
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fcfbfa,#fbf9f6)] px-5 py-4 lg:overflow-hidden">
          {loading ? (
            <LoadingState type="card-grid" rows={2} />
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-3.5">
              <section className="grid flex-none grid-cols-1 gap-3.5 rounded-[var(--sk-radius-md)] border border-skeu-border bg-[linear-gradient(180deg,#fff,#fdfcfb)] p-3.5 shadow-sk-raised lg:grid-cols-[minmax(320px,4fr)_minmax(0,7fr)]">
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
                    className="w-full"
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
                  <div className="min-w-[200px] max-w-sm flex-1">
                    <DatePicker
                      value={scheduleDate}
                      onChange={setScheduleDate}
                      placeholder="请选择售卖日期"
                      showWeekday
                    />
                  </div>
                </FormField>
              </section>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 lg:grid-cols-[minmax(320px,4fr)_minmax(0,7fr)] lg:grid-rows-1">
                <section className="skeu-panel flex min-h-0 flex-col overflow-hidden">
                  <header className="skeu-panel-toolbar flex items-center justify-between gap-2.5 px-3.5 py-3">
                    <h2 className="text-sm font-bold">已排菜单</h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      <b className="text-foreground">{selected.length}</b> 道 ·{" "}
                      <b className="text-foreground">{totalQuantity}</b> 份
                    </span>
                  </header>
                  <div className="skeu-panel-body skeu-scroll min-h-0 flex-1 overflow-y-auto p-3">
                    {selected.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        请在右侧选择菜品
                      </p>
                    ) : (
                      <ul className="space-y-2.5">
                        {selected.map((item) => (
                          <li key={item.dishId} className="skeu-picked-card grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 px-3 py-2.5 pl-4">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-[#2f4237]">
                                {item.name}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#687a70]">
                                {item.categoryName && (
                                  <span className="inline-flex h-5 items-center rounded-full border border-[#d4e3d9] bg-white/75 px-1.5 text-xs font-bold text-[#5d7265]">
                                    {item.categoryName}
                                  </span>
                                )}
                                <PortionTag portion={item.portion} className="h-5 text-xs" />
                                {item.price != null && (
                                  <span className="font-mono font-bold">
                                    {formatMoney(item.price)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label={`移除 ${item.name}`}
                              onClick={() =>
                                setSelected((previous) =>
                                  previous.filter((row) => row.dishId !== item.dishId)
                                )
                              }
                              className="skeu-icon-btn size-7 shrink-0 text-muted-foreground hover:text-[#b42318]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <div className="col-span-2 mt-1.5 flex items-center justify-end gap-1.5">
                              <SkeuButton
                                size="icon-sm"
                                variant="outline"
                                aria-label={`减少 ${item.name} 份数`}
                                onClick={() => changeQuantity(item.dishId, item.quantity - 1)}
                              >
                                <Minus className="h-3 w-3" />
                              </SkeuButton>
                              <Input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(event) =>
                                  changeQuantity(item.dishId, Number(event.target.value))
                                }
                                className="skeu-input h-7 w-14 text-center font-mono font-bold"
                                aria-label={`${item.name} 份数`}
                              />
                              <SkeuButton
                                size="icon-sm"
                                variant="outline"
                                aria-label={`增加 ${item.name} 份数`}
                                onClick={() => changeQuantity(item.dishId, item.quantity + 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </SkeuButton>
                              <span className="ml-1 text-xs text-muted-foreground">份</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <footer className="skeu-panel-toolbar flex items-center justify-between gap-2.5 px-3.5 py-2.5 text-xs text-muted-foreground">
                    <span>默认份数为 1，最新选中的排在最前</span>
                    <button
                      type="button"
                      onClick={() => setSelected([])}
                      className="h-7 rounded-[var(--sk-radius-xs)] px-2 text-xs font-bold text-[#a3572f] transition-colors hover:bg-[#fbe7dc]"
                    >
                      清空菜单
                    </button>
                  </footer>
                </section>

                <section className="skeu-panel flex min-h-0 flex-col overflow-hidden">
                  <div className="skeu-panel-toolbar relative flex items-center gap-2 px-3.5 py-3">
                    <SkeuSearch
                      value={search}
                      onChange={setSearch}
                      placeholder="搜索菜品名称或编码..."
                      aria-label="搜索菜品名称或编码"
                    />
                    <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                      <PopoverTrigger
                        aria-label="筛选菜品"
                        className="skeu-btn skeu-btn-outline flex h-11 shrink-0 items-center gap-1.5 rounded-[var(--sk-radius-sm)] px-3 text-[13px] font-semibold data-[state=open]:bg-[#f6f3ef]"
                      >
                        <SlidersHorizontal className="h-4 w-4" />
                        筛选
                        {activeFilterCount > 0 && (
                          <span className="grid h-5 min-w-5 place-items-center rounded-full border border-current text-xs font-bold">
                            {activeFilterCount}
                          </span>
                        )}
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        sideOffset={6}
                        className="w-[min(420px,calc(100vw-28px))] rounded-[var(--sk-radius-md)] border-skeu-border bg-[linear-gradient(180deg,#fff,#fdfcfb)] p-3.5 shadow-sk-2 ring-0"
                      >
                        <section>
                          <h3 className="mb-2 text-xs font-bold text-muted-foreground">
                            菜品类别
                          </h3>
                          <div className="flex flex-wrap gap-1.5">
                            {["全部", ...categoryOptions].map((name) =>
                              filterChip(name, categoryFilter === name, () =>
                                setCategoryFilter(name === "全部" ? "all" : name)
                              )
                            )}
                          </div>
                        </section>
                        <section className="mt-3">
                          <h3 className="mb-2 text-xs font-bold text-muted-foreground">份量</h3>
                          <div className="flex flex-wrap gap-1.5">
                            {["全部", ...portionOptions].map((name) =>
                              filterChip(name, portionFilter === name, () =>
                                setPortionFilter(name === "全部" ? "all" : name)
                              )
                            )}
                          </div>
                        </section>
                        <section className="mt-3">
                          <h3 className="mb-2 text-xs font-bold text-muted-foreground">售价</h3>
                          <div className="flex flex-wrap gap-1.5">
                            {PRICE_FILTERS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                aria-pressed={priceFilter === option.value}
                                data-on={priceFilter === option.value}
                                onClick={() => setPriceFilter(option.value)}
                                className="skeu-fchip"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </section>
                        <div className="mt-3.5 flex items-center justify-between border-t border-skeu-border pt-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setCategoryFilter("all");
                              setPortionFilter("all");
                              setPriceFilter("all");
                            }}
                            className="h-8 px-2.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                          >
                            清空筛选
                          </button>
                          <button
                            type="button"
                            onClick={() => setFilterOpen(false)}
                            className="skeu-fchip"
                          >
                            完成
                          </button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="skeu-panel-body skeu-scroll min-h-0 flex-1 overflow-y-auto p-3">
                    {filteredDishes.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        未找到匹配的已发布菜品
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
                        {filteredDishes.map((dish) => {
                          const picked = selected.some((item) => item.dishId === dish.id);
                          return (
                            <button
                              key={dish.id}
                              type="button"
                              aria-pressed={picked}
                              data-on={picked}
                              onClick={() => toggleDish(dish)}
                              className="skeu-dish-card p-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                {dish.category?.name ? (
                                  <span className="inline-flex h-[22px] items-center rounded-full bg-[#f4f1eb] px-1.5 text-xs font-bold text-[#6d675f]">
                                    {dish.category.name}
                                  </span>
                                ) : (
                                  <span />
                                )}
                                <span className="skeu-pick-dot">
                                  <Check strokeWidth={3} />
                                </span>
                              </div>
                              <div className="mt-2 truncate pr-5 text-sm font-bold text-[#36312a]">
                                {dish.name}
                              </div>
                              <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                                {dish.code}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <PortionTag portion={dish.portion} className="h-[22px] px-1.5 text-xs" />
                                <span className="font-mono text-[13px] font-bold text-[#7a4a2a] tabular-nums">
                                  {formatMoney(dish.price)}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <footer className="skeu-panel-toolbar flex items-center justify-between gap-2.5 px-3.5 py-2.5 text-xs text-muted-foreground">
                    <span>仅展示已发布菜品</span>
                    <span className="tabular-nums">共 {filteredDishes.length} 道可选</span>
                  </footer>
                </section>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-[linear-gradient(180deg,#fff,#fdfcfb)] px-5 py-3.5">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span
              className={
                canSubmit
                  ? "flex items-center gap-2 text-[13px] font-bold text-[#4d6b5c]"
                  : "flex items-center gap-2 text-[13px] text-muted-foreground"
              }
            >
              <span
                className={
                  canSubmit
                    ? "grid size-[22px] place-items-center rounded-full border border-[#bfdacd] bg-[#eaf6ef]"
                    : "grid size-[22px] place-items-center rounded-full border border-skeu-border bg-[linear-gradient(180deg,#fbf9f6,#f6f3ef)]"
                }
              >
                {canSubmit ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#1e6d47]" />
                ) : (
                  <Info className="h-3.5 w-3.5 text-[#8a847c]" />
                )}
              </span>
              {validationText}
            </span>
            <div className="flex items-center gap-2">
              <SkeuButton
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                disabled={!canSubmit}
              >
                预览菜单
              </SkeuButton>
              <SkeuButton variant="outline" onClick={onClose} disabled={submitting}>
                取消
              </SkeuButton>
              <SkeuButton onClick={handleSubmit} disabled={!canSubmit}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editId ? "保存修改" : "完成排菜"}
              </SkeuButton>
            </div>
          </div>
        </DialogFooter>
      </AppDialogContent>

      <RecordSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={storeName || "未选择门店"}
        meta={
          <span className="font-semibold text-[#5d7265]">
            {scheduleDate || "未选择日期"}
            {scheduleDate ? ` · ${getWeekDay(scheduleDate)}` : ""} · 待确认
          </span>
        }
        bodyClassName="skeu-scroll bg-[linear-gradient(180deg,#fcfbfa,#f9f7f3)] px-4 py-4"
        footer={
          <>
            <span className="mr-auto text-[13px] font-bold text-[#4d6b5c] tabular-nums">
              合计 <b className="text-base">{selected.length}</b> 菜 /{" "}
              <b className="text-base">{totalQuantity}</b> 份
              {totalAmount > 0 && (
                <span className="ml-2 font-mono font-normal text-muted-foreground">
                  约 {formatMoney(totalAmount)}
                </span>
              )}
            </span>
            <SkeuButton variant="outline" onClick={() => setPreviewOpen(false)}>
              继续调整
            </SkeuButton>
            <SkeuButton onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {editId ? "确认并保存" : "确认并完成"}
            </SkeuButton>
          </>
        }
      >
        <ul className="space-y-2.5">
          {selected.map((item) => (
            <li
              key={item.dishId}
              className="skeu-picked-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 pl-4"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-[#2f4237]">
                  {item.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#687a70]">
                  {item.categoryName && (
                    <span className="inline-flex h-5 items-center rounded-full border border-[#d4e3d9] bg-white/75 px-1.5 text-xs font-bold text-[#5d7265]">
                      {item.categoryName}
                    </span>
                  )}
                  <PortionTag portion={item.portion} className="h-5 text-xs" />
                  {item.price != null && (
                    <span className="font-mono font-bold">
                      {formatMoney(item.price)}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-sm font-bold text-[#2f4237] tabular-nums">
                <b className="font-mono text-base">{item.quantity}</b> 份
              </span>
            </li>
          ))}
        </ul>
      </RecordSheet>
    </Dialog>
  );
}
