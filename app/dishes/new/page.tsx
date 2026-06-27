"use client";

import { useEffect, useState } from "react";
import { DishForm } from "@/app/components/dish-form";
import { DishFormRefs } from "@/app/components/dish-form/types";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function NewDishPage() {
  const [refs, setRefs] = useState<DishFormRefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRefs = async () => {
      try {
        const [cRes, catRes] = await Promise.all([
          fetch("/api/dish-categories"),
          fetch("/api/ingredient-categories"),
        ]);

        const checkJson = async (res: Response, label: string) => {
          if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`${label}失败 (${res.status}): ${text || res.statusText}`);
          }
          try {
            return await res.json();
          } catch {
            throw new Error(`${label}返回格式错误`);
          }
        };

        const [categories, ingredientCategories] = await Promise.all([
          checkJson(cRes, "获取菜品分类"),
          checkJson(catRes, "获取食材分类"),
        ]);

        setRefs({
          categories: Array.isArray(categories) ? categories : categories.data || [],
          ingredientCategories: Array.isArray(ingredientCategories)
            ? ingredientCategories
            : ingredientCategories.data || [],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "获取参考数据失败";
        toast.error(message);
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
