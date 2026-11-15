"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { ScheduleForm, type ScheduleFormDish } from "@/app/components/schedule/schedule-form";
import { EmptyState } from "@/app/components/ui/empty-state";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PageShell } from "@/app/components/ui/page-shell";
import { FileStack } from "lucide-react";
import { parseObject } from "@/lib/client/api";

interface ScheduleForEdit {
  status: string;
  title: string;
  scheduleDate: string;
  storeId?: number;
  store?: { id: number; name: string } | null;
  items: Array<{
    dishId: number;
    quantity: number;
    dish: {
      name: string;
      code: string;
      portion?: string;
      meatType?: string | null;
      price?: number | null;
      category?: { name: string } | null;
    };
  }>;
}

export default function EditSchedulePage() {
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [initial, setInitial] = useState<{
    date: string;
    storeId: number | null;
    items: ScheduleFormDish[];
  } | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/schedules/${id}`);
        const data = await parseObject<ScheduleForEdit>(res);
        if (!data) {
          if (alive) {
            toast.error("排程不存在");
            setBlocked(true);
          }
          return;
        }
        if (data.status !== "待生效") {
          if (alive) {
            toast.error("只有待生效的排程可以修改");
            router.push(`/schedules/${id}`);
          }
          return;
        }
        if (!alive) return;
        setInitial({
          date: data.scheduleDate.slice(0, 10),
          storeId: data.store?.id ?? data.storeId ?? null,
          items: data.items.map((item) => ({
            dishId: item.dishId,
            quantity: item.quantity,
            name: item.dish.name,
            code: item.dish.code,
            categoryName: item.dish.category?.name ?? "",
            portion: item.dish.portion ?? null,
            meatType: item.dish.meatType ?? null,
            price: item.dish.price ?? null,
          })),
        });
      } catch {
        if (alive) {
          toast.error("获取排程数据失败");
          setBlocked(true);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [id, router]);

  if (loading) {
    return (
      <PageShell>
        <LoadingState type="page" />
      </PageShell>
    );
  }

  if (blocked || !initial) {
    return (
      <PageShell>
        <EmptyState
          icon={FileStack}
          title="无法修改这张排程"
          description="排程可能已被删除，或当前状态不允许修改。"
          action={{ label: "返回排程列表", onClick: () => router.push("/schedules") }}
        />
      </PageShell>
    );
  }

  return (
    <ScheduleForm
      mode="edit"
      scheduleId={id}
      backHref={`/schedules/${id}`}
      initialDate={initial.date}
      initialStoreId={initial.storeId}
      initialItems={initial.items}
    />
  );
}
