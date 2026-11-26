"use client";

import { useEffect, useState } from "react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { FormDialog } from "@/app/components/ui/form-dialog";
import { DataTable } from "@/app/components/ui/data-table";
import { PortionTag } from "@/app/components/ui/portion-tag";

type RelatedDish = {
  id: number;
  code: string;
  name: string;
  portion: string | null;
};

const PAGE_SIZE = 20;

interface MaterialUsageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 使用概况数据接口（分页参数由弹窗拼接），如 /api/seasoning-products/3/dishes */
  fetchUrl: string | null;
  /** 物料名称，用于副标题 */
  materialName?: string | null;
  /** 物料类别文案（净料 / 小料 / 调料），用于副标题与空态 */
  materialLabel?: string;
}

/**
 * 使用概况：展示引用了当前物料（净料/小料/调料产物）的菜品。
 * 数据接口按物料类型由调用方传入，返回结构统一为分页的 {id, code, name, portion}。
 */
export function MaterialUsageDialog({
  open,
  onOpenChange,
  fetchUrl,
  materialName,
  materialLabel = "物料",
}: MaterialUsageDialogProps) {
  const [rows, setRows] = useState<RelatedDish[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{
    totalItems: number;
    totalPages: number;
  } | null>(null);

  useEffect(() => {
    if (!open || !fetchUrl) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const sep = fetchUrl.includes("?") ? "&" : "?";
        const res = await fetch(
          `${fetchUrl}${sep}page=${page}&pageSize=${PAGE_SIZE}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("加载失败");
        const json: unknown = await res.json();
        const payload = typeof json === "object" && json !== null ? json : {};
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
            ? (payload.pagination as { totalItems: number; totalPages: number })
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
  }, [open, fetchUrl, page]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setPage(1);
    onOpenChange(next);
  };

  return (
    <FormDialog open={open} onOpenChange={handleOpenChange}>
      <AppDialogContent size="wide" className="[&>button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="text-lg">使用概况</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {materialName
              ? `引用了「${materialName}」的菜品`
              : `引用了该${materialLabel}的菜品`}
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
              title: "暂未用于任何菜品",
              description: loading ? "" : `当前${materialLabel}还没有被任何菜品引用`,
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
    </FormDialog>
  );
}
