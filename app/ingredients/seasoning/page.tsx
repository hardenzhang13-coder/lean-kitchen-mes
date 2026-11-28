"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageTabs } from "@/app/components/ui/page-tabs";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { IngredientFormDialog } from "@/app/components/ingredients/ingredient-form-dialog";
import { SeasoningListPanel } from "@/app/components/ingredients/seasoning-list-panel";
import { SeasoningProductListPanel } from "@/app/components/ingredients/seasoning-product-list-panel";
import type { SeasoningProductType } from "@/lib/shared/seasoning-product";
import { toast } from "sonner";

type SeasoningTab = "all" | "item" | "compound" | "sauce";

// 页签一 = 调味品原料层（kind=seasoning）；页签二~四 = 调料产物层（按产物类型）
const TABS: Array<{
  value: SeasoningTab;
  label: string;
  productType: SeasoningProductType | null;
}> = [
  { value: "all", label: "调味品", productType: null },
  { value: "item", label: "单品调料", productType: "单品调料" },
  { value: "compound", label: "复合调料", productType: "复合调料" },
  { value: "sauce", label: "成品酱料", productType: "成品酱料" },
];

function getTab(value: string | null): SeasoningTab {
  return TABS.some((t) => t.value === value) ? (value as SeasoningTab) : "all";
}

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
      // 调味品不挂分类树（归类走「调料分类」体系），只需拉单位字典
      const unitRes = await fetch("/api/units?page=1&pageSize=100");
      const unitJson = await unitRes.json();
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

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          showBack
          backHref="/ingredients"
          title="调味品"
          description="调味品是原材料层，可转化为单品/复合/成品酱料三种标准化调料，供菜品 BOM 按克选用"
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
                units={units}
                refreshToken={refreshTokens.all}
                onTransformed={() => {
                  // 转化产物按类型落在三个产物页签；页签保持挂载缓存，必须显式刷新
                  refresh("item");
                  refresh("compound");
                  refresh("sauce");
                }}
              />
            </div>
          )}
          {TABS.filter((t) => t.productType !== null).map((t) => {
            const tab = t.value;
            const productType = t.productType as SeasoningProductType;
            return (
              mountedTabs.includes(tab) && (
                <div key={tab} className={activeTab === tab ? "contents" : "hidden"}>
                  <SeasoningProductListPanel
                    productType={productType}
                    refreshToken={refreshTokens[tab]}
                  />
                </div>
              )
            );
          })}
        </div>
      </div>

      <IngredientFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        units={units}
        mode="seasoning"
        onSuccess={() => {
          setCreateOpen(false);
          refresh(activeTab);
          // 新建产物/原料互不影响，但转化可能落在其他 Tab：全部刷新
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
