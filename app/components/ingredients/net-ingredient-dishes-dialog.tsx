"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { DataTable } from "@/app/components/ui/data-table";
import { PortionTag } from "@/app/components/ui/portion-tag";

type RelatedDish = {
  id: number;
  code: string;
  name: string;
  portion: string | null;
};

const PAGE_SIZE = 20;

interface NetIngredientDishesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  netIngredientId: number | null;
  /** 当前净料/小料名称，用于弹窗副标题 */
  netIngredientName?: string | null;
  /** 净料 / 小料，用于文案 */
  kind?: "net" | "minor";
}

/**
 * 关联菜品：展示引用了当前净料/小料的菜品。
 * 主料、辅料与小料三种引用关系都算。
 */
export function NetIngredientDishesDialog({
  open,
  onOpenChange,
  netIngredientId,
  netIngredientName,
  kind = "net",
}: NetIngredientDishesDialogProps) {
  const [rows, setRows] = useState<RelatedDish[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);

  useEffect(() => {
    if (!open || !netIngredientId) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/net-ingredients/${netIngredientId}/dishes?page=${page}&pageSize=${PAGE_SIZE}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("加载失败");
        const json: unknown = await res.json();
        const payload =
          typeof json === "object" && json !== null ? json : {};
        if (controller.signal.aborted) return;
        setRows(
          "data" in payload && Array.isArray(payload.data)
            ? (payload.data as RelatedDish[])
            : []
        );
        setPagination(
          "pagination" in payload &&
            typeof payload.pagination === "object" &&
            payload.pagination !== null
            ? (payload.pagination as {
                totalItems: number;
                totalPages: number;
              })
            : null
        );
      } catch {
        if (!controller.signal.aborted) {
          setRows([]);
          setPagination(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [open, netIngredientId, page]);

  const label = kind === "minor" ? "小料" : "净料";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="wide" className="[&>button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="text-lg">关联菜品</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {netIngredientName
              ? `引用了「${netIngredientName}」的菜品`
              : `引用了该${label}的菜品`}
          </p>
        </DialogHeader>

        <div className="mt-2 max-h-[60vh] overflow-y-auto">
          <DataTable<RelatedDish>
            data={rows}
            loading={loading}
            density="dense"
            tableClassName="min-w-max"
            columns={[
              {
                header: "菜品编号",
                className: "w-[140px]",
                cell: (row) => (
                  <span className="font-medium tabular-nums">{row.code}</span>
                ),
              },
              {
                header: "菜品名称",
                className: "w-[240px]",
                cell: (row) => (
                  <span className="font-semibold text-primary">{row.name}</span>
                ),
              },
              {
                header: "份量",
                className: "w-[120px]",
                cell: (row) => <PortionTag portion={row.portion} />,
              },
            ]}
            emptyState={{
              title: `暂无关联菜品`,
              description: loading ? "" : `当前${label}还没有被任何菜品引用`,
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
        </div>
      </AppDialogContent>
    </Dialog>
  );
}