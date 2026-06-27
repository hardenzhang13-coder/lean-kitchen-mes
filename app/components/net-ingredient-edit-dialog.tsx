"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  NetIngredientFormFields,
  NetIngredientFormData,
  CategoryL1,
  RawIngredientOption,
} from "@/app/components/net-ingredient-form-fields";
import { toast } from "sonner";

export type NetIngredientEditItem = {
  id: number;
  name: string;
  spec: string | null;
  yieldRate: number | null;
  unitPrice: number;
  sourceIngredientId: number | null;
  l2Code: string;
};

interface NetIngredientEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "net" | "minor";
  initialData: NetIngredientEditItem | null;
  categories: CategoryL1[];
  rawIngredients: RawIngredientOption[];
  onSuccess?: () => void;
}

export function NetIngredientEditDialog({
  open,
  onOpenChange,
  mode = "net",
  initialData,
  categories,
  rawIngredients,
  onSuccess,
}: NetIngredientEditDialogProps) {
  const isMinor = mode === "minor";

  const [form, setForm] = useState<NetIngredientFormData>({
    name: "",
    l1Code: isMinor ? "MIN" : "",
    l2Code: "",
    sourceIngredientId: "",
    spec: "",
    yieldRate: "",
    unitPrice: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const findParentL1 = useCallback(
    (l2Code?: string) => {
      if (!l2Code) return undefined;
      return categories.find((cat) =>
        cat.children.some((child) => child.code === l2Code)
      );
    },
    [categories]
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || !initialData) return;
    const parentL1 = findParentL1(initialData.l2Code);
    setForm({
      name: initialData.name || "",
      l1Code: isMinor ? "MIN" : parentL1?.code || "",
      l2Code: initialData.l2Code || "",
      sourceIngredientId: initialData.sourceIngredientId
        ? String(initialData.sourceIngredientId)
        : "",
      spec: initialData.spec || "",
      yieldRate: initialData.yieldRate != null ? String(initialData.yieldRate) : "",
      unitPrice: String(initialData.unitPrice),
    });
    setErrors({});
  }, [open, initialData, findParentL1, isMinor]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleChange = (field: keyof NetIngredientFormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "l1Code" && !isMinor) {
        next.l2Code = "";
      }
      return next;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = `${isMinor ? "小料" : "净料"}名称不能为空`;
    if (!form.l2Code) next.l2Code = "请选择二级分类";

    if (!isMinor) {
      if (!form.sourceIngredientId) next.sourceIngredientId = "请选择来源原料";
      const yieldRate = Number(form.yieldRate);
      if (!form.yieldRate || yieldRate <= 0 || yieldRate > 100) {
        next.yieldRate = "出成率必须在 1-100 之间";
      }
    }

    if (form.unitPrice === "" || Number(form.unitPrice) < 0) {
      next.unitPrice = "请输入有效的单价";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !initialData) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        spec: form.spec.trim() || null,
        unitPrice: Number(form.unitPrice),
        l2Code: form.l2Code,
      };

      if (!isMinor) {
        payload.sourceIngredientId = Number(form.sourceIngredientId);
        payload.yieldRate = Number(form.yieldRate);
      } else {
        payload.unit = "10g";
      }

      const res = await fetch(`/api/net-ingredients/${initialData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "更新失败");
        return;
      }

      toast.success("更新成功");
      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast.error("更新出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">{isMinor ? "编辑小料" : "编辑净料"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 px-6 overflow-y-auto flex-1">
          <NetIngredientFormFields
            form={form}
            onChange={handleChange}
            categories={categories}
            rawIngredients={rawIngredients}
            mode={isMinor ? "minor" : "net"}
            readOnly={isMinor ? undefined : { l1Code: true, l2Code: true, sourceIngredientId: true }}
            errors={errors}
          />
        </div>

        <DialogFooter className="px-6 pt-0 pb-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 px-6"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="h-11 px-6"
          >
            <span aria-live="polite" className="inline-flex items-center">
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              保存
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
