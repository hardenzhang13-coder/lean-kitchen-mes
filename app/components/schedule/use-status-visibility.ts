"use client";

import { startTransition, useEffect, useState } from "react";
import { SCHEDULE_STATUS_VALUES } from "@/lib/shared/schedule-status";

/**
 * 列表看板的状态列可见性。
 * 默认只展示「待生效 / 进行中」——已完成的单据日常无需盯；用户可按模块自行勾选，
 * 选择记在 localStorage，下次进入沿用。至少保留一列，避免看板空转。
 */
export function useStatusVisibility(storageKey: string) {
  const [visible, setVisible] = useState<string[]>(() => defaultVisible());

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(storageKey);
    } catch {
      return;
    }
    if (!saved) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(saved);
    } catch {
      return;
    }
    if (!Array.isArray(parsed)) return;

    const restored = SCHEDULE_STATUS_VALUES.filter((status) =>
      (parsed as unknown[]).includes(status)
    );
    if (restored.length === 0) return;
    startTransition(() => setVisible(restored));
  }, [storageKey]);

  const setStatuses = (next: readonly string[]) => {
    // 固定按枚举顺序重排，勾选顺序不影响列顺序
    const ordered = SCHEDULE_STATUS_VALUES.filter((status) => next.includes(status));
    if (ordered.length === 0) return;
    setVisible(ordered);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(ordered));
    } catch {
      // 隐私模式等场景写入失败不影响本次选择
    }
  };

  return { visible, setStatuses };
}

function defaultVisible(): string[] {
  return SCHEDULE_STATUS_VALUES.filter((status) => status !== "已完成");
}
