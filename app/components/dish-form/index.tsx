"use client";

import { useState, useMemo, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
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
  totalBomCost,
  validatePublish,
  validateForSave,
  normalizeNetIngredients,
  normalizeSeasoningProducts,
} from "./types";
import { toast } from "sonner";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";

interface DishFormProps {
  mode: "new" | "edit";
  initialDish?: DishDetail | null;
  refs: DishFormRefs;
  onSaved?: () => void;
}

export function DishForm({ mode, initialDish, refs, onSaved }: DishFormProps) {
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState(initialDish?.status || "draft");
  const [lastDishId, setLastDishId] = useState<number | null>(initialDish?.id ?? null);
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [confirmUnpublishOpen, setConfirmUnpublishOpen] = useState(false);
  const isReadOnly = localStatus !== "draft";

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

  // 成本估算：优先取当前 BOM 明细合计，BOM 为空时回退到服务端已存成本
  const bomCostEstimate = useMemo(() => totalBomCost(bom), [bom]);
  const currentCost = bomCostEstimate > 0 ? bomCostEstimate : (initialDish?.cost ?? null);

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
    if (l1Code) query.set("l1Code", l1Code);
    if (q) query.set("q", q);
    // 选择弹窗按分类一次性取回该分类下的全部食材，弹窗内做客户端分页
    query.set("pageSize", "100");

    let url: string;
    let normalizeFn: (items: unknown[]) => IngredientOption[];

    // 酱料机制已业务剥离：存量 BOM 行只读透传，选择入口不再打开 sauce 弹窗
    if (type === "seasoning") {
      // 调料一律选产物（单品/复合/成品酱料同构），选中后按克需求、出库价计成本
      url = `/api/seasoning-products?${query.toString()}`;
      normalizeFn = normalizeSeasoningProducts;
    } else {
      url = `/api/net-ingredients?${query.toString()}`;
      normalizeFn = normalizeNetIngredients;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error("加载原料失败");
    const json = await res.json();
    const data = Array.isArray(json) ? json : json.data || [];
    return normalizeFn(data);
  }, []);

  const saveBasicInfo = async (dishId: number) => {
    const body = {
      name: form.name,
      intro: form.intro || undefined,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      cuisine: form.cuisine || undefined,
      technique: form.technique || undefined,
      taste: form.taste || undefined,
      portion: form.portion || "单人份",
      season: form.season || "四季",
      meatType: form.meatType || undefined,
      price: form.price ? Number(form.price) : null,
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

  const changeStatus = async (
    dishId: number,
    action: "publish" | "unpublish" | "deactivate" | "restore"
  ) => {
    const res = await fetch(`/api/dishes/${dishId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "状态更新失败");
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
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        cuisine: form.cuisine || undefined,
        technique: form.technique || undefined,
        taste: form.taste || undefined,
        portion: form.portion || "单人份",
        season: form.season || "四季",
        meatType: form.meatType || undefined,
        price: form.price ? Number(form.price) : null,
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
      await changeStatus(dishId, "publish");
    }
    return dishId;
  };

  const updateDish = async (status: "draft" | "published") => {
    if (!initialDish) throw new Error("编辑模式缺少菜品 ID");
    const dishId = initialDish.id;
    await saveBom(dishId);
    await saveProcesses(dishId);
    await saveBasicInfo(dishId);
    if (status === "published") {
      await changeStatus(dishId, "publish");
    }
    return dishId;
  };

  const handleSave = async () => {
    const error = validateForSave(form, currentCost, bom);
    if (error) {
      toast.error(error);
      return;
    }
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

    const error = validatePublish(form, bom, currentCost);
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
      router.push("/dishes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpublish = async () => {
    const dishId = lastDishId;
    if (!dishId) return;
    setConfirmUnpublishOpen(false);
    setSubmitting(true);
    try {
      await changeStatus(dishId, "unpublish");
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
      <div className="skeu-surface flex items-center justify-between px-8 py-4 border-b shrink-0">
        <SkeuButton variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </SkeuButton>
        <div className="flex items-center gap-2">
          {isReadOnly ? (
            <SkeuButton variant="outline" onClick={() => setConfirmUnpublishOpen(true)} disabled={submitting}>
              下架
            </SkeuButton>
          ) : (
            <>
              <SkeuButton
                variant="outline"
                onClick={handleSave}
                disabled={submitting}
              >
                保存草稿
              </SkeuButton>
              <SkeuButton
                variant="primary"
                onClick={() => {
                  const error = validatePublish(form, bom, currentCost);
                  if (error) {
                    toast.error(error);
                    return;
                  }
                  setConfirmPublishOpen(true);
                }}
                disabled={submitting}
              >
                发布
              </SkeuButton>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[40] min-w-[380px] max-w-[520px] overflow-y-auto p-4 border-r [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <BasicInfoPanel data={form} onChange={setForm} categories={refs.categories} cost={currentCost} readOnly={isReadOnly} />
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
<AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">确认发布</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要发布菜品「{form.name || "未命名"}」吗？发布后将锁定基础信息、菜品用料与加工工艺，不可再修改。
          </p>
          <DialogFooter>
            <SkeuButton variant="outline" onClick={() => setConfirmPublishOpen(false)}>
              取消
            </SkeuButton>
            <SkeuButton variant="primary" onClick={handlePublishConfirm}>
              发布
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <Dialog open={confirmUnpublishOpen} onOpenChange={setConfirmUnpublishOpen}>
        <AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">确认下架</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要下架菜品「{form.name || "未命名"}」吗？下架后回到草稿可重新编辑，新建排程不再可选，历史排程与切配计划不受影响。
          </p>
          <DialogFooter>
            <SkeuButton variant="outline" onClick={() => setConfirmUnpublishOpen(false)}>
              取消
            </SkeuButton>
            <SkeuButton variant="primary" onClick={handleUnpublish} disabled={submitting}>
              下架
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
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
    portion: "单人份",
    season: "四季",
    meatType: "",
    price: "",
  };
}
