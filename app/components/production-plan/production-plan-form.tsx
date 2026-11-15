"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/app/components/ui/form-controls";
import { FormField, FormSection } from "@/app/components/ui/form-field";
import { DatePicker } from "@/app/components/ui/date-picker";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { Pagination } from "@/app/components/ui/pagination";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatDate, getWeekDay, dayOffsetInputValue } from "@/lib/shared/date-format";
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
  planId: number;
  initialPlanDate?: string;
  initialScheduleIds?: number[];
}

const OPTION_PAGE_SIZE = 10;

export function ProductionPlanForm({
  planId,
  initialPlanDate,
  initialScheduleIds = [],
}: ProductionPlanFormProps) {
  const router = useRouter();
  const [planDate, setPlanDate] = useState(
    initialPlanDate ?? dayOffsetInputValue(1)
  );
  const [options, setOptions] = useState<ScheduleOption[]>([]);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(initialScheduleIds));
  const [known, setKnown] = useState<Map<number, ScheduleOption>>(new Map());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ totalItems: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let alive = true;
    const fetchOptions = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: "进行中",
          availableForPlan: "1",
          page: String(page),
          pageSize: String(OPTION_PAGE_SIZE),
        });
        if (planId != null) params.set("excludePlanId", String(planId));
        if (debouncedSearch) params.set("q", debouncedSearch);
        const res = await fetch("/api/schedules?" + params.toString());
        const data = await res.json();
        if (!alive) return;
        const list: ScheduleOption[] = data.data || [];
        setOptions(list);
        setPagination(data.pagination || null);
        setKnown((previous) => {
          const next = new Map(previous);
          for (const option of list) {
            if (next.has(option.id)) next.set(option.id, option);
          }
          return next;
        });
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
  }, [planId, page, debouncedSearch]);

  const pickedOptions = useMemo(
    () => [...picked].map((id) => known.get(id)).filter((option): option is ScheduleOption => !!option),
    [picked, known]
  );
  const pickedTotalQty = pickedOptions.reduce((sum, option) => sum + option.totalQuantity, 0);
  const pickedDateCount = new Set(
    pickedOptions.map((option) => option.scheduleDate.slice(0, 10))
  ).size;

  const toggle = (option: ScheduleOption) => {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(option.id)) next.delete(option.id);
      else next.add(option.id);
      return next;
    });
    setKnown((previous) => new Map(previous).set(option.id, option));
  };

  const allOnPagePicked = options.length > 0 && options.every((option) => picked.has(option.id));
  const togglePage = () => {
    setPicked((previous) => {
      const next = new Set(previous);
      for (const option of options) {
        if (allOnPagePicked) next.delete(option.id);
        else next.add(option.id);
      }
      return next;
    });
    setKnown((previous) => {
      const next = new Map(previous);
      for (const option of options) next.set(option.id, option);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (picked.size === 0) {
      toast.error("请至少选择一张进行中的排程单");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/production-plans/${planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planDate, scheduleIds: [...picked] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "修改失败");
        return;
      }
      toast.success("生产计划单修改成功");
      router.push("/production-plans/" + planId);
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  const backHref = `/production-plans/${planId}`;

  return (
    <PageShell>
      <PageHeader
        showBack
        backHref={backHref}
        backLabel="返回"
        title="修改生产计划单"
        description="把各门店「进行中」的排程单汇总成一张执行单，切配中心据此切配、完成生产并入库"
        actions={
          <>
            <Button variant="outline" onClick={() => router.push(backHref)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存修改
            </Button>
          </>
        }
      />

      <FormSection cols={2}>
        <FormField id="production-plan-date" label="生产日期" required optionalHint={false}>
          <DatePicker value={planDate} onChange={setPlanDate} placeholder="请选择生产日期" showWeekday />
        </FormField>
      </FormSection>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            选择进行中的排程单
            <span className="ml-2 font-normal text-primary">已选 {picked.size} 张</span>
            <span className="ml-2 font-normal text-muted-foreground">合计 {pickedTotalQty} 份</span>
          </h3>
          <div className="flex items-center gap-2">
            <Input
              placeholder="搜索排程标题..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-[220px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={togglePage}
              disabled={options.length === 0}
            >
              {allOnPagePicked ? "取消本页全选" : "全选本页"}
            </Button>
          </div>
        </div>

        {pickedDateCount > 1 && (
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            已选排程跨 {pickedDateCount} 个生产日期，将统一汇总到计划日期{" "}
            {formatDate(planDate)}。
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : options.length === 0 ? (
          <EmptyState
            title="暂无可汇总的排程单"
            description="只有「进行中」且未纳入其他生产计划单的排程才能汇总。"
          />
        ) : (
          <div className="space-y-2">
            {options.map((option) => {
              const checked = picked.has(option.id);
              return (
                <label
                  key={option.id}
                  className={
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors " +
                    (checked ? "border-primary bg-primary/5" : "hover:bg-muted/40")
                  }
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggle(option)}
                    aria-label={`选择 ${option.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{option.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {option.code ?? "排程 #" + option.id}
                      </span>
                      <StatusBadge status={option.status} />
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatDate(option.scheduleDate)} {getWeekDay(option.scheduleDate)} ·{" "}
                      {option.dishCount} 个菜品 / {option.totalQuantity} 份
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {pagination && pagination.totalItems > 0 && (
          <Pagination
            currentPage={page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        )}

        <p className="text-xs text-muted-foreground">
          只能汇总「进行中」且未纳入其他生产计划单的排程；来源排程可跨日期，系统不限制日期一致。
        </p>
      </div>
    </PageShell>
  );
}
