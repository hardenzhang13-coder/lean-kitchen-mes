"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { DataTable } from "@/app/components/ui/data-table";
import { PortionTag } from "@/app/components/ui/portion-tag";
import {
  StandardSeasoningFormDialog,
  StandardSeasoningFormItem,
} from "@/app/components/ingredients/standard-seasoning-form-dialog";
import { toast } from "sonner";

export type StandardSeasoningViewRow = {
  id: number;
  code: string;
  name: string;
  packageSpec: number | null;
  portion: string | null;
  yieldRate: number | null;
  unitPrice: number | null;
  processingFeePerJin: number | null;
  grossMarginRate: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
  sourceIngredient: {
    id: number;
    name: string;
    purchaseSpec: string | null;
    pricePerJin: number | null;
  } | null;
};

interface StandardSeasoningViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 来源调料 ID */
  sourceIngredientId: number | null;
  /** 来源调料名称，用于副标题 */
  sourceName?: string | null;
  /** 来源调料二级分类名称 */
  sourceL2Name?: string | null;
  /** 来源调料编号 */
  sourceCode?: string | null;
  /** 规格新增 / 更新 / 删除后回调 */
  onChanged?: () => void;
}

/**
 * 封装调料：展示某个调料转化出的标准规格。
 * 展示字段固定为：名称、包装规格、份量、调料单价、出库价、标准规格价。
 */
export function StandardSeasoningViewDialog({
  open,
  onOpenChange,
  sourceIngredientId,
  sourceName,
  sourceL2Name,
  sourceCode,
  onChanged,
}: StandardSeasoningViewDialogProps) {
  const [rows, setRows] = useState<StandardSeasoningViewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<StandardSeasoningFormItem | undefined>(
    undefined
  );
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<StandardSeasoningViewRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!sourceIngredientId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/standard-seasonings?sourceIngredientId=${sourceIngredientId}&pageSize=100`
      );
      const json: unknown = await res.json();
      if (!res.ok) {
        setRows([]);
        return;
      }
      const data =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data?: StandardSeasoningViewRow[] }).data
          : [];
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [sourceIngredientId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/standard-seasonings?sourceIngredientId=${sourceIngredientId}&pageSize=100`
        );
        const json: unknown = await res.json();
        if (cancelled) return;
        const data =
          typeof json === "object" && json !== null && "data" in json
            ? (json as { data?: StandardSeasoningViewRow[] }).data
            : [];
        setRows(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, sourceIngredientId]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/standard-seasonings/${deleteTarget.id}`, {
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
      toast.success("调料规格已删除");
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch {
      toast.error("删除出错");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, load, onChanged]);

  const source = {
    id: sourceIngredientId ?? 0,
    code: sourceCode ?? "",
    name: sourceName ?? "",
    purchaseSpec: rows[0]?.sourceIngredient?.purchaseSpec ?? null,
    pricePerJin:
      rows[0]?.sourceIngredient?.pricePerJin != null
        ? Number(rows[0].sourceIngredient.pricePerJin)
        : null,
    l2Name: sourceL2Name ?? null,
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <AppDialogContent size="wide" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">封装调料</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {sourceName ? `「${sourceName}」转化出的标准规格` : "标准规格"}
            </p>
          </DialogHeader>

          <div className="mt-2 max-h-[60vh] overflow-y-auto">
            <DataTable<StandardSeasoningViewRow>
              data={rows}
              loading={loading}
              density="dense"
              tableClassName="min-w-max"
              columns={[
                {
                  header: "名称",
                  cell: (row) => <span className="font-medium">{row.name}</span>,
                },
                {
                  header: "包装规格",
                  className: "whitespace-nowrap tabular-nums",
                  cell: (row) =>
                    row.packageSpec != null ? `${row.packageSpec}g` : "—",
                },
                {
                  header: "份量",
                  cell: (row) => <PortionTag portion={row.portion} />,
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
                  header: "出库价",
                  className: "whitespace-nowrap tabular-nums text-right",
                  cell: (row) =>
                    row.outPricePerJin != null
                      ? `¥${Number(row.outPricePerJin).toFixed(2)}/斤`
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
                    title="编辑调料规格"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({
                        id: row.id,
                        code: row.code,
                        name: row.name,
                        packageSpec: row.packageSpec,
                        portion: row.portion,
                        yieldRate: row.yieldRate,
                        processingFeePerJin: row.processingFeePerJin,
                        grossMarginRate: row.grossMarginRate,
                        sourceIngredientId:
                          row.sourceIngredient?.id ?? sourceIngredientId ?? undefined,
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
                    title="删除调料规格"
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
                title: loading ? "加载中…" : "暂无封装调料",
                description: loading
                  ? undefined
                  : "该调料尚未转化出标准规格，可在调料清单点击「转调料」创建",
              }}
            />
          </div>
        </AppDialogContent>
      </Dialog>

      {sourceIngredientId != null && (
        <StandardSeasoningFormDialog
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
            确定要删除调料规格「{deleteTarget?.name}」
            {deleteTarget?.packageSpec != null
              ? `（${deleteTarget.packageSpec}g）`
              : ""}
            吗？删除后不再可用于菜品 BOM。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void handleDelete();
              }}
              disabled={deleting}
              className="h-11 px-6"
            >
              <span aria-live="polite" className="inline-flex items-center">
                {deleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                删除
              </span>
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </>
  );
}
