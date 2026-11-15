"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { statusToVariant } from "@/app/components/ui/status-badge";
import type { StatusVariant } from "@/app/components/ui/status-badge";
import { UserMenu } from "@/app/components/ui/user-menu";
import { parseObject } from "@/lib/client/api";
import { SCHEDULE_STATUS_OPTIONS } from "@/lib/shared/schedule-status";
import { formatPortionsValue } from "@/lib/shared/prepped-stock";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";

interface CurrentUser {
  username: string;
  name?: string | null;
  role?: string | null;
}

interface ScheduleCardData {
  id: number;
  date: string;
  status: string;
  storeName: string;
  dishCount: number;
  totalQuantity: number;
  plannedAmount: number | null;
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
    dot: "bg-[var(--status-info-solid)]",
    text: "text-[var(--status-info-solid)]",
    card: "bg-[var(--status-info-solid)]",
  },
  success: {
    dot: "bg-[var(--status-success-solid)]",
    text: "text-[var(--status-success-solid)]",
    card: "bg-[var(--status-success-solid)]",
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

export default function HomePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<WeeklyData | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, [startDate, endDate]);

  const schedulesByDate = useMemo(
    () => groupByDate(data?.schedules ?? []),
    [data]
  );
  const plansByDate = useMemo(() => groupByDate(data?.plans ?? []), [data]);

  const hour = new Date().getHours();
  const greeting =
    hour < 6 ? "凌晨好" : hour < 12 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
  const displayName = user?.name || user?.username || "";

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
          onClick={() => setWeekOffset((value) => value - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium tabular-nums">
          {formatCnDate(startDate)} — {formatCnDate(endDate)}
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="下一周"
          onClick={() => setWeekOffset((value) => value + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {weekOffset !== 0 && (
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
            <Undo2 className="mr-1 h-3.5 w-3.5" />
            返回本周
          </Button>
        )}

        <div className="ml-auto flex items-center gap-4">
          {SCHEDULE_STATUS_OPTIONS.map((option) => (
            <span key={option.value} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn("h-2 w-2 rounded-full", STATUS_STYLE[option.variant].dot)}
              />
              <span className={cn("text-xs font-medium", STATUS_STYLE[option.variant].text)}>
                {option.label}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* 表格式周历：左侧单据行名 + 7 个日期列，日期列贯穿两行，保证日期与数据的对应关系 */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))]">
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
                createHref="/schedules"
                createLabel="新增排程"
              >
                {loading ? (
                  <ColumnSkeleton />
                ) : (
                  items.map((item) => <ScheduleCard key={item.id} item={item} />)
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
                createHref="/production-plans"
                createLabel="新增计划"
              >
                {loading ? (
                  <ColumnSkeleton />
                ) : (
                  items.map((item) => <PlanCard key={item.id} item={item} />)
                )}
              </DayCell>
            );
          })}
        </div>
      </div>
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

/** 一天一列中的一个单据区格子；今天及以后，鼠标移入才淡出新增入口 */
function DayCell({
  date,
  today,
  loading,
  itemCount,
  createHref,
  createLabel,
  children,
}: {
  date: string;
  today: string;
  loading: boolean;
  itemCount: number;
  createHref: string;
  createLabel: string;
  children: React.ReactNode;
}) {
  const isEditable = date >= today && !loading;
  const isToday = date === today;

  return (
    <div
      className={cn(
        "group relative min-h-44 space-y-2 border-l border-t border-border p-2",
        isToday && "bg-primary/[0.03]"
      )}
    >
      {children}

      {isEditable && itemCount === 0 && (
        <Link
          href={createHref}
          className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:border-primary/40 group-hover:text-primary group-hover:opacity-100"
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {createLabel}
        </Link>
      )}
      {isEditable && itemCount > 0 && (
        <Link
          href={createHref}
          aria-label={createLabel}
          title={createLabel}
          className="pointer-events-none absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-primary group-hover:pointer-events-auto group-hover:opacity-100"
        >
          <Plus className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

function ScheduleCard({ item }: { item: ScheduleCardData }) {
  const style = STATUS_STYLE[statusToVariant(item.status)];
  return (
    <Link
      href={`/schedules/${item.id}`}
      className={cn(
        "block rounded-md p-2 text-white shadow-sm transition-[filter] hover:brightness-105",
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
    </Link>
  );
}

function PlanCard({ item }: { item: PlanCardData }) {
  const style = STATUS_STYLE[statusToVariant(item.status)];
  return (
    <Link
      href={`/production-plans/${item.id}`}
      className={cn(
        "block rounded-md p-2 text-white shadow-sm transition-[filter] hover:brightness-105",
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
      />
    </Link>
  );
}

function CardStats({
  firstLabel,
  firstValue,
  secondValue,
  amount,
}: {
  firstLabel: string;
  firstValue: string;
  secondValue: string;
  amount: number | null;
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
        <span className="shrink-0 text-xs text-white/75">计划销售额</span>
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
