"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PackageOpen, Pencil } from "lucide-react";
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
  NetIngredientFormFields,
  NetIngredientFormData,
  CategoryL1,
  RawIngredientOption,
} from "@/app/components/net-ingredient-form-fields";
import { EmptyState } from "@/app/components/empty-state";
import { LoadingState } from "@/app/components/loading-state";
import { parseList } from "@/app/lib/api";
import { toast } from "sonner";

export type NetIngredientItem = {
  id: number;
  code: string;
  name: string;
  spec: string | null;
  yieldRate: number | null;
  unitPrice: number;
  unit: string;
  sourceIngredientId: number | null;
  l2Code: string;
};

interface NetIngredientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "net" | "minor" | "convert";
  sourceIngredientId?: number;
  initialData?: NetIngredientItem;
  categories: CategoryL1[];
  rawIngredients: RawIngredientOption[];
  onSuccess?: () => void;
}

const emptyForm: NetIngredientFormData = {
  name: "",
  l1Code: "",
  l2Code: "",
  sourceIngredientId: "",
  spec: "",
  yieldRate: "",
  unitPrice: "",
};

export function NetIngredientFormDialog({
  open,
  onOpenChange,
  mode = "net",
  sourceIngredientId: propSourceId,
  initialData,
  categories,
  rawIngredients,
  onSuccess,
}: NetIngredientFormDialogProps) {
  const [form, setForm] = useState<NetIngredientFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [rightList, setRightList] = useState<NetIngredientItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const unitPriceManuallySet = useRef(false);

  const isMinor = mode === "minor";
  const isConvert = mode === "convert";

  const findParentL1 = useCallback(
    (l2Code?: string) => {
      if (!l2Code) return undefined;
      return categories.find((cat) =>
        cat.children.some((child) => child.code === l2Code)
      );
    },
    [categories]
  );

  const getRawIngredient = useCallback(
    (id?: number) => {
      if (!id) return undefined;
      return rawIngredients.find((ri) => ri.id === id);
    },
    [rawIngredients]
  );

  // Initialize form when dialog opens or props change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;

    unitPriceManuallySet.current = false;

    if (initialData) {
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
      return;
    }

    if (isConvert && propSourceId) {
      const raw = getRawIngredient(propSourceId);
      const parentL1 = raw ? findParentL1(raw.l2Code) : undefined;
      setForm({
        ...emptyForm,
        l1Code: parentL1?.code || "",
        l2Code: raw?.l2Code || "",
        sourceIngredientId: String(propSourceId),
      });
      return;
    }

    if (isMinor) {
      setForm({ ...emptyForm, l1Code: "MIN" });
      return;
    }

    // 新增净料：默认选中第一个一级分类与二级分类
    const firstL1 = categories[0];
    const firstL2 = firstL1?.children[0];
    setForm({
      ...emptyForm,
      l1Code: firstL1?.code || "",
      l2Code: firstL2?.code || "",
    });
  }, [open, initialData, isConvert, isMinor, propSourceId, findParentL1, getRawIngredient, categories]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Auto-calculate unit price (net mode only)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || isMinor) return;
    if (unitPriceManuallySet.current) return;

    const sourceId = Number(form.sourceIngredientId);
    const yieldRate = Number(form.yieldRate);
    if (!sourceId || !yieldRate || yieldRate <= 0 || yieldRate > 100) {
      return;
    }

    const raw = getRawIngredient(sourceId);
    const price = raw?.latestRefPrice ?? null;
    if (price == null || price === 0) return;

    const calculated = Number((Number(price) / (yieldRate / 100)).toFixed(2));
    setForm((prev) =>
      prev.unitPrice !== String(calculated)
        ? { ...prev, unitPrice: String(calculated) }
        : prev
    );
  }, [open, isMinor, form.sourceIngredientId, form.yieldRate, getRawIngredient]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load right-side list (net/convert mode only)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || isMinor) return;
    const sourceId = Number(form.sourceIngredientId);
    if (!sourceId) {
      setRightList([]);
      return;
    }

    const fetchList = async () => {
      setLoadingList(true);
      try {
        const res = await fetch(
          `/api/net-ingredients?sourceIngredientId=${sourceId}`
        );
        if (res.ok) {
          const list = await parseList<NetIngredientItem>(res);
          setRightList(list);
        }
      } catch {
        // ignore
      } finally {
        setLoadingList(false);
      }
    };

    fetchList();
  }, [open, isMinor, form.sourceIngredientId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleChange = (field: keyof NetIngredientFormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "l1Code" && !isMinor) {
        next.l2Code = "";
      }
      return next;
    });

    if (field === "unitPrice") {
      unitPriceManuallySet.current = true;
    }

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

  const resetForCreate = () => {
    unitPriceManuallySet.current = false;
    if (isMinor) {
      setForm({ ...emptyForm, l1Code: "MIN" });
    } else {
      const firstL1 = categories[0];
      const firstL2 = firstL1?.children[0];
      setForm({
        ...emptyForm,
        l1Code: firstL1?.code || "",
        l2Code: firstL2?.code || "",
      });
    }
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validate()) return;

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

      const url = initialData?.id
        ? `/api/net-ingredients/${initialData.id}`
        : "/api/net-ingredients";
      const method = initialData?.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "保存失败");
        return;
      }

      toast.success(initialData?.id ? "更新成功" : "创建成功");

      if (initialData?.id || isMinor || isConvert) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        resetForCreate();
        const sourceId = Number(form.sourceIngredientId);
        if (sourceId) {
          setLoadingList(true);
          try {
            const listRes = await fetch(
              `/api/net-ingredients?sourceIngredientId=${sourceId}`
            );
            if (listRes.ok) {
              const json = await listRes.json();
              setRightList(json.data || []);
            }
          } finally {
            setLoadingList(false);
          }
        }
      }
    } catch {
      toast.error("保存出错");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditFromList = (row: NetIngredientItem) => {
    const parentL1 = findParentL1(row.l2Code);
    unitPriceManuallySet.current = true;
    setForm({
      name: row.name || "",
      l1Code: isMinor ? "MIN" : parentL1?.code || "",
      l2Code: row.l2Code || "",
      sourceIngredientId: row.sourceIngredientId ? String(row.sourceIngredientId) : "",
      spec: row.spec || "",
      yieldRate: row.yieldRate != null ? String(row.yieldRate) : "",
      unitPrice: String(row.unitPrice),
    });
  };

  const dialogTitle = useMemo(() => {
    if (isMinor && initialData?.id) return "编辑小料";
    if (isMinor) return "新增小料";
    if (initialData?.id) return "编辑净料";
    if (isConvert) return "转净料";
    return "新增净料";
  }, [isMinor, initialData, isConvert]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isMinor
            ? "sm:max-w-[640px] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]"
            : "sm:max-w-[1200px] max-w-[calc(100%-4rem)] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]"
        }
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div
          className={
            isMinor
              ? "space-y-4 py-4 px-6 overflow-y-auto flex-1"
              : "flex flex-col lg:flex-row gap-6 py-4 px-6 overflow-y-auto flex-1 min-h-0"
          }
        >
          <div className={isMinor ? "" : "flex-1 space-y-4 min-w-0"}>
            <NetIngredientFormFields
              form={form}
              onChange={handleChange}
              categories={categories}
              rawIngredients={rawIngredients}
              mode={isMinor ? "minor" : "net"}
              readOnly={
                isConvert
                  ? {
                      l1Code: true,
                      l2Code: true,
                      sourceIngredientId: true,
                    }
                  : undefined
              }
              errors={errors}
            />
          </div>

          {!isMinor && (
            <div className="lg:w-[680px] flex flex-col min-h-0 rounded-lg border bg-card">
              <div className="px-4 py-3 border-b">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  已创建的净料规格
                </h4>
              </div>
              <div className="flex-1 overflow-auto">
                {loadingList ? (
                  <LoadingState type="table" rows={5} cols={7} />
                ) : rightList.length === 0 ? (
                  <EmptyState
                    icon={PackageOpen}
                    title="暂无净料"
                    description="该原料尚未创建净料规格"
                  />
                ) : (
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="whitespace-nowrap">编号</TableHead>
                        <TableHead className="whitespace-nowrap">名称</TableHead>
                        <TableHead className="whitespace-nowrap">规格</TableHead>
                        <TableHead className="whitespace-nowrap">出成率</TableHead>
                        <TableHead className="whitespace-nowrap">净料单价</TableHead>
                        <TableHead className="whitespace-nowrap">单位</TableHead>
                        <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rightList.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-sm whitespace-nowrap font-medium">
                            {row.code}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.spec || "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.yieldRate != null ? `${row.yieldRate}%` : "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            ¥{Number(row.unitPrice).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="编辑"
                              onClick={() => handleEditFromList(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
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
