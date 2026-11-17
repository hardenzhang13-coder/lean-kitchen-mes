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
import { cn } from "@/lib/shared/utils";
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

interface SelfOrderOption {
  id: number;
  code: string | null;
  title: string;
  produceDate: string;
  status: string;
  itemCount: number;
  totalPortions: number;
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
 * 生产计划单新建弹窗：生产日期一行，下面 4:6 分「已选来源 / 可汇总来源」。
 * 来源支持门店排程单与内部生产单两种，至少选择其一。
 */
export function ProductionPlanCreateDialog({
  onClose,
  onCreated,
  presetScheduleId,
  presetDate,
}: ProductionPlanCreateDialogProps) {
  const [planDate, setPlanDate] = useState(presetDate || dayOffsetInputValue(0));
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [storeId, setStoreId] = useState("");
  const [sourceTab, setSourceTab] = useState<"schedule" | "self">("schedule");

  // 门店排程候选
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

  // 内部生产候选
  const [selfOptions, setSelfOptions] = useState<SelfOrderOption[]>([]);
  const [selfPicked, setSelfPicked] = useState<Set<number>>(new Set());
  const [selfKnown, setSelfKnown] = useState<Map<number, SelfOrderOption>>(new Map());
  const [selfSearch, setSelfSearch] = useState("");
  const [selfDebouncedSearch, setSelfDebouncedSearch] = useState("");
  const [selfPage, setSelfPage] = useState(1);
  const [selfPagination, setSelfPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);
  const [selfLoading, setSelfLoading] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSelfDebouncedSearch(selfSearch);
      setSelfPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [selfSearch]);

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

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setSelfLoading(true);
      try {
        const params = new URLSearchParams({
          status: "进行中",
          availableForPlan: "1",
          page: String(selfPage),
          pageSize: String(OPTION_PAGE_SIZE),
        });
        if (selfDebouncedSearch) params.set("q", selfDebouncedSearch);
        const res = await fetch("/api/self-production-orders?" + params.toString());
        const data = await res.json();
        if (!alive) return;
        const list: SelfOrderOption[] = data.data || [];
        setSelfOptions(list);
        setSelfPagination(data.pagination || null);
        setSelfKnown((previous) => {
          const next = new Map(previous);
          for (const option of list) {
            if (next.has(option.id)) next.set(option.id, option);
          }
          return next;
        });
      } catch {
        if (alive) toast.error("获取内部生产单失败");
      } finally {
        if (alive) setSelfLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [selfPage, selfDebouncedSearch]);

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

  const selfPickedOptions = useMemo(
    () =>
      [...selfPicked]
        .map((id) => selfKnown.get(id))
        .filter((option): option is SelfOrderOption => !!option),
    [selfPicked, selfKnown]
  );
  const selfPickedPortions = selfPickedOptions.reduce(
    (sum, option) => sum + option.totalPortions,
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

  const toggleSelf = (option: SelfOrderOption) => {
    setSelfPicked((previous) => {
      const next = new Set(previous);
      if (next.has(option.id)) next.delete(option.id);
      else next.add(option.id);
      return next;
    });
    setSelfKnown((previous) => new Map(previous).set(option.id, option));
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

  const canSubmit = !!planDate && picked.size + selfPicked.size > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/production-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planDate,
          scheduleIds: [...picked],
          selfOrderIds: [...selfPicked],
        }),
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
            <div className="lg:col-span-5">
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

            <div className="lg:col-span-5">
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
                  <h4 className="text-sm font-semibold text-foreground">已选来源</h4>
                  <span className="text-xs text-muted-foreground">
                    {picked.size} 张排程 · {selfPicked.size} 张内部生产
                  </span>
                </div>
                <div className="h-[360px] overflow-y-auto p-3">
                  {pickedOptions.length === 0 && selfPickedOptions.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      请在右侧选择排程单或内部生产单
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {pickedOptions.length > 0 && (
                        <div>
                          <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                            门店排程
                          </p>
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
                        </div>
                      )}
                      {selfPickedOptions.length > 0 && (
                        <div>
                          <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">
                            内部生产
                          </p>
                          <ul className="space-y-2">
                            {selfPickedOptions.map((option) => (
                              <li
                                key={option.id}
                                className="flex items-start justify-between gap-2 rounded-md border px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">
                                    {option.title}
                                  </div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {formatDate(option.produceDate)} ·{" "}
                                    {option.itemCount} 种 / {option.totalPortions} 份
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 text-muted-foreground"
                                  aria-label={`移除 ${option.title}`}
                                  onClick={() => toggleSelf(option)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="flex flex-col rounded-lg border bg-card">
                <div className="flex items-center gap-1 border-b px-4 py-2">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      sourceTab === "schedule"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => setSourceTab("schedule")}
                  >
                    门店排程
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      sourceTab === "self"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                    onClick={() => setSourceTab("self")}
                  >
                    内部生产单
                  </button>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {sourceTab === "schedule"
                      ? `共 ${pagination?.totalItems ?? options.length} 张可汇总`
                      : `共 ${selfPagination?.totalItems ?? selfOptions.length} 张可汇总`}
                  </span>
                </div>

                {sourceTab === "schedule" ? (
                  <>
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
                    </div>

                    <div className="h-[300px] overflow-y-auto p-3">
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

                    <div className="h-[48px] border-t px-4 py-2">
                      {pagination && pagination.totalItems > OPTION_PAGE_SIZE && (
                        <Pagination
                          currentPage={page}
                          totalPages={pagination.totalPages}
                          onPageChange={setPage}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                      <Input
                        placeholder="搜索内部生产单..."
                        value={selfSearch}
                        onChange={(event) => setSelfSearch(event.target.value)}
                        className="w-[200px]"
                      />
                    </div>

                    <div className="h-[300px] overflow-y-auto p-3">
                      {selfLoading ? (
                        <LoadingState type="list" rows={3} />
                      ) : selfOptions.length === 0 ? (
                        <p className="py-16 text-center text-sm text-muted-foreground">
                          暂无可汇总的「进行中」内部生产单
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {selfOptions.map((option) => {
                            const checked = selfPicked.has(option.id);
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
                                    onChange={() => toggleSelf(option)}
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
                                      {formatDate(option.produceDate)}{" "}
                                      {getWeekDay(option.produceDate)} ·{" "}
                                      {option.itemCount} 种净料 / {option.totalPortions} 份
                                    </div>
                                  </div>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <div className="h-[48px] border-t px-4 py-2">
                      {selfPagination && selfPagination.totalItems > OPTION_PAGE_SIZE && (
                        <Pagination
                          currentPage={selfPage}
                          totalPages={selfPagination.totalPages}
                          onPageChange={setSelfPage}
                        />
                      )}
                    </div>
                  </>
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
                : picked.size + selfPicked.size === 0
                  ? "请至少选择一张排程单或内部生产单"
                  : `将汇总 ${picked.size} 张排程单 / ${pickedTotalQty} 份，${selfPicked.size} 张内部生产单 / ${selfPickedPortions} 份`}
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
