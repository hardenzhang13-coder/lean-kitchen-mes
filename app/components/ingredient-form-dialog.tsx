"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FormField, FormSection } from "@/app/components/form-field";
import { TileSelect } from "@/app/components/tile-select";
import { SearchableSelect } from "./searchable-select";
import { getDefaultSpec } from "@/lib/spec-parser";
import { toast } from "sonner";

type CategoryL1 = {
  code: string;
  name: string;
  children: { code: string; name: string }[];
};

type Unit = {
  id: number;
  name: string;
  category: string;
};

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
  const [form, setForm] = useState({
    name: "",
    l1Code: "",
    l2Code: "",
    alias: "",
    purchaseSpec: "",
    purchaseUnit: "",
    latestRefPrice: "",
    stockUnit: "",
  });

  const [rightList, setRightList] = useState<ListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.name, label: u.name })),
    [units]
  );

  const filteredCategories = useMemo(() => {
    if (mode === "auto") return categories;
    return categories
      .map((l1) => {
        const isSeasoningL1 = l1.code === "SEA" || l1.name === "调味品";
        if (mode === "ingredient" && isSeasoningL1) return null;

        if (mode === "ingredient") {
          const filteredChildren = l1.children.filter(
            (c) => c.code !== "GRA-SEA"
          );
          if (filteredChildren.length === 0) return null;
          return { ...l1, children: filteredChildren };
        }

        if (mode === "seasoning" && !isSeasoningL1) return null;
        return l1;
      })
      .filter((l1): l1 is CategoryL1 => l1 !== null);
  }, [categories, mode]);

  const l2Options = useMemo(() => {
    if (!form.l1Code) return [];
    const l1 = filteredCategories.find((c) => c.code === form.l1Code);
    return (l1?.children || []).map((c) => ({ value: c.code, label: c.name }));
  }, [form.l1Code, filteredCategories]);

  const selectedL2 = (() => {
    if (!form.l2Code) return undefined;
    for (const l1 of categories) {
      const l2 = l1.children.find((c) => c.code === form.l2Code);
      if (l2) return { ...l2, parentName: l1.name, parentCode: l1.code };
    }
    return undefined;
  })();

  const isSeasoning =
    mode === "seasoning" ||
    (mode === "auto" &&
      (selectedL2?.name === "调料" || selectedL2?.parentName === "调味品"));
  const aliasLabel = isSeasoning ? "商品名称" : "商品名称";

  const findParentL1 = useCallback(
    (l2Code?: string) => {
      if (!l2Code) return undefined;
      return categories.find((c) =>
        c.children.some((ch) => ch.code === l2Code)
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
  }, [open, initialData, findParentL1]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 当二级分类变化时，右侧列表显示对应分类下已存在的食材
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

  const validate = () => {
    if (!form.name.trim()) return "名称不能为空";
    if (!form.l2Code) return "请选择二级分类";
    if (isSeasoning && !form.alias.trim()) return "调料必须填写商品名称";
    if (!form.purchaseSpec.trim()) return "采购规格不能为空";
    if (!form.purchaseUnit.trim()) return "请选择采购单位";
    if (!form.stockUnit.trim()) return "请选择入库单位";
    if (form.latestRefPrice && Number(form.latestRefPrice) < 0) {
      return "最新参照单价不能为负数";
    }
    return null;
  };

  const ensureDefaultSpec = (spec: string, stockUnit: string) => {
    if (spec.trim()) return spec.trim();
    return getDefaultSpec(stockUnit);
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

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
          {/* 左侧表单 */}
          <div className="flex-1 space-y-4 min-w-0">
            <FormSection title="基础信息" cols={2}>
              <FormField label="食材分类" required className="col-span-2">
                <div className="grid grid-cols-2 gap-3">
                  {!isSeasoning && (
                    <TileSelect
                      options={filteredCategories.map((c) => ({
                        value: c.code,
                        label: c.name,
                      }))}
                      value={form.l1Code}
                      onChange={(v) =>
                        setForm({ ...form, l1Code: v, l2Code: "" })
                      }
                      placeholder="请选择"
                      title="选择一级分类"
                      searchable={false}
                      required
                    />
                  )}
                  <TileSelect
                    options={l2Options}
                    value={form.l2Code}
                    onChange={(v) => setForm({ ...form, l2Code: v })}
                    placeholder="请选择"
                    title="选择二级分类"
                    disabled={!form.l1Code && !isSeasoning}
                    searchable={false}
                    required
                  />
                </div>
              </FormField>
              <FormField label="食材名称" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如 带皮五花肉"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label={aliasLabel} required={isSeasoning}>
                <Input
                  value={form.alias}
                  onChange={(e) =>
                    setForm({ ...form, alias: e.target.value })
                  }
                  placeholder={isSeasoning ? "如 海天金标生抽" : "如 五花肉"}
                  className="h-11 text-base px-4"
                />
              </FormField>
            </FormSection>

            <FormSection title="采购与入库" cols={2}>
              <FormField label="采购规格" required>
                <Input
                  value={form.purchaseSpec}
                  onChange={(e) =>
                    setForm({ ...form, purchaseSpec: e.target.value })
                  }
                  placeholder="如 1千克*10袋、散装称斤"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="采购单位" required>
                <SearchableSelect
                  options={unitOptions}
                  value={form.purchaseUnit}
                  onChange={(v) => setForm({ ...form, purchaseUnit: v })}
                  placeholder="选择采购单位"
                  title="选择采购单位"
                  searchPlaceholder="搜索单位..."
                  emptyText="暂无匹配单位"
                />
              </FormField>
              <FormField label="入库单位" required>
                <SearchableSelect
                  options={unitOptions}
                  value={form.stockUnit}
                  onChange={(v) => setForm({ ...form, stockUnit: v })}
                  placeholder="选择入库单位"
                  title="选择入库单位"
                  searchPlaceholder="搜索单位..."
                  emptyText="暂无匹配单位"
                />
              </FormField>
              <FormField label="最新参照单价">
                <Input
                  type="number"
                  step="0.01"
                  value={form.latestRefPrice}
                  onChange={(e) =>
                    setForm({ ...form, latestRefPrice: e.target.value })
                  }
                  placeholder="可选"
                  className="h-11 text-base px-4"
                />
              </FormField>
            </FormSection>
          </div>

          {/* 右侧列表 */}
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
