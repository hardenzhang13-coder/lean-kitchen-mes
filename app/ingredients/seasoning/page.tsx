"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageTabs } from "@/app/components/ui/page-tabs";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { IngredientFormDialog } from "@/app/components/ingredients/ingredient-form-dialog";
import { SeasoningListPanel } from "@/app/components/ingredients/seasoning-list-panel";
import { toast } from "sonner";

type SeasoningTab = "all" | "item" | "compound" | "sauce";

const TABS: Array<{ value: SeasoningTab; label: string; l2Code: string }> = [
  { value: "all", label: "调味品", l2Code: "" },
  { value: "item", label: "单品调料", l2Code: "SEA-ITM" },
  { value: "compound", label: "复合调料", l2Code: "SEA-COM" },
  { value: "sauce", label: "成品酱料", l2Code: "SEA-SAU" },
];

function getTab(value: string | null): SeasoningTab {
  return TABS.some((t) => t.value === value) ? (value as SeasoningTab) : "all";
}

type CategoryL1 = {
  id?: number;
  code: string;
  name: string;
  children: { id?: number; code: string; name: string; parentCode: string }[];
};

type Unit = {
  id: number;
  name: string;
  category: string;
  gramsPerUnit?: number | string | null;
  isActive?: boolean;
};

function SeasoningListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = getTab(searchParams.get("tab"));

  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [mountedTabs, setMountedTabs] = useState<SeasoningTab[]>([activeTab]);
  const [createOpen, setCreateOpen] = useState(false);
  const [refreshTokens, setRefreshTokens] = useState<Record<SeasoningTab, number>>({
    all: 0,
    item: 0,
    compound: 0,
    sauce: 0,
  });

  const refresh = useCallback((tab: SeasoningTab) => {
    setRefreshTokens((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const [categoryRes, unitRes] = await Promise.all([
        fetch("/api/ingredient-categories?page=1&pageSize=100"),
        fetch("/api/units?page=1&pageSize=100"),
      ]);
      const categoryJson = await categoryRes.json();
      const unitJson = await unitRes.json();
      setCategories(categoryJson.data || []);
      if (unitRes.ok) setUnits(unitJson.data || []);
    } catch {
      toast.error("获取筛选数据失败");
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleTabChange = (next: string) => {
    if (!TABS.some((t) => t.value === next)) return;
    const tab = next as SeasoningTab;
    setMountedTabs((previous) =>
      previous.includes(tab) ? previous : [...previous, tab]
    );
    router.replace(`/ingredients/seasoning?tab=${next}`);
  };

  // 新建调味品默认分类：优先单品调料（SEA-ITM），其次 SEA 下第一个启用二级分类
  const defaultL2Code = useMemo(() => {
    const sea = categories.find((l1) => l1.code === "SEA");
    if (!sea) return undefined;
    const itm = sea.children.find((c) => c.code === "SEA-ITM");
    return (itm ?? sea.children[0])?.code;
  }, [categories]);

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          showBack
          backHref="/ingredients"
          title="调味品"
          description="调味品可转化为调料清单档案；单品/复合/成品酱料按分类归属"
          actions={
            <SkeuButton onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              新增调味品
            </SkeuButton>
          }
        />
      }
    >
      <div className="skeu-panel flex min-h-0 flex-1 flex-col overflow-hidden py-0 ring-0">
        <PageTabs
          tabs={TABS.map(({ value, label }) => ({ value, label }))}
          value={activeTab}
          onChange={handleTabChange}
          ariaLabel="调味品分类视图"
        />
        <div className="flex min-h-0 flex-1 flex-col">
          {mountedTabs.includes("all") && (
            <div className={activeTab === "all" ? "contents" : "hidden"}>
              <SeasoningListPanel
                categories={categories}
                units={units}
                refreshToken={refreshTokens.all}
              />
            </div>
          )}
          {mountedTabs.includes("item") && (
            <div className={activeTab === "item" ? "contents" : "hidden"}>
              <SeasoningListPanel
                categories={categories}
                units={units}
                fixedL2Code="SEA-ITM"
                refreshToken={refreshTokens.item}
              />
            </div>
          )}
          {mountedTabs.includes("compound") && (
            <div className={activeTab === "compound" ? "contents" : "hidden"}>
              <SeasoningListPanel
                categories={categories}
                units={units}
                fixedL2Code="SEA-COM"
                refreshToken={refreshTokens.compound}
              />
            </div>
          )}
          {mountedTabs.includes("sauce") && (
            <div className={activeTab === "sauce" ? "contents" : "hidden"}>
              <SeasoningListPanel
                categories={categories}
                units={units}
                fixedL2Code="SEA-SAU"
                refreshToken={refreshTokens.sauce}
              />
            </div>
          )}
        </div>
      </div>

      <IngredientFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialData={{ l2Code: defaultL2Code }}
        categories={categories}
        units={units}
        mode="seasoning"
        onSuccess={() => {
          setCreateOpen(false);
          refresh(activeTab);
          // 新建可能落在其他分类 Tab，同步刷新全部
          refresh("all");
          refresh("item");
          refresh("compound");
          refresh("sauce");
        }}
      />
    </PageShell>
  );
}

export default function SeasoningIngredientsPage() {
  return (
    <Suspense fallback={null}>
      <SeasoningListContent />
    </Suspense>
  );
}
