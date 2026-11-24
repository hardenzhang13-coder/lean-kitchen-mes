"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, ArrowRightLeft, Eye } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  SkeuActionButton,
  SkeuIconAction,
} from "@/app/components/ui/skeu-row-action";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { SeasoningTypeTag } from "@/app/components/ui/seasoning-type-tag";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { IngredientDetailSheet } from "@/app/components/ingredients/ingredient-detail-sheet";
import { IngredientFormDialog } from "@/app/components/ingredients/ingredient-form-dialog";
import { StandardSeasoningFormDialog } from "@/app/components/ingredients/standard-seasoning-form-dialog";
import { StandardSeasoningListSheet } from "@/app/components/ingredients/standard-seasoning-list-sheet";
import type { RawDetail } from "@/app/components/ingredients/ingredient-detail-sheet";
import { DataTable } from "@/app/components/ui/data-table";
import { CodeText } from "@/app/components/ui/code-text";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
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
  l2Code: string;
  /** 调味品类型：单品调料/复合调料/成品酱料；空 = 基础调味品 */
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
  /** 类型过滤：空 = 全部调味品；否则只显示该调味品类型（单品调料/复合调料/成品酱料） */
  fixedSeasoningType?: string;
  refreshToken: number;
}

export function SeasoningListPanel({
  categories,
  units,
  fixedSeasoningType = "",
  refreshToken,
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
  // 「转化」：创建该调味品的调料清单档案（standard_seasonings）
  const [convertSourceId, setConvertSourceId] = useState<number | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  // 「查看已有调料清单」抽屉（转化弹窗头部入口）
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
      if (fixedSeasoningType) params.set("seasoningType", fixedSeasoningType);
      const ingRes = await fetch(`/api/ingredients?${params.toString()}`);
      const json = await ingRes.json();
      setData(json.data || []);
      setPagination(json.pagination || null);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [fixedSeasoningType, page, pageSize, search]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData, refreshToken]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPage(1);
  }, [fixedSeasoningType, search]);
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
      l2Code: row.l2Code,
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

  // 「转化」来源行：取来源调味品的编号/名称/采购规格/每斤单价
  const convertSourceRow = useMemo(
    () => data.find((row) => row.id === convertSourceId) ?? null,
    [data, convertSourceId]
  );

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
                className: "w-[132px]",
                cell: (row) => (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-semibold text-primary">{row.name}</span>
                    <SeasoningTypeTag type={row.seasoningType} />
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
                    setConvertSourceId(row.id);
                    setConvertDialogOpen(true);
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
        categoryName={
          detailId
            ? l2Map[data.find((row) => row.id === detailId)?.l2Code || ""]?.name
            : undefined
        }
        onUpdated={fetchData}
        onCopy={(record) => {
          openCopy(record as RawDetail);
        }}
        onConvert={(id) => {
          setDetailOpen(false);
          setConvertSourceId(id);
          setConvertDialogOpen(true);
        }}
      />

      <IngredientFormDialog
        {...copyDialogProps}
        categories={categories}
        units={units}
        mode="seasoning"
      />

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
  );
}
