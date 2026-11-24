"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageHeader } from "@/app/components/ui/page-header";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { DataTable, type ColumnDef } from "@/app/components/ui/data-table";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { SkeuDotSelect, type SkeuDotOption } from "@/app/components/ui/skeu-dot-select";
import { SkeuIconAction } from "@/app/components/ui/skeu-row-action";
import {
  usePagination,
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
import { toast } from "sonner";

/** 行数据的 isActive 约定：启用状态筛选的实体必须带；模板内部安全读取 */
type StatusRow = { isActive?: boolean };

export interface SimpleListCtx<T> {
  /** 重新拉取列表（提交 / 启停 / 删除成功后调用） */
  refresh: () => void;
  data: T[];
  loading: boolean;
  currentPage: number;
  pageSize: number;
}

const STATUS_OPTIONS: SkeuDotOption[] = [
  { value: "all", label: "全部", tone: "all" },
  { value: "active", label: "启用中", tone: "success" },
  { value: "inactive", label: "已停用", tone: "warning" },
];

/** 排序能力配置：开启后操作列前置上移 / 下移 */
export interface SimpleListSortable<T> {
  /** 重排接口：PUT，body 为 { ids: number[] }（按新顺序排列的完整 id 列表） */
  endpoint: string;
  /** 取行唯一 id */
  getId: (row: T) => number;
  /** 取行名，用于无障碍标签 */
  getLabel?: (row: T) => string;
}

export interface SimpleListPageProps<T extends object> {
  title: string;
  description?: string;
  /** 分页汇总与错误提示用的业务名词，如「单位」 */
  entityLabel: string;
  /** 列表接口；与 loader 二选一 */
  listUrl?: string;
  /** 自定义加载函数（如需并行拉取多个接口）；必须用 useCallback 固定引用 */
  loader?: () => Promise<T[]>;
  searchPlaceholder?: string;
  /** 参与搜索匹配的字段；不传则搜索不过滤 */
  searchIn?: (row: T) => (string | null | undefined)[];
  /** 内置三态状态筛选（全部 / 启用中 / 已停用），按 row.isActive 过滤 */
  statusFilter?: boolean;
  /** 状态筛选之外的自定义筛选控件，追加在工具条内 */
  toolbarExtra?: ReactNode;
  /** toolbarExtra 有生效筛选时传 true，控制「重置」按钮 */
  hasExtraFilters?: boolean;
  /** 重置时同步清空自定义筛选状态 */
  onResetExtra?: () => void;
  createLabel?: string;
  onCreate?: () => void;
  /** 自动生成序号列，默认开启 */
  showIndex?: boolean;
  columns: ColumnDef<T>[];
  /** 行操作；ctx.refresh 供启停 / 删除成功后刷新 */
  rowActions?: (row: T, ctx: SimpleListCtx<T>) => ReactNode;
  /** 开启排序：操作列前置上移 / 下移按钮 */
  sortable?: SimpleListSortable<T>;
  /** 操作列宽度；默认按三个带文字操作预留 */
  actionsWidth?: string;
  emptyTitle?: string;
  /** 页面级弹窗（RecordDialog / DeleteConfirmDialog）；函数形态可拿到 ctx */
  children?: ReactNode | ((ctx: SimpleListCtx<T>) => ReactNode);
}

/**
 * 设置类简单表整页模板：panel + topbar 骨架、数据加载、搜索、
 * 三态状态筛选、分页、序号列与空态全部内置；页面只声明列、行操作与弹窗。
 */
export function SimpleListPage<T extends object>({
  title,
  description,
  entityLabel,
  listUrl,
  loader,
  searchPlaceholder,
  searchIn,
  statusFilter = false,
  toolbarExtra,
  hasExtraFilters = false,
  onResetExtra,
  createLabel,
  onCreate,
  showIndex = true,
  columns,
  rowActions,
  sortable,
  actionsWidth,
  emptyTitle = "暂无数据",
  children,
}: SimpleListPageProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [reordering, setReordering] = useState(false);

  const refresh = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        let rows: T[] = [];
        if (loader) {
          rows = await loader();
        } else if (listUrl) {
          const res = await fetch(listUrl);
          const json = await res.json();
          rows = json.data || [];
        }
        if (alive) setData(rows);
      } catch {
        if (alive) toast.error(`获取${entityLabel}失败`);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [loader, listUrl, reloadKey, entityLabel]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((row) => {
      if (statusFilter) {
        const isActive = (row as StatusRow).isActive;
        if (status === "active" && !isActive) return false;
        if (status === "inactive" && isActive) return false;
      }
      if (!term || !searchIn) return true;
      return searchIn(row).some((field) =>
        field?.toLowerCase().includes(term)
      );
    });
  }, [data, search, status, statusFilter, searchIn]);

  const {
    currentPage,
    setCurrentPage,
    pageItems,
    totalPages,
    totalItems,
    pageSize,
    setPageSize,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

  const ctx: SimpleListCtx<T> = {
    refresh,
    data: pageItems,
    loading,
    currentPage,
    pageSize,
  };

  // 排序：搜索或状态筛选会隐藏部分行，此时上下移动的目标行不明确，禁用
  const filterActive = !!search.trim() || (statusFilter && status !== "all");
  const sortDisabled = filterActive || reordering;
  const sortHint = search.trim() ? "搜索时不可排序" : "筛选时不可排序";

  /** 上移 / 下移：与当前可见列表的相邻行交换，提交完整有序 id 列表 */
  const moveRow = async (row: T, dir: -1 | 1) => {
    if (!sortable) return;
    const id = sortable.getId(row);
    const visibleIdx = filtered.findIndex((r) => sortable.getId(r) === id);
    if (visibleIdx < 0) return;
    const targetIdx = visibleIdx + dir;
    if (targetIdx < 0 || targetIdx >= filtered.length) return;

    const targetId = sortable.getId(filtered[targetIdx]);
    const gi = data.findIndex((r) => sortable.getId(r) === id);
    const gj = data.findIndex((r) => sortable.getId(r) === targetId);
    if (gi < 0 || gj < 0) return;

    const ids = data.map((r) => sortable.getId(r));
    [ids[gi], ids[gj]] = [ids[gj], ids[gi]];
    setReordering(true);
    try {
      const res = await fetch(sortable.endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "调整顺序失败");
        return;
      }
      const nextData = [...data];
      [nextData[gi], nextData[gj]] = [nextData[gj], nextData[gi]];
      setData(nextData);
      toast.success("顺序已调整");
    } catch {
      toast.error("调整顺序失败");
    } finally {
      setReordering(false);
    }
  };

  /** 行首的排序按钮（上移 / 下移） */
  const renderSortActions = (row: T): ReactNode => {
    if (!sortable) return null;
    const id = sortable.getId(row);
    const visibleIdx = filtered.findIndex((r) => sortable.getId(r) === id);
    const label = sortable.getLabel?.(row) ?? entityLabel;
    return (
      <>
        <SkeuIconAction
          label={`上移 ${label}`}
          tip={sortDisabled ? sortHint : "上移"}
          disabled={sortDisabled || visibleIdx <= 0}
          icon={<ChevronUp className="h-4 w-4" />}
          onClick={(event) => {
            event.stopPropagation();
            moveRow(row, -1);
          }}
        />
        <SkeuIconAction
          label={`下移 ${label}`}
          tip={sortDisabled ? sortHint : "下移"}
          disabled={sortDisabled || visibleIdx < 0 || visibleIdx >= filtered.length - 1}
          icon={<ChevronDown className="h-4 w-4" />}
          onClick={(event) => {
            event.stopPropagation();
            moveRow(row, 1);
          }}
        />
      </>
    );
  };

  const indexColumn: ColumnDef<T> | null = showIndex
    ? {
        header: "序号",
        className: "w-[48px]",
        cell: (_, rowIdx) => (
          <span className="text-muted-foreground">
            {(currentPage - 1) * pageSize + rowIdx + 1}
          </span>
        ),
      }
    : null;

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          showBack
          title={title}
          description={description}
          actions={
            onCreate ? (
              <SkeuButton onClick={onCreate}>
                <Plus className="h-4 w-4" />
                {createLabel ?? "新增"}
              </SkeuButton>
            ) : undefined
          }
        />
      }
    >
      <Card className="skeu-panel flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0 ring-0">
        <CardHeader className="skeu-panel-toolbar shrink-0 px-5 py-4">
          <ListToolbar
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            searchPlaceholder={searchPlaceholder}
            onReset={() => {
              setSearch("");
              if (statusFilter) setStatus("all");
              onResetExtra?.();
              setCurrentPage(1);
            }}
            hasFilters={(statusFilter && status !== "all") || hasExtraFilters}
          >
            {statusFilter && (
              <SkeuDotSelect
                value={status}
                onChange={(value) => {
                  setStatus(value);
                  setCurrentPage(1);
                }}
                options={STATUS_OPTIONS}
                aria-label={`${entityLabel}状态筛选`}
              />
            )}
            {toolbarExtra}
          </ListToolbar>
        </CardHeader>
        <CardContent className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
          <DataTable<T>
            data={pageItems}
            loading={loading}
            fillHeight
            variant="skeu"
            tableClassName="min-w-max"
            columns={indexColumn ? [indexColumn, ...columns] : columns}
            pagination={{
              currentPage,
              totalPages,
              totalItems,
              pageSize,
              onPageChange: setCurrentPage,
              totalLabel: formatPageSummary(totalItems),
              showPageSize: true,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{ title: emptyTitle }}
            actionsWidth={actionsWidth ?? (sortable ? "w-[340px]" : "w-[260px]")}
            rowActions={
              rowActions || sortable
                ? (row) => (
                    <>
                      {renderSortActions(row)}
                      {rowActions?.(row, ctx)}
                    </>
                  )
                : undefined
            }
          />
        </CardContent>
      </Card>
      {typeof children === "function" ? children(ctx) : children}
    </PageShell>
  );
}
