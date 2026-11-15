"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
import { DatePicker } from "@/app/components/ui/date-picker";
import { SelectField } from "@/app/components/ui/select-field";
import { LoadingState } from "@/app/components/ui/loading-state";
import { Pagination } from "@/app/components/ui/pagination";
import { ScheduleStatusTag } from "@/app/components/ui/schedule-status-tag";
import { dayOffsetInputValue, formatDate, getWeekDay } from "@/lib/shared/date-format";
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

interface ProductionPlanCreateDialogProps {
  onClose: () => void;
  onCreated: (id: number) => void;
  /** 预选一张排程（从排程卡片「纳入生产计划单」进入时使用） */
  presetScheduleId?: number | null;
  /** 指定进入时的生产日期（工作台按日期新增时使用） */
  presetDate?: string | null;
}

const OPTION_PAGE_SIZE = 10;

/**
 * 生产计划单新建弹窗：生产日期一行，下面 4:6 分「已选排程单 / 可汇总排程单」。
 * 标题由生产日期自动生成，不在表单里填写。
 */
export function ProductionPlanCreateDialog({
  onClose,
  onCreated,
  presetScheduleId,
  presetDate,
}: ProductionPlanCreateDialogProps) {
  const [planDate, setPlanDate] = useState(presetDate || dayOffsetInputValue(1));
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [storeId, setStoreId] = useState("");
  const [options, setOptions] = useState<ScheduleOption[]>([]);
  const [picked, setPicked] = useState<Set<number>>(
    () => new Set(presetScheduleId ? [presetScheduleId] : [])
  );
  const [known, setKnown] = useState<Map<number, ScheduleOption>>(new Map());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);
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
    const loadStores = async () => {
      try {
        const res = await fetch("/api/stores?pageSize=100");
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
        if (alive) setStores(list);
      } catch {
        if (alive) toast.error("获取门店失败");
      }
    };
    loadStores();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          status: "进行中",
          availableForPlan: "1",
          page: String(page),
          pageSize: String(OPTION_PAGE_SIZE),
        });
        if (storeId) params.set("storeId", storeId);
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
    load();
    return () => {
      alive = false;
    };
  }, [page, debouncedSearch, storeId]);

  const pickedOptions = useMemo(
    () =>
      [...picked]
        .map((id) => known.get(id))
        .filter((option): option is ScheduleOption => !!option),
    [picked, known]
  );
  const pickedTotalQty = pickedOptions.reduce(
    (sum, option) => sum + option.totalQuantity,
    0
  );

  const toggle = (option: ScheduleOption) => {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(option.id)) next.delete(option.id);
      else next.add(option.id);
      return next;
    });
    setKnown((previous) => new Map(previous).set(option.id, option));
  };

  const allOnPagePicked =
    options.length > 0 && options.every((option) => picked.has(option.id));
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

  const canSubmit = !!planDate && picked.size > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planDate, scheduleIds: [...picked] }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建失败");
        return;
      }
      toast.success("生产计划单已创建");
      onCreated(data?.data?.id);
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <AppDialogContent
        size="workbench"
        className="[&>button]:cursor-pointer p-0 flex flex-col max-h-[calc(100dvh-24px)]"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-lg">生产计划</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-10">
            <div className="lg:col-span-4">
              <FormField
                id="production-plan-date"
                label="生产日期"
                required
                optionalHint={false}
              >
                <DatePicker
                  value={planDate}
                  onChange={setPlanDate}
                  placeholder="请选择生产日期"
                  className="w-[260px]"
                  showWeekday
                />
              </FormField>
            </div>

            <div className="lg:col-span-6">
              <FormField
                id="production-plan-store"
                label="选择门店"
                optionalHint={false}
              >
                <SelectField
                  value={storeId}
                  onChange={(value) => {
                    setStoreId(value);
                    setPage(1);
                  }}
                  className="w-[260px]"
                  options={[
                    { value: "", label: "所有门店" },
                    ...stores.map((store) => ({
                      value: String(store.id),
                      label: store.name,
                    })),
                  ]}
                />
              </FormField>
            </div>

            <div className="lg:col-span-4">
              <div className="flex flex-col rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <h4 className="text-sm font-semibold text-foreground">已选排程单</h4>
                  <span className="text-xs text-muted-foreground">
                    {picked.size} 张 · {pickedTotalQty} 份
                  </span>
                </div>
                <div className="h-[360px] overflow-y-auto p-3">
                  {pickedOptions.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      请在右侧选择排程单
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {pickedOptions.map((option) => (
                        <li
                          key={option.id}
                          className="flex items-start justify-between gap-2 rounded-md border px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {option.title}
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {formatDate(option.scheduleDate)} ·{" "}
                              {option.totalQuantity} 份
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground"
                            aria-label={`移除 ${option.title}`}
                            onClick={() => toggle(option)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="flex flex-col rounded-lg border bg-card">
                <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                  <Input
                    placeholder="搜索排程标题..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="w-[200px]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={togglePage}
                    disabled={options.length === 0}
                  >
                    {allOnPagePicked ? "取消本页全选" : "全选本页"}
                  </Button>
                  <span className="ml-auto text-xs text-muted-foreground">
                    共 {pagination?.totalItems ?? options.length} 张可汇总
                  </span>
                </div>

                <div className="h-[360px] overflow-y-auto p-3">
                  {loading ? (
                    <LoadingState type="list" rows={3} />
                  ) : options.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      暂无可汇总的「进行中」排程单
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {options.map((option) => {
                        const checked = picked.has(option.id);
                        return (
                          <li key={option.id}>
                            <label
                              className={
                                "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition-colors " +
                                (checked
                                  ? "border-primary bg-primary/5"
                                  : "hover:bg-muted/50")
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
                                  <span className="truncate text-sm font-medium">
                                    {option.title}
                                  </span>
                                  <ScheduleStatusTag status={option.status} size="sm" />
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {formatDate(option.scheduleDate)}{" "}
                                  {getWeekDay(option.scheduleDate)} ·{" "}
                                  {option.dishCount} 个菜品 / {option.totalQuantity} 份
                                </div>
                              </div>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {pagination && pagination.totalItems > OPTION_PAGE_SIZE && (
                  <div className="border-t px-4 py-2">
                    <Pagination
                      currentPage={page}
                      totalPages={pagination.totalPages}
                      onPageChange={setPage}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 pb-5 pt-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {!planDate
                ? "请先选择生产日期"
                : picked.size === 0
                  ? "请至少选择一张排程单"
                  : `将汇总 ${picked.size} 张排程单 / ${pickedTotalQty} 份`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="h-11 px-6"
              >
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="h-11 px-6"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                完成
              </Button>
            </div>
          </div>
        </DialogFooter>
      </AppDialogContent>
    </Dialog>
  );
}
