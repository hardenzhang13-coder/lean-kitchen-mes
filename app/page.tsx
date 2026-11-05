"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { SelectField } from "@/app/components/ui/select-field";
import { parseList, parseObject } from "@/lib/client/api";
import { toast } from "sonner";

interface StoreOption {
  id: number;
  name: string;
}

interface DailyItem {
  id: number;
  dishId: number;
  name: string;
  portion: string | null;
  meatType: string | null;
  categoryName: string | null;
  quantity: number;
  soldQty: number | null;
  diff: number | null;
  sellRate: number | null;
  price: number | null;
  amount: number | null;
}

interface DailySummary {
  planQty: number;
  soldQty: number;
  sellThrough: number | null;
  revenue: number | null;
}

interface DailySchedule {
  id: number;
  title: string;
  scheduleDate: string;
  status: string;
  scope: string;
}

interface DailyData {
  schedule: DailySchedule | null;
  store: StoreOption | null;
  recorded: boolean;
  summary: DailySummary | null;
  items: DailyItem[];
}

const STORE_KEY = "dashboard-store-id";
const DOW_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

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

function getWeekDay(dateStr: string) {
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return days[new Date(dateStr).getDay()];
}

function formatCnDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatMoney(value: number | null) {
  return value != null ? `¥${value.toFixed(2)}` : "—";
}

export default function HomePage() {
  const [userName, setUserName] = useState("");
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [storeId, setStoreId] = useState("1");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);

  const weekDays = useMemo(() => getWeekDays(weekOffset), [weekOffset]);
  const todayStr = formatDate(new Date());

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const result = await parseObject<{ user: { name?: string | null; username: string } }>(res);
        setUserName(result?.user?.name || result?.user?.username || "");
      } catch {
        // 忽略，问候语降级为通用文案
      }
    };
    const fetchStores = async () => {
      try {
        const res = await fetch("/api/stores");
        const list = await parseObject<StoreOption[]>(res);
        if (list && list.length > 0) setStores(list);
      } catch {
        toast.error("获取门店失败");
      }
    };
    fetchUser();
    fetchStores();
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) setStoreId(saved);
  }, []);

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate, storeId });
      const res = await fetch(`/api/dashboard/daily?${params.toString()}`);
      const result = await parseObject<DailyData>(res);
      setData(result);
    } catch {
      toast.error("获取复盘数据失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, storeId]);

  useEffect(() => {
    fetchDaily();
  }, [fetchDaily]);

  const changeWeek = (delta: number) => {
    const next = weekOffset + delta;
    setWeekOffset(next);
    const days = getWeekDays(next);
    if (!days.some((d) => formatDate(d) === selectedDate)) {
      // 切周后选中日期不在该周：选中与今天相同的星期几（落在今天之前的周则选周内同一天）
      const idx = Math.min((new Date().getDay() + 6) % 7, 6);
      setSelectedDate(formatDate(days[idx]));
    }
  };

  const handleStoreChange = (value: string) => {
    setStoreId(value);
    localStorage.setItem(STORE_KEY, value);
  };

  const hour = new Date().getHours();
  const greeting = hour < 6 ? "凌晨好" : hour < 12 ? "早上好" : hour < 14 ? "中午好" : hour < 18 ? "下午好" : "晚上好";

  const schedule = data?.schedule ?? null;
  const summary = data?.summary ?? null;

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* 顶部：问候 + 门店切换 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {userName ? `${greeting}，${userName}` : "工作台"}
          </h1>
          <p className="text-muted-foreground">
            {formatCnDate(todayStr)} {getWeekDay(todayStr)}
          </p>
        </div>
        <SelectField
          value={storeId}
          onChange={handleStoreChange}
          options={stores.map((s) => ({ value: String(s.id), label: s.name }))}
          className="w-[180px]"
        />
      </div>

      {/* 周日历条 */}
      <div className="flex items-center gap-2">
        <button
          aria-label="上一周"
          className="rounded-lg border p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          onClick={() => changeWeek(-1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 grid grid-cols-7 gap-2">
          {weekDays.map((d, i) => {
            const ds = formatDate(d);
            const isSelected = ds === selectedDate;
            const isToday = ds === todayStr;
            return (
              <button
                key={ds}
                className={`rounded-lg border py-2.5 text-center transition-colors ${
                  isSelected
                    ? "border-transparent bg-[#EEF2FF] text-[#6366F1]"
                    : "hover:bg-muted/40"
                }`}
                onClick={() => setSelectedDate(ds)}
              >
                <div className="text-xs text-muted-foreground">周{DOW_LABELS[i]}</div>
                <div className="text-base font-bold">
                  {d.getMonth() + 1}/{d.getDate()}
                </div>
                <div className="text-[11px] h-4">{isToday ? "今天" : ""}</div>
              </button>
            );
          })}
        </div>
        <button
          aria-label="下一周"
          className="rounded-lg border p-2 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          onClick={() => changeWeek(1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 当日复盘单 */}
      {loading ? (
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      ) : !schedule ? (
        <Card className="border-dashed">
          <CardContent className="py-8">
            <EmptyState
              icon={CalendarDays}
              title={`${formatCnDate(selectedDate)} ${getWeekDay(selectedDate)} · 当日无排程`}
              action={{
                label: "去创建排程",
                onClick: () => (window.location.href = "/schedules/new"),
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-4">
            {/* 头部：标题 + 汇总 */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{schedule.title}</h2>
                  <StatusBadge status={schedule.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatCnDate(schedule.scheduleDate)} {getWeekDay(schedule.scheduleDate)}
                  <span className="mx-2">·</span>
                  {data?.store?.name ?? ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {summary ? (
                  <>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      计划 <b className="text-foreground">{summary.planQty}</b> 份
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      售出 <b className="text-foreground">{summary.soldQty}</b> 份
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      售出率{" "}
                      <b className="text-foreground">
                        {summary.sellThrough != null ? `${(summary.sellThrough * 100).toFixed(1)}%` : "—"}
                      </b>
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      营收 <b className="text-[var(--status-success)]">{formatMoney(summary.revenue)}</b>
                    </span>
                  </>
                ) : (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    计划{" "}
                    <b className="text-foreground">
                      {data?.items.reduce((s, i) => s + i.quantity, 0) ?? 0}
                    </b>{" "}
                    份
                  </span>
                )}
                <Link href={`/schedules/${schedule.id}`} className="text-sm text-primary hover:underline">
                  查看排程详情 →
                </Link>
              </div>
            </div>

            {/* 未回录占位 */}
            {!data?.recorded ? (
              <div className="rounded-lg border border-dashed py-12 text-center">
                <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">当日售卖数据未回录</p>
                <p className="text-sm text-muted-foreground mt-1">
                  回录后此处展示售出进度、销售额与销售状态
                </p>
              </div>
            ) : (
              /* 复盘单表格 */
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium w-12">序号</th>
                    <th className="py-2 pr-4 font-medium">菜品 / 规格</th>
                    <th className="py-2 pr-4 font-medium w-[34%]">售出进度（售出 / 计划）</th>
                    <th className="py-2 pr-4 font-medium text-right w-28">销售额</th>
                    <th className="py-2 pr-4 font-medium w-28">销售状态</th>
                    <th className="py-2 font-medium text-right w-24">售价</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((item, idx) => {
                    const rate = item.sellRate != null ? item.sellRate : 0;
                    const isSoldOut = item.diff === 0;
                    const isOver = item.diff != null && item.diff < 0;
                    const isHighLoss =
                      item.diff != null && item.diff > 0 && item.diff / item.quantity >= 0.3;
                    return (
                      <tr key={item.id} className="border-t">
                        <td className="py-3 pr-4 text-muted-foreground">{idx + 1}</td>
                        <td className="py-3 pr-4">
                          <div className="font-medium">{item.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {[item.portion, item.meatType, item.categoryName]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isSoldOut ? "bg-emerald-500" : "bg-[#6366F1]"}`}
                              style={{ width: `${Math.min(100, rate * 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                            <span>
                              <b className="text-foreground">{item.soldQty}</b> / {item.quantity} 份
                            </span>
                            <span>{(rate * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right font-medium tabular-nums">
                          {formatMoney(item.amount)}
                        </td>
                        <td className="py-3 pr-4">
                          {item.diff === 0 ? (
                            <StatusBadge status="✓ 售罄" variant="success" />
                          ) : isOver ? (
                            <StatusBadge status={`多 ${Math.abs(item.diff ?? 0)} 份`} variant="info" />
                          ) : (
                            <StatusBadge status={`剩 ${item.diff} 份`} variant={isHighLoss ? "danger" : "warning"} />
                          )}
                        </td>
                        <td className="py-3 text-right text-muted-foreground tabular-nums">
                          {formatMoney(item.price)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
