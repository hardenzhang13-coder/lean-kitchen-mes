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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IngredientFormFields,
  IngredientFormData,
  CategoryL1,
  Unit,
} from "@/app/components/ingredient-form-fields";
import { getDefaultSpec } from "@/lib/spec-parser";
import { toast } from "sonner";

export type CreatedIngredient = {
  id: number;
  name: string;
  alias?: string | null;
  l2Code: string;
  stockUnit?: string | null;
  purchaseUnit?: string | null;
  purchaseSpec?: string | null;
};

type ListItem = {
  id: number;
  code?: string | null;
  name: string;
  alias?: string | null;
  purchaseSpec?: string | null;
  purchaseUnit?: string | null;
  stockUnit?: string | null;
  latestRefPrice?: number | string | null;
};

interface IngredientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    id?: number;
    code?: string;
    name?: string;
    l2Code?: string;
    alias?: string | null;
    purchaseSpec?: string | null;
    purchaseUnit?: string | null;
    stockUnit?: string | null;
    latestRefPrice?: number | null;
  };
  categories: CategoryL1[];
  units: Unit[];
  mode?: "ingredient" | "seasoning" | "auto";
  onSuccess: (data: CreatedIngredient) => void;
}

export function IngredientFormDialog({
  open,
  onOpenChange,
  initialData,
  categories,
  units,
  mode = "auto",
  onSuccess,
}: IngredientFormDialogProps) {
  const [form, setForm] = useState<IngredientFormData>({
    name: "",
    l1Code: "",
    l2Code: "",
    alias: "",
    purchaseSpec: "",
    purchaseUnit: "",
    latestRefPrice: "",
    stockUnit: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [l2Open, setL2Open] = useState(false);

  const [rightList, setRightList] = useState<ListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
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
    if (!open) return;
    const parentL1 = findParentL1(initialData?.l2Code);
    setForm({
      name: initialData?.name || "",
      l1Code: parentL1?.code || "",
      l2Code: initialData?.l2Code || "",
      alias: initialData?.alias || "",
      purchaseSpec: initialData?.purchaseSpec || "",
      purchaseUnit: initialData?.purchaseUnit || "",
      latestRefPrice:
        initialData?.latestRefPrice != null
          ? String(initialData.latestRefPrice)
          : "",
      stockUnit: initialData?.stockUnit || "",
    });
    setErrors({});
    setL2Open(false);
  }, [open, initialData, findParentL1]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || !form.l2Code) {
      setRightList([]);
      return;
    }
    const fetchList = async () => {
      setLoadingList(true);
      try {
        const res = await fetch(
          `/api/ingredients?l2Code=${encodeURIComponent(form.l2Code)}`
        );
        if (res.ok) {
          const json = await res.json();
          setRightList(Array.isArray(json) ? json : json.data || []);
        }
      } catch {
        // ignore
      } finally {
        setLoadingList(false);
      }
    };
    fetchList();
  }, [open, form.l2Code]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedL2 = (() => {
    if (!form.l2Code) return undefined;
    for (const l1 of categories) {
      const l2 = l1.children.find((c) => c.code === form.l2Code);
      if (l2) return { ...l2, parentName: l1.name };
    }
    return undefined;
  })();

  const isSeasoning =
    mode === "seasoning" ||
    (mode === "auto" &&
      (selectedL2?.name === "调料" || selectedL2?.parentName === "调味品"));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "名称不能为空";
    if (!form.l2Code) next.l2Code = "请选择二级分类";
    if (isSeasoning && !form.alias.trim())
      next.alias = "调料必须填写商品名称";
    if (!form.purchaseSpec.trim()) next.purchaseSpec = "采购规格不能为空";
    if (!form.purchaseUnit.trim()) next.purchaseUnit = "请选择采购单位";
    if (!form.stockUnit.trim()) next.stockUnit = "请选择入库单位";
    if (form.latestRefPrice && Number(form.latestRefPrice) < 0)
      next.latestRefPrice = "最新参照单价不能为负数";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const ensureDefaultSpec = (spec: string, stockUnit: string) => {
    if (spec.trim()) return spec.trim();
    return getDefaultSpec(stockUnit);
  };

  const handleChange = (field: keyof IngredientFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const dupRes = await fetch(
      `/api/ingredients/check-name?name=${encodeURIComponent(form.name.trim())}` +
        (initialData?.id ? `&excludeId=${initialData.id}` : "")
    );
    const dupData = await dupRes.json();
    if (dupData.exists) {
      toast.error("食材名称已存在");
      return;
    }

    setSubmitting(true);
    try {
      const price = form.latestRefPrice ? Number(form.latestRefPrice) : null;
      const spec = ensureDefaultSpec(form.purchaseSpec, form.stockUnit);
      const payload = {
        name: form.name.trim(),
        alias: form.alias.trim() || undefined,
        l2Code: form.l2Code,
        purchaseSpec: spec,
        purchaseUnit: form.purchaseUnit,
        stockUnit: form.stockUnit,
        ...(price != null && { latestRefPrice: price }),
      };

      const res = await fetch(
        initialData?.id
          ? `/api/ingredients/${initialData.id}`
          : "/api/ingredients",
        {
          method: initialData?.id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || data.message || "保存失败");
        return;
      }

      const result = data.data || data || {};
      toast.success(initialData?.id ? "更新成功" : "创建成功");
      onSuccess({
        id: result.id,
        name: result.name,
        alias: result.alias,
        l2Code: result.l2Code,
        stockUnit: result.stockUnit,
        purchaseUnit: result.purchaseUnit,
        purchaseSpec: result.purchaseSpec,
      });
      onOpenChange(false);
    } catch {
      toast.error("保存出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-w-[calc(100%-4rem)] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">
            {initialData?.id ? "编辑食材" : "新增食材"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-6 py-4 px-6 overflow-y-auto flex-1 min-h-0">
          <div className="flex-1 space-y-4 min-w-0">
            <IngredientFormFields
              form={form}
              onChange={handleChange}
              errors={errors}
              categories={categories}
              units={units}
              mode={mode}
              l2Open={l2Open}
              onL2OpenChange={setL2Open}
            />
          </div>

          <div className="lg:w-[520px] flex flex-col min-h-0 border rounded-md p-4">
            <h4 className="text-sm font-semibold text-muted-foreground mb-3">
              该分类下已添加的食材
            </h4>
            <div className="flex-1 overflow-auto rounded-md border">
              {loadingList ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rightList.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">暂无数据</p>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="whitespace-nowrap">名称</TableHead>
                      <TableHead className="whitespace-nowrap">商品名称</TableHead>
                      <TableHead className="whitespace-nowrap">采购规格</TableHead>
                      <TableHead className="whitespace-nowrap">采购单位</TableHead>
                      <TableHead className="whitespace-nowrap">入库单位</TableHead>
                      <TableHead className="whitespace-nowrap">最新参照单价</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rightList.map((row: ListItem) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-sm whitespace-nowrap">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.alias || "—"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.purchaseSpec || "—"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.purchaseUnit || "—"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.stockUnit || "—"}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {row.latestRefPrice != null
                            ? `¥${Number(row.latestRefPrice).toFixed(2)}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
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
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
