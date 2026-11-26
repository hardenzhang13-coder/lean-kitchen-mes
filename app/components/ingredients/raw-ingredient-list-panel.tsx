"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pencil,
  ArrowRightLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  SkeuActionButton,
} from "@/app/components/ui/skeu-row-action";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { CategoryFilter } from "@/app/components/ui/category-filter";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { DeleteConfirmDialog } from "@/app/components/ui/delete-confirm-dialog";
import { IngredientFormDialog } from "@/app/components/ingredients/ingredient-form-dialog";
import { NetIngredientFormDialog } from "@/app/components/ingredients/net-ingredient-form-dialog";
import { ImportField } from "@/app/components/ui/import-dialog";
import { IngredientDetailSheet } from "@/app/components/ingredients/ingredient-detail-sheet";
import type { RawDetail } from "@/app/components/ingredients/ingredient-detail-sheet";
import type { IngredientFormInitialData } from "@/app/components/ingredients/use-ingredient-form";
import { DataTable } from "@/app/components/ui/data-table";
import { CodeText } from "@/app/components/ui/code-text";
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
  latestRefPrice: number | null;
  pricePerJin: number | null;
  yieldRate: number | null;
  stockUnit: string | null;
  unitsPerPurchase: number | null;
  defaultSupplierId: number | null;
};

type CategoryL1 = {
  id?: number;
  code: string;
  name: string;
  children: { id?: number; code: string; name: string; parentCode: string }[];
};

interface RawIngredientListPanelProps {
  categories: CategoryL1[];
  units: Unit[];
  refreshToken: number;
}

type Unit = {
  id: number;
  name: string;
  category: string;
  gramsPerUnit?: number | string | null;
  isActive?: boolean;
};

export const RAW_IMPORT_FIELDS: ImportField[] = [
  { key: "name", label: "食材名称", required: true, sample: "带皮五花肉" },
  { key: "alias", label: "品牌名称", sample: "五花肉" },
  { key: "l2Code", label: "二级分类编码", required: true, sample: "MEA-POR" },
  { key: "purchaseSpec", label: "采购规格", sample: "散称" },
  { key: "purchaseUnit", label: "采购单位", required: true, sample: "斤" },
  { key: "stockUnit", label: "入库单位", required: true, sample: "斤" },
  { key: "unitsPerPurchase", label: "入库数量", sample: "10" },
  { key: "latestRefPrice", label: "最新参照单价", sample: "18.50" },
];

export function RawIngredientListPanel({
  categories,
  units,
  refreshToken,
}: RawIngredientListPanelProps) {
  const [data, setData] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [l1Filter, setL1Filter] = useState("");
  const [l2Filter, setL2Filter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [convertSourceId, setConvertSourceId] = useState<number | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  // 查看默认只读；列表「编辑」入口直接进入编辑态
  const [detailEdit, setDetailEdit] = useState(false);

  const fetchData = useCallback(async () => {
    // refreshToken 变化会重建回调，从而触发下方 debounce effect 重新拉取。
    void refreshToken;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        kind: "raw",
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("q", search.trim());
      if (l1Filter) params.set("l1Code", l1Filter);
      if (l2Filter) params.set("l2Code", l2Filter);
      const ingRes = await fetch(`/api/ingredients?${params.toString()}`);
      const ingData = await ingRes.json();
      setData(ingData.data || []);
      setPagination(ingData.pagination || null);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [l1Filter, l2Filter, page, pageSize, refreshToken, search]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const l2Map = useMemo(() => {
    const map: Record<
      string,
      { name: string; parentCode: string }
    > = {};
    categories.forEach((l1) => {
      l1.children.forEach((l2) => {
        map[l2.code] = { name: l2.name, parentCode: l1.code };
      });
    });
    return map;
  }, [categories]);

  const l1Map = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((l1) => {
      map[l1.code] = l1.name;
    });
    return map;
  }, [categories]);

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
      l2Code: row.l2Code ?? undefined,
      purchaseSpec: row.purchaseSpec,
      purchaseUnit: row.purchaseUnit,
      stockUnit: row.stockUnit,
      unitsPerPurchase: row.unitsPerPurchase ?? 1,
      latestRefPrice: row.latestRefPrice,
      pricePerJin: row.pricePerJin,
      yieldRate: row.yieldRate,
      defaultSupplierId: row.defaultSupplierId,
    }),
    title: "复制食材",
    onCopySuccess: () => {
      setDetailOpen(false);
      fetchData();
    },
  });

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
      const message = e instanceof Error ? e.message : "删除失败";
      toast.error(message);
    }
  };

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
              setL1Filter("");
              setL2Filter("");
              setPage(1);
            }}
            hasFilters={!!(l1Filter || l2Filter)}
          >
            <CategoryFilter
              categories={categories.filter(
                (c) => c.code !== "MIN" && c.code !== "SEA"
              )}
              l1={l1Filter}
              l2={l2Filter}
              onChange={(nextL1, nextL2) => {
                setL1Filter(nextL1);
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
            actionsWidth="w-[200px]"
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
                className: "w-[85px]",
                cell: (row) => <CodeText>{row.code}</CodeText>,
              },
              {
                header: "食材名称",
                className: "w-[160px]",
                cell: (row) => (
                  <span className="font-semibold text-primary">
                    {row.name}
                  </span>
                ),
              },
              {
                header: "品牌名称",
                className: "w-[100px]",
                cell: (row) =>
                  row.alias ? row.alias : <EmptyValue />,
              },
              {
                header: "一级分类",
                className: "w-[90px]",
                cell: (row) => {
                  const l2Info = l2Map[row.l2Code];
                  return l2Info ? (
                    l1Map[l2Info.parentCode] || <EmptyValue />
                  ) : (
                    <EmptyValue />
                  );
                },
              },
              {
                header: "二级分类",
                className: "w-[90px]",
                cell: (row) => {
                  const l2Info = l2Map[row.l2Code];
                  const l2Name = l2Info?.name || row.l2Code;
                  return <CategoryTag l2Code={row.l2Code} name={l2Name} />;
                },
              },
              {
                header: "采购规格",
                className: "w-[120px]",
                cell: (row) =>
                  row.purchaseSpec ? row.purchaseSpec : <EmptyValue />,
              },
              {
                header: "采购单位",
                className: "w-[80px]",
                cell: (row) =>
                  row.purchaseUnit ? row.purchaseUnit : <EmptyValue />,
              },
              {
                header: "最新参照单价",
                className: "w-[100px]",
                cell: (row) => (
                  row.latestRefPrice != null ? (
                    <span className="tabular-nums">
                      {formatMoney(row.latestRefPrice)}
                    </span>
                  ) : (
                    <EmptyValue />
                  )
                ),
              },
              {
                header: "每斤单价",
                className: "w-[100px]",
                cell: (row) =>
                  row.pricePerJin != null ? (
                    <span className="font-semibold tabular-nums text-primary">
                      ¥{Number(row.pricePerJin).toFixed(2)}/斤
                    </span>
                  ) : (
                    <EmptyValue title="未填写，可在编辑中按规格换算或手动填写" />
                  ),
              },
              {
                header: "出成率",
                className: "w-[80px]",
                cell: (row) =>
                  row.yieldRate != null ? (
                    <span className="tabular-nums">
                      {Number(row.yieldRate)}%
                    </span>
                  ) : (
                    <EmptyValue title="未设置，转化净料时手动填写" />
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
                <SkeuActionButton
                  label="编辑"
                  icon={<Pencil className="h-3.5 w-3.5" />}
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
        kind="raw"
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
        onConvert={(id) => {
          setDetailOpen(false);
          setConvertSourceId(id);
          setConvertDialogOpen(true);
        }}
        onDelete={(id) => {
          setDetailOpen(false);
          setDeleteId(id);
        }}
      />

      <IngredientFormDialog
        {...copyDialogProps}
        categories={categories}
        units={units}
        mode="ingredient"
      />

      <NetIngredientFormDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        mode="convert"
        allowTargetChoice
        sourceIngredientId={convertSourceId ?? undefined}
        sourceIngredientName={
          data.find((d) => d.id === convertSourceId)?.name ?? null
        }
        categories={categories}
        rawIngredients={data.map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
          alias: d.alias,
          l2Code: d.l2Code,
          purchaseSpec: d.purchaseSpec,
          purchaseUnit: d.purchaseUnit,
          latestRefPrice: d.latestRefPrice,
          // 转净料单价自动换算的数据源，缺失会导致弹窗无法自动计算
          pricePerJin: d.pricePerJin,
          // 出成率建档默认值：转化时预填
          yieldRate: d.yieldRate,
        }))}
        onSuccess={() => {
          setConvertDialogOpen(false);
          setConvertSourceId(null);
          fetchData();
        }}
      />

      <DeleteConfirmDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        message="确定要删除这条食材吗？此操作不可撤销。"
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
    </>
  );
}

