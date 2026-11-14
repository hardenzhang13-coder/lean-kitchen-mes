"use client";

import { useEffect, useState } from "react";
import { Plus, Eye, CalendarDays, ChefHat, FileStack, Tags } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DatePicker } from "@/app/components/ui/date-picker";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { SectionTabs } from "@/app/components/ui/section-tabs";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Pagination } from "@/app/components/ui/pagination";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import {
  ScheduleCuttingTable,
  type CuttingOrderRow,
  type ScheduleDocMeta,
} from "@/app/components/schedule/schedule-cutting-table";
import {
  SchedulePurchaseTable,
  type PurchasePlanRow,
} from "@/app/components/schedule/schedule-purchase-table";
import {
  ScheduleMenuTable,
  type ScheduleMenuItem,
} from "@/app/components/schedule/schedule-menu-table";
import { DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";

interface ScheduleItem {
  id: number;
  title: string;
  scheduleDate: string;
  store: { id: number; name: string } | null;
  status: string;
  operator: string | null;
  operatorName?: string | null;
  createdAt: string;
  dishCount: number;
  totalQuantity: number;
  productionPlan: {
    id: number;
    code: string | null;
    title: string;
    planDate: string;
    status: string;
  } | null;
}

/** 快速查看抽屉数据：与详情页同源同结构（复用详情页表格组件，保证一致） */
interface QuickDetail {
  id: number;
  code: string | null;
  title: string;
  scheduleDate: string;
  status: string;
  store: { id: number; name: string } | null;
  items: ScheduleMenuItem[];
  cuttingOrders: CuttingOrderRow[];
  purchasePlans: PurchasePlanRow[];
  totalQuantity: number;
  dishCount: number;
  productionPlan: {
    id: number;
    code: string | null;
    title: string;
    planDate: string;
    status: string;
  } | null;
}

interface ProductionPlanPreview {
  id: number;
  code: string | null;
  title: string;
  planDate: string;
  status: string;
  operator: string | null;
  operatorName: string | null;
  createdAt: string;
  cuttingOrders: CuttingOrderRow[];
  purchasePlans: PurchasePlanRow[];
  sourceSchedules: Array<{
    id: number;
    code: string | null;
    title: string;
    scheduleDate: string;
    totalQuantity: number;
  }>;
}

type QuickTab = "menu" | "cutting" | "purchase";
type PlanPreviewTab = "cutting" | "purchase";

const STATUS_OPTIONS = [
  { value: "all", label: "全部状态" },
  { value: "待生效", label: "待生效" },
  { value: "进行中", label: "进行中" },
  { value: "已完成", label: "已完成" },
];

function getWeekDay(dateStr: string) {
  const days = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return days[new Date(dateStr).getDay()];
}

export default function SchedulesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ScheduleItem[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [storeFilter, setStoreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ totalItems: number; totalPages: number } | null>(null);

  // 筛选/页码/搜索变化时在渲染期进入加载态（prev-key 派生范式）
  const listKey = `${statusFilter}|${storeFilter}|${startDate}|${endDate}|${page}|${debouncedSearch}`;
  const [prevListKey, setPrevListKey] = useState(listKey);
  if (prevListKey !== listKey) {
    setPrevListKey(listKey);
    setLoading(true);
  }

  // 快速查看抽屉
  const [quickView, setQuickView] = useState<QuickDetail | null>(null);
  const [quickViewLoading, setQuickViewLoading] = useState(false);
  const [quickTab, setQuickTab] = useState<QuickTab>("menu");
  const [module, setModule] = useState<"schedules" | "plans">("schedules");
  const [plans, setPlans] = useState<Array<{ id: number; code: string | null; title: string; planDate: string; status: string; operator: string | null; operatorName?: string | null; createdAt: string; scheduleCount: number }>>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [debouncedPlanSearch, setDebouncedPlanSearch] = useState("");
  const [planStatus, setPlanStatus] = useState("");
  const [planStart, setPlanStart] = useState("");
  const [planEnd, setPlanEnd] = useState("");
  const [planPage, setPlanPage] = useState(1);
  const [planPagination, setPlanPagination] = useState<{ totalItems: number; totalPages: number } | null>(null);
  const [planPreview, setPlanPreview] = useState<ProductionPlanPreview | null>(null);
  const [planPreviewLoading, setPlanPreviewLoading] = useState(false);
  const [planPreviewTab, setPlanPreviewTab] = useState<PlanPreviewTab>("cutting");

  useEffect(() => {
    let alive = true;
    const fetchData = async () => {
      try {
        const params = new URLSearchParams();
        if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (storeFilter && storeFilter !== "all") params.set("storeId", storeFilter);
        params.set("page", String(page));
        params.set("pageSize", String(DEFAULT_PAGE_SIZE));
        const res = await fetch("/api/schedules?" + params.toString());
        const data = await res.json();
        if (!alive) return;
        setRows(data.data || []);
        setPagination(data.pagination || null);
      } catch {
        if (alive) toast.error("获取排程数据失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchData();
    return () => {
      alive = false;
    };
  }, [statusFilter, storeFilter, startDate, endDate, page, debouncedSearch]);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await fetch("/api/stores?pageSize=100");
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : [];
        setStores(list);
      } catch {
        toast.error("获取门店失败");
      }
    };
    fetchStores();
  }, []);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPlanSearch(planSearch);
      setPlanPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [planSearch]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "plans") setModule("plans");
  }, []);

  useEffect(() => {
    if (module !== "plans") return;
    const fetchPlans = async () => {
      setPlansLoading(true);
      try {
        const params = new URLSearchParams();
        if (planStatus && planStatus !== "all") params.set("status", planStatus);
        if (debouncedPlanSearch) params.set("q", debouncedPlanSearch);
        if (planStart) params.set("startDate", planStart);
        if (planEnd) params.set("endDate", planEnd);
        params.set("page", String(planPage));
        params.set("pageSize", String(DEFAULT_PAGE_SIZE));
        const res = await fetch("/api/production-plans?" + params.toString());
        const data = await res.json();
        setPlans(data.data || []);
        setPlanPagination(data.pagination || null);
      } catch {
        toast.error("获取生产计划单失败");
      } finally {
        setPlansLoading(false);
      }
    };
    fetchPlans();
  }, [module, planStatus, planStart, planEnd, planPage, debouncedPlanSearch]);

  const openQuickView = async (id: number) => {
    setQuickViewLoading(true);
    setQuickTab("menu");
    try {
      const res = await fetch("/api/schedules/" + id);
      const d = await parseObject<QuickDetail>(res);
      if (!d) {
        toast.error("排程不存在");
        return;
      }
      setQuickView(d);
    } catch {
      toast.error("获取排程数据失败");
    } finally {
      setQuickViewLoading(false);
    }
  };

  const closeQuickView = () => {
    setQuickView(null);
    setQuickViewLoading(false);
  };

  const openPlanPreview = async (id: number) => {
    setPlanPreviewLoading(true);
    setPlanPreviewTab("cutting");
    try {
      const res = await fetch("/api/production-plans/" + id);
      const data = await parseObject<ProductionPlanPreview>(res);
      if (!data) {
        toast.error("生产计划单不存在");
        return;
      }
      setPlanPreview(data);
    } catch {
      toast.error("获取生产计划单失败");
    } finally {
      setPlanPreviewLoading(false);
    }
  };

  const closePlanPreview = () => {
    setPlanPreview(null);
    setPlanPreviewLoading(false);
  };

  const quickMeta: ScheduleDocMeta | null = quickView
    ? {
        title: quickView.title,
        scheduleDate: quickView.scheduleDate,
        storeName: quickView.store?.name ?? "",
        scheduleId: quickView.id,
        code: quickView.code,
      }
    : null;

  const planPreviewMeta: ScheduleDocMeta | null = planPreview
    ? {
        title: planPreview.title,
        scheduleDate: planPreview.planDate,
        storeName: "",
        scheduleId: planPreview.id,
        code: planPreview.code,
        printBase: "/production-plans/",
      }
    : null;

  return (
    <PageShell>
      <PageHeader
        title="排程管理"
        description="设定生产计划，系统自动拆解切配工单与采购计划"
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md bg-muted p-1" role="group" aria-label="排程视图">
              {(["schedules", "plans"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={module === m}
                  onClick={() => setModule(m)}
                  className={
                    "min-h-10 rounded-md px-4 text-sm font-medium transition-colors " +
                    (module === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {m === "schedules" ? "门店排程单" : "生产计划单"}
                </button>
              ))}
            </div>
            <Button
              onClick={() =>
                router.push(
                  module === "schedules" ? "/schedules/new" : "/production-plans/new"
                )
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              {module === "schedules" ? "新建排程" : "新增生产计划单"}
            </Button>
          </>
        }
      />

      {module === "plans" && (
        <>
        <ListToolbar
          searchValue={planSearch}
          onSearchChange={setPlanSearch}
          searchPlaceholder="搜索生产计划单标题..."
          onReset={() => {
            setPlanSearch("");
            setDebouncedPlanSearch("");
            setPlanStatus("");
            setPlanStart("");
            setPlanEnd("");
            setPlanPage(1);
          }}
          hasFilters={!!(planStatus || planStart || planEnd)}
        >
          <SelectTileMode
            options={[
              { value: "all", label: "全部状态" },
              { value: "待生效", label: "待生效" },
              { value: "进行中", label: "进行中" },
              { value: "已完成", label: "已完成" },
            ]}
            value={planStatus}
            onChange={(value) => {
              setPlanStatus(value);
              setPlanPage(1);
            }}
            placeholder="全部状态"
            title="选择状态"
            className="w-[160px]"
          />
          <DatePicker
            value={planStart}
            onChange={(value) => {
              setPlanStart(value);
              setPlanPage(1);
            }}
            placeholder="开始日期"
            className="w-[170px]"
          />
          <span className="text-sm text-muted-foreground">至</span>
          <DatePicker
            value={planEnd}
            onChange={(value) => {
              setPlanEnd(value);
              setPlanPage(1);
            }}
            placeholder="结束日期"
            className="w-[170px]"
          />
        </ListToolbar>
        <div className="space-y-3">
          {plansLoading ? (
            <LoadingState type="list" rows={2} />
          ) : plans.length === 0 ? (
            <EmptyState
              icon={FileStack}
              title="暂无生产计划单"
              description="新增生产计划单后，可集中确认切配并完成入库。"
              action={{
                label: "查看门店排程单",
                onClick: () => setModule("schedules"),
              }}
            />
          ) : (
            plans.map((p) => (
              <Card
                key={p.id}
                className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30"
                onClick={() => openPlanPreview(p.id)}
              >
                <CardContent className="flex flex-col items-stretch gap-4 p-5 md:flex-row md:items-stretch md:gap-6">
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <h3 className="font-semibold text-base truncate mb-2">{p.title}</h3>
                    <div className="flex items-center gap-5 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{new Date(p.planDate).toLocaleDateString("zh-CN")} {getWeekDay(p.planDate)}</span>
                      <span className="flex items-center gap-1.5"><FileStack className="h-3.5 w-3.5" />汇总 {p.scheduleCount} 张排程单</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-row items-center justify-between gap-2 md:flex-col md:items-end md:justify-between">
                    <StatusBadge status={p.status} className="text-sm font-semibold px-3 py-1" />
                    <div className="flex flex-wrap items-center justify-end gap-2 md:gap-3" onClick={(e) => e.stopPropagation()}>
                      <span className="hidden md:inline text-sm text-muted-foreground whitespace-nowrap">制单人:{p.operatorName || p.operator || "—"}</span>
                      <Button variant="outline" size="sm" onClick={() => openPlanPreview(p.id)}>
                        <Eye className="mr-1 h-4 w-4" />
                        预览
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => router.push("/production-plans/" + p.id)}>详情</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          </div>
          {planPagination && planPagination.totalItems > 0 && (
            <Pagination
              currentPage={planPage}
              totalPages={planPagination.totalPages}
              totalItems={planPagination.totalItems}
              start={(planPage - 1) * DEFAULT_PAGE_SIZE + 1}
              end={Math.min(planPage * DEFAULT_PAGE_SIZE, planPagination.totalItems)}
              onPageChange={setPlanPage}
            />
          )}
        </>
      )}

      {module === "schedules" && (
        <>
      {/* 筛选：状态 + 门店 + 日期范围，控件统一高度 */}
      <ListToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="搜索排程标题..."
        onReset={() => {
          setStatusFilter("");
          setStartDate("");
          setEndDate("");
          setStoreFilter("");
          setSearch("");
          setPage(1);
        }}
        hasFilters={!!(statusFilter || startDate || endDate || storeFilter)}
      >
        <SelectTileMode
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          placeholder="全部状态"
          title="选择状态"
          className="w-[160px]"
        />
        <SelectTileMode
          options={[{ value: "all", label: "全部门店" }, ...stores.map((st) => ({ value: String(st.id), label: st.name }))]}
          value={storeFilter}
          onChange={(v) => {
            setStoreFilter(v);
            setPage(1);
          }}
          placeholder="全部门店"
          title="选择门店"
          className="w-[180px]"
        />
        <DatePicker
          value={startDate}
          onChange={(v) => {
            setStartDate(v);
            setPage(1);
          }}
          placeholder="开始日期"
          className="w-[170px]"
        />
        <span className="text-sm text-muted-foreground">至</span>
        <DatePicker
          value={endDate}
          onChange={(v) => {
            setEndDate(v);
            setPage(1);
          }}
          placeholder="结束日期"
          className="w-[170px]"
        />
      </ListToolbar>

      {/* 列表：卡片式，信息分区清晰 */}
      {loading ? (
        <LoadingState type="list" rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="暂无排程"
          action={{
            label: "创建第一个排程",
            onClick: () => router.push("/schedules/new"),
          }}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card
              key={row.id}
              className="cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/30"
              onClick={() => openQuickView(row.id)}
            >
              <CardContent className="flex flex-col items-stretch gap-4 p-5 md:flex-row md:items-stretch md:gap-6">
                {/* 左：标题 + 元信息 */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                  <h3
                    className="font-semibold text-base truncate mb-2"
                    title={row.store ? `${row.store.name} · ${row.title}` : row.title}
                  >
                    {row.store ? `${row.store.name} · ${row.title}` : row.title}
                  </h3>
                  <div className="flex items-center gap-5 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {new Date(row.scheduleDate).toLocaleDateString("zh-CN")}
                      <span className="text-xs">{getWeekDay(row.scheduleDate)}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ChefHat className="h-3.5 w-3.5" />
                      {row.dishCount} 个菜品 / {row.totalQuantity} 份
                    </span>
                    {row.productionPlan && (
                      <button
                        type="button"
                        className="flex items-center gap-1.5 transition-colors hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          router.push(`/production-plans/${row.productionPlan?.id}`);
                        }}
                        title="查看生产计划单"
                      >
                        <FileStack className="h-3.5 w-3.5" />
                        生产计划 {row.productionPlan.code ?? `PPL-${row.productionPlan.id}`}
                      </button>
                    )}
                  </div>
                </div>

                {/* 右：状态右上（与标题同字号） + 制单人/操作右下 */}
                <div className="flex shrink-0 flex-row items-center justify-between gap-2 md:flex-col md:items-end md:justify-between">
                  <StatusBadge status={row.status} className="text-sm font-semibold px-3 py-1" />
                  <div
                    className="flex flex-wrap items-center justify-end gap-2 md:gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="hidden md:inline text-sm text-muted-foreground whitespace-nowrap">制单人：{row.operatorName || row.operator || "—"}</span>
                    <Button variant="outline" size="sm" onClick={() => openQuickView(row.id)}>
                      <Eye className="mr-1 h-4 w-4" />
                      预览
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => router.push("/schedules/" + row.id)}>
                      详情
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {pagination && pagination.totalItems > 0 && (
        <Pagination
          currentPage={page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          start={(page - 1) * DEFAULT_PAGE_SIZE + 1}
          end={Math.min(page * DEFAULT_PAGE_SIZE, pagination.totalItems)}
          onPageChange={setPage}
        />
      )}

        </>
      )}

      {/* 预览抽屉：复用详情页表格组件，数据与详情页 1:1 */}
      <Sheet open={quickViewLoading || !!quickView} onOpenChange={(open) => !open && closeQuickView()}>
        <SheetContent className="w-full sm:max-w-4xl p-0">
          {quickViewLoading || !quickView || !quickMeta ? (
            <div className="p-6 space-y-3">
              <SheetTitle className="sr-only">排程预览</SheetTitle>
              <LoadingState type="page" />
            </div>
          ) : (
            <>
              <SheetHeader className="border-b px-6 py-4 pr-14">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SheetTitle className="text-lg">{quickView.title}</SheetTitle>
                      <StatusBadge status={quickView.status} />
                    </div>
                    <SheetDescription className="mt-1">
                      {new Date(quickView.scheduleDate).toLocaleDateString("zh-CN")}{" "}
                      {getWeekDay(quickView.scheduleDate)}
                      {" · "}{quickView.store?.name ?? "—"}
                      {" · "}{quickView.dishCount} 个菜品 / {quickView.totalQuantity} 份
                    </SheetDescription>
                    {quickView.productionPlan && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        生产计划：
                        {quickView.productionPlan.code ?? `PPL-${quickView.productionPlan.id}`}
                        {" · "}
                        {quickView.productionPlan.title}
                      </p>
                    )}
                  </div>
                  <Button size="sm" onClick={() => router.push("/schedules/" + quickView.id)}>
                    查看完整详情
                  </Button>
                </div>
              </SheetHeader>

              <SectionTabs
                ariaLabel="排程预览内容"
                value={quickTab}
                onChange={setQuickTab}
                className="px-4"
                tabs={[
                  { value: "menu", label: "排程菜单", count: quickView.items.length },
                  { value: "cutting", label: "切配工单明细", count: quickView.cuttingOrders.length },
                  { value: "purchase", label: "采购计划明细", count: quickView.purchasePlans.length },
                ]}
              />

              <div className="flex-1 overflow-y-auto p-4">
                {quickTab === "menu" && <ScheduleMenuTable items={quickView.items} meta={quickMeta} />}
                {quickTab === "cutting" && <ScheduleCuttingTable rows={quickView.cuttingOrders} meta={quickMeta} />}
                {quickTab === "purchase" && <SchedulePurchaseTable rows={quickView.purchasePlans} meta={quickMeta} />}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={planPreviewLoading || !!planPreview}
        onOpenChange={(open) => !open && closePlanPreview()}
      >
        <SheetContent className="w-full sm:max-w-4xl p-0">
          {planPreviewLoading || !planPreview || !planPreviewMeta ? (
            <div className="p-6 space-y-3">
              <SheetTitle className="sr-only">生产计划单预览</SheetTitle>
              <LoadingState type="page" />
            </div>
          ) : (
            <>
              <SheetHeader className="border-b px-6 py-4 pr-14">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SheetTitle className="text-lg">{planPreview.title}</SheetTitle>
                      <StatusBadge status={planPreview.status} />
                    </div>
                    <SheetDescription className="mt-1">
                      {new Date(planPreview.planDate).toLocaleDateString("zh-CN")}{" "}
                      {getWeekDay(planPreview.planDate)}
                      {" · "}汇总 {planPreview.sourceSchedules.length} 张排程
                      {" · "}制单人：{planPreview.operatorName || planPreview.operator || "—"}
                    </SheetDescription>
                    <p className="mt-1 text-xs text-muted-foreground">
                      来源日期：
                      {[...new Set(planPreview.sourceSchedules.map((schedule) => schedule.scheduleDate.slice(0, 10)))]
                        .map((date) => new Date(date).toLocaleDateString("zh-CN"))
                        .join("、") || "—"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/production-plans/${planPreview.id}/labels`, "_blank", "noopener,noreferrer")}
                      disabled={planPreview.cuttingOrders.length === 0}
                    >
                      <Tags className="mr-1 h-4 w-4" />
                      打印净菜标签
                    </Button>
                    <Button size="sm" onClick={() => router.push("/production-plans/" + planPreview.id)}>
                      查看完整详情
                    </Button>
                  </div>
                </div>
              </SheetHeader>

              <SectionTabs
                ariaLabel="生产计划单预览内容"
                value={planPreviewTab}
                onChange={setPlanPreviewTab}
                className="px-4"
                tabs={[
                  { value: "cutting", label: "切配工单明细", count: planPreview.cuttingOrders.length },
                  { value: "purchase", label: "采购计划明细", count: planPreview.purchasePlans.length },
                ]}
              />

              <div className="flex-1 overflow-y-auto p-4">
                {planPreviewTab === "cutting" && (
                  <ScheduleCuttingTable
                    rows={planPreview.cuttingOrders}
                    meta={planPreviewMeta}
                    enableLabelPrint
                  />
                )}
                {planPreviewTab === "purchase" && (
                  <SchedulePurchaseTable rows={planPreview.purchasePlans} meta={planPreviewMeta} />
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
