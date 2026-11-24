"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Printer, Eye } from "lucide-react";
import { SkeuIconAction } from "@/app/components/ui/skeu-row-action";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/app/components/ui/data-table";
import { CodeText } from "@/app/components/ui/code-text";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { CategoryFilter } from "@/app/components/ui/category-filter";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { DeleteConfirmDialog } from "@/app/components/ui/delete-confirm-dialog";
import {
  NetIngredientFormDialog,
} from "@/app/components/ingredients/net-ingredient-form-dialog";
import type { NetIngredientFormItem } from "@/app/components/ingredients/net-ingredient-form-dialog";
import { IngredientDetailSheet } from "@/app/components/ingredients/ingredient-detail-sheet";
import type { NetDetail } from "@/app/components/ingredients/ingredient-detail-sheet";
import {
  NetLabelPrintDialog,
  NetLabelTarget,
} from "@/app/components/ingredients/net-label-print-dialog";
import {
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
import { useRecordCopy } from "@/lib/client/use-record-copy";
import { toast } from "sonner";
import { formatMoney, formatPercent } from "@/lib/shared/display-format";

type NetIngredient = {
  id: number;
  code: string;
  name: string;
  sourceIngredientId: number | null;
  spec: string | null;
  packageSpec: number | null;
  packageMaterial: string | null;
  packageSize: string | null;
  processingFeePerJin: number | null;
  yieldRate: number | null;
  unitPrice: number | null;
  grossMarginRate: number | null;
  /** 份量（小碗菜 / 社区口径） */
  portion?: string | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
  unit: string;
  l2Code: string;
  sourceIngredient?: { id: number; name: string } | null;
};

type CategoryL1 = {
  code: string;
  name: string;
  children: { code: string; name: string }[];
};

type RawIngredientOption = {
  id: number;
  code: string;
  name: string;
  alias?: string | null;
  l2Code?: string;
  purchaseSpec?: string | null;
  purchaseUnit?: string | null;
  latestRefPrice?: number | null;
  pricePerJin?: number | null;
};

interface NetIngredientListPanelProps {
  variant: "net" | "minor";
  categories: CategoryL1[];
  rawIngredients: RawIngredientOption[];
  refreshToken: number;
}

export function NetIngredientListPanel({
  variant,
  categories,
  rawIngredients,
  refreshToken,
}: NetIngredientListPanelProps) {
  const isMinor = variant === "minor";
  const entityLabel = isMinor ? "小料" : "净料";
  const [data, setData] = useState<NetIngredient[]>([]);
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

  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEdit, setDetailEdit] = useState(false);
  const [labelTarget, setLabelTarget] = useState<NetLabelTarget | null>(null);

  const [deleteRow, setDeleteRow] = useState<NetIngredient | null>(null);

  const fetchIngredients = useCallback(async () => {
    // refreshToken 变化会重建回调，从而触发下方 debounce effect 重新拉取。
    void refreshToken;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (isMinor) {
        params.set("l1Code", "MIN");
      } else {
        params.set("excludeMinor", "true");
      }
      if (search.trim()) params.set("q", search.trim());
      if (l1Filter) params.set("l1Code", l1Filter);
      if (l2Filter) params.set("l2Code", l2Filter);
      const netRes = await fetch(`/api/net-ingredients?${params.toString()}`);
      const netJson = await netRes.json();
      setData(netJson.data || []);
      setPagination(netJson.pagination || null);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [isMinor, l1Filter, l2Filter, page, pageSize, refreshToken, search]);

  useEffect(() => {
    const timer = setTimeout(fetchIngredients, 300);
    return () => clearTimeout(timer);
  }, [fetchIngredients]);

  const l2Map = useMemo(() => {
    const map: Record<string, { name: string; parentCode: string }> = {};
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

  const openView = (row: NetIngredient) => {
    setDetailId(row.id);
    setDetailEdit(false);
    setDetailOpen(true);
  };

  const openEdit = (row: NetIngredient) => {
    setDetailId(row.id);
    setDetailEdit(true);
    setDetailOpen(true);
  };

  // 复制：以现有档案为模板新建一条，名称默认加「-副本」避免重名
  const { openCopy, copyDialogProps } = useRecordCopy<
    NetIngredient | NetDetail,
    NetIngredientFormItem
  >({
    buildInitialData: (row) => ({
      sourceIngredientId: row.sourceIngredientId,
      packageSpec: row.packageSpec,
      packageMaterial: row.packageMaterial,
      packageSize: row.packageSize,
      processingFeePerJin: row.processingFeePerJin,
      yieldRate: row.yieldRate,
      grossMarginRate: row.grossMarginRate,
      portion: row.portion ?? null,
      l2Code: row.l2Code,
    }),
    title: `复制${entityLabel}`,
    onCopySuccess: () => {
      setDetailOpen(false);
      fetchIngredients();
    },
  });

  const handleDelete = async () => {
    if (!deleteRow) return;
    try {
      const res = await fetch(`/api/net-ingredients/${deleteRow.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "删除失败");
      }
      toast.success("删除成功");
      setDeleteRow(null);
      fetchIngredients();
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
              categories={
                isMinor
                  ? categories
                  : categories.filter(
                      (category) =>
                        category.code !== "MIN" && category.code !== "SEA"
                    )
              }
              fixedL1={isMinor ? "MIN" : undefined}
              l1={isMinor ? "" : l1Filter}
              l2={l2Filter}
              onChange={(nextL1, nextL2) => {
                setL1Filter(isMinor ? "" : nextL1);
                setL2Filter(nextL2);
                setPage(1);
              }}
              className="w-[160px]"
            />
          </ListToolbar>
        </CardHeader>
        <CardContent className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
          <DataTable<NetIngredient>
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
                header: "名称",
                className: "w-[180px]",
                cell: (row) => (
                  <span className="font-semibold text-primary">
                    {row.name}
                  </span>
                ),
              },
              ...(isMinor ? [] : [{
                header: "一级分类",
                className: "w-[90px]",
                cell: (row: NetIngredient) => {
                  const l2Info = l2Map[row.l2Code];
                  return l2Info ? (
                    l1Map[l2Info.parentCode] || <EmptyValue />
                  ) : (
                    <EmptyValue />
                  );
                },
              }]),
              {
                header: "二级分类",
                className: "w-[90px]",
                cell: (row) => {
                  const l2Info = l2Map[row.l2Code];
                  return (
                    <CategoryTag
                      l2Code={row.l2Code}
                      name={l2Info?.name || row.l2Code}
                    />
                  );
                },
              },
              {
                header: "来源原料",
                className: "w-[130px]",
                cell: (row) =>
                  row.sourceIngredient?.name || <EmptyValue />,
              },
              {
                header: "出成率",
                className: "w-[80px]",
                cell: (row) =>
                  row.yieldRate != null ? (
                    <span className="tabular-nums">{row.yieldRate}%</span>
                  ) : (
                    <EmptyValue />
                  ),
              },
              {
                header: `${entityLabel}单价`,
                className: "w-[125px]",
                cell: (row) => (
                  <span className="tabular-nums">
                    {formatMoney(row.unitPrice, "斤")}
                  </span>
                ),
              },
              {
                header: "毛利率",
                className: "w-[80px]",
                cell: (row) =>
                  <span className="tabular-nums">
                    {formatPercent(row.grossMarginRate)}
                  </span>
              },
              {
                header: "标准规格价",
                className: "w-[115px]",
                cell: (row) =>
                  row.standardPackagePrice != null ? (
                    <span className="font-semibold tabular-nums text-primary">
                      {formatMoney(row.standardPackagePrice, "份")}
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
                  label={`打印${entityLabel}标签 ${row.name}`}
                  tip={
                    row.packageSpec != null && row.packageSpec > 0
                      ? "打印标签"
                      : "缺少包装规格，无法打印标签"
                  }
                  icon={<Printer className="h-4 w-4" />}
                  disabled={row.packageSpec == null || row.packageSpec <= 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    setLabelTarget({
                      id: row.id,
                      name: row.name,
                      packageSpec: row.packageSpec,
                    });
                  }}
                />
                <SkeuIconAction
                  label={`编辑${entityLabel} ${row.name}`}
                  tip={`编辑${entityLabel}`}
                  icon={<Pencil className="h-4 w-4" />}
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(row);
                  }}
                />
                <SkeuIconAction
                  label={`查看${entityLabel} ${row.name}`}
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

      <NetIngredientFormDialog
        {...copyDialogProps}
        mode={isMinor ? "minor" : "net"}
        categories={categories}
        rawIngredients={rawIngredients}
      />

      <IngredientDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        kind={isMinor ? "minor" : "net"}
        ingredientId={detailId}
        categories={categories}
        rawIngredients={rawIngredients}
        inlineEdit
        startInEditMode={detailEdit}
        onUpdated={fetchIngredients}
        onPrintLabel={(id) => {
          const row = data.find((item) => item.id === id);
          if (!row) return;
          setDetailOpen(false);
          setLabelTarget({
            id: row.id,
            name: row.name,
            packageSpec: row.packageSpec,
          });
        }}
        onCopy={(record) => {
          openCopy(record as NetDetail);
        }}
        categoryName={
          detailId
            ? l2Map[data.find((row) => row.id === detailId)?.l2Code || ""]?.name
            : undefined
        }
        onDelete={(id) => {
          const row = data.find((item) => item.id === id);
          if (!row) return;
          setDetailOpen(false);
          setDeleteRow(row);
        }}
      />

      <NetLabelPrintDialog
        target={labelTarget}
        onOpenChange={(open) => {
          if (!open) setLabelTarget(null);
        }}
      />

      <DeleteConfirmDialog
        open={deleteRow !== null}
        onOpenChange={() => setDeleteRow(null)}
        message={`确定要删除${entityLabel}「${deleteRow?.name}」吗？此操作不可撤销。`}
        onConfirm={handleDelete}
      />
    </>
  );
}


