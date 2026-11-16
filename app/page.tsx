"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { statusToVariant } from "@/app/components/ui/status-badge";
import type { StatusVariant } from "@/app/components/ui/status-badge";
import { UserMenu } from "@/app/components/ui/user-menu";
import { SchedulePreviewDialog } from "@/app/components/ui/schedule-preview-dialog";
import { ProductionPlanPreviewDialog } from "@/app/components/ui/production-plan-preview-dialog";
import { ScheduleCreateDialog } from "@/app/components/schedule/schedule-create-dialog";
import { ProductionPlanCreateDialog } from "@/app/components/production-plan/production-plan-create-dialog";
import { parseObject } from "@/lib/client/api";
import { canAccessApi } from "@/lib/shared/access-control";
import { useCurrentRole } from "@/lib/client/use-current-role";
import { SCHEDULE_STATUS_OPTIONS } from "@/lib/shared/schedule-status";
import { formatPortionsValue } from "@/lib/shared/prepped-stock";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";

interface CurrentUser {
  username: string;
  name?: string | null;
  role?: string | null;
}

/** 排程单里的一道菜：悬浮速览用 */
interface ScheduleDishItem {
  id: number;
  dishName: string;
  quantity: number;
  amount: number | null;
}

interface ScheduleCardData {
  id: number;
  date: string;
  status: string;
  storeName: string;
  dishCount: number;
  totalQuantity: number;
  plannedAmount: number | null;
  items: ScheduleDishItem[];
}

interface PlanCardData {
  id: number;
  date: string;
  status: string;
  netKinds: number;
  totalPortions: number | null;
  plannedAmount: number | null;
}

interface WeeklyData {
  schedules: ScheduleCardData[];
  plans: PlanCardData[];
}

const DOW_LABELS = ["一", "二", "三", "四", "五", "六", "日"];
const WEEKDAY_NAMES = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/** 状态色只取状态 Token；两类单据共用同一套中色系实色底 */
const STATUS_STYLE: Record<
  StatusVariant,
  { dot: string; text: string; card: string }
> = {
  warning: {
    dot: "bg-[var(--status-warning-solid)]",
    text: "text-[var(--status-warning-solid)]",
    card: "bg-[var(--status-warning-solid)]",
  },
  info: {
    dot: "bg-[var(--status-progress-solid)]",
    text: "text-[var(--status-progress-solid)]",
    card: "bg-[var(--status-progress-solid)]",
  },
  success: {
    dot: "bg-[var(--status-done-solid)]",
    text: "text-[var(--status-done-solid)]",
    card: "bg-[var(--status-done-solid)]",
  },
  danger: {
    dot: "bg-[var(--status-danger-solid)]",
    text: "text-[var(--status-danger-solid)]",
    card: "bg-[var(--status-danger-solid)]",
  },
  neutral: {
    dot: "bg-[var(--status-neutral-solid)]",
    text: "text-[var(--status-neutral-solid)]",
    card: "bg-[var(--status-neutral-solid)]",
  },
};

function formatDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function getWeekDays(offset: number): Date[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatCnDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatMoney(value: number | null) {
  return value != null ? `¥${value.toFixed(2)}` : "—";
}

function groupByDate<T extends { date: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.date);
    if (list) list.push(row);
    else map.set(row.date, [row]);
  }
  return map;
}

function mondayOf(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return monday;
}

/** URL 上的 week（该周任意一天）→ 相对本周的周偏移 */
function weekOffsetFromParam(value: string | null): number {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 0;
  const target = new Date(`${value}T00:00:00`);
  if (Number.isNaN(target.getTime())) return 0;
  const diff = mondayOf(target).getTime() - mondayOf(new Date()).getTime();
  return Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [weekOffset, setWeekOffset] = useState(() =>
    weekOffsetFromParam(searchParams.get("week"))
  );
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduleDialogDate, setScheduleDialogDate] = useState<string | null>(null);
  const [planDialogDate, setPlanDialogDate] = useState<string | null>(null);
  const [previewScheduleId, setPreviewScheduleId] = useState<number | null>(null);
  const [previewPlanId, setPreviewPlanId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const role = useCurrentRole();
  const canCreateSchedule = canAccessApi("/api/schedules", "POST", role);
  const canCreatePlan = canAccessApi("/api/production-plans", "POST", role);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const startDate = formatDate(weekDays[0]);
  const endDate = formatDate(weekDays[6]);
  const todayStr = formatDate(new Date());

  // 周切换时在渲染期置加载态（prev-props 派生范式，避免 effect 内同步 setState）
  const [prevRange, setPrevRange] = useState({ startDate, endDate });
  if (prevRange.startDate !== startDate || prevRange.endDate !== endDate) {
    setPrevRange({ startDate, endDate });
    setLoading(true);
  }

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const result = await parseObject<{ user: CurrentUser }>(res);
        setUser(result?.user ?? null);
      } catch {
        // 忽略，问候语降级为通用文案
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchWeekly = async () => {
      try {
        const params = new URLSearchParams({ startDate, endDate });
        const res = await fetch(`/api/dashboard/weekly?${params.toString()}`);
        const result = await parseObject<WeeklyData>(res);
        if (!alive) return;
        setData(result ?? { schedules: [], plans: [] });
      } catch {
        if (!alive) return;
        toast.error("获取周视图数据失败");
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchWeekly();
    return () => {
      alive = false;
    };
  }, [startDate, endDate, refreshKey]);

  const schedulesByDate = useMemo(
    () => groupByDate(data?.schedules ?? []),
    [data]
  );
  const plansByDate = useMemo(() => groupByDate(data?.plans ?? []), [data]);

  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? "凌晨好" : hour < 12 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
  const displayName = user?.name || user?.username || "";

  // 切周同时写回 URL（?week=该周周一），刷新或分享链接能回到同一周
  const applyWeek = (offset: number) => {
    setWeekOffset(offset);
    const params = new URLSearchParams(searchParams.toString());
    if (offset === 0) params.delete("week");
    else params.set("week", formatDate(getWeekDays(offset)[0]));
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* 顶部：问候 + 个人菜单 */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {displayName ? `${greeting}，${displayName}` : "工作台"}
          </h1>
          <p className="text-muted-foreground">
            {formatCnDate(todayStr)} {WEEKDAY_NAMES[new Date().getDay()]}
          </p>
        </div>
        <UserMenu user={user} />
      </div>

      {/* 日期切换 + 状态图例（同一行） */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="上一周"
          onClick={() => applyWeek(weekOffset - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-bold tabular-nums">
          {formatCnDate(startDate)} — {formatCnDate(endDate)}
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="下一周"
          onClick={() => applyWeek(weekOffset + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {weekOffset !== 0 && (
          <Button variant="ghost" size="sm" onClick={() => applyWeek(0)}>
            <Undo2 className="mr-1 h-3.5 w-3.5" />
            返回本周
          </Button>
        )}

        <div className="ml-auto flex items-center gap-4">
          {SCHEDULE_STATUS_OPTIONS.map((option) => (
            <span key={option.value} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn("h-2.5 w-2.5 rounded-full", STATUS_STYLE[option.variant].dot)}
              />
              <span className={cn("text-sm font-bold", STATUS_STYLE[option.variant].text)}>
                {option.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* 表格式周历：左侧单据行名 + 7 个日期列，日期列贯穿两行；窄屏横向滚动 */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <div className="grid min-w-[840px] grid-cols-[5rem_repeat(7,minmax(0,1fr))]">
          <div className="px-3 py-2.5 text-xs text-muted-foreground">日期</div>
          {weekDays.map((day, index) => {
            const ds = formatDate(day);
            const isToday = ds === todayStr;
            return (
              <div
                key={ds}
                className={cn(
                  "border-l border-border px-2 py-2 text-center",
                  isToday && "bg-primary/[0.05]"
                )}
              >
                <div className="text-xs text-muted-foreground">周{DOW_LABELS[index]}</div>
                <div className="text-sm font-bold tabular-nums">
                  {day.getMonth() + 1}/{day.getDate()}
                </div>
                <div className={cn("h-4 text-xs", isToday ? "text-primary" : undefined)}>
                  {isToday ? "今天" : ""}
                </div>
              </div>
            );
          })}

          <RowLabel title="菜品排程单" />
          {weekDays.map((day) => {
            const ds = formatDate(day);
            const items = schedulesByDate.get(ds) ?? [];
            return (
              <DayCell
                key={`schedule-${ds}`}
                today={todayStr}
                date={ds}
                loading={loading}
                itemCount={items.length}
                createLabel="新增排程"
                onCreate={
                  canCreateSchedule ? () => setScheduleDialogDate(ds) : undefined
                }
              >
                {loading ? (
                  <ColumnSkeleton />
                ) : (
                  items.map((item) => (
                    <ScheduleCard
                      key={item.id}
                      item={item}
                      onOpen={() => setPreviewScheduleId(item.id)}
                    />
                  ))
                )}
              </DayCell>
            );
          })}

          <RowLabel title="生产计划单" />
          {weekDays.map((day) => {
            const ds = formatDate(day);
            const items = plansByDate.get(ds) ?? [];
            return (
              <DayCell
                key={`plan-${ds}`}
                today={todayStr}
                date={ds}
                loading={loading}
                itemCount={items.length}
                createLabel="新增计划"
                onCreate={canCreatePlan ? () => setPlanDialogDate(ds) : undefined}
              >
                {loading ? (
                  <ColumnSkeleton />
                ) : (
                  items.map((item) => (
                    <PlanCard
                      key={item.id}
                      item={item}
                      onOpen={() => setPreviewPlanId(item.id)}
                    />
                  ))
                )}
              </DayCell>
            );
          })}
        </div>
      </div>

      <SchedulePreviewDialog
        scheduleId={previewScheduleId}
        onClose={() => setPreviewScheduleId(null)}
      />
      <ProductionPlanPreviewDialog
        planId={previewPlanId}
        onClose={() => setPreviewPlanId(null)}
      />

      {scheduleDialogDate && (
        <ScheduleCreateDialog
          presetDate={scheduleDialogDate}
          onClose={() => setScheduleDialogDate(null)}
          onCreated={() => {
            setScheduleDialogDate(null);
            setRefreshKey((value) => value + 1);
          }}
        />
      )}
      {planDialogDate && (
        <ProductionPlanCreateDialog
          presetDate={planDialogDate}
          onClose={() => setPlanDialogDate(null)}
          onCreated={() => {
            setPlanDialogDate(null);
            setRefreshKey((value) => value + 1);
          }}
        />
      )}
    </div>
  );
}

function RowLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center border-t border-border py-4">
      <span className="text-sm font-semibold tracking-[0.25em] [writing-mode:vertical-rl]">
        {title}
      </span>
    </div>
  );
}

/** 一天一列中的一个单据区格子；今天及以后，卡片下方的空槽位悬浮才显示新增 */
function DayCell({
  date,
  today,
  loading,
  itemCount,
  createLabel,
  onCreate,
  children,
}: {
  date: string;
  today: string;
  loading: boolean;
  itemCount: number;
  createLabel: string;
  onCreate?: () => void;
  children: React.ReactNode;
}) {
  const isEditable = date >= today && !loading;
  const isToday = date === today;
  const hasFreeSlot = itemCount < 2;

  return (
    <div
      className={cn(
        "group relative min-h-[13.5rem] border-l border-t border-border p-2",
        isToday && "bg-primary/[0.03]"
      )}
    >
      <div className="space-y-2">
        {children}

        {isEditable && onCreate && hasFreeSlot && (
          <button
            type="button"
            onClick={onCreate}
            className="flex h-24 w-full items-center justify-center rounded-md border border-dashed border-transparent text-xs text-muted-foreground opacity-0 transition-opacity hover:border-border hover:bg-muted/30 hover:text-primary hover:opacity-100"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {createLabel}
          </button>
        )}

        {/* 已排满两卡：悬浮整格时下方临时展开一张卡高度的新增槽位 */}
        {isEditable && onCreate && !hasFreeSlot && (
          <div className="max-h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-h-28 group-hover:opacity-100">
            <button
              type="button"
              onClick={onCreate}
              className="mt-2 flex h-24 w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {createLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleCard({
  item,
  onOpen,
}: {
  item: ScheduleCardData;
  onOpen: () => void;
}) {
  const style = STATUS_STYLE[statusToVariant(item.status)];
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        onClick={onOpen}
        className={cn(
          "block w-full min-h-[6rem] rounded-md p-2 text-left text-white shadow-sm transition-[filter] hover:brightness-105",
          style.card
        )}
      >
        <div className="truncate text-sm font-semibold">{item.storeName}</div>
        <CardStats
          firstLabel="菜品"
          firstValue={String(item.dishCount)}
          secondValue={String(item.totalQuantity)}
          amount={item.plannedAmount}
        />
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="start"
        sideOffset={8}
        className="block w-80 max-w-none gap-0 rounded-xl bg-popover p-0 text-popover-foreground shadow-xl ring-1 ring-border [&>div]:bg-popover [&>div]:fill-popover"
      >
        <DishPeekPanel
          storeName={item.storeName}
          items={item.items}
          totalQuantity={item.totalQuantity}
          totalAmount={item.plannedAmount}
          accentClass={style.dot}
        />
      </TooltipContent>
    </Tooltip>
  );
}

/** 悬浮速览：今天要卖哪些菜、各多少份、计划销售额多少 */
function DishPeekPanel({
  storeName,
  items,
  totalQuantity,
  totalAmount,
  accentClass,
}: {
  storeName: string;
  items: ScheduleDishItem[];
  totalQuantity: number;
  totalAmount: number | null;
  accentClass: string;
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl bg-popover">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/60 px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", accentClass)} />
          售卖菜品
        </span>
        <span className="truncate text-xs text-muted-foreground">{storeName}</span>
      </div>

      <div className="grid grid-cols-[1fr_3.5rem_5.5rem] items-center gap-x-2 border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span>菜品名称</span>
        <span className="text-right">份数</span>
        <span className="text-right">计划销售额</span>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_3.5rem_5.5rem] items-center gap-x-2 border-b border-border/60 px-3 py-1.5 last:border-b-0"
          >
            <span className="truncate text-sm text-foreground">{item.dishName}</span>
            <span className="text-right font-mono text-sm text-muted-foreground">
              {item.quantity}
            </span>
            <span className="text-right font-mono text-sm font-semibold text-foreground">
              {formatMoney(item.amount)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t bg-muted/60 px-3 py-2">
        <span className="text-xs font-semibold text-foreground">
          合计 {items.length} 个菜品
        </span>
        <span className="flex items-baseline gap-3">
          <span className="font-mono text-sm font-semibold text-foreground">
            {totalQuantity} 份
          </span>
          <span className="font-mono text-sm font-bold text-primary">
            {formatMoney(totalAmount)}
          </span>
        </span>
      </div>
    </div>
  );
}

function PlanCard({
  item,
  onOpen,
}: {
  item: PlanCardData;
  onOpen: () => void;
}) {
  const style = STATUS_STYLE[statusToVariant(item.status)];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "block w-full min-h-[6rem] rounded-md p-2 text-left text-white shadow-sm transition-[filter] hover:brightness-105",
        style.card
      )}
    >
      <div className="truncate text-sm font-semibold">生产计划</div>
      <CardStats
        firstLabel="净菜"
        firstValue={String(item.netKinds)}
        secondValue={
          item.totalPortions != null ? formatPortionsValue(item.totalPortions) : "—"
        }
        amount={item.plannedAmount}
        amountLabel="净料总金额"
      />
    </button>
  );
}

function CardStats({
  firstLabel,
  firstValue,
  secondValue,
  amount,
  amountLabel = "计划销售额",
}: {
  firstLabel: string;
  firstValue: string;
  secondValue: string;
  amount: number | null;
  amountLabel?: string;
}) {
  return (
    <>
      <div className="mt-1.5 flex items-center justify-between border-t border-white/25 pt-1.5">
        <span className="text-xs text-white/75">
          {firstLabel} <b className="font-mono text-sm font-semibold text-white">{firstValue}</b>
        </span>
        <span className="text-xs text-white/75">
          份数 <b className="font-mono text-sm font-semibold text-white">{secondValue}</b>
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className="shrink-0 text-xs text-white/75">{amountLabel}</span>
        <span className="truncate font-mono text-sm font-semibold text-white">
          {formatMoney(amount)}
        </span>
      </div>
    </>
  );
}

function ColumnSkeleton() {
  return (
    <div className="h-16 animate-pulse rounded-md border border-border bg-card" aria-hidden="true" />
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-8" aria-busy="true" aria-label="正在加载">
      <div className="h-14 w-64 animate-pulse rounded-lg bg-muted" />
      <div className="h-9 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="h-96 animate-pulse rounded-xl border border-border bg-card" />
    </div>
  );
}
