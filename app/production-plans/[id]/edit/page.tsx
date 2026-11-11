"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProductionPlanForm } from "@/app/components/production-plan/production-plan-form";
import { parseObject } from "@/lib/client/api";
import { toast } from "sonner";

interface EditableProductionPlan {
  title: string;
  planDate: string;
  status: string;
  sourceSchedules: Array<{ id: number }>;
}

export default function EditProductionPlanPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const [data, setData] = useState<EditableProductionPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/production-plans/${id}`);
        const result = await parseObject<EditableProductionPlan>(res);
        if (!result) {
          toast.error("生产计划单不存在");
          router.push("/schedules?tab=plans");
          return;
        }
        if (result.status !== "待生效") {
          toast.error("只有待生效的生产计划单可以修改");
          router.push(`/production-plans/${id}`);
          return;
        }
        if (alive) setData(result);
      } catch {
        if (alive) toast.error("获取生产计划单失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    if (id) load();
    return () => {
      alive = false;
    };
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <div className="h-[200px] bg-muted rounded animate-pulse" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <ProductionPlanForm
      mode="edit"
      planId={id}
      initialTitle={data.title}
      initialPlanDate={data.planDate.slice(0, 10)}
      initialScheduleIds={data.sourceSchedules.map((schedule) => schedule.id)}
    />
  );
}
