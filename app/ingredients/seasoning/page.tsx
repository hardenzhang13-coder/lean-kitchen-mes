"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, ArrowRightLeft, Eye } from "lucide-react";
import {
  SkeuIconAction,
} from "@/app/components/ui/skeu-row-action";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { DataTable } from "@/app/components/ui/data-table";
import { CodeText } from "@/app/components/ui/code-text";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { CategoryFilter } from "@/app/components/ui/category-filter";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { DeleteConfirmDialog } from "@/app/components/ui/delete-confirm-dialog";
import { IngredientFormDialog } from "@/app/components/ingredients/ingredient-form-dialog";
import { IngredientDetailSheet } from "@/app/components/ingredients/ingredient-detail-sheet";
import { StandardSeasoningFormDialog } from "@/app/components/ingredients/standard-seasoning-form-dialog";
import { StandardSeasoningListSheet } from "@/app/components/ingredients/standard-seasoning-list-sheet";
import { STANDARD_SEASONING_ENABLED } from "@/app/components/ingredients/standard-seasoning-flag";
import type { RawDetail } from "@/app/components/ingredients/ingredient-detail-sheet";
import type { IngredientFormInitialData } from "@/app/components/ingredients/use-ingredient-form";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import {
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
import { useRecordCopy } from "@/lib/client/use-record-copy";
import { toast } from "sonner";
import { formatMoney } from "@/lib/shared/display-format";

type Ingredient = {
  id: number;
  code: string;
  name: string;
  alias: string | null;
  l2Code: string;
  purchaseSpec: string | null;
  purchaseUnit: string | null;
  stockUnit: string | null;
  unitsPerPurchase: number | null;
  latestRefPrice: number | null;
  pricePerJin: number | null;
  defaultSupplierId: number | null;
};

type CategoryL1 = {
  id: number;
  code: string;
  name: string;
  children: { id: number; code: string; name: string; parentCode: string }[];
};

type Unit = {
  id: number;
  name: string;
  category: string;
  gramsPerUnit?: number | string | null;
  isActive?: boolean;
};

// 新建调料默认分类：SEA（调味品）下第一个二级分类（分类接口默认只返回启用中的）
function findDefaultSeasoningL2Code(categories: CategoryL1[]) {
  const sea = categories.find((l1) => l1.code === "SEA");
  return sea?.children[0]?.code;
}

export default function SeasoningIngredientsPage() {
  const [data, setData] = useState<Ingredient[]>([]);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [l2Filter, setL2Filter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEdit, setDetailEdit] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  // 「转调料」：从列表行操作发起，创建该调料的标准规格
  const [convertSourceId, setConvertSourceId] = useState<number | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  // 「查看已有封装调料」列表（转调料弹窗头部入口）
  const [packagedOpen, setPackagedOpen] = useState(false);

  const seasoningL2Code = useMemo(
    () => findDefaultSeasoningL2Code(categories),
    [categories]
  );

  const fetchMeta = async () => {
    try {
      const [catRes, unitRes] = await Promise.all([
        fetch("/api/ingredient-categories?page=1&pageSize=100"),
        fetch("/api/units?page=1&pageSize=100"),
      ]);
      const cats = await catRes.json();
      const categoryList = Array.isArray(cats) ? cats : cats.data || [];
      setCategories(categoryList);
      const unitsData = await unitRes.json();
      if (unitRes.ok) setUnits(Array.isArray(unitsData) ? unitsData : unitsData.data || []);
    } catch {
      toast.error("获取筛选数据失败");
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        kind: "seasoning",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("q", search.trim());
      if (l2Filter) params.set("l2Code", l2Filter);
      const ingRes = await fetch(`/api/ingredients?${params.toString()}`);
      const json = await ingRes.json();
      setData(json.data || []);
      setPagination(json.pagination || null);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [l2Filter, page, pageSize, search]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchMeta();
  }, []);
  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const openCreate = () => {
    setDialogOpen(true);
  };

  const openView = (row: Ingredient) => {
    setDetailId(row.id);
    setDetailEdit(false);
    setDetailOpen(true);
  };

  const openEdit = (row: Ingredient) => {
    setDetailId(row.id);
    setDetailEdit(true);
    setDetailOpen(true);
  };

  // 复制：以现有档案为模板新建一条，名称默认加「-副本」避免重名校验拦截
  const { openCopy, copyDialogProps } = useRecordCopy<
    Ingredient | RawDetail,
    IngredientFormInitialData
  >({
    buildInitialData: (row) => ({
      alias: row.alias,
      l2Code: row.l2Code,
      purchaseSpec: row.purchaseSpec,
      purchaseUnit: row.purchaseUnit,
      stockUnit: row.stockUnit,
      unitsPerPurchase: row.unitsPerPurchase ?? 1,
      latestRefPrice: row.latestRefPrice,
      pricePerJin: row.pricePerJin,
      defaultSupplierId: row.defaultSupplierId,
    }),
    title: "复制调料",
    onCopySuccess: () => {
      setDetailOpen(false);
      fetchData();
    },
  });

  // 「转调料」来源行：取来源调料的编号/名称/采购规格/每斤单价
  const convertSourceRow = useMemo(
    () => data.find((row) => row.id === convertSourceId) ?? null,
    [data, convertSourceId]
  );

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/ingredients/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "删除失败");
      }
      toast.success("删除成功");
      setDeleteId(null);
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const l2Map = useMemo(() => {
    const map: Record<string, { name: string; parentCode: string }> = {};
    categories.forEach((l1) => {
      l1.children.forEach((l2) => {
        map[l2.code] = { name: l2.name, parentCode: l1.code };
      });
    });
    return map;
  }, [categories]);

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          showBack
          title="调料清单"
          description="标准化产品形态的基础调味品"
          actions={
            <SkeuButton onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新增调料
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
            searchPlaceholder="搜索名称..."
            onReset={() => {
              setSearch("");
              setL2Filter("");
              setPage(1);
            }}
            hasFilters={!!l2Filter}
          >
            <CategoryFilter
              categories={categories}
              fixedL1="SEA"
              l1=""
              l2={l2Filter}
              onChange={(_l1, nextL2) => {
                setL2Filter(nextL2);
                setPage(1);
              }}
              className="w-[160px]"
            />
          </ListToolbar>
        </CardHeader>
        <CardContent className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
          <DataTable<Ingredient>
            data={data}
            loading={loading}
            fillHeight
            variant="skeu"
            actionsWidth="w-[120px]"
            tableClassName="min-w-max"
            onRowClick={openView}
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
                  className: "w-[72px]",
                  cell: (row) => <CodeText>{row.code}</CodeText>,
                },
                {
                  header: "食材名称",
                  className: "w-[132px]",
                  cell: (row) => (
                    <span className="font-semibold text-primary">
                      {row.name}
                    </span>
                  ),
                },
                {
                  header: "商品名称",
                  className: "w-[88px]",
                  cell: (row) => row.alias || <EmptyValue />,
                },
                {
                  header: "二级分类",
                  className: "w-[84px]",
                  cell: (row) => {
                    const l2Info = l2Map[row.l2Code];
                    return (
                      <CategoryTag l2Code={row.l2Code} name={l2Info?.name || row.l2Code} />
                    );
                  },
                },
                {
                  header: "采购规格",
                  className: "w-[100px]",
                  cell: (row) => row.purchaseSpec || <EmptyValue />,
                },
                {
                  header: "采购单位",
                  className: "w-[72px]",
                  cell: (row) => row.purchaseUnit || <EmptyValue />,
                },
                {
                  header: "最新参照单价",
                  className: "w-[88px]",
                  cell: (row) =>
                    row.latestRefPrice != null ? (
                      <span className="tabular-nums">
                        {formatMoney(row.latestRefPrice)}
                      </span>
                    ) : (
                      <EmptyValue />
                    ),
                },
                {
                  header: "入库单位",
                  className: "w-[72px]",
                  cell: (row) => row.stockUnit || <EmptyValue />,
                },
                {
                  header: "入库数量",
                  className: "w-[64px]",
                  cell: (row) => <span className="font-medium">{row.unitsPerPurchase ?? 1}</span>,
                },
                {
                  header: "每斤单价",
                  className: "w-[88px]",
                  cell: (row) =>
                    row.pricePerJin != null ? (
                      <span className="font-semibold tabular-nums text-primary">
                        {formatMoney(row.pricePerJin, "斤")}
                      </span>
                    ) : (
                      <EmptyValue />
                    ),
                },
            ]}
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
              emptyState={{ title: "暂无数据" }}
              rowActions={(row) => (
                <>
                  {STANDARD_SEASONING_ENABLED && (
                    <SkeuIconAction
                      label={`转调料 ${row.name}`}
                      tip="转调料"
                      icon={<ArrowRightLeft className="h-4 w-4" />}
                      onClick={(event) => {
                        event.stopPropagation();
                        setConvertSourceId(row.id);
                        setConvertDialogOpen(true);
                      }}
                    />
                  )}
                  <SkeuIconAction
                    label={`编辑调料 ${row.name}`}
                    tip="编辑调料"
                    icon={<Pencil className="h-4 w-4" />}
                    onClick={(event) => {
                      event.stopPropagation();
                      openEdit(row);
                    }}
                  />
                  <SkeuIconAction
                    label={`查看调料 ${row.name}`}
                    tip="查看"
                    icon={<Eye className="h-4 w-4" />}
                    onClick={(event) => {
                      event.stopPropagation();
                      openView(row);
                    }}
                  />
                </>
              )}
          />
        </CardContent>
      </Card>

      <IngredientFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={{ l2Code: seasoningL2Code }}
        categories={categories}
        units={units}
        mode="seasoning"
        onSuccess={() => {
          setDialogOpen(false);
          fetchData();
        }}
      />

      <IngredientFormDialog
        {...copyDialogProps}
        categories={categories}
        units={units}
        mode="seasoning"
      />

      <IngredientDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        kind="seasoning"
        ingredientId={detailId}
        categories={categories}
        units={units}
        inlineEdit
        startInEditMode={detailEdit}
        categoryName={
          detailId
            ? l2Map[data.find((row) => row.id === detailId)?.l2Code || ""]?.name
            : undefined
        }
        onUpdated={fetchData}
        onCopy={(record) => {
          openCopy(record as RawDetail);
        }}
        onConvert={
          STANDARD_SEASONING_ENABLED
            ? (id) => {
                setDetailOpen(false);
                setConvertSourceId(id);
                setConvertDialogOpen(true);
              }
            : undefined
        }
        onDelete={(id) => {
          setDetailOpen(false);
          setDeleteId(id);
        }}
      />

      {STANDARD_SEASONING_ENABLED && (
        <>
          <StandardSeasoningFormDialog
            open={convertDialogOpen}
            onOpenChange={setConvertDialogOpen}
            source={
              convertSourceRow
                ? {
                    id: convertSourceRow.id,
                    code: convertSourceRow.code,
                    name: convertSourceRow.name,
                    purchaseSpec: convertSourceRow.purchaseSpec ?? null,
                    pricePerJin:
                      convertSourceRow.pricePerJin != null
                        ? Number(convertSourceRow.pricePerJin)
                        : null,
                    l2Name: l2Map[convertSourceRow.l2Code]?.name ?? null,
                  }
                : { id: 0, code: "", name: "" }
            }
            onSuccess={() => {
              setConvertDialogOpen(false);
              setConvertSourceId(null);
              fetchData();
            }}
            onViewExisting={() => setPackagedOpen(true)}
          />

          <StandardSeasoningListSheet
            open={packagedOpen}
            onOpenChange={setPackagedOpen}
            sourceIngredientId={convertSourceId}
            sourceName={convertSourceRow?.name ?? null}
            sourceCode={convertSourceRow?.code ?? null}
            sourceL2Name={
              convertSourceRow ? l2Map[convertSourceRow.l2Code]?.name ?? null : null
            }
          />
        </>
      )}

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        message="确定要删除这条调料吗？此操作不可撤销。"
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </PageShell>
  );
}
