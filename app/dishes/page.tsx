"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil, ArrowRightLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageHeader } from "@/app/components/ui/page-header";
import { DataTable } from "@/app/components/ui/data-table";
import { CodeText } from "@/app/components/ui/code-text";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuIconAction } from "@/app/components/ui/skeu-row-action";
import { DishStatusTag } from "@/app/components/ui/dish-status-tag";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { FormField } from "@/app/components/ui/form-field";
import { Input } from "@/app/components/ui/form-controls";
import {
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
import { DishSheetDetail } from "@/app/components/dishes/dish-sheet-detail";
import { DishScaleDialog } from "@/app/components/dishes/dish-scale-dialog";
import {
  DishDetail,
  calcGrossMarginPercent,
} from "@/app/components/dish-form/types";
import { TECHNIQUE_OPTIONS as techniqueOptions } from "@/lib/shared/dish-enums";
import { toast } from "sonner";
import { formatMoney } from "@/lib/shared/display-format";
import { AppDialogContent } from "@/app/components/ui/app-dialog";

const statusOptions = [
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
];

// 份量与净料/小料档案共用同一套枚举（lib/shared/portion-scale.ts）

function MeatTypeBadge({ type }: { type?: string | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  const classes: Record<string, string> = {
    荤菜: "bg-red-100 text-red-700 hover:bg-red-100",
    素菜: "bg-green-100 text-green-700 hover:bg-green-100",
    小荤菜: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  };
  return (
    <Badge className={classes[type] || "bg-muted text-muted-foreground"}>
      {type}
    </Badge>
  );
}

export default function DishesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dishIdParam = searchParams.get("dishId");
  const [dishes, setDishes] = useState<DishDetail[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTechnique, setFilterTechnique] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<{ totalItems: number; totalPages: number } | null>(null);

  const [selectedDish, setSelectedDish] = useState<DishDetail | null>(null);
  const [fullDish, setFullDish] = useState<DishDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scaleTarget, setScaleTarget] = useState<DishDetail | null>(null);
  const [copyTarget, setCopyTarget] = useState<DishDetail | null>(null);
  const [copyName, setCopyName] = useState("");
  const [copying, setCopying] = useState(false);

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
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterCategory) params.set("categoryId", filterCategory);
        if (filterTechnique) params.set("technique", filterTechnique);
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
            setSheetOpen(true);
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
  }, [filterCategory, filterTechnique, filterStatus, search, page, pageSize, refreshKey, dishIdParam, fetchDetail]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories]
  );

  const hasFilters = search || filterCategory || filterTechnique || filterStatus;

  const clearFilters = () => {
    setSearch("");
    setFilterCategory("");
    setFilterTechnique("");
    setFilterStatus("");
    setPage(1);
  };

  const openSheet = (dish: DishDetail) => {
    setSelectedDish(dish);
    setFullDish(null);
    setSheetOpen(true);
    fetchDetail(dish.id);
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/dishes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("删除成功");
      setSheetOpen(false);
      refresh();
    } catch {
      toast.error("删除失败");
    }
  };

  const changeDishStatus = async (id: number, action: "publish" | "unpublish") => {
    const res = await fetch(`/api/dishes/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || (action === "publish" ? "发布失败" : "下架失败"));
      return false;
    }
    return true;
  };

  const handleUnpublish = async (id: number) => {
    try {
      if (!(await changeDishStatus(id, "unpublish"))) return;
      toast.success("已下架");
      setSheetOpen(false);
      refresh();
    } catch {
      toast.error("下架失败");
    }
  };

  const handlePublish = async (id: number) => {
    try {
      if (!(await changeDishStatus(id, "publish"))) return;
      toast.success("发布成功");
      setSheetOpen(false);
      refresh();
    } catch {
      toast.error("发布失败");
    }
  };

  const openCopy = (dish: DishDetail) => {
    setCopyTarget(dish);
    setCopyName(`${dish.name}-副本`);
  };

  const handleCopy = async () => {
    if (!copyTarget || !copyName.trim()) return;
    setCopying(true);
    try {
      const res = await fetch(`/api/dishes/${copyTarget.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: copyName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "复制失败");
        return;
      }
      toast.success(`已复制为「${copyName.trim()}」`);
      setCopyTarget(null);
      refresh();
    } catch {
      toast.error("复制失败");
    } finally {
      setCopying(false);
    }
  };

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
      <Card className="skeu-panel flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0 ring-0">
        <CardHeader className="skeu-panel-toolbar shrink-0 px-5 py-4">
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
            <SelectTileMode
              options={categoryOptions}
              value={filterCategory}
              onChange={(v) => {
                setFilterCategory(v);
                setPage(1);
              }}
              placeholder="全部类别"
              title="选择菜品类别"
              className="w-[180px]"
            />
            <SelectTileMode
              options={techniqueOptions}
              value={filterTechnique}
              onChange={(v) => {
                setFilterTechnique(v);
                setPage(1);
              }}
              placeholder="全部做法"
              title="选择做法"
              className="w-[180px]"
            />
            <SelectTileMode
              options={statusOptions}
              value={filterStatus}
              onChange={(v) => {
                setFilterStatus(v);
                setPage(1);
              }}
              placeholder="全部状态"
              title="选择状态"
              className="w-[180px]"
            />
          </ListToolbar>
        </CardHeader>
        <CardContent className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
          <DataTable<DishDetail>
            data={dishes}
            loading={loading}
            onRowClick={openSheet}
            fillHeight
            variant="skeu"
            actionsWidth="w-[150px]"
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
                className: "w-[96px]",
                cell: (row) => <PortionTag portion={row.portion} />,
              },
              {
                header: "类别",
                className: "w-[96px]",
                cell: (row) => (
                  <CategoryTag l1Code={row.category?.code} name={row.category?.name} />
                ),
              },
              {
                header: "荤素",
                className: "w-[80px]",
                cell: (row) => <MeatTypeBadge type={row.meatType} />,
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
                      {margin != null ? `${margin}%` : "—"}
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
                <SkeuIconAction
                  label={`转化菜品 ${row.name}`}
                  tip="菜品转化"
                  icon={<ArrowRightLeft className="h-4 w-4" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setScaleTarget(row);
                  }}
                />
                <SkeuIconAction
                  label={`复制菜品 ${row.name}`}
                  tip="复制菜品"
                  icon={<Copy className="h-4 w-4" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    openCopy(row);
                  }}
                />
                <SkeuIconAction
                  label={`编辑菜品 ${row.name}`}
                  tip="编辑"
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/dishes/${row.id}/edit`);
                  }}
                />
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
                    totalLabel: formatPageSummary(
                      page,
                      pageSize,
                      pagination.totalItems,
                      "菜品"
                    ),
                    showPageSize: true,
                    onPageSizeChange: (size) => {
                      setPageSize(size);
                      setPage(1);
                    },
                  }
                : undefined
            }
            emptyState={{ title: "暂无数据" }}
          />
        </CardContent>
      </Card>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open && dishIdParam) {
            router.replace("/dishes");
          }
        }}
      >
        {selectedDish && (
          <DishSheetDetail
            dish={fullDish ?? selectedDish}
            onDelete={handleDelete}
            onUnpublish={handleUnpublish}
            onPublish={handlePublish}
            onEdit={(id) => router.push(`/dishes/${id}/edit`)}
          />
        )}
      </Sheet>

      <Dialog open={copyTarget !== null} onOpenChange={() => setCopyTarget(null)}>
        <AppDialogContent size="form">
          <DialogHeader>
            <DialogTitle className="text-lg">复制菜品</DialogTitle>
          </DialogHeader>
          {copyTarget && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-base">
                将以「{copyTarget.name}」（{copyTarget.portion}）为模板生成新的草稿档案，用料与加工工艺完整复制。
              </p>
              <FormField id="copy-name" label="新菜品名称" required>
                <Input
                  id="copy-name"
                  value={copyName}
                  onChange={(e) => setCopyName(e.target.value)}
                  placeholder="请输入新菜品名称"
                  className="h-11 text-base px-4"
                />
              </FormField>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCopyTarget(null)}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button
              onClick={handleCopy}
              disabled={copying || !copyName.trim()}
              className="h-11 px-6"
            >
              {copying ? "复制中..." : "确认复制"}
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

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
              setSheetOpen(true);
              fetchDetail(newDish.id);
            }
          }}
        />
      )}
    </PageShell>
  );
}
