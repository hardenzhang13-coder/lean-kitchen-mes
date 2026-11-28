"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageTabs } from "@/app/components/ui/page-tabs";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { ImportDialog } from "@/app/components/ui/import-dialog";
import { IngredientFormDialog } from "@/app/components/ingredients/ingredient-form-dialog";
import { NetIngredientFormDialog } from "@/app/components/ingredients/net-ingredient-form-dialog";
import { RAW_IMPORT_FIELDS, RawIngredientListPanel } from "@/app/components/ingredients/raw-ingredient-list-panel";
import { NetIngredientListPanel } from "@/app/components/ingredients/net-ingredient-list-panel";
import { toast } from "sonner";

type IngredientFoodTab = "raw" | "net";

const FOOD_TABS = [
  { value: "raw", label: "食材清单" },
  { value: "net", label: "净料清单" },
] as const;

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

type RawIngredientOption = {
  id: number;
  code: string;
  name: string;
  alias?: string | null;
  l2Code?: string;
  purchaseSpec?: string | null;
  purchaseUnit?: string | null;
  latestRefPrice?: number | null;
  pricePerJin?: number | null;
};

function getIngredientFoodTab(value: string | null): IngredientFoodTab {
  return value === "net" ? value : "raw";
}

function IngredientFoodListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = getIngredientFoodTab(searchParams.get("tab"));

  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [rawIngredients, setRawIngredients] = useState<RawIngredientOption[]>([]);

  const [mountedTabs, setMountedTabs] = useState<IngredientFoodTab[]>([activeTab]);

  const [rawRefreshToken, setRawRefreshToken] = useState(0);
  const [netRefreshToken, setNetRefreshToken] = useState(0);

  const [rawCreateOpen, setRawCreateOpen] = useState(false);
  const [rawImportOpen, setRawImportOpen] = useState(false);
  const [netCreateOpen, setNetCreateOpen] = useState(false);

  const refreshRaw = useCallback(() => {
    setRawRefreshToken((value) => value + 1);
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const [categoryRes, unitRes, rawRes] = await Promise.all([
        fetch("/api/ingredient-categories?page=1&pageSize=100"),
        fetch("/api/units?page=1&pageSize=100"),
        fetch("/api/ingredients?kind=raw&page=1&pageSize=100"),
      ]);
      const categoryJson = await categoryRes.json();
      const unitJson = await unitRes.json();
      const rawJson = await rawRes.json();
      setCategories(categoryJson.data || []);
      if (unitRes.ok) setUnits(unitJson.data || []);
      if (rawRes.ok) setRawIngredients(rawJson.data || []);
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
    if (!FOOD_TABS.some((tab) => tab.value === next)) return;
    setMountedTabs((previous) =>
      previous.includes(next as IngredientFoodTab)
        ? previous
        : [...previous, next as IngredientFoodTab]
    );
    router.replace(`/ingredients/food?tab=${next}`);
  };

  const handleValidateImport = (rows: Record<string, string>[]) => {
    const l2Set = new Set(
      categories.flatMap((category) => category.children.map((child) => child.code))
    );
    return rows.map((row, index) => {
      const errors: string[] = [];
      if (!row.name?.trim()) errors.push("食材名称不能为空");
      if (!row.l2Code?.trim()) errors.push("二级分类编码不能为空");
      else if (!l2Set.has(row.l2Code.trim())) errors.push("二级分类编码不存在");
      if (!row.purchaseUnit?.trim()) errors.push("采购单位不能为空");
      if (!row.stockUnit?.trim()) errors.push("入库单位不能为空");
      return { index, data: row, errors };
    });
  };

  const handleImport = async (rows: Record<string, string>[]) => {
    const response = await fetch("/api/ingredients/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: rows.map((row) => ({
          name: row.name.trim(),
          alias: row.alias?.trim() || undefined,
          l2Code: row.l2Code.trim(),
          purchaseSpec: row.purchaseSpec?.trim() || undefined,
          purchaseUnit: row.purchaseUnit.trim(),
          stockUnit: row.stockUnit.trim(),
          unitsPerPurchase: row.unitsPerPurchase?.trim()
            ? Number(row.unitsPerPurchase.trim())
            : undefined,
          latestRefPrice: row.latestRefPrice?.trim()
            ? Number(row.latestRefPrice.trim())
            : undefined,
        })),
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      toast.error(error.error || "导入失败");
      throw new Error(error.error);
    }
    refreshRaw();
  };

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          showBack
          backHref="/ingredients"
          title="食材库"
          description="集中管理采购食材及其转化生成的净料"
          actions={
            <div className="flex items-center gap-2">
              {activeTab === "raw" && (
                <>
                  <SkeuButton variant="outline" onClick={() => setRawImportOpen(true)}>
                    <Upload className="h-4 w-4" />
                    批量导入
                  </SkeuButton>
                  <SkeuButton onClick={() => setRawCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    新增食材
                  </SkeuButton>
                </>
              )}
              {activeTab === "net" && (
                <SkeuButton onClick={() => setNetCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  新增净料
                </SkeuButton>
              )}
            </div>
          }
        />
      }
    >
      <div className="skeu-panel flex min-h-0 flex-1 flex-col overflow-hidden py-0 ring-0">
        <PageTabs
          tabs={[...FOOD_TABS]}
          value={activeTab}
          onChange={handleTabChange}
          ariaLabel="食材库清单视图"
        />
        <div className="flex min-h-0 flex-1 flex-col">
          {mountedTabs.includes("raw") && (
            <div className={activeTab === "raw" ? "contents" : "hidden"}>
              <RawIngredientListPanel
                categories={categories}
                units={units}
                refreshToken={rawRefreshToken}
              />
            </div>
          )}
          {mountedTabs.includes("net") && (
            <div className={activeTab === "net" ? "contents" : "hidden"}>
              <NetIngredientListPanel
                categories={categories}
                rawIngredients={rawIngredients}
                refreshToken={netRefreshToken}
              />
            </div>
          )}
        </div>
      </div>

      <IngredientFormDialog
        open={rawCreateOpen}
        onOpenChange={setRawCreateOpen}
        categories={categories}
        units={units}
        mode="ingredient"
        allowContinue
        onSuccess={(_data, continued) => {
          refreshRaw();
          if (!continued) setRawCreateOpen(false);
        }}
      />

      <NetIngredientFormDialog
        open={netCreateOpen}
        onOpenChange={setNetCreateOpen}
        categories={categories}
        rawIngredients={rawIngredients}
        onSuccess={() => {
          setNetCreateOpen(false);
          setNetRefreshToken((value) => value + 1);
        }}
      />

      <ImportDialog
        open={rawImportOpen}
        onOpenChange={setRawImportOpen}
        title="批量导入食材"
        fields={RAW_IMPORT_FIELDS}
        templateFilename="食材导入模板.csv"
        onValidate={handleValidateImport}
        onImport={handleImport}
      />
    </PageShell>
  );
}

export default function IngredientFoodPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-0 flex-1 flex-col gap-4 p-6"
          aria-label="正在加载食材清单"
        >
          <div className="h-14 rounded-[12px] bg-muted animate-pulse" />
          <div className="flex-1 rounded-[12px] bg-muted animate-pulse" />
        </div>
      }
    >
      <IngredientFoodListContent />
    </Suspense>
  );
}

