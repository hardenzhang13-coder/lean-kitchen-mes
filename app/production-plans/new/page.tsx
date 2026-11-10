"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/app/components/ui/date-picker";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { toast } from "sonner";

interface ScheduleOption {
  id: number;
  code: string | null;
  title: string;
  scheduleDate: string;
  status: string;
  dishCount: number;
  totalQuantity: number;
}

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function getWeekDay(dateStr: string) {
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return days[new Date(dateStr).getDay()];
}

export default function NewProductionPlanPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [planDate, setPlanDate] = useState(getTomorrow);
  const [options, setOptions] = useState<ScheduleOption[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch("/api/schedules?status=" + encodeURIComponent("进行中") + "&pageSize=100");
        const data = await res.json();
        setOptions(data.data || []);
      } catch {
        toast.error("获取排程单失败");
      } finally {
        setLoading(false);
      }
    };
    fetchOptions();
  }, []);

  const toggle = (id: number) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pickedTotalQty = options
    .filter((o) => picked.has(o.id))
    .reduce((s, o) => s + o.totalQuantity, 0);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("请填写标题");
      return;
    }
    if (picked.size === 0) {
      toast.error("请至少选择一张进行中的排程单");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), planDate, scheduleIds: [...picked] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建失败");
        return;
      }
      toast.success("生产计划单创建成功");
      router.push("/production-plans/" + data.data.id);
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="返回" onClick={() => router.push("/schedules?tab=plans")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">新增生产计划单</h1>
          <p className="text-sm text-muted-foreground">汇总各门店「进行中」排程单的切配工单与采购计划</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label>标题 <span className="text-destructive">*</span></Label>
          <Input placeholder="如：周五切配中心生产计划" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>生产日期 <span className="text-destructive">*</span></Label>
          <DatePicker value={planDate} onChange={setPlanDate} placeholder="请选择生产日期" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">选择进行中的排程单 <span className="text-primary">已选 {picked.size} 张</span></h3>
          <span className="text-sm text-muted-foreground">合计 {pickedTotalQty} 份</span>
        </div>
        {loading ? (
          <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : options.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            暂无「进行中」的排程单，请先在排程管理中确认生产计划
          </div>
        ) : (
          <div className="space-y-2">
            {options.map((o) => {
              const on = picked.has(o.id);
              return (
                <div
                  key={o.id}
                  className={
                    "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors " +
                    (on ? "border-primary bg-primary/5" : "hover:bg-muted/40")
                  }
                  onClick={() => toggle(o.id)}
                >
                  <input type="checkbox" className="mt-1" checked={on} readOnly />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{o.title}</span>
                      <span className="mono text-xs text-muted-foreground">{o.code ?? "排程 #" + o.id}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {new Date(o.scheduleDate).toLocaleDateString("zh-CN")} {getWeekDay(o.scheduleDate)} · {o.dishCount} 个菜品 / {o.totalQuantity} 份
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">生成后数据为快照固化，之后门店排程单变化不影响本单；只能汇总「进行中」状态的排程单。</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/schedules?tab=plans")}>取消</Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          生成生产计划单
        </Button>
      </div>
    </div>
  );
}
