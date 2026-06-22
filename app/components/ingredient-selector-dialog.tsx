"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DataTable } from "@/app/components/data-table";
import { EmptyState } from "@/app/components/empty-state";
import { cn } from "@/lib/utils";

export type CategoryL1 = {
  code: string;
  name: string;
  children: { code: string; name: string }[];
};

export type IngredientForSelector = {
  id: number;
  code: string;
  name: string;
  alias?: string | null;
  l2Code?: string;
  purchaseSpec?: string | null;
  purchaseUnit?: string | null;
  latestRefPrice?: number | null;
};

interface IngredientSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryL1[];
  ingredients: IngredientForSelector[];
  initialL1Code?: string;
  initialL2Code?: string;
  initialIngredientId?: string;
  onConfirm: (value: {
    l1Code: string;
    l2Code: string;
    ingredientId: string;
  }) => void;
}

export function IngredientSelectorDialog({
  open,
  onOpenChange,
  categories,
  ingredients,
  initialL1Code,
  initialL2Code,
  initialIngredientId,
  onConfirm,
}: IngredientSelectorDialogProps) {
  const [selectedL1Code, setSelectedL1Code] = useState<string>("");
  const [selectedL2Code, setSelectedL2Code] = useState<string>("");
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedL1Code(initialL1Code || "");
    setSelectedL2Code(initialL2Code || "");
    setSelectedIngredientId(initialIngredientId || "");
    setSearch("");
  }, [open, initialL1Code, initialL2Code, initialIngredientId]);

  const l1Options = useMemo(
    () => categories.map((c) => ({ value: c.code, label: c.name })),
    [categories]
  );

  const l2Options = useMemo(() => {
    if (selectedL1Code) {
      const l1 = categories.find((c) => c.code === selectedL1Code);
      return l1?.children || [];
    }
    return categories.flatMap((c) => c.children);
  }, [selectedL1Code, categories]);

  const filteredIngredients = useMemo(() => {
    let list = ingredients;
    if (selectedL2Code) {
      list = list.filter((i) => i.l2Code === selectedL2Code);
    } else if (selectedL1Code) {
      const l1 = categories.find((c) => c.code === selectedL1Code);
      const l2Codes = new Set((l1?.children || []).map((c) => c.code));
      list = list.filter((i) => i.l2Code && l2Codes.has(i.l2Code));
    }
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(s) ||
          i.code.toLowerCase().includes(s) ||
          (i.alias && i.alias.toLowerCase().includes(s))
      );
    }
    return list;
  }, [ingredients, selectedL1Code, selectedL2Code, categories, search]);

  const selectedIngredient = useMemo(
    () => ingredients.find((i) => String(i.id) === selectedIngredientId),
    [ingredients, selectedIngredientId]
  );

  const handleL1Click = (code: string) => {
    if (selectedL1Code === code) {
      setSelectedL1Code("");
      setSelectedL2Code("");
    } else {
      setSelectedL1Code(code);
      setSelectedL2Code("");
    }
  };

  const handleL2Click = (code: string) => {
    if (selectedL2Code === code) {
      setSelectedL2Code("");
    } else {
      setSelectedL2Code(code);
    }
  };

  const handleConfirm = () => {
    if (!selectedIngredientId) return;
    const ingredient = ingredients.find((i) => String(i.id) === selectedIngredientId);
    if (!ingredient) return;
    const l2Code = ingredient.l2Code || selectedL2Code || "";
    const l1Code = l2Code
      ? categories.find((c) => c.children.some((l2) => l2.code === l2Code))?.code || selectedL1Code || ""
      : selectedL1Code || "";
    onConfirm({
      l1Code,
      l2Code,
      ingredientId: selectedIngredientId,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px] max-w-[calc(100%-4rem)] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">选择来源原料</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-6 py-4 px-6 overflow-y-auto flex-1 min-h-0">
          <div className="lg:w-[320px] flex flex-col gap-4 min-h-0">
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                一级分类
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {l1Options.map((l1) => {
                  const active = selectedL1Code === l1.value;
                  return (
                    <button
                      key={l1.value}
                      type="button"
                      onClick={() => handleL1Click(l1.value)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm text-left transition-colors",
                        active
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-input bg-background text-foreground hover:bg-muted/60"
                      )}
                    >
                      {l1.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4 space-y-3 flex-1 min-h-0">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                二级分类
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {l2Options.map((l2) => {
                  const active = selectedL2Code === l2.code;
                  return (
                    <button
                      key={l2.code}
                      type="button"
                      onClick={() => handleL2Click(l2.code)}
                      className={cn(
                        "rounded-md border px-3 py-2 text-sm text-left transition-colors",
                        active
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-input bg-background text-foreground hover:bg-muted/60"
                      )}
                    >
                      {l2.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索编号、名称或商品名称..."
                className="h-11 pl-9 text-base"
              />
            </div>

            <div className="flex-1 min-h-0 overflow-auto rounded-md border">
              <DataTable<IngredientForSelector>
                data={filteredIngredients}
                columns={[
                  {
                    header: "序号",
                    cell: (_, rowIdx) => (
                      <span className="text-muted-foreground">
                        {rowIdx + 1}
                      </span>
                    ),
                  },
                  {
                    header: "编号",
                    cell: (row) => (
                      <span className="font-medium">{row.code}</span>
                    ),
                  },
                  { header: "食材名称", accessorKey: "name" },
                  {
                    header: "商品名称",
                    cell: (row) => row.alias || "—",
                  },
                  {
                    header: "采购规格",
                    cell: (row) => row.purchaseSpec || "—",
                  },
                  {
                    header: "采购单位",
                    cell: (row) => row.purchaseUnit || "—",
                  },
                  {
                    header: "最新参照单价",
                    cell: (row) =>
                      row.latestRefPrice != null
                        ? `¥${Number(row.latestRefPrice).toFixed(2)}`
                        : "—",
                    className: "text-right",
                  },
                ]}
                onRowClick={(row) => setSelectedIngredientId(String(row.id))}
                isRowSelected={(row) =>
                  String(row.id) === selectedIngredientId
                }
                emptyState={{
                  icon: Search,
                  title: "暂无匹配原料",
                  description:
                    selectedL2Code
                      ? "该分类下暂无原料"
                      : "请选择分类或调整搜索条件",
                }}
              />
            </div>

            <div className="shrink-0 flex items-center justify-between gap-4 pt-2">
              <div className="text-sm text-muted-foreground min-h-[1.5rem]">
                {selectedIngredient ? (
                  <span className="text-foreground">
                    已选择：
                    <span className="font-medium">
                      {selectedIngredient.name}
                    </span>
                    <span className="text-muted-foreground ml-1">
                      ({selectedIngredient.code})
                    </span>
                  </span>
                ) : (
                  "请点击右侧表格选择原料"
                )}
              </div>
              <Button
                onClick={handleConfirm}
                disabled={!selectedIngredientId}
                className="h-11 px-6"
              >
                确认选择
              </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
