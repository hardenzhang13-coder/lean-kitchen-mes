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
import { DataTable } from "@/app/components/ui/data-table";
import { SkeletonTable } from "@/app/components/ui/skeleton-table";
import { EmptyState } from "@/app/components/ui/empty-state";
import { useDebounce } from "@/lib/client/hooks";
import { BomType, IngredientOption, IngredientCategory } from "./types";
import { cn } from "@/lib/shared/utils";
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
  /** 自定义标题（如酱料配方编辑器复用时） */
  title?: string;
  /** 隐藏左侧分类面板（纯搜索模式） */
  hideCategories?: boolean;
  /** 展示全部分类（默认按 type 过滤；酱料配方选净料/小料时跨全部分类） */
  allCategories?: boolean;
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
  title,
  hideCategories = false,
  allCategories = false,
}: BomPickerDialogProps) {
  const { l1Categories, l2Categories, hasCategories } = useMemo(() => {
    if (hideCategories || type === "sauce") {
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
    const l1List = allCategories
      ? refs.ingredientCategories
      : isMinor
        ? refs.ingredientCategories.filter((c) => c.code === "MIN")
        : refs.ingredientCategories.filter(
            (c) => c.code !== "SEA" && c.code !== "GRA-SEA" && c.code !== "MIN"
          );

    return {
      l1Categories: l1List,
      l2Categories: l1List.flatMap((c) => c.children ?? []),
      hasCategories: true,
    };
  }, [type, refs.ingredientCategories, hideCategories, allCategories]);

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

  // 二级分类随一级分类级联：只展示当前选中一级分类下的子分类
  const cascadedL2 = useMemo(
    () => l1Categories.find((c) => c.code === selectedL1)?.children ?? [],
    [l1Categories, selectedL1]
  );

  const loadItems = useCallback(
    async (params: { l1Code?: string; l2Code?: string; q?: string; signal?: AbortSignal }) => {
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

  // 打开/搜索/分类变化时在渲染期进入加载态（prev-key 派生范式，避免 effect 内同步 setState）
  const requestKey = `${open}|${debouncedSearch}|${selectedL1}|${selectedL2}|${hasCategories}|${l1Categories.length}`;
  const [prevRequestKey, setPrevRequestKey] = useState(requestKey);
  if (prevRequestKey !== requestKey) {
    setPrevRequestKey(requestKey);
    setLoading(true);
    setError(null);
  }

  // Load items based on category/search
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const load = async () => {
      const params = debouncedSearch.trim()
        ? { q: debouncedSearch.trim() }
        : hasCategories
          ? {
              l1Code: selectedL1 || l1Categories[0]?.code,
              l2Code: selectedL2 || cascadedL2[0]?.code || l2Categories[0]?.code,
            }
          : {};
      try {
        const result = await onLoadItems({ type, ...params });
        if (controller.signal.aborted) return;
        setItems(result);
      } catch (e) {
        if (controller.signal.aborted) return;
        const message = e instanceof Error ? e.message : "加载失败";
        setError(message);
        toast.error(`加载原料失败：${message}`);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    void load();

    return () => controller.abort();
  }, [open, debouncedSearch, selectedL1, selectedL2, hasCategories, l1Categories, cascadedL2, l2Categories, onLoadItems, type]);

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
  // 级联：二级分类面板只显示当前一级分类的子分类（未选中时回退全量）
  const l2Options = (cascadedL2.length > 0 ? cascadedL2 : l2Categories).map((c) => ({
    value: c.code,
    label: c.name,
  }));
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
        header: "出库价",
        className: "text-right",
        cell: (row: IngredientOption) => {
          // 净料/小料 = 出库价（含加工费与毛利，元/斤）；调料 = 每斤单价；酱料维持原单价口径
          const price = type === "sauce" ? row.unitPrice : (row.costPrice ?? null);
          return price != null ? `¥${Number(price).toFixed(2)}/斤` : "—";
        },
      },
      {
        header: "单位",
        className: "text-center",
        cell: (row: IngredientOption) => row.unit || "—",
      },
    ],
    [isSeasoningOrSauce, type]
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
              setLoading(true);
              setError(null);
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
          <DialogTitle className="text-lg">{title ?? TYPE_TITLES[type]}</DialogTitle>
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
