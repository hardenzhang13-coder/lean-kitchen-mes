"use client";

import { useEffect, useState } from "react";

/** 读取当前登录角色（只用于决定按钮显隐，权限判定仍以后端为准）。 */
export function useCurrentRole(): string | null {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setRole(data?.data?.user?.role ?? null);
      } catch {
        // 角色读取失败时按只读处理，按钮显隐由 canWrite 默认值兜底
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  return role;
}
