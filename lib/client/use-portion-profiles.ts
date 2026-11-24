"use client";

import { useEffect, useState } from "react";

import { toPortionOption, type PortionOption, type PortionProfileLike } from "@/lib/shared/portion-scale";

const CACHE_TTL_MS = 60_000;

type PortionProfilesState = {
  /** 启用中的份量档案行（选项源）；失败时为 null，降级用 LEGACY 兜底 */
  profiles: PortionProfileLike[] | null;
  loading: boolean;
  error: boolean;
};

let cache: { rows: PortionProfileLike[]; expiresAt: number } | null = null;
let inflight: Promise<PortionProfileLike[] | null> | null = null;

async function fetchProfiles(): Promise<PortionProfileLike[] | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.rows;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch("/api/portion-profiles?all=1");
        if (!res.ok) return null;
        const json = await res.json();
        const rows = Array.isArray(json?.data) ? (json.data as PortionProfileLike[]) : null;
        if (!rows) return null;
        cache = { rows, expiresAt: Date.now() + CACHE_TTL_MS };
        return rows;
      } catch {
        return null;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

/**
 * 份量档案数据源：菜品/净料/调料表单的份量选项唯一来源。
 * 模块级 60s 缓存 + 并发去重；接口失败时 profiles 为 null，
 * 调用方用 LEGACY_PORTION_OPTIONS 兜底展示，不写回。
 */
export function usePortionProfiles(): PortionProfilesState {
  // 不在 render 期读缓存（Date.now 纯度约束）；effect 内同步命中缓存立即返回
  const [state, setState] = useState<PortionProfilesState>({
    profiles: null,
    loading: true,
    error: false,
  });

  useEffect(() => {
    let alive = true;
    fetchProfiles().then((rows) => {
      if (!alive) return;
      if (rows) {
        setState({ profiles: rows, loading: false, error: false });
      } else {
        setState({ profiles: null, loading: false, error: true });
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  return state;
}

/** 档案行 → 下拉选项（label 即落库标签，描述为计算规则） */
export function toPortionOptions(profiles: PortionProfileLike[]): PortionOption[] {
  return profiles.map(toPortionOption);
}
