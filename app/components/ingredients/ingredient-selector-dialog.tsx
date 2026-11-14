"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/app/components/ui/data-table";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import {
  RecordActions,
  RecordSheet,
} from "@/app/components/ui/record-sheet";
import { formatMoney } from "@/lib/shared/display-format";
import {
  DEFAULT_PAGE_SIZE,
} from "@/lib/client/use-pagination";

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
  pricePerJin?: number | null;
};

interface IngredientSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryL1[];
  ingredients: IngredientForSelector[];
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
  initialIngredientId,
  onConfirm,
}: IngredientSelectorDialogProps) {
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

  // 来源必须为原料：排除 MIN（小料转化品分类）与 SEA（调料体系，调料是标准化直接采购品，不转化为净料）
  const rawCategories = useMemo(
    () => categories.filter((c) => c.code !== "MIN" && c.code !== "SEA"),
    [categories]
  );

  // 兜底过滤：无论传入的原料列表是否已按体系过滤，都排除 MIN/SEA 分类下的食材（含搜索场景）
  const rawIngredients = useMemo(() => {
    const excludedL2 = new Set(
      categories
        .filter((c) => c.code === "MIN" || c.code === "SEA")
        .flatMap((c) => (c.children || []).map((l2) => l2.code))
    );
    return ingredients.filter((i) => !i.l2Code || !excludedL2.has(i.l2Code));
  }, [ingredients, categories]);

  const l2Map = useMemo(() => {
    const map: Record<string, { name: string; parentName: string }> = {};
    rawCategories.forEach((l1) => {
      l1.children.forEach((l2) => {
        map[l2.code] = { name: l2.name, parentName: l1.name };
      });
    });
    return map;
  }, [rawCategories]);

  const filteredIngredients = useMemo(() => {
    let list = rawIngredients;
    const s = search.trim().toLowerCase();
    if (s) {
      list = list.filter((i) => i.name.toLowerCase().includes(s));
    }
    return list;
  }, [rawIngredients, search]);

  const totalItems = filteredIngredients.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () =>
      filteredIngredients.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize
      ),
    [filteredIngredients, pageSize, safePage]
  );

  // 抽屉打开/初始值变化时在渲染期同步选中状态与分页，避免 effect 内级联 setState。
  const [prevInit, setPrevInit] = useState({
    open,
    initialIngredientId,
  });
  if (
    prevInit.open !== open ||
    prevInit.initialIngredientId !== initialIngredientId
  ) {
    setPrevInit({ open, initialIngredientId });
    setSelectedIngredientId(initialIngredientId || "");
    setSearch("");
    setPage(1);
  }

  const selectedIngredient = useMemo(
    () => rawIngredients.find((i) => String(i.id) === selectedIngredientId),
    [rawIngredients, selectedIngredientId]
  );

  const handleConfirm = () => {
    if (!selectedIngredientId) return;
    const ingredient = rawIngredients.find((i) => String(i.id) === selectedIngredientId);
    if (!ingredient) return;
    const l2Code = ingredient.l2Code || "";
    const l1Code = l2Code
      ? rawCategories.find((c) => c.children.some((l2) => l2.code === l2Code))
          ?.code || ""
      : "";
    onConfirm({
      l1Code,
      l2Code,
      ingredientId: selectedIngredientId,
    });
    onOpenChange(false);
  };

  return (
    <RecordSheet
      open={open}
      onOpenChange={onOpenChange}
      title="选择来源原料"
      meta={
        selectedIngredient ? (
          <span>
            已选择：
            <span className="font-medium text-foreground">
              {selectedIngredient.name}
            </span>
            <span className="ml-1 font-mono">{selectedIngredient.code}</span>
          </span>
        ) : (
          <span>选择原料后会带出分类与当前每斤单价</span>
        )
      }
      bodyClassName="overflow-hidden"
      footer={
        <RecordActions
          secondary={
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          }
          primary={
            <Button
              onClick={handleConfirm}
              disabled={!selectedIngredientId}
            >
              确认选择
            </Button>
          }
        />
      }
    >
      <DataTable<IngredientForSelector>
        data={pageItems}
        fillHeight
        density="compact"
        tableClassName="min-w-max"
        filters={
          <ListToolbar
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setSelectedIngredientId("");
              setPage(1);
            }}
            searchPlaceholder="搜索食材名称..."
            onReset={() => {
              setSearch("");
              setSelectedIngredientId("");
              setPage(1);
            }}
          />
        }
        columns={[
          {
            header: "序号",
            className: "w-[48px]",
            cell: (_, rowIdx) => (
              <span className="text-muted-foreground">
                {(safePage - 1) * pageSize + rowIdx + 1}
              </span>
            ),
          },
          {
            header: "食材名称",
            className: "w-[150px]",
            cell: (row) => (
              <span className="font-semibold text-primary">{row.name}</span>
            ),
          },
          {
            header: "一级分类",
            className: "w-[85px]",
            cell: (row) =>
              row.l2Code ? l2Map[row.l2Code]?.parentName || "—" : "—",
          },
          {
            header: "二级分类",
            className: "w-[90px]",
            cell: (row) =>
              row.l2Code ? (
                <CategoryTag
                  l2Code={row.l2Code}
                  name={l2Map[row.l2Code]?.name || row.l2Code}
                />
              ) : (
                "—"
              ),
          },
          {
            header: "采购规格",
            className: "w-[110px]",
            cell: (row) => row.purchaseSpec || "—",
          },
          {
            header: "最新参照单价",
            className: "w-[115px] text-right tabular-nums",
            cell: (row) =>
              formatMoney(row.latestRefPrice, row.purchaseUnit),
          },
          {
            header: "每斤单价",
            className: "w-[110px] text-right",
            cell: (row) =>
              row.pricePerJin != null ? (
                <span className="font-semibold tabular-nums text-primary">
                  {formatMoney(row.pricePerJin, "斤")}
                </span>
              ) : (
                "—"
              ),
          },
        ]}
        onRowClick={(row) => setSelectedIngredientId(String(row.id))}
        isRowSelected={(row) => String(row.id) === selectedIngredientId}
        emptyState={{
          icon: Search,
          title: "暂无匹配原料",
          description: "请调整搜索条件后重试",
        }}
        pagination={
          totalItems > 0
            ? {
                currentPage: safePage,
                totalPages,
                totalItems,
                pageSize,
                onPageChange: setPage,
              }
            : undefined
        }
      />
    </RecordSheet>
  );
}
