"use client";

import { useState, useMemo, useCallback } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { BasicInfoPanel } from "./basic-info-panel";
import { BomEditor } from "./bom-editor";
import { ProcessEditor } from "./process-editor";
import {
  BomType,
  DishFormData,
  DishDetail,
  BomItem,
  IngredientOption,
  ProcessStep,
  DishFormRefs,
  emptyBom,
  dishToFormData,
  dishToBom,
  dishToProcesses,
  bomToPayload,
  validatePublish,
  validateDishDetailForPublish,
  normalizeNetIngredients,
  normalizeIngredients,
  normalizeSauces,
} from "./types";
import { toast } from "sonner";

interface DishFormProps {
  mode: "new" | "edit" | "view";
  initialDish?: DishDetail | null;
  refs: DishFormRefs;
  onSaved?: () => void;
}

export function DishForm({ mode, initialDish, refs, onSaved }: DishFormProps) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState(initialDish?.status || "draft");
  const [lastDishId, setLastDishId] = useState<number | null>(initialDish?.id ?? null);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const isReadOnly = localStatus === "published" || mode === "view";

  const [form, setForm] = useState<DishFormData>(() =>
    initialDish ? dishToFormData(initialDish) : defaultFormData()
  );
  const [bom, setBom] = useState<Record<"main" | "support" | "minor" | "seasoning" | "sauce", BomItem[]>>(() =>
    initialDish ? dishToBom(initialDish) : emptyBom()
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

  const handleLoadItems = useCallback(async (params: {
    type: BomType;
    l1Code?: string;
    l2Code?: string;
    q?: string;
  }): Promise<IngredientOption[]> => {
    const { type, l1Code, l2Code, q } = params;
    const query = new URLSearchParams();
    if (l2Code) query.set("l2Code", l2Code);
    if (q) query.set("q", q);

    let url: string;
    let normalizeFn: (items: unknown[]) => IngredientOption[];

    if (type === "sauce") {
      url = `/api/sauce-ingredients?${query.toString()}`;
      normalizeFn = normalizeSauces;
    } else if (type === "seasoning") {
      url = `/api/ingredients?${query.toString()}`;
      normalizeFn = normalizeIngredients;
    } else {
      if (l1Code) query.set("l1Code", l1Code);
      if (type === "main" || type === "support") {
        if (!l1Code && !l2Code && !q) query.set("excludeMinor", "true");
      }
      url = `/api/net-ingredients?${query.toString()}`;
      normalizeFn = normalizeNetIngredients;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error("加载原料失败");
    const json = await res.json();
    const data = Array.isArray(json) ? json : json.data || [];
    return normalizeFn(data);
  }, []);

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
    await saveBom(dishId);
    await saveProcesses(dishId);
    await saveBasicInfo(dishId, status);
    return dishId;
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const dishId = mode === "new" ? await createDish("draft") : await updateDish("draft");
      setLastDishId(dishId);
      toast.success("保存草稿成功");
      onSaved?.();
      router.push("/dishes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishConfirm = async () => {
    setConfirmPublishOpen(false);

    if (mode === "view" && lastDishId) {
      setSubmitting(true);
      try {
        const detailRes = await fetch(`/api/dishes/${lastDishId}`);
        if (!detailRes.ok) {
          const data = await detailRes.json().catch(() => ({}));
          throw new Error(data.error || "获取菜品详情失败");
        }
        const detailJson = await detailRes.json();
        const dishData = detailJson.data || detailJson;
        const error = validateDishDetailForPublish(dishData);
        if (error) {
          toast.error(error);
          setSubmitting(false);
          return;
        }
        const res = await fetch(`/api/dishes/${lastDishId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "发布失败");
        }
        toast.success("发布成功");
        setLocalStatus("published");
        onSaved?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "发布失败");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const error = validatePublish(form, bom);
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      const dishId = mode === "new" ? await createDish("published") : await updateDish("published");
      setLastDishId(dishId);
      toast.success("发布成功");
      onSaved?.();
      router.push(`/dishes/${dishId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpublish = async () => {
    const dishId = lastDishId;
    if (!dishId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/dishes/${dishId}`, {
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
      setLocalStatus("draft");
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
          {mode === "view" ? (
            <>
              {localStatus === "published" ? (
                <Button
                  variant="secondary"
                  className="h-10"
                  onClick={handleUnpublish}
                  disabled={submitting}
                >
                  下架
                </Button>
              ) : (
                <Button
                  className="h-10"
                  onClick={() => {
                    const error = validatePublish(form, bom);
                    if (error) {
                      toast.error(error);
                      return;
                    }
                    setConfirmPublishOpen(true);
                  }}
                  disabled={submitting}
                >
                  发布
                </Button>
              )}
              <Button
                variant="outline"
                className="h-10"
                onClick={() => router.push(`/dishes/${lastDishId}/edit`)}
                disabled={submitting || !lastDishId}
              >
                <Pencil className="mr-1 h-4 w-4" />
                编辑
              </Button>
            </>
          ) : isReadOnly ? (
            <Button variant="default" className="h-10" onClick={handleUnpublish} disabled={submitting}>
              下架
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-10"
                onClick={handleSave}
                disabled={submitting}
              >
                保存草稿
              </Button>
              <Button
                className="h-10"
                onClick={() => {
                  const error = validatePublish(form, bom);
                  if (error) {
                    toast.error(error);
                    return;
                  }
                  setConfirmPublishOpen(true);
                }}
                disabled={submitting}
              >
                发布
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[40] min-w-[380px] max-w-[520px] overflow-y-auto p-6 border-r">
          <BasicInfoPanel data={form} onChange={setForm} categories={refs.categories} readOnly={isReadOnly} />
        </div>
        <div className="flex-[60] overflow-y-auto p-6 space-y-6 bg-muted/20">
          <BomEditor bom={bom} onChange={setBom} refs={refs} onLoadItems={handleLoadItems} readOnly={isReadOnly} />
          <ProcessEditor
            processes={processes}
            objectOptions={objectOptions}
            onChange={setProcesses}
            readOnly={isReadOnly}
          />
        </div>
      </div>

      <Dialog open={confirmPublishOpen} onOpenChange={setConfirmPublishOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg">确认发布</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要发布菜品「{form.name || "未命名"}」吗？发布后将锁定基础信息、菜品用料与加工工艺，不可再修改。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPublishOpen(false)} className="h-11 px-6">
              取消
            </Button>
            <Button onClick={handlePublishConfirm} className="h-11 px-6">
              确认发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
