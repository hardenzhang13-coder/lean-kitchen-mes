"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRightLeft,
  Building2,
  Pencil,
  Plus,
  User,
  Users,
} from "lucide-react";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageTabs } from "@/app/components/ui/page-tabs";
import { DataTable } from "@/app/components/ui/data-table";
import { CodeText } from "@/app/components/ui/code-text";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuSegmented } from "@/app/components/ui/skeu-segmented";
import { SkeuDotSelect, type SkeuDotOption } from "@/app/components/ui/skeu-dot-select";
import { SkeuActionButton } from "@/app/components/ui/skeu-row-action";
import { SkeuListSelect, type SkeuListSelectOption } from "@/app/components/ui/skeu-list-select";
import { DishStatusTag } from "@/app/components/ui/dish-status-tag";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { MeatTypeTag } from "@/app/components/ui/meat-type-tag";
import { formatPageSummary } from "@/lib/client/use-pagination";
import { DishDetailDialog } from "@/app/components/dishes/dish-detail-dialog";
import { DishScaleDialog } from "@/app/components/dishes/dish-scale-dialog";
import { DishUnpublishEditDialog } from "@/app/components/dishes/dish-unpublish-edit-dialog";
import {
  DishDetail,
  calcGrossMarginPercent,
} from "@/app/components/dish-form/types";
import { usePortionProfiles } from "@/lib/client/use-portion-profiles";
import { isBasePortion } from "@/lib/shared/portion-scale";
import { toast } from "sonner";
import { formatMoney } from "@/lib/shared/display-format";

type StatusFilter = "" | "draft" | "published" | "inactive";
type MeatFilter = "" | "荤菜" | "小荤菜" | "素菜";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
  { value: "inactive", label: "已停用" },
] as const;

/** 荤素筛选：SkeuDotSelect 圆点下拉（与设置模块状态筛选同一标准件），与荤素胶囊同色 */
const MEAT_FILTER_OPTIONS: SkeuDotOption[] = [
  { value: "", label: "全部", tone: "all" },
  { value: "荤菜", label: "荤菜", tone: "danger" },
  { value: "小荤菜", label: "小荤菜", tone: "rose" },
  { value: "素菜", label: "素菜", tone: "green" },
];

/** 份量分组页签图标：档案场景按序循环复用 */
const GROUP_ICONS = [User, Users, Building2];

/** 档案加载失败时的兜底页签：value 必须是份量档案 scenario（服务端按 scenario 过滤） */
const LEGACY_GROUP_VALUES = ["单人份", "社区", "团餐食堂"];

export default function DishesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dishIdParam = searchParams.get("dishId");
  const groupParam = searchParams.get("group");
  // 份量分组唯一来源是份量档案 scenario；档案未就绪/失败时回退兜底三组（值仍是 scenario）
  const { profiles, loading: profilesLoading, error: profilesError } =
    usePortionProfiles();

  /** 场景有序集合：按档案 sortOrder 顺序去重 */
  const scenarios = useMemo(() => {
    const list: string[] = [];
    (profiles ?? []).forEach((p) => {
      if (p.isActive && !list.includes(p.scenario)) list.push(p.scenario);
    });
    return list;
  }, [profiles]);

  const groupTabs = useMemo(
    () =>
      (profilesError || scenarios.length === 0 ? LEGACY_GROUP_VALUES : scenarios).map(
        (value, i) => ({ value, label: value, icon: GROUP_ICONS[i % GROUP_ICONS.length] })
      ),
    [profilesError, scenarios]
  );

  const group: string =
    groupParam && groupTabs.some((t) => t.value === groupParam)
      ? groupParam
      : (groupTabs[0]?.value ?? "");

  // URL 分组参数不在档案场景内（含首次进入无参数）：档案就绪后回写为第一个场景
  useEffect(() => {
    if (profilesLoading) return;
    if (groupTabs.length === 0) return;
    if (!groupParam || !groupTabs.some((t) => t.value === groupParam)) {
      router.replace(`/dishes?group=${encodeURIComponent(groupTabs[0].value)}`);
    }
  }, [profilesLoading, groupTabs, groupParam, router]);
  const [dishes, setDishes] = useState<DishDetail[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMeatType, setFilterMeatType] = useState<MeatFilter>("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [pagination, setPagination] = useState<{ totalItems: number; totalPages: number } | null>(null);

  const [selectedDish, setSelectedDish] = useState<DishDetail | null>(null);
  const [fullDish, setFullDish] = useState<DishDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scaleTarget, setScaleTarget] = useState<DishDetail | null>(null);
  const [unpublishEditTarget, setUnpublishEditTarget] = useState<DishDetail | null>(null);

  const fetchDetail = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/dishes/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "获取菜品详情失败");
        return;
      }
      const json = await res.json();
      setFullDish(json.data || json);
    } catch {
      toast.error("获取菜品详情失败");
    }
  }, []);

  useEffect(() => {
    if (!group || profilesLoading) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("portionGroup", group);
        if (filterCategory) params.set("categoryId", filterCategory);
        if (filterMeatType) params.set("meatType", filterMeatType);
        if (filterStatus) params.set("status", filterStatus);
        if (search.trim()) params.set("q", search.trim());
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const [dRes, cRes] = await Promise.all([
          fetch(`/api/dishes?${params.toString()}`, { signal: controller.signal }),
          fetch("/api/dish-categories?page=1&pageSize=100", { signal: controller.signal }),
        ]);
        const dJson = await dRes.json();
        const cJson = await cRes.json();
        if (controller.signal.aborted) return;
        setDishes(dJson.data || []);
        setPagination(dJson.pagination || null);
        setCategories(Array.isArray(cJson) ? cJson : cJson.data || []);
        if (dishIdParam) {
          const id = Number(dishIdParam);
          const dish = (dJson.data || []).find((d: DishDetail) => d.id === id);
          if (dish) {
            setSelectedDish(dish);
            setDetailOpen(true);
            fetchDetail(id);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        toast.error(err instanceof Error ? err.message : "获取数据失败");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [group, profilesLoading, filterCategory, filterMeatType, filterStatus, search, page, pageSize, refreshKey, dishIdParam, fetchDetail]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const categoryOptions = useMemo<SkeuListSelectOption[]>(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories]
  );

  const hasFilters = search || filterCategory || filterMeatType || filterStatus;

  const clearFilters = () => {
    setSearch("");
    setFilterCategory("");
    setFilterMeatType("");
    setFilterStatus("");
    setPage(1);
  };

  const openDetail = (dish: DishDetail) => {
    setSelectedDish(dish);
    setFullDish(null);
    setDetailOpen(true);
    fetchDetail(dish.id);
  };

  const closeDetail = (open: boolean) => {
    setDetailOpen(open);
    if (!open && dishIdParam) {
      router.replace("/dishes");
    }
  };

  /** 详情弹窗内状态变更后：重取详情并刷新列表 */
  const handleDetailChanged = useCallback(() => {
    if (selectedDish) fetchDetail(selectedDish.id);
    refresh();
  }, [selectedDish, fetchDetail]);

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          title="菜品库"
          description="管理所有菜品及其 BOM 与工艺"
          actions={
            <SkeuButton onClick={() => router.push("/dishes/new")}>
              <Plus className="h-4 w-4" />
              新增菜品
            </SkeuButton>
          }
        />
      }
    >
      <div className="skeu-panel flex min-h-0 flex-1 flex-col overflow-hidden">
        <PageTabs
          tabs={groupTabs}
          value={group}
          onChange={(next) => {
            if (!groupTabs.some((t) => t.value === next)) return;
            setPage(1);
            setDetailOpen(false);
            router.replace(`/dishes?group=${encodeURIComponent(next)}`);
          }}
          ariaLabel="菜品份量分类"
        />
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="skeu-panel-toolbar shrink-0 px-5 py-4">
            <ListToolbar
              searchValue={search}
              onSearchChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              searchPlaceholder="搜索菜品名称或编号..."
              onReset={clearFilters}
              hasFilters={Boolean(hasFilters)}
            >
              <SkeuListSelect
                value={filterCategory}
                onChange={(v) => {
                  setFilterCategory(v);
                  setPage(1);
                }}
                options={categoryOptions}
                ariaLabel="类别筛选"
                allLabel="全部类别"
                searchable
                searchPlaceholder="搜索类别..."
                className="w-[160px]"
              />
              <SkeuDotSelect
                value={filterMeatType}
                onChange={(value) => {
                  setFilterMeatType(value as MeatFilter);
                  setPage(1);
                }}
                options={[...MEAT_FILTER_OPTIONS]}
                aria-label="荤素筛选"
              />
              <SkeuSegmented
                value={filterStatus}
                onChange={(value) => {
                  setFilterStatus(value);
                  setPage(1);
                }}
                options={[...STATUS_FILTER_OPTIONS]}
                ariaLabel="状态筛选"
              />
            </ListToolbar>
          </div>
          <div className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
            <DataTable<DishDetail>
              data={dishes}
              loading={loading}
              onRowClick={openDetail}
              fillHeight
              variant="skeu"
              rowSize="tall"
              actionsWidth="w-[180px]"
              tableClassName="min-w-max"
              columns={[
              {
                header: "序号",
                className: "w-[48px]",
                cell: (_, rowIdx) => (
                  <span className="text-muted-foreground">
                    {(page - 1) * pageSize + rowIdx + 1}
                  </span>
                ),
              },
              {
                header: "编号",
                className: "w-[120px]",
                cell: (row) => (
                  <CodeText className="whitespace-nowrap">{row.code}</CodeText>
                ),
              },
              {
                header: "菜品名称",
                className: "w-[160px]",
                cell: (row) => (
                  <span className="whitespace-nowrap font-semibold text-primary">{row.name}</span>
                ),
              },
              {
                header: "份量",
                className: "w-[110px]",
                cell: (row) => <PortionTag portion={row.portion} />,
              },
              {
                header: "荤素",
                className: "w-[100px]",
                cell: (row) => <MeatTypeTag type={row.meatType} />,
              },
              {
                header: "成本价",
                className: "w-[90px] text-right",
                cell: (row) => (
                  <span className="whitespace-nowrap font-medium tabular-nums">
                    {formatMoney(row.cost, "份")}
                  </span>
                ),
              },
              {
                header: "售价",
                className: "w-[90px] text-right",
                cell: (row) => (
                  <span className="whitespace-nowrap font-semibold tabular-nums text-primary">
                    {formatMoney(row.price, "份")}
                  </span>
                ),
              },
              {
                header: "毛利率",
                className: "w-[80px] text-right",
                cell: (row) => {
                  const margin = calcGrossMarginPercent(row.cost, row.price);
                  return (
                    <span
                      className={
                        margin != null && margin < 0
                          ? "font-medium text-destructive tabular-nums"
                          : "text-muted-foreground tabular-nums"
                      }
                    >
                      {margin != null ? `${margin}%` : "–"}
                    </span>
                  );
                },
              },
              {
                header: "状态",
                className: "w-[90px]",
                cell: (row) => <DishStatusTag status={row.status} />,
              },
            ]}
            rowActions={(row) => (
              <>
                <SkeuActionButton
                  label="编辑"
                  icon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    // 编辑全状态可达：非草稿先「下架并编辑」（复制/删除收进详情操作簇）
                    if (row.status === "draft") router.push(`/dishes/${row.id}/edit`);
                    else setUnpublishEditTarget(row);
                  }}
                />
                {isBasePortion(row.portion, profiles) && row.status === "published" && (
                  <SkeuActionButton
                    label="转化"
                    tone="primary"
                    icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setScaleTarget(row);
                    }}
                  />
                )}
              </>
            )}
            pagination={
              pagination && pagination.totalItems > 0
                ? {
                    currentPage: page,
                    totalPages: pagination.totalPages,
                    totalItems: pagination.totalItems,
                    pageSize,
                    onPageChange: setPage,
                    totalLabel: formatPageSummary(pagination.totalItems),
                    showPageSize: true,
                    onPageSizeChange: (size) => {
                      setPageSize(size);
                      setPage(1);
                    },
                  }
                : undefined
            }
            emptyState={{
              title: "该分类下暂无菜品",
              description: "切换上方份量页签，或新增一道菜品",
              action: {
                label: "新增菜品",
                onClick: () => router.push("/dishes/new"),
              },
            }}
          />
          </div>
        </div>
      </div>

      {selectedDish && (
        <DishDetailDialog
          dish={fullDish ?? selectedDish}
          open={detailOpen}
          onOpenChange={closeDetail}
          onChanged={handleDetailChanged}
          onDeleted={refresh}
        />
      )}

      {unpublishEditTarget && (
        <DishUnpublishEditDialog
          dish={unpublishEditTarget}
          open={unpublishEditTarget !== null}
          onOpenChange={(open) => {
            if (!open) setUnpublishEditTarget(null);
          }}
        />
      )}

      {scaleTarget && (
        <DishScaleDialog
          key={scaleTarget.id}
          dish={scaleTarget}
          open={scaleTarget !== null}
          onOpenChange={(open) => {
            if (!open) setScaleTarget(null);
          }}
          onSuccess={(newDish) => {
            setScaleTarget(null);
            refresh();
            if (newDish?.id) {
              setSelectedDish(newDish);
              setDetailOpen(true);
              fetchDetail(newDish.id);
            }
          }}
        />
      )}
    </PageShell>
  );
}
