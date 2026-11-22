import { useCallback, useMemo, useState } from "react";

export const DEFAULT_PAGE_SIZE = 10;

/**
 * 列表底部的汇总文案：只报总量，不报当前区间。
 * 区间信息在分页里通过页码体现，底栏只留「共 N 条」并用主题色强调。
 */
export function formatPageSummary(
  _currentPage: number,
  _pageSize: number,
  totalItems: number,
  itemLabel?: string
): string {
  return `共 ${totalItems} 条${itemLabel ? ` ${itemLabel}` : ""}`;
}

export function usePagination<T>(items: T[], initialPageSize = DEFAULT_PAGE_SIZE) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / pageSize)),
    [items.length, pageSize]
  );

  const safePage = Math.min(currentPage, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const start = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, items.length);

  return {
    currentPage: safePage,
    setCurrentPage,
    pageItems,
    totalPages,
    totalItems: items.length,
    start,
    end,
    pageSize,
    setPageSize,
  };
}
