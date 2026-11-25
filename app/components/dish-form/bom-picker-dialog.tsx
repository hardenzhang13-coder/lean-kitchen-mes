"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormDialog } from "@/app/components/ui/form-dialog";
import { Input } from "@/app/components/ui/form-controls";
import { DataTable, type ColumnDef } from "@/app/components/ui/data-table";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { CategoryCascadeSelect } from "@/app/components/ui/category-cascade-select";
import { EmptyState } from "@/app/components/ui/empty-state";
import { useDebounce } from "@/lib/client/hooks";
import { DEFAULT_PAGE_SIZE } from "@/lib/client/use-pagination";
import { BomType, IngredientOption, IngredientCategory } from "./types";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { SeasoningTypeTag } from "@/app/components/ui/seasoning-type-tag";
import { cn } from "@/lib/shared/utils";

import { toast } from "sonner";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";

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
  /** 隐藏分类筛选（纯搜索模式） */
  hideCategories?: boolean;
  /** 展示全部分类（默认按 type 过滤；酱料配方选净料/小料时跨全部分类） */
  allCategories?: boolean;
  /** 是否展示底部用量输入；菜品 BOM 关闭，直接采用食材规格 */
  showAmountInput?: boolean;
  /** 单选模式：菜品 BOM 添加一次只选一项；酱料配方默认多选 */
  singleSelect?: boolean;
  /** 用量输入框的默认值（g）：菜品 BOM 调味品传 10，酱料配方默认 100 */
  defaultAmountG?: string;
}

const TYPE_TITLES: Record<BomType, string> = {
  main: "选择主料",
  support: "选择辅料",
  minor: "选择小料",
  seasoning: "选择调味品",
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
  showAmountInput = true,
  singleSelect = false,
  defaultAmountG = "100",
}: BomPickerDialogProps) {
  const { l1Categories, hasCategories } = useMemo(() => {
    // 调味品产物层不挂分类体系；酱料已业务剥离（存量行只读，不再打开选择弹窗）
    if (hideCategories || type === "sauce" || type === "seasoning") {
      return {
        l1Categories: [] as IngredientCategory[],
        hasCategories: false,
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
      hasCategories: true,
    };
  }, [type, refs.ingredientCategories, hideCategories, allCategories]);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selectedItems, setSelectedItems] = useState<Map<number, IngredientOption>>(new Map());
  const [amountG, setAmountG] = useState(defaultAmountG);
  const [selectedL1, setSelectedL1] = useState<string>("");
  const [selectedL2, setSelectedL2] = useState<string>("");
  const [items, setItems] = useState<IngredientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = DEFAULT_PAGE_SIZE;

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
    setPage(1);
  }

  // Load items based on category/search
  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    const load = async () => {
      const params = debouncedSearch.trim()
        ? { q: debouncedSearch.trim() }
        : selectedL1
          ? {
              l1Code: selectedL1,
              // 未选二级分类时按一级分类取全量子分类
              l2Code: selectedL2 || undefined,
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
  }, [open, debouncedSearch, selectedL1, selectedL2, hasCategories, l1Categories, onLoadItems, type]);

  const handleRowClick = (row: IngredientOption) => {
    if (singleSelect) {
      setSelectedItems(new Map([[row.id, row]]));
      return;
    }
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
    const items = Array.from(selectedItems.values()).map((option) => ({
      option,
      // 菜品 BOM 不手填用量：直接采用食材规格
      // （净料/小料 = 封装规格；调味品按克需求手填；其余回退 100g）
      amountG: showAmountInput ? amountG : String(option.packageSpec ?? 100),
    }));
    onSelect(items);
    onOpenChange(false);
  };

  const isSearchMode = debouncedSearch.trim().length > 0;

  // 客户端分页：列表一次性取回当前分类下的全部数据，分页只做展示切片
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, pageSize, safePage]
  );

  // 序号列：选中行用「✓ + 主题色」标识，不再依赖整行背景高亮
  const seqColumn: ColumnDef<IngredientOption> = {
    header: "序号",
    className: "w-[64px]",
    cell: (row, rowIdx) => {
      const selected = selectedItems.has(row.id);
      return (
        <span
          className={cn(
            "tabular-nums",
            selected ? "font-semibold text-primary" : "text-muted-foreground"
          )}
        >
          {selected ? "✓ " : ""}
          {(safePage - 1) * pageSize + rowIdx + 1}
        </span>
      );
    },
  };

  // 净料/小料：名称 / 包装规格 / 标准规格价 / 包装份量 / 来源原料
  const netColumns: ColumnDef<IngredientOption>[] = [
    seqColumn,
    {
      header: "名称",
      className: "w-[150px]",
      cell: (row) => (
        <span className="font-semibold text-primary">{row.name}</span>
      ),
    },
    {
      header: "包装规格",
      className: "w-[100px] text-right",
      cell: (row) =>
        row.packageSpec != null ? (
          <span className="tabular-nums">{row.packageSpec}g</span>
        ) : (
          "—"
        ),
    },
    {
      header: "标准规格价",
      className: "w-[110px] text-right",
      cell: (row) =>
        row.standardPackagePrice != null ? (
          <span className="font-semibold tabular-nums text-primary">
            ¥{Number(row.standardPackagePrice).toFixed(2)}/份
          </span>
        ) : (
          "—"
        ),
    },
    {
      header: "包装份量",
      className: "w-[110px]",
      cell: (row) => <PortionTag portion={row.portion} />,
    },
    {
      header: "来源原料",
      className: "w-[130px]",
      cell: (row) => row.productName || "—",
    },
  ];

  // 调料产物：名称（+类型标签）/ 包装规格 / 出库价 / 标准规格价 / 来源
  const seasoningColumns: ColumnDef<IngredientOption>[] = [
    seqColumn,
    {
      header: "产物名称",
      className: "w-[160px]",
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <span className="font-semibold text-primary">{row.name}</span>
          <SeasoningTypeTag type={row.productType} />
        </span>
      ),
    },
    {
      header: "包装规格",
      className: "w-[100px] text-right",
      cell: (row) =>
        row.packageSpec != null ? (
          <span className="tabular-nums">{row.packageSpec}g</span>
        ) : (
          "—"
        ),
    },
    {
      header: "出库价",
      className: "w-[110px] text-right",
      cell: (row) =>
        row.costPrice != null ? (
          <span className="font-semibold tabular-nums text-primary">
            ¥{Number(row.costPrice).toFixed(2)}/斤
          </span>
        ) : (
          <span className="text-muted-foreground">缺价</span>
        ),
    },
    {
      header: "标准规格价",
      className: "w-[110px] text-right",
      cell: (row) =>
        row.standardPackagePrice != null ? (
          <span className="tabular-nums">
            ¥{Number(row.standardPackagePrice).toFixed(2)}/份
          </span>
        ) : (
          "—"
        ),
    },
    {
      header: "来源",
      className: "w-[130px]",
      cell: (row) =>
        row.productName ? (
          <span className="text-muted-foreground">
            转化 · {row.productName}
          </span>
        ) : (
          "—"
        ),
    },
  ];

  const columns = type === "seasoning" ? seasoningColumns : netColumns;

  // 空态文案：搜索中与按分类浏览两种口径（无分类体系类型直接提示暂无数据）
  const emptyState = {
    icon: Search,
    title: isSearchMode
      ? "暂无匹配原料"
      : hasCategories
        ? "该分类下暂无原料"
        : "暂无原料",
    description: isSearchMode ? "请尝试调整搜索条件" : "请选择分类",
  };

  const errorState = error ? (
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
              l2Code: selectedL2 || undefined,
              signal: controller.signal,
            });
          } else {
            loadItems({ signal: controller.signal });
          }
        },
      }}
    />
  ) : null;

  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="workbench"
        className="max-w-[calc(100%-4rem)] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh] gap-0"
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg">
            {title ?? TYPE_TITLES[type]}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-4">
          {errorState ?? (
            <div className="skeu-panel flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="skeu-panel-toolbar shrink-0 px-5 py-4">
                <ListToolbar
                  searchValue={search}
                  onSearchChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  searchPlaceholder="搜索名称..."
                  onReset={() => {
                    setSearch("");
                    setSelectedL1("");
                    setSelectedL2("");
                    setPage(1);
                  }}
                  hasFilters={
                    search.trim() !== "" ||
                    selectedL1 !== "" ||
                    selectedL2 !== ""
                  }
                >
                  {hasCategories && (
                    <CategoryCascadeSelect
                      categories={l1Categories.map((c) => ({
                        code: c.code,
                        name: c.name,
                        children: c.children ?? [],
                      }))}
                      l1Code={selectedL1}
                      l2Code={selectedL2}
                      onChange={(l1, l2) => {
                        setSelectedL1(l1);
                        setSelectedL2(l2);
                        setPage(1);
                      }}
                      placeholder="全部分类"
                      className="w-[200px]"
                    />
                  )}
                </ListToolbar>
              </div>
              <div className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
                <DataTable<IngredientOption>
                  data={pageItems}
                  columns={columns}
                  loading={loading}
                  fillHeight
                  variant="skeu"
                  density="compact"
                  tableClassName="min-w-max"
                  onRowClick={handleRowClick}
                  isRowSelected={(row) => selectedItems.has(row.id)}
                  pagination={{
                    currentPage: safePage,
                    totalPages,
                    totalItems,
                    pageSize,
                    onPageChange: (p) => setPage(p),
                  }}
                  emptyState={emptyState}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pt-2 pb-6">
          <div className="flex w-full flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground min-h-[1.5rem]">
              {selectedItems.size > 0 ? (
                <span className="text-foreground">
                  已选择 <span className="font-medium">{selectedItems.size}</span> 项
                </span>
              ) : singleSelect ? (
                "请选择一项原料"
              ) : (
                "请选择原料"
              )}
            </div>
            <div className="flex items-center gap-3">
              {showAmountInput && (
                <div className="flex h-11 items-center gap-2">
                  <span className="text-sm text-muted-foreground">用量</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={amountG}
                    onChange={(e) => setAmountG(e.target.value)}
                    aria-label="用量"
                    className="h-9 w-[76px] px-2 text-base font-bold tabular-nums text-primary"
                  />
                  <span className="text-base font-bold text-primary">g</span>
                </div>
              )}
              <SkeuButton
                variant="primary"
                onClick={handleConfirm}
                disabled={selectedItems.size === 0 || loading}
              >
                确认选择
              </SkeuButton>
            </div>
          </div>
        </DialogFooter>
      </AppDialogContent>
    </FormDialog>
  );
}
