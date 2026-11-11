"use client";

import { useEffect, useMemo, useState } from "react";
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

interface ProductionPlanFormProps {
  mode: "create" | "edit";
  planId?: number;
  initialTitle?: string;
  initialPlanDate?: string;
  initialScheduleIds?: number[];
}

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function getWeekDay(dateStr: string) {
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return days[new Date(dateStr).getDay()];
}

export function ProductionPlanForm({
  mode,
  planId,
  initialTitle = "",
  initialPlanDate,
  initialScheduleIds = [],
}: ProductionPlanFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [planDate, setPlanDate] = useState(initialPlanDate ?? getTomorrow());
  const [options, setOptions] = useState<ScheduleOption[]>([]);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(initialScheduleIds));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    const fetchOptions = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: "进行中",
          availableForPlan: "1",
          pageSize: "100",
        });
        if (planId != null) params.set("excludePlanId", String(planId));
        const res = await fetch("/api/schedules?" + params.toString());
        const data = await res.json();
        if (alive) setOptions(data.data || []);
      } catch {
        if (alive) toast.error("获取排程单失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchOptions();
    return () => {
      alive = false;
    };
  }, [planId]);

  const pickedOptions = useMemo(
    () => options.filter((option) => picked.has(option.id)),
    [options, picked]
  );
  const pickedTotalQty = pickedOptions.reduce(
    (sum, option) => sum + option.totalQuantity,
    0
  );
  const pickedDateCount = new Set(
    pickedOptions.map((option) => option.scheduleDate.slice(0, 10))
  ).size;

  const toggle = (id: number) => {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      const res = await fetch(
        mode === "create" ? "/api/production-plans" : `/api/production-plans/${planId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            planDate,
            scheduleIds: [...picked],
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || (mode === "create" ? "创建失败" : "修改失败"));
        return;
      }
      toast.success(mode === "create" ? "生产计划单创建成功" : "生产计划单修改成功");
      router.push("/production-plans/" + (mode === "create" ? data.data.id : planId));
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  const backHref =
    mode === "edit" && planId != null
      ? `/production-plans/${planId}`
      : "/schedules?tab=plans";

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="返回" onClick={() => router.push(backHref)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "create" ? "新增生产计划单" : "修改生产计划单"}
          </h1>
          <p className="text-sm text-muted-foreground">
            汇总各门店「进行中」排程单的切配工单与采购计划
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label htmlFor="production-plan-title">
            标题 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="production-plan-title"
            placeholder="如：周五切配中心生产计划"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>
            生产日期 <span className="text-destructive">*</span>
          </Label>
          <DatePicker value={planDate} onChange={setPlanDate} placeholder="请选择生产日期" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">
            选择进行中的排程单 <span className="text-primary">已选 {picked.size} 张</span>
          </h3>
          <span className="text-sm text-muted-foreground">合计 {pickedTotalQty} 份</span>
        </div>

        {pickedDateCount > 1 && (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            当前已选排程跨 {pickedDateCount} 个生产日期，将统一汇总到计划日期{" "}
            {new Date(planDate).toLocaleDateString("zh-CN")}。
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((item) => (
              <div key={item} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : options.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            暂无可汇总的「进行中」排程单
          </div>
        ) : (
          <div className="space-y-2">
            {options.map((option) => {
              const checked = picked.has(option.id);
              return (
                <label
                  key={option.id}
                  className={
                    "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors " +
                    (checked ? "border-primary bg-primary/5" : "hover:bg-muted/40")
                  }
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggle(option.id)}
                    aria-label={`选择 ${option.title}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{option.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {option.code ?? "排程 #" + option.id}
                      </span>
                      <StatusBadge status={option.status} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {new Date(option.scheduleDate).toLocaleDateString("zh-CN")}{" "}
                      {getWeekDay(option.scheduleDate)} · {option.dishCount} 个菜品 /{" "}
                      {option.totalQuantity} 份
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          只能汇总「进行中」且未纳入其他生产计划单的排程；来源排程可跨日期，系统不限制日期一致。
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push(backHref)}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "生成生产计划单" : "保存修改"}
        </Button>
      </div>
    </div>
  );
}
