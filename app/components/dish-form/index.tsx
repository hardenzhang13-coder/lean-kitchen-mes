"use client";

import { useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BasicInfoPanel } from "./basic-info-panel";
import { BomEditor } from "./bom-editor";
import { ProcessEditor } from "./process-editor";
import {
  DishFormData,
  DishDetail,
  BomItem,
  ProcessStep,
  DishFormRefs,
  emptyBom,
  dishToFormData,
  dishToBom,
  dishToProcesses,
  bomToPayload,
  validatePublish,
} from "./types";
import { toast } from "sonner";

interface DishFormProps {
  mode: "new" | "edit";
  initialDish?: DishDetail | null;
  refs: DishFormRefs;
  onSaved?: () => void;
}

export function DishForm({ mode, initialDish, refs, onSaved }: DishFormProps) {
  const router = useRouter();
  const isPublished = initialDish?.status === "published";

  const [form, setForm] = useState<DishFormData>(() =>
    initialDish ? dishToFormData(initialDish) : defaultFormData()
  );
  const [bom, setBom] = useState<Record<"main" | "support" | "minor" | "seasoning" | "sauce", BomItem[]>>(() =>
    initialDish ? dishToBom(initialDish, refs) : emptyBom()
  );
  const [processes, setProcesses] = useState<ProcessStep[]>(() =>
    initialDish ? dishToProcesses(initialDish) : []
  );
  const [submitting, setSubmitting] = useState(false);

  const objectOptions = useMemo(() => {
    const names = new Set<string>();
    bom.main.forEach((i) => names.add(i.name));
    bom.support.forEach((i) => names.add(i.name));
    return Array.from(names);
  }, [bom.main, bom.support]);

  const handleBack = () => {
    router.push("/dishes");
  };

  const saveBasicInfo = async (dishId: number, status: "draft" | "published") => {
    const body = {
      name: form.name,
      intro: form.intro || undefined,
      categoryId: Number(form.categoryId),
      cuisine: form.cuisine || undefined,
      technique: form.technique || undefined,
      taste: form.taste || undefined,
      portion: form.portion || "正餐份量",
      season: form.season || "四季",
      meatType: form.meatType || undefined,
      status,
    };
    const res = await fetch(`/api/dishes/${dishId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "保存基础信息失败");
    }
  };

  const saveBom = async (dishId: number) => {
    const payload = bomToPayload(bom);
    const res = await fetch(`/api/dishes/${dishId}/bom`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "保存 BOM 失败");
    }
  };

  const saveProcesses = async (dishId: number) => {
    const res = await fetch(`/api/dishes/${dishId}/processes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ processes }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "保存加工工艺失败");
    }
  };

  const createDish = async (status: "draft" | "published") => {
    const res = await fetch("/api/dishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        intro: form.intro || undefined,
        categoryId: Number(form.categoryId),
        cuisine: form.cuisine || undefined,
        technique: form.technique || undefined,
        taste: form.taste || undefined,
        portion: form.portion || "正餐份量",
        season: form.season || "四季",
        meatType: form.meatType || undefined,
        status: "draft",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "创建菜品失败");
    }
    const json = await res.json();
    const dishId = json.data?.id ?? json.id;
    if (!dishId) throw new Error("创建菜品后未返回 ID");
    await saveBom(dishId);
    await saveProcesses(dishId);
    if (status === "published") {
      await saveBasicInfo(dishId, "published");
    }
    return dishId;
  };

  const updateDish = async (status: "draft" | "published") => {
    if (!initialDish) throw new Error("编辑模式缺少菜品 ID");
    const dishId = initialDish.id;
    await saveBasicInfo(dishId, status);
    await saveBom(dishId);
    await saveProcesses(dishId);
    return dishId;
  };

  const handleSave = async (targetStatus: "draft" | "published") => {
    if (targetStatus === "published") {
      const error = validatePublish(form, bom, processes);
      if (error) {
        toast.error(error);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "new") {
        await createDish(targetStatus);
      } else {
        await updateDish(targetStatus);
      }
      toast.success(targetStatus === "published" ? "发布成功" : "保存草稿成功");
      onSaved?.();
      router.push("/dishes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpublish = async () => {
    if (!initialDish) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/dishes/${initialDish.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "下架失败");
      }
      toast.success("已下架");
      onSaved?.();
      router.push("/dishes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "下架失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Top action bar */}
      <div className="flex items-center justify-between px-8 py-4 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          返回列表
        </Button>
        <div className="flex items-center gap-2">
          {isPublished ? (
            <Button variant="default" className="h-10" onClick={handleUnpublish} disabled={submitting}>
              下架
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-10"
                onClick={() => handleSave("draft")}
                disabled={submitting}
              >
                保存草稿
              </Button>
              <Button className="h-10" onClick={() => handleSave("published")} disabled={submitting}>
                发布
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[40] min-w-[380px] max-w-[520px] overflow-y-auto p-6 border-r">
          <BasicInfoPanel data={form} onChange={setForm} categories={refs.categories} readOnly={isPublished} />
        </div>
        <div className="flex-[60] overflow-y-auto p-6 space-y-6 bg-muted/20">
          <BomEditor bom={bom} onChange={setBom} refs={refs} readOnly={isPublished} />
          <ProcessEditor
            processes={processes}
            objectOptions={objectOptions}
            onChange={setProcesses}
            readOnly={isPublished}
          />
        </div>
      </div>
    </div>
  );
}

function defaultFormData(): DishFormData {
  return {
    name: "",
    intro: "",
    categoryId: "",
    cuisine: "",
    technique: "",
    taste: "",
    portion: "正餐份量",
    season: "四季",
    meatType: "",
  };
}
