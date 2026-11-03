"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Carrot, Package, Cherry, FlaskConical, Wine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type IngredientSummaryCounts = {
  raw: number;
  net: number;
  minor: number;
  seasoning: number;
  sauce: number;
};

const ingredientItems = [
  {
    href: "/ingredients/raw",
    label: "原料清单",
    desc: "食材采购入库、库存管理的基本单位",
    icon: Carrot,
    color: "text-orange-500 dark:text-orange-400",
    countKey: "raw",
  },
  {
    href: "/ingredients/net",
    label: "净料清单",
    desc: "原料经初加工后的规格化半成品",
    icon: Package,
    color: "text-emerald-500 dark:text-emerald-400",
    countKey: "net",
  },
  {
    href: "/ingredients/minor",
    label: "小料清单",
    desc: "用量极小的增香/去腥/提味食材",
    icon: Cherry,
    color: "text-rose-500 dark:text-rose-400",
    countKey: "minor",
  },
  {
    href: "/ingredients/seasoning",
    label: "调料清单",
    desc: "标准化产品形态的基础调味品",
    icon: FlaskConical,
    color: "text-blue-500 dark:text-blue-400",
    countKey: "seasoning",
  },
  {
    href: "/ingredients/sauce",
    label: "酱料清单",
    desc: "复合加工调味半成品",
    icon: Wine,
    color: "text-purple-500 dark:text-purple-400",
    countKey: "sauce",
  },
] as const;

const emptyCounts: IngredientSummaryCounts = {
  raw: 0,
  net: 0,
  minor: 0,
  seasoning: 0,
  sauce: 0,
};

export default function IngredientsPage() {
  const [counts, setCounts] = useState<IngredientSummaryCounts>(emptyCounts);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/ingredients/summary");
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data) setCounts(json.data);
    } catch {
      // 静默失败：保留当前展示的数字
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 从其他页面录入数据后返回本页（含浏览器后退 bfcache 恢复）时自动刷新统计数
  useEffect(() => {
    const handleFocus = () => fetchCounts();
    const handlePageShow = () => fetchCounts();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [fetchCounts]);

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">食材库</h1>
        <p className="text-muted-foreground">管理五类食材档案</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ingredientItems.map((item) => {
          const Icon = item.icon;
          const count = counts[item.countKey];
          return (
            <Link key={item.href} href={item.href}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <Icon className={`h-8 w-8 ${item.color}`} />
                  <div className="flex-1">
                    <CardTitle className="text-lg">{item.label}</CardTitle>
                  </div>
                  <span className="text-2xl font-bold text-foreground">
                    {count}
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
