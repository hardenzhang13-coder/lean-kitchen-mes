"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock,
  ArrowRight,
  ChefHat,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/app/components/status-badge";
import { EmptyState } from "@/app/components/empty-state";
import { toast } from "sonner";

interface ActiveSchedule {
  id: number;
  title: string;
  scheduleDate: string;
  scope: string;
  status: string;
  items: Array<{
    dish: { name: string };
    quantity: number;
  }>;
  dishCount: number;
  totalQuantity: number;
}

function getWeekDay(dateStr: string) {
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return days[new Date(dateStr).getDay()];
}

export default function HomePage() {
  const [activeSchedules, setActiveSchedules] = useState<ActiveSchedule[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveSchedules();
  }, []);

  const fetchActiveSchedules = async () => {
    try {
      const res = await fetch("/api/schedules/active");
      const data = await res.json();
      setActiveSchedules(data);
      if (data.length > 0) setActiveTab(0);
    } catch {
      toast.error("获取排程数据失败");
    } finally {
      setLoading(false);
    }
  };

  const currentSchedule = activeSchedules[activeTab];

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">工作台</h1>
        <p className="text-muted-foreground">欢迎使用精益厨房管理系统</p>
      </div>

      {/* 今日排程 */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-[var(--info)]" />
          今日排程
        </h2>

        {loading ? (
          <div className="h-40 bg-muted rounded-lg animate-pulse" />
        ) : activeSchedules.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8">
              <EmptyState
                icon={ChefHat}
                title="暂无进行中的排程"
                action={
                  <Link href="/schedules/new" className="text-sm text-primary">
                    去创建一个 →
                  </Link>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-5">
              {/* Tab 切换（多个排程时） */}
              {activeSchedules.length > 1 && (
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                  {activeSchedules.map((s, idx) => (
                    <button
                      key={s.id}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        activeTab === idx
                          ? "bg-[var(--info-muted)] text-[var(--info)]"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setActiveTab(idx)}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              )}

              {currentSchedule && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{currentSchedule.title}</h3>
                        <StatusBadge status="进行中" />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>
                          {new Date(currentSchedule.scheduleDate).toLocaleDateString("zh-CN")}
                          {" "}{getWeekDay(currentSchedule.scheduleDate)}
                        </span>
                        <span>{currentSchedule.scope}</span>
                        <span>{currentSchedule.dishCount} 个菜品 / {currentSchedule.totalQuantity} 份</span>
                      </div>
                    </div>
                    <Link href={`/schedules/${currentSchedule.id}`}>
                      <span className="text-sm text-primary flex items-center gap-1">
                        查看详情 <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </Link>
                  </div>

                  {/* 菜品清单摘要 */}
                  <div className="flex flex-wrap gap-2">
                    {currentSchedule.items.slice(0, 8).map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2.5 py-1"
                      >
                        {item.dish.name}
                        <span className="text-muted-foreground">×{item.quantity}</span>
                      </span>
                    ))}
                    {currentSchedule.items.length > 8 && (
                      <span className="text-xs text-muted-foreground self-center">
                        +{currentSchedule.items.length - 8} 更多
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
