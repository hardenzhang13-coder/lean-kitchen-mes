"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DishDetailView } from "@/app/components/dishes/dish-detail-view";
import { DishDetail } from "@/app/components/dish-form/types";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function DishDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dishId = Number(params.id);

  const [dish, setDish] = useState<DishDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDish = useCallback(async () => {
    const res = await fetch(`/api/dishes/${dishId}`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error || `获取菜品详情失败 (${res.status})`);
    }
    const data = json.data || json;
    if (!data || typeof data !== "object" || !data.id) {
      throw new Error("菜品不存在或已删除");
    }
    return data as DishDetail;
  }, [dishId]);

  useEffect(() => {
    if (Number.isNaN(dishId) || dishId <= 0) {
      toast.error("无效的菜品ID");
      router.push("/dishes");
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        const data = await fetchDish();
        if (controller.signal.aborted) return;
        setDish(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        toast.error(err instanceof Error ? err.message : "获取数据失败");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [dishId, router, fetchDish]);

  const handleRefresh = useCallback(() => {
    fetchDish()
      .then(setDish)
      .catch((err) => toast.error(err instanceof Error ? err.message : "刷新失败"));
  }, [fetchDish]);

  if (loading || !dish) {
    return (
      <div className="flex flex-col h-screen p-8 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <DishDetailView dish={dish} onRefresh={handleRefresh} />;
}
