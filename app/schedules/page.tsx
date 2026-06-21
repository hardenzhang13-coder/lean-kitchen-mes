"use client";

import { useEffect, useState } from "react";
import { Plus, Search, CalendarDays, ChefHat, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/app/components/date-picker";
import { PageHeader } from "@/app/components/page-header";
import { StatusBadge } from "@/app/components/status-badge";
import { EmptyState } from "@/app/components/empty-state";
import { toast } from "sonner";

interface ScheduleItem {
  id: number;
  title: string;
  scheduleDate: string;
  scope: string;
  status: string;
  operator: string | null;
  operatorName?: string | null;
  createdAt: string;
  dishCount: number;
  totalQuantity: number;
}

const statusTabs = [
  { key: "", label: "全部" },
  { key: "待生效", label: "待生效" },
  { key: "进行中", label: "进行中" },
  { key: "已完成", label: "已完成" },
];

function getWeekDay(dateStr: string) {
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return days[new Date(dateStr).getDay()];
}

export default function SchedulesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("进行中");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeStatus) params.set("status", activeStatus);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (search) params.set("q", search);
      const res = await fetch(`/api/schedules?${params.toString()}`);
      const data = await res.json();
      setRows(data.data || []);
    } catch {
      toast.error("获取排程数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeStatus, startDate, endDate]);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader title="排程管理" description="设定生产计划，系统自动拆解切配工单与采购计划" />
        <Button onClick={() => router.push("/schedules/new")}>
          <Plus className="mr-2 h-4 w-4" />
          新建排程
        </Button>
      </div>

      {/* 状态 Tab */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeStatus === tab.key
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveStatus(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 筛选 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="搜索排程标题..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <DatePicker
          value={startDate}
          onChange={(v) => setStartDate(v)}
          placeholder="开始日期"
          className="w-[180px]"
        />
        <span className="text-sm text-muted-foreground">至</span>
        <DatePicker
          value={endDate}
          onChange={(v) => setEndDate(v)}
          placeholder="结束日期"
          className="w-[180px]"
        />
        {(startDate || endDate || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setSearch(""); }}>
            清除
          </Button>
        )}
      </div>

      {/* 卡片列表 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="暂无排程"
          action={{
            label: "创建第一个排程",
            onClick: () => router.push("/schedules/new"),
          }}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => router.push(`/schedules/${row.id}`)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-base">{row.title}</h3>
                  <StatusBadge status={row.status} />
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(row.scheduleDate).toLocaleDateString("zh-CN")} {getWeekDay(row.scheduleDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <ChefHat className="h-3.5 w-3.5" />
                    {row.dishCount} 个菜品 / {row.totalQuantity} 份
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {row.scope}
                  </span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                负责人：{row.operatorName || row.operator || "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
