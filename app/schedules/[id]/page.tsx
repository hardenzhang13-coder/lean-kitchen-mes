"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Trash2,
  Pencil,
  ChefHat,
  CalendarDays,
  Clock,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";
import { ScheduleCuttingTable, type CuttingOrderRow, type ScheduleDocMeta } from "@/app/components/schedule/schedule-cutting-table";
import { SchedulePurchaseTable, type PurchasePlanRow } from "@/app/components/schedule/schedule-purchase-table";
import { ScheduleMenuTable } from "@/app/components/schedule/schedule-menu-table";
import { StatusBadge } from "@/app/components/ui/status-badge";

interface ScheduleData {
  id: number;
  title: string;
  scheduleDate: string;
  store: { id: number; name: string } | null;
  status: string;
  operator: string | null;
  operatorName?: string | null;
  createdAt: string;
  items: Array<{
    id: number;
    dishId: number;
    quantity: number;
    dish: {
      id: number;
      code: string;
      name: string;
      portion: string;
      meatType: string | null;
      cost: number | null;
      price: number | null;
      category: { name: string } | null;
    };
  }>;
  cuttingOrders: CuttingOrderRow[];
  purchasePlans: PurchasePlanRow[];
  totalQuantity: number;
  dishCount: number;
}

function getWeekDay(dateStr: string) {
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return days[new Date(dateStr).getDay()];
}

export default function ScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"menu" | "cutting" | "purchase">("menu");

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedules/${id}`);
      const d = await parseObject<ScheduleData>(res);
      if (!d) {
        toast.error("排程不存在");
        return;
      }
      setData(d);
    } catch {
      toast.error("获取排程数据失败");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/schedules/${id}/activate`, { method: "PUT" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "操作失败");
        return;
      }
      toast.success("生产计划已确认");
      fetchData();
    } catch {
      toast.error("操作出错");
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/schedules/${id}/complete`, { method: "PUT" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "操作失败");
        return;
      }
      toast.success("生产已完成");
      fetchData();
    } catch {
      toast.error("操作出错");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("确定删除此排程？")) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || "删除失败");
        return;
      }
      toast.success("排程已删除");
      router.push("/schedules");
    } catch {
      toast.error("删除出错");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div className="h-[200px] bg-muted rounded animate-pulse" />
        <div className="h-[300px] bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <p className="text-muted-foreground">排程不存在</p>
      </div>
    );
  }

  const totalCost = data.items.reduce((s, it) => s + (Number(it.dish.cost) || 0) * it.quantity, 0);
  const docMeta: ScheduleDocMeta = {
    title: data.title,
    scheduleDate: data.scheduleDate,
    storeName: data.store?.name ?? "",
    scheduleId: data.id,
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="返回排程列表" onClick={() => router.push("/schedules")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.title}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              排程 #{data.id} · 负责人：{data.operatorName || data.operator || "—"} <StatusBadge status={data.status} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.status === "待生效" && (
            <>
              <Button variant="outline" onClick={() => router.push(`/schedules/${id}/edit`)} disabled={actionLoading}>
                <Pencil className="mr-2 h-4 w-4" />
                修改
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </Button>
              <Button onClick={handleActivate} disabled={actionLoading}>
                <Play className="mr-2 h-4 w-4" />
                确认生产计划
              </Button>
            </>
          )}
          {data.status === "进行中" && (
            <Button onClick={handleComplete} disabled={actionLoading}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              完成生产
            </Button>
          )}
        </div>
      </div>

      {/* 基础信息块 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CalendarDays className="h-4 w-4" />
            生产日期
          </div>
          <div className="font-medium">
            {new Date(data.scheduleDate).toLocaleDateString("zh-CN")}
          </div>
          <div className="text-sm text-muted-foreground">{getWeekDay(data.scheduleDate)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <MapPin className="h-4 w-4" />
            门店
          </div>
          <div className="font-medium">{data.store?.name ?? "—"}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Clock className="h-4 w-4" />
            制单信息
          </div>
          <div className="font-medium">{data.operatorName || data.operator || "—"}</div>
          <div className="text-sm text-muted-foreground">
            {new Date(data.createdAt).toLocaleString("zh-CN")}
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <ChefHat className="h-4 w-4" />
            菜品统计
          </div>
          <div className="font-medium">{data.dishCount} 个菜品 / {data.totalQuantity} 份</div>
          <div className="text-sm text-muted-foreground">预估成本 ¥{totalCost.toFixed(2)}</div>
        </div>
      </div>

      {/* 核心数据：Tab 切换 */}
      <div>
        <div className="flex items-center gap-1 border-b">
          {([
            ["menu", "排程菜单", data.items.length],
            ["cutting", "切配工单明细", data.cuttingOrders.length],
            ["purchase", "采购计划明细", data.purchasePlans.length],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
                (activeTab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {label}
              <span
                className={
                  "ml-1.5 text-xs rounded-full px-1.5 py-0.5 " +
                  (activeTab === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
                }
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="pt-4">
          {activeTab === "menu" &&
            (data.items.length > 0 ? (
              <ScheduleMenuTable items={data.items} meta={docMeta} />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">暂无菜单数据</p>
            ))}
          {activeTab === "cutting" &&
            (data.cuttingOrders.length > 0 ? (
              <ScheduleCuttingTable rows={data.cuttingOrders} meta={docMeta} />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">暂无切配工单</p>
            ))}
          {activeTab === "purchase" &&
            (data.purchasePlans.length > 0 ? (
              <SchedulePurchaseTable rows={data.purchasePlans} meta={docMeta} />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">暂无采购计划</p>
            ))}
        </div>
      </div>
    </div>
  );
}
