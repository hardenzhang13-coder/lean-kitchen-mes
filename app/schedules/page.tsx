"use client";

import { useEffect, useState } from "react";
import { Plus, CalendarDays, ChefHat, Clock, Eye, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/app/components/ui/date-picker";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { PageHeader } from "@/app/components/ui/page-header";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Pagination } from "@/app/components/ui/pagination";
import { SelectField } from "@/app/components/ui/select-field";
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

/** 快速查看抽屉数据（取自详情接口） */
interface QuickDish {
  id: number;
  code: string;
  name: string;
  portion: string;
  meatType: string | null;
  price: number | null;
  category: { name: string } | null;
}

interface QuickItem {
  id: number;
  quantity: number;
  dish: QuickDish;
}

interface QuickCutting {
  id: number;
  sourceType: string;
  sourceId: number;
  itemName: string;
  l1Name: string;
  l2Name: string;
  spec: string | null;
  requiredQty: number;
  unit: string;
  portions: number | null;
}

interface QuickPurchase {
  id: number;
  sourceType: string;
  sourceId: number;
  itemName: string;
  suggestedPurchase: number;
  unit: string;
  priceUnit: string | null;
  purchaseSpec: string | null;
  supplierName: string | null;
  estimatedAmount: number | null;
}

interface QuickDetail {
  id: number;
  title: string;
  scheduleDate: string;
  status: string;
  store: { id: number; name: string } | null;
  items: QuickItem[];
  cuttingOrders: QuickCutting[];
  purchasePlans: QuickPurchase[];
  totalQuantity: number;
  dishCount: number;
}

type QuickTab = "menu" | "cutting" | "purchase";

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
  }, [storeFilter, startDate, endDate, page]);

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await fetch("/api/stores?pageSize=100");
        const data = await res.json();
        setStores(data.data?.items || []);
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

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader title="排程管理" description="设定生产计划，系统自动拆解切配工单与采购计划" />
        <Button onClick={() => router.push("/schedules/new")}>
          <Plus className="mr-2 h-4 w-4" />
          新建排程
        </Button>
      </div>

      {/* 筛选：状态不再是筛选维度，以门店 + 日期为主 */}
      <ListToolbar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="搜索排程标题..."
        onReset={() => {
          setStartDate("");
          setEndDate("");
          setStoreFilter("");
          setSearch("");
          setPage(1);
        }}
        hasFilters={!!(startDate || endDate || storeFilter)}
      >
        <SelectField
          value={storeFilter}
          onChange={(v) => {
            setStoreFilter(v);
            setPage(1);
          }}
          options={[{ value: "all", label: "全部门店" }, ...stores.map((st) => ({ value: String(st.id), label: st.name }))]}
          placeholder="全部门店"
          className="w-[160px]"
        />
        <DatePicker
          value={startDate}
          onChange={(v) => {
            setStartDate(v);
            setPage(1);
          }}
          placeholder="开始日期"
          className="w-[180px]"
        />
        <span className="text-sm text-muted-foreground">至</span>
        <DatePicker
          value={endDate}
          onChange={(v) => {
            setEndDate(v);
            setPage(1);
          }}
          placeholder="结束日期"
          className="w-[180px]"
        />
      </ListToolbar>

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
              className="flex items-center gap-4 rounded-lg border p-4 hover:bg-muted/40 transition-colors"
            >
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => router.push("/schedules/" + row.id)}
              >
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
                    {row.store?.name ?? "—"}
                  </span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                负责人：{row.operatorName || row.operator || "—"}
              </div>
              <Button variant="outline" size="sm" onClick={() => openQuickView(row.id)}>
                <Eye className="mr-1 h-4 w-4" />
                快速查看
              </Button>
            </div>
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

      {/* 快速查看抽屉 */}
      {(quickViewLoading || quickView) && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/35"
            onClick={() => {
              setQuickView(null);
              setQuickViewLoading(false);
            }}
          />
          <div className="relative w-full max-w-xl bg-background shadow-2xl flex flex-col h-full">
            {quickViewLoading || !quickView ? (
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
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="关闭"
                    onClick={() => setQuickView(null)}
                  >
                    <X className="h-5 w-5" />
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
                  {quickTab === "menu" && (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-2 pr-2 font-medium">菜品名称</th>
                          <th className="py-2 pr-2 font-medium">份量</th>
                          <th className="py-2 pr-2 font-medium">荤素</th>
                          <th className="py-2 pr-2 font-medium text-right">数量（份）</th>
                          <th className="py-2 font-medium text-right">售价/份</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickView.items.map((it) => (
                          <tr key={it.id} className="border-t">
                            <td className="py-2 pr-2 font-medium">{it.dish.name}</td>
                            <td className="py-2 pr-2 text-muted-foreground">{it.dish.portion}</td>
                            <td className="py-2 pr-2 text-muted-foreground">{it.dish.meatType || "—"}</td>
                            <td className="py-2 pr-2 text-right font-semibold">{it.quantity}</td>
                            <td className="py-2 text-right text-muted-foreground">
                              {it.dish.price != null ? "¥" + Number(it.dish.price).toFixed(2) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {quickTab === "cutting" && (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-2 pr-2 font-medium">一级分类</th>
                          <th className="py-2 pr-2 font-medium">名称</th>
                          <th className="py-2 pr-2 font-medium">规格</th>
                          <th className="py-2 pr-2 font-medium text-right">切配量</th>
                          <th className="py-2 font-medium text-right">切配份数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickView.cuttingOrders.map((c) => (
                          <tr key={c.id} className="border-t">
                            <td className="py-2 pr-2 text-muted-foreground">{c.l1Name}</td>
                            <td className="py-2 pr-2 font-medium">{c.itemName}</td>
                            <td className="py-2 pr-2 text-muted-foreground">{c.spec || "—"}</td>
                            <td className="py-2 pr-2 text-right">{c.requiredQty.toLocaleString("zh-CN")} {c.unit}</td>
                            <td className="py-2 text-right font-semibold text-primary">{c.portions ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {quickTab === "purchase" && (
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-2 pr-2 font-medium">食材名称</th>
                          <th className="py-2 pr-2 font-medium">采购规格</th>
                          <th className="py-2 pr-2 font-medium text-right">建议采购量</th>
                          <th className="py-2 pr-2 font-medium">供应商</th>
                          <th className="py-2 font-medium text-right">预估金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quickView.purchasePlans.map((p) => (
                          <tr key={p.id} className="border-t">
                            <td className="py-2 pr-2 font-medium">{p.itemName}</td>
                            <td className="py-2 pr-2 text-muted-foreground">{p.purchaseSpec || "—"}</td>
                            <td className="py-2 pr-2 text-right">
                              {p.suggestedPurchase > 0 ? p.suggestedPurchase.toLocaleString("zh-CN") : "0"}
                              {" "}{p.priceUnit || p.unit}
                            </td>
                            <td className="py-2 pr-2 text-muted-foreground">{p.supplierName || "—"}</td>
                            <td className="py-2 text-right">
                              {p.estimatedAmount != null ? "¥" + p.estimatedAmount.toFixed(2) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 px-6 py-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/schedules/" + quickView.id + "/print?doc=cutting", "_blank")}
                  >
                    打印切配单
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/schedules/" + quickView.id + "/print?doc=purchase&mode=all", "_blank")}
                  >
                    打印采购单（全部）
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("/schedules/" + quickView.id + "/print?doc=purchase&mode=supplier", "_blank")}
                  >
                    按供应商打印
                  </Button>
                  <Button size="sm" onClick={() => router.push("/schedules/" + quickView.id)}>
                    查看完整详情 →
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}