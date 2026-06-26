"use client";

import { useEffect, useState } from "react";
import { DishForm } from "@/app/components/dish-form";
import { DishFormRefs, IngredientOption, IngredientCategory } from "@/app/components/dish-form/types";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function NewDishPage() {
  const [refs, setRefs] = useState<DishFormRefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [cRes, catRes, netRes, minorRes, ingRes, sauceRes] = await Promise.all([
          fetch("/api/dish-categories"),
          fetch("/api/ingredient-categories"),
          fetch("/api/net-ingredients?excludeMinor=true"),
          fetch("/api/net-ingredients?l1Code=MIN"),
          fetch("/api/ingredients"),
          fetch("/api/sauce-ingredients"),
        ]);

        const categories = await cRes.json();
        const ingredientCategories: IngredientCategory[] = await catRes.json();
        const netJson = await netRes.json();
        const minorJson = await minorRes.json();
        const ingJson = await ingRes.json();
        const sauceJson = await sauceRes.json();

        const seasoningL2Codes = new Set(
          ingredientCategories
            .flatMap((l1) => l1.children || [])
            .filter((l2) => l2.parentCode === "SEA" || l2.code === "GRA-SEA")
            .map((l2) => l2.code)
        );

        const allIngredients = ingJson.data || ingJson || [];
        const netIngredients = normalizeNetIngredients(netJson.data || netJson || []);
        const minorIngredients = normalizeNetIngredients(minorJson.data || minorJson || []);

        setRefs({
          categories: Array.isArray(categories) ? categories : categories.data || [],
          netIngredients,
          minorIngredients,
          seasonings: normalizeIngredients(
            allIngredients.filter((i: { l2Code?: string }) => seasoningL2Codes.has(i.l2Code || ""))
          ),
          sauces: normalizeSauces(sauceJson.data || sauceJson || []),
          ingredientCategories,
        });
      } catch {
        toast.error("获取参考数据失败");
      } finally {
        setLoading(false);
      }
    };
    fetchRefs();
  }, []);

  if (loading || !refs) {
    return (
      <div className="flex flex-col h-screen p-8 space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="flex flex-1 gap-6">
          <Skeleton className="flex-[60] h-full" />
          <Skeleton className="flex-[40] h-full" />
        </div>
      </div>
    );
  }

  return <DishForm mode="new" refs={refs} />;
}

function normalizeNetIngredients(items: unknown[]): IngredientOption[] {
  return items.map((item) => {
    const record = item as Record<string, unknown>;
    const sourceIngredient = record.sourceIngredient as Record<string, unknown> | undefined;
    return {
      id: Number(record.id),
      code: String(record.code || ""),
      name: String(record.name || ""),
      productName: String(sourceIngredient?.name || ""),
      spec: String(record.spec || ""),
      unitPrice: record.unitPrice != null ? Number(record.unitPrice) : null,
      unit: String(record.unit || "g"),
      l1Code: undefined,
      l2Code: String(record.l2Code || ""),
    };
  });
}

function normalizeIngredients(items: unknown[]): IngredientOption[] {
  return items.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      id: Number(record.id),
      code: String(record.code || ""),
      name: String(record.name || ""),
      productName: String(record.alias || ""),
      spec: String(record.purchaseSpec || ""),
      unitPrice: record.latestRefPrice != null ? Number(record.latestRefPrice) : null,
      unit: String(record.purchaseUnit || "g"),
      l1Code: undefined,
      l2Code: String(record.l2Code || ""),
    };
  });
}

function normalizeSauces(items: unknown[]): IngredientOption[] {
  return items.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      id: Number(record.id),
      code: String(record.code || ""),
      name: String(record.name || ""),
      productName: String(record.brand || ""),
      spec: String(record.spec || ""),
      unitPrice: record.unitPrice != null ? Number(record.unitPrice) : null,
      unit: String(record.unit || "g"),
    };
  });
}
