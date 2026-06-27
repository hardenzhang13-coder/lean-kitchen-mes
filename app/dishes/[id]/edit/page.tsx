"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DishForm } from "@/app/components/dish-form";
import { DishDetail, DishFormRefs } from "@/app/components/dish-form/types";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function EditDishPage() {
  const params = useParams();
  const router = useRouter();
  const dishId = Number(params.id);

  const [dish, setDish] = useState<DishDetail | null>(null);
  const [refs, setRefs] = useState<DishFormRefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (Number.isNaN(dishId) || dishId <= 0) {
      toast.error("无效的菜品ID");
      router.push("/dishes");
      return;
    }

    const controller = new AbortController();
    const fetchAll = async () => {
      try {
        const [dishRes, cRes, catRes] = await Promise.all([
          fetch(`/api/dishes/${dishId}`, { signal: controller.signal }),
          fetch("/api/dish-categories", { signal: controller.signal }),
          fetch("/api/ingredient-categories", { signal: controller.signal }),
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

        const [dishJson, categories, ingredientCategories] = await Promise.all([
          checkJson(dishRes, "获取菜品详情"),
          checkJson(cRes, "获取菜品分类"),
          checkJson(catRes, "获取食材分类"),
        ]);

        if (controller.signal.aborted) return;

        const dishData = dishJson.data || dishJson;
        if (!dishData || typeof dishData !== "object" || !dishData.id) {
          toast.error("菜品不存在或已删除");
          router.push("/dishes");
          return;
        }

        setDish(dishData);
        setRefs({
          categories: Array.isArray(categories) ? categories : categories.data || [],
          ingredientCategories: Array.isArray(ingredientCategories)
            ? ingredientCategories
            : ingredientCategories.data || [],
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : "获取数据失败";
        toast.error(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchAll();
    return () => controller.abort();
  }, [dishId, router]);

  if (loading || !refs || !dish) {
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

  return <DishForm mode="edit" initialDish={dish} refs={refs} />;
}
