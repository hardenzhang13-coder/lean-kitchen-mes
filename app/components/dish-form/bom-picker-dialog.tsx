"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/app/components/data-table";
import { SkeletonTable } from "@/app/components/skeleton-table";
import { EmptyState } from "@/app/components/empty-state";
import { useDebounce } from "@/lib/hooks";
import { BomType, IngredientOption, IngredientCategory } from "./types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BomPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: BomType;
  onSelect: (items: Array<{ option: IngredientOption; amountG: string }>) => void;
  refs: { ingredientCategories: IngredientCategory[] };
  onLoadItems: (params: {
    type: BomType;
    l1Code?: string;
    l2Code?: string;
    q?: string;
  }) => Promise<IngredientOption[]>;
}

const TYPE_TITLES: Record<BomType, string> = {
  main: "选择主料",
  support: "选择辅料",
  minor: "选择小料",
  seasoning: "选择调料",
  sauce: "选择酱料",
};

export function BomPickerDialog({
  open,
  onOpenChange,
  type,
  onSelect,
  refs,
  onLoadItems,
}: BomPickerDialogProps) {
  const { l1Categories, l2Categories, hasCategories } = useMemo(() => {
    if (type === "sauce") {
      return {
        l1Categories: [] as IngredientCategory[],
        l2Categories: [] as Array<{ code: string; name: string; parentCode: string }>,
        hasCategories: false,
      };
    }

    if (type === "seasoning") {
      const l1 = refs.ingredientCategories.filter((c) => c.code === "SEA");
      return {
        l1Categories: l1,
        l2Categories: l1.flatMap((c) => c.children ?? []),
        hasCategories: true,
      };
    }

    const isMinor = type === "minor";
    const l1List = isMinor
      ? refs.ingredientCategories.filter((c) => c.code === "MIN")
      : refs.ingredientCategories.filter(
          (c) => c.code !== "SEA" && c.code !== "GRA-SEA" && c.code !== "MIN"
        );

    return {
      l1Categories: l1List,
      l2Categories: l1List.flatMap((c) => c.children ?? []),
      hasCategories: true,
    };
  }, [type, refs.ingredientCategories]);

  const initialL1 = hasCategories ? l1Categories[0]?.code ?? "" : "";
  const initialL2 = hasCategories ? l1Categories[0]?.children?.[0]?.code ?? "" : "";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedItems, setSelectedItems] = useState<Map<number, IngredientOption>>(new Map());
  const [amountG, setAmountG] = useState("100");
  const [selectedL1, setSelectedL1] = useState<string>(initialL1);
  const [selectedL2, setSelectedL2] = useState<string>(initialL2);
  const [items, setItems] = useState<IngredientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(
    async (params: { l1Code?: string; l2Code?: string; q?: string; signal?: AbortSignal }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await onLoadItems({ type, ...params });
        if (params.signal?.aborted) return;
        setItems(result);
      } catch (e) {
        if (params.signal?.aborted) return;
        const message = e instanceof Error ? e.message : "加载失败";
        setError(message);
        toast.error(`加载原料失败：${message}`);
      } finally {
        if (!params.signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [onLoadItems, type]
  );

  // Load items based on category/search
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    if (debouncedSearch.trim()) {
      loadItems({ q: debouncedSearch.trim(), signal: controller.signal });
    } else if (hasCategories) {
      const l2 = selectedL2 || l2Categories[0]?.code;
      const l1 = selectedL1 || l1Categories[0]?.code;
      loadItems({ l1Code: l1, l2Code: l2, signal: controller.signal });
    } else {
      loadItems({ signal: controller.signal });
    }

    return () => controller.abort();
  }, [open, debouncedSearch, selectedL1, selectedL2, hasCategories, l1Categories, l2Categories, loadItems]);

  const handleL1Click = (code: string) => {
    if (selectedL1 === code) return;
    setSelectedL1(code);
    const children = l1Categories.find((c) => c.code === code)?.children ?? [];
    setSelectedL2(children[0]?.code ?? "");
  };

  const handleL2Click = (code: string) => {
    setSelectedL2(selectedL2 === code ? "" : code);
  };

  const handleRowClick = (row: IngredientOption) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(row.id)) {
        next.delete(row.id);
      } else {
        next.set(row.id, row);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    if (selectedItems.size === 0) return;
    const items = Array.from(selectedItems.values()).map((option) => ({ option, amountG }));
    onSelect(items);
    onOpenChange(false);
  };

  const l1Options = l1Categories.map((c) => ({ value: c.code, label: c.name }));
  const l2Options = l2Categories.map((c) => ({ value: c.code, label: c.name }));
  const isSearchMode = debouncedSearch.trim().length > 0;
  const isSeasoningOrSauce = type === "seasoning" || type === "sauce";

  const columns = useMemo(
    () => [
      {
        header: "序号",
        cell: (_: IngredientOption, rowIdx: number) => (
          <span className="text-muted-foreground">{rowIdx + 1}</span>
        ),
      },
      {
        header: "名称",
        cell: (row: IngredientOption) => <span className="font-medium">{row.name}</span>,
      },
      ...(isSeasoningOrSauce
        ? [
            {
              header: "商品名称",
              cell: (row: IngredientOption) => row.productName || "—",
            },
          ]
        : [
            {
              header: "规格",
              cell: (row: IngredientOption) => row.spec || "—",
            },
          ]),
      {
        header: "成本价",
        className: "text-right",
        cell: (row: IngredientOption) =>
          row.unitPrice != null ? `¥${Number(row.unitPrice).toFixed(2)}` : "—",
      },
      {
        header: "单位",
        className: "text-center",
        cell: (row: IngredientOption) => row.unit || "—",
      },
    ],
    [isSeasoningOrSauce]
  );

  const renderTableContent = () => {
    if (loading) {
      return <SkeletonTable cols={columns.length} rows={3} className="h-full" />;
    }

    if (error) {
      return (
        <EmptyState
          icon={Search}
          title="加载失败"
          description={error}
          action={{
            label: "重试",
            onClick: () => {
              const controller = new AbortController();
              if (isSearchMode) {
                loadItems({ q: debouncedSearch.trim(), signal: controller.signal });
              } else if (hasCategories) {
                loadItems({
                  l1Code: selectedL1 || l1Categories[0]?.code,
                  l2Code: selectedL2 || l2Categories[0]?.code,
                  signal: controller.signal,
                });
              } else {
                loadItems({ signal: controller.signal });
              }
            },
          }}
        />
      );
    }

    const emptyTitle = isSearchMode ? "暂无匹配原料" : "该分类下暂无原料";
    const emptyDescription = isSearchMode
      ? "请尝试调整搜索条件"
      : selectedL2
        ? "该分类下暂无原料"
        : "请选择分类";

    return (
      <DataTable<IngredientOption>
        data={items}
        columns={columns}
        onRowClick={handleRowClick}
        isRowSelected={(row) => selectedItems.has(row.id)}
        emptyState={{
          icon: Search,
          title: emptyTitle,
          description: emptyDescription,
        }}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px] max-w-[calc(100%-4rem)] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">{TYPE_TITLES[type]}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-6 py-4 px-6 overflow-y-auto flex-1 min-h-0">
          {/* Left categories */}
          {hasCategories && (
            <div className="lg:w-[320px] flex flex-col gap-4 min-h-0">
              {l1Options.length > 0 && (
                <div className={cn("rounded-lg border p-4 space-y-3", isSearchMode && "opacity-50")}>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    一级分类
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {l1Options.map((l1) => {
                      const active = selectedL1 === l1.value;
                      return (
                        <button
                          key={l1.value}
                          type="button"
                          disabled={isSearchMode}
                          onClick={() => handleL1Click(l1.value)}
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm text-left transition-colors disabled:cursor-not-allowed",
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
              )}

              {l2Options.length > 0 && (
                <div className={cn("rounded-lg border p-4 space-y-3 flex-1 min-h-0", isSearchMode && "opacity-50")}>
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    二级分类
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {l2Options.map((l2) => {
                      const active = selectedL2 === l2.value;
                      return (
                        <button
                          key={l2.value}
                          type="button"
                          disabled={isSearchMode}
                          onClick={() => handleL2Click(l2.value)}
                          className={cn(
                            "rounded-md border px-3 py-2 text-sm text-left transition-colors disabled:cursor-not-allowed",
                            active
                              ? "bg-primary/10 border-primary text-primary"
                              : "border-input bg-background text-foreground hover:bg-muted/60"
                          )}
                        >
                          {l2.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Right table */}
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索编号、名称或商品名称..."
                className="h-11 pl-9 text-base"
              />
              {loading && isSearchMode && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-auto rounded-md border">
              {renderTableContent()}
            </div>

            <div className="shrink-0 flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground min-h-[1.5rem]">
                  {selectedItems.size > 0 ? (
                    <span className="text-foreground">
                      已选择 <span className="font-medium">{selectedItems.size}</span> 项
                    </span>
                  ) : (
                    "请点击右侧表格选择原料"
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">用量</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={amountG}
                    onChange={(e) => setAmountG(e.target.value)}
                    className="w-[100px] h-9 text-sm px-2"
                  />
                  <span className="text-sm text-muted-foreground">g</span>
                </div>
              </div>
              <Button
                onClick={handleConfirm}
                disabled={selectedItems.size === 0 || loading}
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
