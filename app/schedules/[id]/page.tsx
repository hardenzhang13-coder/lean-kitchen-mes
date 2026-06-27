"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  Trash2,
  Pencil,
  AlertTriangle,
  ChefHat,
  CalendarDays,
  Clock,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { parseObject } from "@/app/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ScheduleCuttingTable } from "@/app/components/schedule-cutting-table";
import { SchedulePurchaseTable } from "@/app/components/schedule-purchase-table";
import { StatusBadge } from "@/app/components/status-badge";

interface ScheduleData {
  id: number;
  title: string;
  scheduleDate: string;
  scope: string;
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
      category: { name: string };
      cost: number | null;
    };
  }>;
  cuttingOrders: Array<any>;
  purchasePlans: Array<any>;
  totalQuantity: number;
  dishCount: number;
}

function getWeekDay(dateStr: string) {
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return days[new Date(dateStr).getDay()];
}

function isAfter22h(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  d.setHours(22, 0, 0, 0);
  return now > d;
}

export default function ScheduleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

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

  const showTimeoutWarning = data.status === "进行中" && isAfter22h(data.scheduleDate);
  const totalCost = data.items.reduce((s, it) => s + (Number(it.dish.cost) || 0) * it.quantity, 0);

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
            <p className="text-sm text-muted-foreground">
              排程 #{data.id} · 负责人：{data.operatorName || data.operator || "—"}
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

      {showTimeoutWarning && (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--warning-muted)] border border-[var(--warning)]/20 p-3 text-[var(--warning)]">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm">该排程已过了当日 22:00，建议点击「完成生产」结束排程</span>
        </div>
      )}

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
            使用范围
          </div>
          <div className="font-medium">{data.scope}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Clock className="h-4 w-4" />
            排程状态
          </div>
          <StatusBadge status={data.status} />
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

      {/* 菜单及数量 */}
      <div className="space-y-3">
        <h3 className="font-medium">菜单及数量</h3>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>序号</TableHead>
                <TableHead>菜品名称</TableHead>
                <TableHead>编码</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>数量（份）</TableHead>
                <TableHead>单价</TableHead>
                <TableHead>小计</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.dish.name}</TableCell>
                  <TableCell className="font-mono text-xs">{item.dish.code}</TableCell>
                  <TableCell>{item.dish.category?.name}</TableCell>
                  <TableCell className="font-semibold">{item.quantity}</TableCell>
                  <TableCell>¥{Number(item.dish.cost || 0).toFixed(2)}</TableCell>
                  <TableCell>¥{(Number(item.dish.cost || 0) * item.quantity).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={4} className="text-right font-medium">合计</TableCell>
                <TableCell className="font-bold">{data.totalQuantity}</TableCell>
                <TableCell></TableCell>
                <TableCell className="font-bold">¥{totalCost.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* 切配工单 */}
      {data.cuttingOrders.length > 0 && (
        <ScheduleCuttingTable rows={data.cuttingOrders} />
      )}

      {/* 采购计划 */}
      {data.purchasePlans.length > 0 && (
        <SchedulePurchaseTable rows={data.purchasePlans} />
      )}
    </div>
  );
}
