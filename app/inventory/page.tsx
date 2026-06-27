"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Beef,
  Bean,
  Bird,
  Carrot,
  Circle,
  Factory,
  Fish,
  Flame,
  LayoutGrid,
  Package,
  Search,
  Wheat,
  ClipboardList,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/app/components/page-header";
import { EmptyState } from "@/app/components/empty-state";
import { StatusBadge, inventoryStatusToVariant } from "@/app/components/status-badge";
import { KpiCard } from "@/app/components/kpi-card";
import { CategoryPill } from "@/app/components/category-pill";
import { ViewToggle } from "@/app/components/view-toggle";
import {
  IngredientCard,
  InventoryItemWithDetail,
} from "@/app/components/ingredient-card";
import { InventorySkeleton } from "@/app/components/inventory-skeleton";
import { TabSwitcher } from "@/app/components/tab-switcher";
import { Pagination } from "@/app/components/pagination";
import {
  isToday,
  formatRelativeTime,
  formatNumber,
  groupBy,
} from "@/lib/utils";
import { useDebounce } from "@/lib/hooks";
import { toast } from "sonner";
import { LucideIcon } from "lucide-react";

interface InventoryItem {
  id: number;
  sourceId: number;
  name: string;
  code: string;
  l2Code?: string;
  l1Name?: string;
  l2Name?: string;
  currentQty: number;
  unit: string;
  updatedAt: string;
}

interface IngredientDetail {
  id: number;
  alias: string | null;
  purchaseSpec: string | null;
  purchaseUnit: string | null;
  stockUnit: string | null;
  latestRefPrice: number | string | null;
  season: string | null;
  storage: string | null;
}

interface IngredientCategoryL1 {
  id: number;
  code: string;
  name: string;
}

const L1_ICON_MAP: Record<string, LucideIcon> = {
  蔬菜: Carrot,
  肉类: Beef,
  水产: Fish,
  禽类: Bird,
  干货: Package,
  豆制品: Bean,
  粮油: Wheat,
  加工品: Factory,
  调味品: Flame,
};

function getL1Icon(name: string): LucideIcon {
  return L1_ICON_MAP[name] || Circle;
}

type HealthStatus = "充足" | "正常" | "低库存";

function getHealthStatus(qty: number): HealthStatus {
  if (qty >= 10) return "充足";
  if (qty >= 5) return "正常";
  return "低库存";
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [ingredients, setIngredients] = useState<IngredientDetail[]>([]);
  const [l1Categories, setL1Categories] = useState<IngredientCategoryL1[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [activeL1, setActiveL1] = useState("全部");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ totalItems: number; totalPages: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [inventoryRes, ingredientsRes, categoriesRes] = await Promise.all([
          fetch(`/api/inventory?page=${page}&pageSize=100`),
          fetch("/api/ingredients?page=1&pageSize=100"),
          fetch("/api/ingredient-categories?type=l1&page=1&pageSize=100"),
        ]);

        if (!inventoryRes.ok || !ingredientsRes.ok || !categoriesRes.ok) {
          throw new Error("获取数据失败");
        }

        const [inventoryData, ingredientsResponse, categoriesData] = await Promise.all([
          inventoryRes.json(),
          ingredientsRes.json(),
          categoriesRes.json(),
        ]);

        const ingredientsData = Array.isArray(ingredientsResponse)
          ? ingredientsResponse
          : ingredientsResponse?.data || [];

        if (!cancelled) {
          setRows(inventoryData.data || []);
          setPagination(inventoryData.pagination || null);
          setIngredients(ingredientsData);
          setL1Categories(Array.isArray(categoriesData) ? categoriesData : categoriesData.data || []);
        }
      } catch {
        if (!cancelled) {
          toast.error("获取库存数据失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    if (value.trim()) {
      setActiveL1("全部");
    }
  };

  const ingredientMap = useMemo(() => {
    return new Map(ingredients.map((i) => [i.id, i]));
  }, [ingredients]);

  const itemsWithDetail: InventoryItemWithDetail[] = useMemo(() => {
    return rows.map((row) => {
      const detail = ingredientMap.get(row.sourceId);
      return {
        ...row,
        alias: detail?.alias,
        purchaseSpec: detail?.purchaseSpec,
        purchaseUnit: detail?.purchaseUnit,
        stockUnit: detail?.stockUnit,
        latestRefPrice:
          detail?.latestRefPrice != null ? Number(detail.latestRefPrice) : null,
        season: detail?.season,
        storage: detail?.storage,
      };
    });
  }, [rows, ingredientMap]);

  const kpiData = useMemo(() => {
    const totalKinds = itemsWithDetail.length;
    const lowStock = itemsWithDetail.filter((i) => i.currentQty < 5).length;
    const todayUpdated = itemsWithDetail.filter((i) => isToday(i.updatedAt)).length;
    return { totalKinds, lowStock, todayUpdated };
  }, [itemsWithDetail]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    itemsWithDetail.forEach((item) => {
      const l1 = item.l1Name || "未分类";
      counts.set(l1, (counts.get(l1) || 0) + 1);
    });
    return counts;
  }, [itemsWithDetail]);

  const categoryPills = useMemo(() => {
    const pills = l1Categories.map((cat) => ({
      name: cat.name,
      icon: getL1Icon(cat.name),
      count: categoryCounts.get(cat.name) || 0,
    }));
    return [
      { name: "全部", icon: LayoutGrid as LucideIcon, count: itemsWithDetail.length },
      ...pills,
    ];
  }, [l1Categories, categoryCounts, itemsWithDetail.length]);

  const filteredItems = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return itemsWithDetail.filter((item) => {
      const matchSearch = !term
        ? true
        : item.name.toLowerCase().includes(term) ||
          item.code.toLowerCase().includes(term) ||
          item.l1Name?.toLowerCase().includes(term) ||
          item.l2Name?.toLowerCase().includes(term);
      const matchL1 = activeL1 === "全部" ? true : item.l1Name === activeL1;
      return matchSearch && matchL1;
    });
  }, [itemsWithDetail, debouncedSearch, activeL1]);

  const l2Groups = useMemo(() => {
    const grouped = groupBy(filteredItems, (item) => item.l2Name || "未分类"
    );
    return Object.entries(grouped).map(([l2Name, items]) => ({
      l2Name,
      items,
      count: items.length,
      subtotalQty: items.reduce((sum, item) => sum + item.currentQty, 0),
    }));
  }, [filteredItems]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <PageHeader
            showBack
            title="库存管理"
            description="实时库存查询与管理"
          />
          <TabSwitcher
            tabs={[
              { label: "实时库存", href: "/inventory", active: true },
              { label: "库存台账", href: "/inventory/ledger", active: false },
            ]}
          />
        </div>
        <InventorySkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* 顶部：标题 + Tab 切换 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          showBack
          title="库存管理"
          description="实时库存查询与管理"
        />
        <TabSwitcher
          tabs={[
            { label: "实时库存", href: "/inventory", active: true },
            { label: "库存台账", href: "/inventory/ledger", active: false },
          ]}
        />
      </div>

      {/* KPI 看板 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={ClipboardList}
          value={kpiData.totalKinds}
          label="当前库存食材种类"
          unit="种"
        />
        <KpiCard
          icon={AlertTriangle}
          value={kpiData.lowStock}
          label="低库存预警"
          unit="项"
          variant={kpiData.lowStock > 0 ? "destructive" : "default"}
        />
        <KpiCard
          icon={Clock}
          value="—"
          label="临期食材预警"
          unit="项"
          footer="待保质期管理模块接入"
        />
        <KpiCard
          icon={Clock}
          value={kpiData.todayUpdated}
          label="今日更新"
          unit="项"
        />
      </div>

      {/* 搜索 + 视图切换 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="请输入食材名称、编码或分类"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* 一级分类导航 */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {categoryPills.map((pill) => (
          <CategoryPill
            key={pill.name}
            name={pill.name}
            icon={pill.icon}
            count={pill.count}
            active={activeL1 === pill.name}
            disabled={pill.count === 0}
            onClick={() => { setActiveL1(pill.name); setPage(1); }}
          />
        ))}
      </div>

      {/* 分类明细区域 */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={Package}
          title="暂无库存数据"
          description={
            debouncedSearch || activeL1 !== "全部"
              ? "当前搜索或分类下没有食材"
              : "系统中暂无库存记录"
          }
        />
      ) : viewMode === "card" ? (
        <div className="space-y-8">
          {l2Groups.map((group) => (
            <section key={group.l2Name}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{group.l2Name}</h2>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {group.count} 种
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  小计 {formatNumber(group.subtotalQty)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {group.items.map((item) => (
                  <IngredientCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {l2Groups.map((group) => (
            <section key={group.l2Name}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{group.l2Name}</h2>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {group.count} 种
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  小计 {formatNumber(group.subtotalQty)}
                </span>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>食材名称</TableHead>
                      <TableHead>编码</TableHead>
                      <TableHead>当前库存量</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>库存状态</TableHead>
                      <TableHead>更新时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.items.map((row) => {
                      const status = getHealthStatus(row.currentQty);
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {row.code}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatNumber(row.currentQty)}
                          </TableCell>
                          <TableCell>{row.unit}</TableCell>
                          <TableCell>
                            <StatusBadge
                              variant={inventoryStatusToVariant(status)}
                              status={status}
                            />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatRelativeTime(row.updatedAt)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </div>
      )}
      {pagination && pagination.totalItems > 0 && (
        <Pagination
          currentPage={page}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          start={(page - 1) * 100 + 1}
          end={Math.min(page * 100, pagination.totalItems)}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
