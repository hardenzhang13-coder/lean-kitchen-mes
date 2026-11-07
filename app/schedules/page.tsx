"use client";

import { useEffect, useState } from "react";
import { Plus, Eye, CalendarDays, ChefHat, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/app/components/ui/date-picker";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { PageHeader } from "@/app/components/ui/page-header";
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
}

/** 快速查看抽屉数据：与详情页同源同结构（复用详情页表格组件，保证一致） */
interface QuickDetail {
  id: number;
  title: string;
  scheduleDate: string;
  status: string;
  store: { id: number; name: string } | null;
  items: ScheduleMenuItem[];
  cuttingOrders: CuttingOrderRow[];
  purchasePlans: PurchasePlanRow[];
  totalQuantity: number;
  dishCount: number;
}

type QuickTab = "menu" | "cutting" | "purchase";

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
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Array<{ id: number; name: string }>>([]);
  const [storeFilter, setStoreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ totalItems: number; totalPages: number } | null>(null);

  // 快速查看抽屉
  const [quickView, setQuickView] = useState<QuickDetail | null>(null);
  const [quickViewLoading, setQuickViewLoading] = useState(false);
  const [quickTab, setQuickTab] = useState<QuickTab>("menu");

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (search) params.set("q", search);
      if (storeFilter && storeFilter !== "all") params.set("storeId", storeFilter);
      params.set("page", String(page));
      params.set("pageSize", String(DEFAULT_PAGE_SIZE));
      const res = await fetch("/api/schedules?" + params.toString());
      const data = await res.json();
      setRows(data.data || []);
      setPagination(data.pagination || null);
    } catch {
      toast.error("获取排程数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, storeFilter, startDate, endDate, page]);

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
    const timer = setTimeout(() => fetchData(), 300);
    return () => clearTimeout(timer);
  }, [search]);

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

  const quickMeta: ScheduleDocMeta | null = quickView
    ? {
        title: quickView.title,
        scheduleDate: quickView.scheduleDate,
        storeName: quickView.store?.name ?? "",
        scheduleId: quickView.id,
      }
    : null;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader title="排程管理" description="设定生产计划，系统自动拆解切配工单与采购计划" />
        <Button onClick={() => router.push("/schedules/new")}>
          <Plus className="mr-2 h-4 w-4" />
          新建排程
        </Button>
      </div>

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
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
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
              <CardContent className="p-5 flex items-center gap-6">
                {/* 主信息区 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-base truncate">{row.title}</h3>
                    <StatusBadge status={row.status} />
                  </div>
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
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {row.store?.name ?? "—"}
                    </span>
                  </div>
                </div>

                {/* 负责人 */}
                <div className="hidden md:block text-sm text-muted-foreground whitespace-nowrap">
                  负责人：{row.operatorName || row.operator || "—"}
                </div>

                {/* 操作区 */}
                <div
                  className="flex items-center gap-2 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openQuickView(row.id)}
                  >
                    <Eye className="mr-1 h-4 w-4" />
                    快速查看
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/schedules/" + row.id)}
                  >
                    详情
                  </Button>
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

      {/* 快速查看抽屉：复用详情页表格组件，数据与详情页 1:1 */}
      {(quickViewLoading || quickView) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/35" onClick={closeQuickView} />
          <div className="relative w-full max-w-4xl bg-background shadow-2xl flex flex-col h-full">
            {quickViewLoading || !quickView || !quickMeta ? (
              <div className="p-6 space-y-3">
                <div className="h-8 bg-muted rounded animate-pulse" />
                <div className="h-64 bg-muted rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between px-6 py-4 border-b">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold">{quickView.title}</h2>
                      <StatusBadge status={quickView.status} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(quickView.scheduleDate).toLocaleDateString("zh-CN")} {getWeekDay(quickView.scheduleDate)}
                      {" · "}{quickView.store?.name ?? "—"}
                      {" · "}{quickView.dishCount} 个菜品 / {quickView.totalQuantity} 份
                    </p>
                  </div>
                  <Button size="sm" onClick={() => router.push("/schedules/" + quickView.id)}>
                    查看完整详情 →
                  </Button>
                </div>

                <div className="flex items-center gap-1 border-b px-4">
                  {([['menu', '排程菜单', quickView.items.length], ['cutting', '切配工单明细', quickView.cuttingOrders.length], ['purchase', '采购计划明细', quickView.purchasePlans.length]] as const).map(([key, label, count]) => (
                    <button
                      key={key}
                      onClick={() => setQuickTab(key)}
                      className={
                        "px-3 py-2.5 text-sm font-medium border-b-2 -mb-px " +
                        (quickTab === key
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground")
                      }
                    >
                      {label}
                      <span className="ml-1 text-xs rounded-full bg-muted px-1.5 py-0.5">{count}</span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {quickTab === "menu" && <ScheduleMenuTable items={quickView.items} meta={quickMeta} />}
                  {quickTab === "cutting" && <ScheduleCuttingTable rows={quickView.cuttingOrders} meta={quickMeta} />}
                  {quickTab === "purchase" && <SchedulePurchaseTable rows={quickView.purchasePlans} meta={quickMeta} />}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
