"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, ArrowRightLeft, Eye } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  SkeuActionButton,
  SkeuIconAction,
} from "@/app/components/ui/skeu-row-action";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { IngredientDetailSheet } from "@/app/components/ingredients/ingredient-detail-sheet";
import { IngredientFormDialog } from "@/app/components/ingredients/ingredient-form-dialog";
import { SeasoningProductFormDialog } from "@/app/components/ingredients/seasoning-product-form-dialog";
import { SeasoningProductListSheet } from "@/app/components/ingredients/seasoning-product-list-sheet";
import type { RawDetail } from "@/app/components/ingredients/ingredient-detail-sheet";
import { DataTable } from "@/app/components/ui/data-table";
import { CodeText } from "@/app/components/ui/code-text";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { SeasoningTypeTag } from "@/app/components/ui/seasoning-type-tag";
import {
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
import { useRecordCopy } from "@/lib/client/use-record-copy";
import type { IngredientFormInitialData } from "@/app/components/ingredients/use-ingredient-form";
import { toast } from "sonner";
import { formatMoney } from "@/lib/shared/display-format";

type Ingredient = {
  id: number;
  code: string;
  name: string;
  alias: string | null;
  seasoningType: string | null;
  purchaseSpec: string | null;
  purchaseUnit: string | null;
  stockUnit: string | null;
  unitsPerPurchase: number | null;
  latestRefPrice: number | null;
  pricePerJin: number | null;
  defaultSupplierId: number | null;
};

type CategoryL1 = {
  id?: number;
  code: string;
  name: string;
  children: { id?: number; code: string; name: string; parentCode: string }[];
};

type Unit = {
  id: number;
  name: string;
  category: string;
  gramsPerUnit?: number | string | null;
  isActive?: boolean;
};

export interface SeasoningListPanelProps {
  categories: CategoryL1[];
  units: Unit[];
  refreshToken: number;
  /** 转化出调料产物后回调（产物落在其他页签，由页面层刷新对应列表） */
  onTransformed?: () => void;
}

/**
 * 调味品原料层列表（「调味品」页签）：扁平清单，不挂食材分类体系。
 * 行操作：查看 / 编辑 / 转化（生成调料产物档案）。
 */
export function SeasoningListPanel({
  categories,
  units,
  refreshToken,
  onTransformed,
}: SeasoningListPanelProps) {
  const [data, setData] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEdit, setDetailEdit] = useState(false);
  // 「转化」：以该调味品为原料创建调料产物（SeasoningProduct）
  const [convertSourceId, setConvertSourceId] = useState<number | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  // 「查看已有产物」抽屉（转化弹窗头部入口）
  const [packagedOpen, setPackagedOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        kind: "seasoning",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("q", search.trim());
      const ingRes = await fetch(`/api/ingredients?${params.toString()}`);
      const json = await ingRes.json();
      setData(json.data || []);
      setPagination(json.pagination || null);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData, refreshToken]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPage(1);
  }, [search]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      seasoningType: row.seasoningType,
      purchaseSpec: row.purchaseSpec,
      purchaseUnit: row.purchaseUnit,
      stockUnit: row.stockUnit,
      unitsPerPurchase: row.unitsPerPurchase ?? 1,
      latestRefPrice: row.latestRefPrice,
      pricePerJin: row.pricePerJin,
      defaultSupplierId: row.defaultSupplierId,
    }),
    title: "复制调味品",
    onCopySuccess: () => {
      setDetailOpen(false);
      fetchData();
    },
  });

  // 「转化」来源行：取来源调味品的编号/名称/类型/采购规格/每斤单价
  const convertSourceRow = useMemo(
    () => data.find((row) => row.id === convertSourceId) ?? null,
    [data, convertSourceId]
  );

  // 转化按类型归档：未设置类型的调味品先回档案补类型
  const openConvert = useCallback(
    (id: number) => {
      const row = data.find((item) => item.id === id);
      if (!row?.seasoningType) {
        toast.error("请先在调味品档案中选择调料分类");
        return;
      }
      setConvertSourceId(id);
      setConvertDialogOpen(true);
    },
    [data]
  );

  return (
    <>
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
              setPage(1);
            }}
            hasFilters={false}
          />
        </CardHeader>
        <CardContent className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
          <DataTable<Ingredient>
            data={data}
            loading={loading}
            fillHeight
            variant="skeu"
            actionsWidth="w-[150px]"
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
                header: "调味品名称",
                className: "w-[150px]",
                cell: (row) => (
                  <span className="font-semibold text-primary">{row.name}</span>
                ),
              },
              {
                header: "商品名称",
                className: "w-[110px]",
                cell: (row) => row.alias || <EmptyValue />,
              },
              {
                header: "调料分类",
                className: "w-[96px]",
                cell: (row) =>
                  row.seasoningType ? (
                    <SeasoningTypeTag type={row.seasoningType} />
                  ) : (
                    <EmptyValue />
                  ),
              },
              {
                header: "采购规格",
                className: "w-[120px]",
                cell: (row) => row.purchaseSpec || <EmptyValue />,
              },
              {
                header: "采购单位",
                className: "w-[80px]",
                cell: (row) => row.purchaseUnit || <EmptyValue />,
              },
              {
                header: "最新参照单价",
                className: "w-[100px]",
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
                className: "w-[80px]",
                cell: (row) => row.stockUnit || <EmptyValue />,
              },
              {
                header: "入库数量",
                className: "w-[72px]",
                cell: (row) => <span className="font-medium">{row.unitsPerPurchase ?? 1}</span>,
              },
              {
                header: "每斤单价",
                className: "w-[96px]",
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
                <SkeuIconAction
                  label={`查看调味品 ${row.name}`}
                  tip="查看"
                  icon={<Eye className="h-4 w-4" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    openView(row);
                  }}
                />
                <SkeuIconAction
                  label={`编辑调味品 ${row.name}`}
                  tip="编辑"
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(row);
                  }}
                />
                <SkeuActionButton
                  label="转化"
                  tone="primary"
                  icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    openConvert(row.id);
                  }}
                />
              </>
            )}
          />
        </CardContent>
      </Card>

      <IngredientDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        kind="seasoning"
        ingredientId={detailId}
        categories={categories}
        inlineEdit
        startInEditMode={detailEdit}
        onUpdated={fetchData}
        onCopy={(record) => {
          openCopy(record as RawDetail);
        }}
        onConvert={(id) => {
          setDetailOpen(false);
          openConvert(id);
        }}
      />

      <IngredientFormDialog
        {...copyDialogProps}
        categories={categories}
        units={units}
        mode="seasoning"
      />

      {convertSourceRow != null && (
        <SeasoningProductFormDialog
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          source={{
            id: convertSourceRow.id,
            code: convertSourceRow.code,
            name: convertSourceRow.name,
            purchaseSpec: convertSourceRow.purchaseSpec ?? null,
            pricePerJin:
              convertSourceRow.pricePerJin != null
                ? Number(convertSourceRow.pricePerJin)
                : null,
            seasoningType: convertSourceRow.seasoningType,
          }}
          onSuccess={() => {
            setConvertDialogOpen(false);
            setConvertSourceId(null);
            fetchData();
            onTransformed?.();
          }}
          onViewExisting={() => setPackagedOpen(true)}
        />
      )}

      <SeasoningProductListSheet
        open={packagedOpen}
        onOpenChange={setPackagedOpen}
        sourceIngredientId={convertSourceId}
        sourceName={convertSourceRow?.name ?? null}
        sourceCode={convertSourceRow?.code ?? null}
      />
    </>
  );
}
