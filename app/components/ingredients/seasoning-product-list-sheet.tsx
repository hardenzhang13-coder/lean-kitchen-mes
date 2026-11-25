"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { DataTable } from "@/app/components/ui/data-table";
import { RecordSheet } from "@/app/components/ui/record-sheet";
import {
  SeasoningProductFormDialog,
  SeasoningProductFormItem,
} from "@/app/components/ingredients/seasoning-product-form-dialog";
import { toast } from "sonner";

export type SeasoningProductListRow = {
  id: number;
  code: string;
  name: string;
  productType: string | null;
  packageSpec: number | null;
  yieldRate: number | null;
  unitPrice: number | null;
  processingFeePerJin: number | null;
  grossMarginRate: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
  sourceIngredient: {
    id: number;
    code: string;
    name: string;
    purchaseSpec: string | null;
    pricePerJin: number | null;
    seasoningType: string | null;
  } | null;
};

const PAGE_SIZE = 20;

interface SeasoningProductListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 来源调味品 ID（转化场景按来源过滤；产物页全量场景不传） */
  sourceIngredientId?: number | null;
  /** 来源调味品名称 */
  sourceName?: string | null;
  /** 来源调味品编号 */
  sourceCode?: string | null;
  /** 规格新增 / 更新 / 删除后回调 */
  onChanged?: () => void;
}

/**
 * 调料产物列表：某个来源调味品转化出的全部产物（RecordSheet 半屏抽屉）。
 * 转化弹窗头部「查看已有产物」入口打开；产物页全量列表用 SeasoningProductListPanel。
 */
export function SeasoningProductListSheet({
  open,
  onOpenChange,
  sourceIngredientId,
  sourceName,
  sourceCode,
  onChanged,
}: SeasoningProductListSheetProps) {
  const [rows, setRows] = useState<SeasoningProductListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);
  const [editing, setEditing] = useState<SeasoningProductFormItem | undefined>(
    undefined
  );
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<SeasoningProductListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const queryString = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (sourceIngredientId) params.set("sourceIngredientId", String(sourceIngredientId));
    return params.toString();
  }, [sourceIngredientId, page]);

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/seasoning-products?${queryString()}`);
      const json: unknown = await res.json();
      if (!res.ok) {
        setRows([]);
        setPagination(null);
        return;
      }
      const data =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data?: SeasoningProductListRow[] }).data
          : [];
      setRows(Array.isArray(data) ? data : []);
      setPagination(
        typeof json === "object" &&
          json !== null &&
          "pagination" in json &&
          typeof (json as { pagination?: unknown }).pagination === "object" &&
          (json as { pagination?: unknown }).pagination !== null
          ? ((json as {
              pagination: { totalItems: number; totalPages: number };
            }).pagination)
          : null
      );
    } catch {
      setRows([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  }, [open, queryString]);

  /* eslint-disable react-hooks/set-state-in-effect -- 抽屉打开即拉取列表，setState 在异步回调后触发 */
  useEffect(() => {
    void load();
  }, [load]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      toast.success("调料已删除");
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch {
      toast.error("删除出错");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, load, onChanged]);

  const source = sourceIngredientId != null
    ? {
        id: sourceIngredientId,
        code: sourceCode ?? "",
        name: sourceName ?? "",
        purchaseSpec: rows[0]?.sourceIngredient?.purchaseSpec ?? null,
        pricePerJin:
          rows[0]?.sourceIngredient?.pricePerJin != null
            ? Number(rows[0].sourceIngredient.pricePerJin)
            : null,
        seasoningType: rows[0]?.sourceIngredient?.seasoningType ?? null,
      }
    : null;

  return (
    <>
      <RecordSheet
        open={open}
        onOpenChange={onOpenChange}
        title="调料清单"
        meta={
          <span>
            {sourceName ? `${sourceName} 的调料规格` : "全部调料规格"}
          </span>
        }
        footer={
          <Button onClick={() => onOpenChange(false)}>关闭</Button>
        }
        bodyClassName="overflow-hidden"
      >
        <DataTable<SeasoningProductListRow>
          data={rows}
          loading={loading}
          fillHeight
          density="compact"
          tableClassName="min-w-max"
          columns={[
            {
              header: "序号",
              className: "w-12 whitespace-nowrap",
              cell: (_, rowIndex) => (
                <span className="text-muted-foreground">
                  {(page - 1) * PAGE_SIZE + rowIndex + 1}
                </span>
              ),
            },
            {
              header: "名称",
              className: "whitespace-nowrap",
              cell: (row) => (
                <span className="font-semibold text-primary">{row.name}</span>
              ),
            },
            {
              header: "包装规格",
              className: "whitespace-nowrap tabular-nums",
              cell: (row) =>
                row.packageSpec != null ? `${row.packageSpec}g` : "—",
            },
            {
              header: "调料单价",
              className: "whitespace-nowrap tabular-nums text-right",
              cell: (row) =>
                row.unitPrice != null
                  ? `¥${Number(row.unitPrice).toFixed(2)}/斤`
                  : "—",
            },
            {
              header: "标准规格价",
              className: "whitespace-nowrap tabular-nums text-right",
              cell: (row) =>
                row.standardPackagePrice != null ? (
                  <span className="font-semibold text-primary">
                    ¥{Number(row.standardPackagePrice).toFixed(2)}/份
                  </span>
                ) : (
                  "—"
                ),
            },
          ]}
          rowActions={(row) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="编辑调料"
                onClick={(e) => {
                  e.stopPropagation();
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
                  setFormOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                title="删除调料"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(row);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
          emptyState={{
            title: loading ? "加载中…" : "暂无调料",
            description: loading
              ? undefined
              : "该调味品尚未转化出调料档案，可在调味品列表点击「转化」创建",
          }}
          pagination={
            pagination && pagination.totalItems > PAGE_SIZE
              ? {
                  currentPage: page,
                  fullControls: false,
                  totalPages: pagination.totalPages,
                  totalItems: pagination.totalItems,
                  pageSize: PAGE_SIZE,
                  onPageChange: setPage,
                }
              : undefined
          }
        />
      </RecordSheet>

      {source != null && (
        <SeasoningProductFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          source={source}
          initialData={editing}
          onSuccess={() => {
            void load();
            onChanged?.();
          }}
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
            确定要删除调料「{deleteTarget?.name}」
            {deleteTarget?.packageSpec != null
              ? `（${deleteTarget.packageSpec}g）`
              : ""}
            吗？删除后不可恢复。
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
