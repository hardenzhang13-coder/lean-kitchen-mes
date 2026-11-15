"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SCHEDULE_STATUS_VALUES } from "@/lib/shared/schedule-status";
import type {
  ProductionPlanListItem,
  ScheduleListItem,
} from "@/app/components/schedule/list-types";

/** 看板每列的取数上限（与 API pageSize 上限一致）。 */
const COLUMN_LIMIT = 100;

export interface BoardColumn<T> {
  status: string;
  items: T[];
  /** 该状态的总条数（可能大于 items.length） */
  total: number;
}

function useDebouncedValue(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function fetchColumn<T>(
  base: string,
  status: string,
  params: URLSearchParams
): Promise<BoardColumn<T>> {
  const query = new URLSearchParams(params);
  query.set("status", status);
  query.set("page", "1");
  query.set("pageSize", String(COLUMN_LIMIT));
  const res = await fetch(`${base}?${query.toString()}`);
  const data = await res.json();
  const items: T[] = data.data ?? [];
  return {
    status,
    items,
    total: data.pagination?.totalItems ?? items.length,
  };
}

function buildBoardColumns<T>(
  fetcher: (status: string) => Promise<BoardColumn<T>>
): Promise<BoardColumn<T>[]> {
  return Promise.all(SCHEDULE_STATUS_VALUES.map((status) => fetcher(status)));
}

/** 菜品排程单看板：按状态三列取数，日期为单日筛选。 */
export function useScheduleBoard() {
  const [columns, setColumns] = useState<BoardColumn<ScheduleListItem>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [storeId, setStoreId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const boardKey = `${date}|${storeId}|${debouncedSearch}|${refreshKey}`;
  const [prevBoardKey, setPrevBoardKey] = useState(boardKey);
  if (prevBoardKey !== boardKey) {
    setPrevBoardKey(boardKey);
    setLoading(true);
  }

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (date) {
      params.set("startDate", date);
      params.set("endDate", date);
    }
    if (storeId && storeId !== "all") params.set("storeId", storeId);
    if (debouncedSearch) params.set("q", debouncedSearch);

    const run = async () => {
      try {
        const result = await buildBoardColumns((status) =>
          fetchColumn<ScheduleListItem>("/api/schedules", status, params)
        );
        if (alive) setColumns(result);
      } catch {
        if (alive) toast.error("获取排程数据失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [date, storeId, debouncedSearch, refreshKey]);

  return {
    columns,
    loading,
    search,
    date,
    storeId,
    setSearch,
    setDate,
    setStoreId,
    reset: () => {
      setDate("");
      setStoreId("");
      setSearch("");
    },
    refresh: () => setRefreshKey((key) => key + 1),
  };
}

/** 生产计划单看板：按状态三列取数，日期为单日筛选。 */
export function useProductionPlanBoard() {
  const [columns, setColumns] = useState<BoardColumn<ProductionPlanListItem>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const debouncedSearch = useDebouncedValue(search);

  const boardKey = `${date}|${debouncedSearch}|${refreshKey}`;
  const [prevBoardKey, setPrevBoardKey] = useState(boardKey);
  if (prevBoardKey !== boardKey) {
    setPrevBoardKey(boardKey);
    setLoading(true);
  }

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams();
    if (date) {
      params.set("startDate", date);
      params.set("endDate", date);
    }
    if (debouncedSearch) params.set("q", debouncedSearch);

    const run = async () => {
      try {
        const result = await buildBoardColumns((status) =>
          fetchColumn<ProductionPlanListItem>("/api/production-plans", status, params)
        );
        if (alive) setColumns(result);
      } catch {
        if (alive) toast.error("获取生产计划单失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [date, debouncedSearch, refreshKey]);

  return {
    columns,
    loading,
    search,
    date,
    setSearch,
    setDate,
    reset: () => {
      setDate("");
      setSearch("");
    },
    refresh: () => setRefreshKey((key) => key + 1),
  };
}
