"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Pencil, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/app/components/page-header";
import { DataTable } from "@/app/components/data-table";
import { SkeletonTable } from "@/app/components/skeleton-table";
import { StatusBadge } from "@/app/components/status-badge";
import { CategoryTag } from "@/app/components/category-tag";
import { SelectTileMode } from "@/app/components/select-tile-mode";
import { usePagination, DEFAULT_PAGE_SIZE } from "@/app/lib/use-pagination";
import { DishSheetDetail } from "@/app/components/dish-sheet-detail";
import { DishDetail } from "@/app/components/dish-form/types";
import { toast } from "sonner";

const techniqueOptions = [
  { value: "爆炒", label: "爆炒" },
  { value: "红烧", label: "红烧" },
  { value: "清蒸", label: "清蒸" },
  { value: "炖煮", label: "炖煮" },
  { value: "煎炸", label: "煎炸" },
  { value: "凉拌", label: "凉拌" },
  { value: "干锅", label: "干锅" },
  { value: "烧烤", label: "烧烤" },
  { value: "卤制", label: "卤制" },
  { value: "煲汤", label: "煲汤" },
  { value: "烩", label: "烩" },
  { value: "熘", label: "熘" },
  { value: "扒", label: "扒" },
  { value: "焗", label: "焗" },
];

const statusOptions = [
  { value: "draft", label: "草稿" },
  { value: "published", label: "已发布" },
];

const formatDateTime = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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
  const [dishes, setDishes] = useState<DishDetail[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTechnique, setFilterTechnique] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [selectedDish, setSelectedDish] = useState<DishDetail | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterCategory) params.set("categoryId", filterCategory);
        if (filterTechnique) params.set("technique", filterTechnique);
        if (filterStatus) params.set("status", filterStatus);

        const [dRes, cRes] = await Promise.all([
          fetch(`/api/dishes?${params.toString()}`),
          fetch("/api/dish-categories"),
        ]);
        const dJson = await dRes.json();
        const cJson = await cRes.json();
        if (cancelled) return;
        setDishes(dJson.data || []);
        setCategories(Array.isArray(cJson) ? cJson : cJson.data || []);
      } catch {
        if (!cancelled) toast.error("获取数据失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filterCategory, filterTechnique, filterStatus, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const filtered = useMemo(() => {
    if (!search.trim()) return dishes;
    const s = search.trim().toLowerCase();
    return dishes.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        d.code.toLowerCase().includes(s) ||
        (d.intro && d.intro.toLowerCase().includes(s))
    );
  }, [dishes, search]);

  const { currentPage, setCurrentPage, pageItems, totalPages, totalItems } =
    usePagination(filtered, DEFAULT_PAGE_SIZE);

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
  };

  const openSheet = (dish: DishDetail) => {
    setSelectedDish(dish);
    setSheetOpen(true);
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
      setDeleteId(null);
      setSheetOpen(false);
      refresh();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleUnpublish = async (id: number) => {
    try {
      const res = await fetch(`/api/dishes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "下架失败");
        return;
      }
      toast.success("已下架");
      setSheetOpen(false);
      refresh();
    } catch {
      toast.error("下架失败");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader title="菜品库" description="管理所有菜品及其 BOM 与工艺" />
        <Button onClick={() => router.push("/dishes/new")}>
          <Plus className="mr-2 h-4 w-4" />
          新增菜品
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="搜索菜品名称或编号..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full"
              />
            </div>
            <SelectTileMode
              options={categoryOptions}
              value={filterCategory}
              onChange={(v) => {
                setFilterCategory(v);
                setCurrentPage(1);
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
                setCurrentPage(1);
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
                setCurrentPage(1);
              }}
              placeholder="全部状态"
              title="选择状态"
              className="w-[180px]"
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                清除筛选
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <SkeletonTable cols={10} rows={10} />
          ) : (
            <DataTable<DishDetail>
              data={pageItems}
              onRowClick={openSheet}
              columns={[
                {
                  header: "序号",
                  cell: (_, rowIdx) => (
                    <span className="text-muted-foreground">
                      {(currentPage - 1) * DEFAULT_PAGE_SIZE + rowIdx + 1}
                    </span>
                  ),
                },
                {
                  header: "编号",
                  cell: (row) => <span className="font-medium">{row.code}</span>,
                },
                {
                  header: "菜品名称",
                  cell: (row) => <span className="font-medium">{row.name}</span>,
                },
                {
                  header: "类别",
                  cell: (row) => (
                    <CategoryTag l1Code={row.category?.code} name={row.category?.name} />
                  ),
                },
                {
                  header: "菜品描述",
                  cell: (row) => (
                    <span className="text-muted-foreground line-clamp-1">
                      {row.intro || "—"}
                    </span>
                  ),
                },
                {
                  header: "荤素",
                  cell: (row) => <MeatTypeBadge type={row.meatType} />,
                },
                {
                  header: "成本价",
                  className: "text-right",
                  cell: (row) => (
                    <span className="font-medium">
                      {row.cost != null ? `¥${Number(row.cost).toFixed(2)}` : "—"}
                    </span>
                  ),
                },
                {
                  header: "状态",
                  cell: (row) => (
                    <StatusBadge status={row.status === "published" ? "已发布" : "草稿"} />
                  ),
                },
                {
                  header: "创建时间",
                  cell: (row) => (
                    <span className="text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </span>
                  ),
                },
              ]}
              rowActions={(row) => (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="查看"
                    onClick={(e) => {
                      e.stopPropagation();
                      openSheet(row);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="编辑"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/dishes/${row.id}/edit`);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {row.status === "draft" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="删除"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(row.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </>
              )}
              pagination={
                totalItems > 0
                  ? {
                      currentPage,
                      totalPages,
                      totalItems,
                      pageSize: DEFAULT_PAGE_SIZE,
                      onPageChange: setCurrentPage,
                    }
                  : undefined
              }
              emptyState={{ title: "暂无数据" }}
            />
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        {selectedDish && (
          <DishSheetDetail
            dish={selectedDish}
            onDelete={handleDelete}
            onUnpublish={handleUnpublish}
            onEdit={(id) => router.push(`/dishes/${id}/edit`)}
          />
        )}
      </Sheet>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除这条菜品吗？此操作不可撤销。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="h-11 px-6">
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
              className="h-11 px-6"
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
