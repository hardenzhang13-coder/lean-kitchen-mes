"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { DataTable } from "@/app/components/ui/data-table";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { SeasoningTypeTag } from "@/app/components/ui/seasoning-type-tag";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import {
  SeasoningProductFormDialog,
  type SeasoningProductFormItem,
} from "@/app/components/ingredients/seasoning-product-form-dialog";
import type { SeasoningProductListRow } from "@/app/components/ingredients/seasoning-product-list-sheet";
import type { SeasoningProductSource } from "@/app/components/ingredients/seasoning-product-form-fields";
import {
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
import type { SeasoningProductType } from "@/lib/shared/seasoning-product";
import { toast } from "sonner";

export interface SeasoningProductListPanelProps {
  /** 产物类型过滤：单品调料/复合调料/成品酱料（Tab 固定） */
  productType: SeasoningProductType;
  refreshToken: number;
}

/**
 * 调料产物列表面板：按产物类型（单品/复合/成品）展示 SeasoningProduct，
 * 数据源 /api/seasoning-products?productType=。产物只能由调味品「转化」生成，
 * 本面板不提供新增入口，仅支持编辑、删除。
 */
export function SeasoningProductListPanel({
  productType,
  refreshToken,
}: SeasoningProductListPanelProps) {
  const [data, setData] = useState<SeasoningProductListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);
  const [editing, setEditing] = useState<SeasoningProductFormItem | undefined>(
    undefined
  );
  const [editSource, setEditSource] = useState<SeasoningProductSource | null>(
    null
  );
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<SeasoningProductListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        productType,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/seasoning-products?${params.toString()}`);
      const json: unknown = await res.json();
      if (!res.ok) {
        setData([]);
        setPagination(null);
        return;
      }
      const list =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data?: SeasoningProductListRow[] }).data
          : [];
      setData(Array.isArray(list) ? list : []);
      setPagination(
        typeof json === "object" &&
          json !== null &&
          "pagination" in json &&
          typeof (json as { pagination?: unknown }).pagination === "object" &&
          (json as { pagination?: unknown }).pagination !== null
          ? (json as {
              pagination: { totalItems: number; totalPages: number };
            }).pagination
          : null
      );
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, [productType, page, pageSize, search]);

  useEffect(() => {
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
  }, [fetchData, refreshToken]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPage(1);
  }, [productType, search]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const openEdit = (row: SeasoningProductListRow) => {
    if (!row.sourceIngredient) {
      toast.error("该产物缺少来源调味品档案，无法编辑");
      return;
    }
    setEditing({
      id: row.id,
      code: row.code,
      name: row.name,
      productType: row.productType,
      packageSpec: row.packageSpec,
      yieldRate: row.yieldRate,
      processingFeePerJin: row.processingFeePerJin,
      grossMarginRate: row.grossMarginRate,
    });
    setEditSource({
      id: row.sourceIngredient.id,
      code: row.sourceIngredient.code,
      name: row.sourceIngredient.name,
      purchaseSpec: row.sourceIngredient.purchaseSpec,
      pricePerJin:
        row.sourceIngredient.pricePerJin != null
          ? Number(row.sourceIngredient.pricePerJin)
          : null,
      seasoningType: row.sourceIngredient.seasoningType,
    });
    setFormOpen(true);
  };

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/seasoning-products/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const message =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error?: unknown }).error ?? "删除失败")
            : "删除失败";
        toast.error(message);
        return;
      }
      toast.success("产物已删除");
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error("删除出错");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchData]);

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
            hasFilters={search.trim() !== ""}
          />
        </CardHeader>
        <CardContent className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
          <DataTable<SeasoningProductListRow>
            data={data}
            loading={loading}
            fillHeight
            variant="skeu"
            actionsWidth="w-[100px]"
            tableClassName="min-w-max"
            onRowClick={openEdit}
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
                className: "w-[88px]",
                cell: (row) => <span className="font-mono text-xs">{row.code}</span>,
              },
              {
                header: "产物名称",
                className: "w-[160px]",
                cell: (row) => (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="font-semibold text-primary">{row.name}</span>
                    <SeasoningTypeTag type={row.productType} />
                  </span>
                ),
              },
              {
                header: "来源",
                className: "w-[150px]",
                cell: (row) =>
                  row.sourceIngredient ? (
                    <span className="text-muted-foreground">
                      转化 · {row.sourceIngredient.name}
                    </span>
                  ) : (
                    <EmptyValue />
                  ),
              },
              {
                header: "包装规格",
                className: "w-[84px] tabular-nums",
                cell: (row) =>
                  row.packageSpec != null ? `${row.packageSpec}g` : <EmptyValue />,
              },
              {
                header: "出库价",
                className: "w-[96px] tabular-nums text-right",
                cell: (row) =>
                  row.outPricePerJin != null ? (
                    <span className="font-semibold tabular-nums text-primary">
                      ¥{Number(row.outPricePerJin).toFixed(2)}/斤
                    </span>
                  ) : (
                    <EmptyValue />
                  ),
              },
              {
                header: "标准规格价",
                className: "w-[104px] tabular-nums text-right",
                cell: (row) =>
                  row.standardPackagePrice != null
                    ? `¥${Number(row.standardPackagePrice).toFixed(2)}/份`
                    : <EmptyValue />,
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
            emptyState={{
              title: "暂无产物",
              description: "在「调味品」页签的原料行点「转化」生成产物档案",
            }}
            rowActions={(row) => (
              <>
                <SkeuButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(row);
                  }}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  编辑
                </SkeuButton>
                <SkeuButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(row);
                  }}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  删除
                </SkeuButton>
              </>
            )}
          />
        </CardContent>
      </Card>

      {editSource != null && (
        <SeasoningProductFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          source={editSource}
          initialData={editing}
          onSuccess={() => fetchData()}
        />
      )}

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除产物「{deleteTarget?.name}」吗？删除后不可恢复。
          </p>
          <DialogFooter>
            <SkeuButton
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </SkeuButton>
            <SkeuButton
              variant="danger"
              onClick={() => {
                void handleDelete();
              }}
              disabled={deleting}
            >
              <span aria-live="polite" className="inline-flex items-center">
                {deleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                删除
              </span>
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </>
  );
}
