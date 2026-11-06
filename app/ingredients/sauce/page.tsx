"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/app/components/ui/page-header";
import { SkeletonTable } from "@/app/components/ui/skeleton-table";
import { DataTable } from "@/app/components/ui/data-table";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { FormField, FormSection } from "@/app/components/ui/form-field";
import { SupplierSelect } from "@/app/components/ingredients/supplier-select";
import { TileGroup } from "@/app/components/ui/tile-group";
import { BomPickerDialog } from "@/app/components/dish-form/bom-picker-dialog";
import {
  IngredientCategory,
  IngredientOption,
  normalizeIngredients,
  normalizeNetIngredients,
} from "@/app/components/dish-form/types";
import { calcOutPricePerJin, calcStandardPackagePrice } from "@/lib/shared/net-price";
import { calcPricePerJin } from "@/lib/shared/spec-parser";
import {
  applyProcessingFee,
  calcRecipeLineCost,
  calcSauceCostPricePerJin,
} from "@/lib/shared/sauce-price";
import { usePagination } from "@/lib/client/use-pagination";
import { toast } from "sonner";

type Sauce = {
  id: number;
  code: string;
  name: string;
  type: string;
  brand: string | null;
  purchaseSpec: string | null;
  purchaseUnit: string | null;
  latestRefPrice: number | null;
  pricePerJin: number | null;
  grossMarginRate: number | null;
  processingFeePerJin: number | null;
  packageSpec: number | null;
  storage: string;
  remark: string | null;
  defaultSupplierId: number | null;
  costPricePerJin: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
  updatedAt: string;
  _count?: { dishSauceDetails: number };
};

type RecipeLine = {
  key: string;
  lineType: "net" | "seasoning";
  refId: number;
  name: string;
  spec: string | null;
  /** 行单价（元/斤）：净料/小料 = 出库价；调料 = 每斤单价 */
  linePricePerJin: number | null;
  amountG: string;
};

type PickerMode = "net" | "seasoning" | null;

const TYPE_OPTIONS = [
  { value: "自制", label: "自制" },
  { value: "外购", label: "外购" },
];

const STORAGE_OPTIONS = [
  { value: "常温", label: "常温" },
  { value: "冷藏", label: "冷藏" },
  { value: "冷冻", label: "冷冻" },
];

const LINE_TYPE_LABELS: Record<"net" | "seasoning", string> = {
  net: "净料/小料",
  seasoning: "调料",
};

const newKey = () => Math.random().toString(36).slice(2, 9);

const emptyForm = {
  name: "",
  type: "自制",
  storage: "常温",
  remark: "",
  brand: "",
  purchaseSpec: "",
  purchaseUnit: "",
  latestRefPrice: "",
  pricePerJin: "",
  defaultSupplierId: "",
  grossMarginRate: "",
  processingFeePerJin: "",
  packageSpec: "",
};

export default function SauceIngredientsPage() {
  const [data, setData] = useState<Sauce[]>([]);
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Sauce | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [recipeLines, setRecipeLines] = useState<RecipeLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerKey, setPickerKey] = useState(0);

  const [deleteRow, setDeleteRow] = useState<Sauce | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const s = search.trim().toLowerCase();
    return data.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        d.code.toLowerCase().includes(s) ||
        (d.brand || "").toLowerCase().includes(s)
    );
  }, [data, search]);

  const {
    currentPage,
    setCurrentPage,
    pageItems,
    totalPages,
    totalItems,
  } = usePagination(filtered, 20);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, catRes] = await Promise.all([
        fetch("/api/sauce-ingredients?page=1&pageSize=100"),
        fetch("/api/ingredient-categories?page=1&pageSize=100"),
      ]);
      const json = await res.json();
      setData(json.data || []);
      const catJson = await catRes.json();
      setCategories(Array.isArray(catJson) ? catJson : catJson.data || []);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setRecipeLines([]);
    setDialogOpen(true);
  };

  const openEdit = async (row: Sauce) => {
    try {
      const res = await fetch(`/api/sauce-ingredients/${row.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "获取详情失败");
      const detail = json.data;
      setEditing(row);
      setForm({
        name: detail.name || "",
        type: detail.type || "自制",
        storage: detail.storage || "常温",
        remark: detail.remark || "",
        brand: detail.brand || "",
        purchaseSpec: detail.purchaseSpec || "",
        purchaseUnit: detail.purchaseUnit || "",
        latestRefPrice: detail.latestRefPrice != null ? String(detail.latestRefPrice) : "",
        pricePerJin: detail.pricePerJin != null ? String(detail.pricePerJin) : "",
        grossMarginRate: detail.grossMarginRate != null ? String(detail.grossMarginRate) : "",
        defaultSupplierId: detail.defaultSupplierId != null ? String(detail.defaultSupplierId) : "",
        processingFeePerJin:
          detail.processingFeePerJin != null ? String(detail.processingFeePerJin) : "",
        packageSpec: detail.packageSpec != null ? String(detail.packageSpec) : "",
      });
      setRecipeLines(
        (detail.recipeDetails || []).map((l: Record<string, unknown>) => ({
          key: newKey(),
          lineType: l.lineType as "net" | "seasoning",
          refId: Number(l.refId),
          name: String(l.name || ""),
          spec: l.spec != null ? String(l.spec) : null,
          linePricePerJin: l.linePricePerJin != null ? Number(l.linePricePerJin) : null,
          amountG: String(l.amountG),
        }))
      );
      setDialogOpen(true);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "获取详情失败");
    }
  };

  // ---------- 实时价格预览 ----------
  const lineCosts = useMemo(
    () =>
      recipeLines.map((l) =>
        l.amountG !== "" ? calcRecipeLineCost(l.linePricePerJin, Number(l.amountG)) : null
      ),
    [recipeLines]
  );
  const recipeCostPrice = useMemo(
    () =>
      calcSauceCostPricePerJin(
        recipeLines.map((l, i) => ({ cost: lineCosts[i], amountG: Number(l.amountG) }))
      ),
    [recipeLines, lineCosts]
  );
  const formMargin = form.grossMarginRate !== "" ? Number(form.grossMarginRate) : null;
  const formFee = form.processingFeePerJin !== "" ? Number(form.processingFeePerJin) : null;
  // 成本价 = 配方推算价 + 加工费（元/斤），与净料「净料单价 + 封装加工费」同语义
  const recipeCostWithFee = applyProcessingFee(recipeCostPrice, formFee);
  const homemadeOutPrice = calcOutPricePerJin(recipeCostWithFee, formMargin);

  const purchasedCostPrice =
    form.pricePerJin !== "" && !Number.isNaN(Number(form.pricePerJin))
      ? Number(form.pricePerJin)
      : null;
  const purchasedOutPrice = calcOutPricePerJin(purchasedCostPrice, formMargin);

  const isHomemade = form.type === "自制";
  const costPricePreview = isHomemade ? recipeCostWithFee : purchasedCostPrice;
  const outPricePreview = isHomemade ? homemadeOutPrice : purchasedOutPrice;
  // 标准规格价（元/份）= 出库价 × 封装规格 ÷ 500（同净料口径）
  const standardPackagePreview = calcStandardPackagePrice(
    outPricePreview,
    form.packageSpec !== "" ? Number(form.packageSpec) : null
  );
  // 外购：参考价/规格/采购单位变化时自动换算每斤单价（与调料同款逻辑）
  const handlePurchasedChange = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field !== "pricePerJin") {
        const refPrice = field === "latestRefPrice" ? Number(value) : Number(next.latestRefPrice);
        const spec = field === "purchaseSpec" ? value : next.purchaseSpec;
        const unit = field === "purchaseUnit" ? value : next.purchaseUnit;
        const converted = calcPricePerJin(refPrice || null, spec || null, undefined, unit || null);
        next.pricePerJin = converted != null ? String(converted) : next.pricePerJin;
      }
      return next;
    });
  };

  // ---------- 配方行编辑 ----------
  const handlePickerSelect = (
    items: Array<{ option: IngredientOption; amountG: string }>
  ) => {
    if (!pickerMode) return;
    setRecipeLines((prev) => {
      const existing = new Set(prev.map((l) => `${l.lineType}-${l.refId}`));
      const additions = items
        .filter(({ option }) => !existing.has(`${pickerMode}-${option.id}`))
        .map(({ option, amountG }) => ({
          key: newKey(),
          lineType: pickerMode,
          refId: option.id,
          name: option.name,
          spec: option.spec ?? null,
          linePricePerJin: option.costPrice ?? null,
          amountG,
        }));
      return [...prev, ...additions];
    });
    setPickerMode(null);
  };

  const handleLoadPickerItems = useCallback(
    async (params: {
      type: "main" | "support" | "minor" | "seasoning" | "sauce";
      l1Code?: string;
      l2Code?: string;
      q?: string;
    }): Promise<IngredientOption[]> => {
      const query = new URLSearchParams();
      if (params.q) query.set("q", params.q);
      if (params.l2Code) query.set("l2Code", params.l2Code);
      else if (params.l1Code) query.set("l1Code", params.l1Code);
      let url: string;
      let normalizeFn: (items: unknown[]) => IngredientOption[];
      if (pickerMode === "seasoning") {
        url = `/api/ingredients?${query.toString()}`;
        normalizeFn = normalizeIngredients;
      } else {
        url = `/api/net-ingredients?${query.toString()}`;
        normalizeFn = normalizeNetIngredients;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("加载食材失败");
      const json = await res.json();
      const list = Array.isArray(json) ? json : json.data || [];
      return normalizeFn(list);
    },
    [pickerMode]
  );

  // ---------- 提交 ----------
  const validate = (): string | null => {
    if (!form.name.trim()) return "请填写酱料名称";
    if (
      form.grossMarginRate !== "" &&
      (Number.isNaN(Number(form.grossMarginRate)) ||
        Number(form.grossMarginRate) < 0 ||
        Number(form.grossMarginRate) >= 100)
    ) {
      return "毛利率必须在 0-95 之间，留空 = 0";
    }
    if (form.processingFeePerJin !== "" && Number(form.processingFeePerJin) < 0) {
      return "加工费不能为负数";
    }
    if (form.packageSpec !== "") {
      const pkg = Number(form.packageSpec);
      if (!Number.isInteger(pkg) || pkg < 1) return "封装规格必须是大于 0 的整数克数";
    }
    if (isHomemade) {
      if (recipeLines.length === 0) return "自制酱料必须至少包含一行配方明细";
      for (const l of recipeLines) {
        if (!l.amountG || Number(l.amountG) <= 0) return `「${l.name}」的用量必须大于 0`;
      }
      const noPrice = recipeLines.find((l) => l.linePricePerJin == null);
      if (noPrice) return `「${noPrice.name}」缺少价格，请先在食材中维护价格`;
    } else {
      if (form.pricePerJin === "" || Number(form.pricePerJin) < 0) {
        return "请填写有效的每斤单价（或由参考价+规格自动换算）";
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        storage: form.storage,
        remark: form.remark.trim() || null,
        defaultSupplierId: form.defaultSupplierId ? Number(form.defaultSupplierId) : null,
        grossMarginRate: form.grossMarginRate !== "" ? Number(form.grossMarginRate) : null,
        processingFeePerJin:
          form.type === "自制"
            ? form.processingFeePerJin !== ""
              ? Number(form.processingFeePerJin)
              : null
            : null,
        packageSpec: form.packageSpec !== "" ? Number(form.packageSpec) : null,
      };
      if (isHomemade) {
        payload.recipeLines = recipeLines.map((l) => ({
          lineType: l.lineType,
          refId: l.refId,
          amountG: Number(l.amountG),
        }));
      } else {
        payload.brand = form.brand.trim() || null;
        payload.purchaseSpec = form.purchaseSpec.trim() || null;
        payload.purchaseUnit = form.purchaseUnit.trim() || null;
        payload.latestRefPrice =
          form.latestRefPrice !== "" ? Number(form.latestRefPrice) : null;
        payload.pricePerJin = form.pricePerJin !== "" ? Number(form.pricePerJin) : null;
      }

      const url = editing ? `/api/sauce-ingredients/${editing.id}` : "/api/sauce-ingredients";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "保存失败");
      toast.success(editing ? "更新成功" : "创建成功");
      setDialogOpen(false);
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "保存出错");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/sauce-ingredients/${deleteRow.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "删除失败");
      toast.success("删除成功");
      setDeleteRow(null);
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleteLoading(false);
    }
  };

  const typeBadge = (type: string) => {
    if (type === "自制") {
      return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">自制</Badge>;
    }
    if (type === "外购") {
      return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">外购</Badge>;
    }
    return <Badge>{type}</Badge>;
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader showBack title="酱料清单" description="复合调味半成品：自制酱料由配方明细自动核算成本" />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          新增酱料
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <ListToolbar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setCurrentPage(1);
            }}
            searchPlaceholder="搜索编号、名称或品牌..."
            onReset={() => {
              setSearch("");
              setCurrentPage(1);
            }}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <SkeletonTable cols={9} rows={20} />
          ) : (
            <DataTable<Sauce>
              data={pageItems}
              loading={loading}
              columns={[
                {
                  header: "序号",
                  cell: (_, rowIdx) => (
                    <span className="text-muted-foreground">
                      {(currentPage - 1) * 20 + rowIdx + 1}
                    </span>
                  ),
                },
                {
                  header: "编号",
                  cell: (row) => <span className="font-medium">{row.code}</span>,
                },
                { header: "名称", accessorKey: "name" },
                { header: "类型", cell: (row) => typeBadge(row.type) },
                {
                  header: "封装规格",
                  cell: (row) => (row.packageSpec != null ? `${row.packageSpec}g` : "—"),
                },
                {
                  header: "成本价（元/斤）",
                  cell: (row) =>
                    row.costPricePerJin != null ? `¥${Number(row.costPricePerJin).toFixed(2)}` : "—",
                },
                {
                  header: "毛利率",
                  cell: (row) =>
                    row.grossMarginRate != null ? `${row.grossMarginRate}%` : "—",
                },
                {
                  header: "出库价（元/斤）",
                  cell: (row) =>
                    row.outPricePerJin != null ? `¥${Number(row.outPricePerJin).toFixed(2)}` : "—",
                },
                {
                  header: "标准规格价（元/份）",
                  cell: (row) =>
                    row.standardPackagePrice != null
                      ? `¥${Number(row.standardPackagePrice).toFixed(2)}`
                      : "—",
                },
                {
                  header: "更新时间",
                  cell: (row) => (row.updatedAt ? String(row.updatedAt).slice(0, 10) : "—"),
                },
              ]}
              pagination={
                totalItems > 0
                  ? {
                      currentPage,
                      totalPages,
                      totalItems,
                      pageSize: 20,
                      onPageChange: setCurrentPage,
                    }
                  : undefined
              }
              emptyState={{ title: "暂无数据" }}
              rowActions={(row) => (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="编辑酱料"
                    onClick={() => openEdit(row)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="删除酱料"
                    onClick={() => setDeleteRow(row)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            />
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[1000px] max-w-[calc(100%-4rem)] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="text-lg">
              {editing ? "编辑酱料" : "新增酱料"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 px-6 overflow-y-auto flex-1">
            <FormSection title="基础信息" cols={4}>
              <FormField label="酱料名称" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如 宫保汁"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="类型" required>
                <TileGroup
                  options={TYPE_OPTIONS}
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v })}
                />
              </FormField>
              <FormField label="储存方式">
                <TileGroup
                  options={STORAGE_OPTIONS}
                  value={form.storage}
                  onChange={(v) => setForm({ ...form, storage: v })}
                />
              </FormField>
              <FormField
                label="封装规格（g）"
                hint="标准封装单位的克数，如 250g/份填 250；留空 = 不启用标准规格价"
              >
                <Input
                  type="number"
                  min={1}
                  step="1"
                  value={form.packageSpec}
                  onChange={(e) => setForm({ ...form, packageSpec: e.target.value })}
                  placeholder="如 250"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField
                label="默认供应商"
                className="col-span-2"
                hint="用于排程采购计划按供应商拆单打印；不设置则该食材不参与拆单"
              >
                <SupplierSelect
                  value={form.defaultSupplierId ? Number(form.defaultSupplierId) : ""}
                  onChange={(v) =>
                    setForm({ ...form, defaultSupplierId: v === "" ? "" : String(v) })
                  }
                  placeholder="不设置默认供应商"
                />
              </FormField>
            </FormSection>

            {isHomemade ? (
              <>
                <FormSection title="配方明细" cols={1}>
                  <div className="rounded-lg border">
                    <div className="flex items-center justify-end px-4 py-3 border-b gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setPickerKey((k) => k + 1);
                            setPickerMode("net");
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          加净料/小料
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            setPickerKey((k) => k + 1);
                            setPickerMode("seasoning");
                          }}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          加调料
                        </Button>
                    </div>
                    {recipeLines.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                        尚未添加配方明细，点击下方按钮从食材库选择
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground border-b">
                            <th className="px-4 py-2 font-medium">类别</th>
                            <th className="px-4 py-2 font-medium">名称</th>
                            <th className="px-4 py-2 font-medium">单价（元/斤）</th>
                            <th className="px-4 py-2 font-medium w-32">用量（g）</th>
                            <th className="px-4 py-2 font-medium">成本小计（元）</th>
                            <th className="px-4 py-2 w-10" />
                          </tr>
                        </thead>
                        <tbody>
                          {recipeLines.map((line, idx) => (
                            <tr key={line.key} className="border-b last:border-0">
                              <td className="px-4 py-2">
                                <Badge variant="outline" className="text-xs">
                                  {LINE_TYPE_LABELS[line.lineType]}
                                </Badge>
                              </td>
                              <td className="px-4 py-2">
                                <div className="font-medium">{line.name}</div>
                              </td>
                              <td className="px-4 py-2">
                                {line.linePricePerJin != null
                                  ? `¥${Number(line.linePricePerJin).toFixed(2)}`
                                  : "—"}
                              </td>
                              <td className="px-4 py-2">
                                <Input
                                  type="number"
                                  min={0}
                                  step="1"
                                  value={line.amountG}
                                  onChange={(e) =>
                                    setRecipeLines((prev) =>
                                      prev.map((l) =>
                                        l.key === line.key
                                          ? { ...l, amountG: e.target.value }
                                          : l
                                      )
                                    )
                                  }
                                  className="h-9 text-base px-3"
                                />
                              </td>
                              <td className="px-4 py-2">
                                {lineCosts[idx] != null ? `¥${lineCosts[idx]?.toFixed(2)}` : "—"}
                              </td>
                              <td className="px-2 py-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="移除"
                                  onClick={() =>
                                    setRecipeLines((prev) =>
                                      prev.filter((l) => l.key !== line.key)
                                    )
                                  }
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </FormSection>

              </>
            ) : (
              <FormSection title="采购信息（同调料录入逻辑）" cols={2}>
                <FormField label="品牌">
                  <Input
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="如 郫县豆瓣酱"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField label="采购规格">
                  <Input
                    value={form.purchaseSpec}
                    onChange={(e) => handlePurchasedChange("purchaseSpec", e.target.value)}
                    placeholder="如 1.9L*6瓶 / 5斤/桶"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField label="采购单位" hint="按重直采（斤/公斤）时按单位字典换算">
                  <Input
                    value={form.purchaseUnit}
                    onChange={(e) => handlePurchasedChange("purchaseUnit", e.target.value)}
                    placeholder="如 瓶 / 袋 / 桶 / 斤"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField label="零售参考价（元/采购单位）">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.latestRefPrice}
                    onChange={(e) => handlePurchasedChange("latestRefPrice", e.target.value)}
                    placeholder="如 17.50"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField
                  label="每斤单价（元/斤）"
                  required
                  hint="由参考价 + 规格自动换算，可手动修改"
                >
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    value={form.pricePerJin}
                    onChange={(e) => setForm({ ...form, pricePerJin: e.target.value })}
                    placeholder="自动换算"
                    className="h-11 text-base px-4"
                  />
                </FormField>
              </FormSection>
            )}

            <FormSection title="价格" cols={isHomemade ? 4 : 3}>
              {isHomemade && (
                <FormField
                  label="加工费（元/斤）"
                  hint="加工环节每斤成本，计入成本价；留空 = 0"
                >
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.processingFeePerJin}
                    onChange={(e) => setForm({ ...form, processingFeePerJin: e.target.value })}
                    placeholder="留空 = 0"
                    className="h-11 text-base px-4"
                  />
                </FormField>
              )}
              <FormField
                label="毛利率（%）"
                hint="真毛利率口径：出库价 = 成本价 ÷ (1 - 毛利率/100)；留空 = 0"
              >
                <Input
                  type="number"
                  min={0}
                  max={95}
                  step="0.01"
                  value={form.grossMarginRate}
                  onChange={(e) => setForm({ ...form, grossMarginRate: e.target.value })}
                  placeholder="留空 = 0"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="成本价（元/斤）">
                <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground font-medium">
                  {costPricePreview != null ? `¥${costPricePreview.toFixed(2)}` : "—"}
                </div>
              </FormField>
              <FormField label="出库价（元/斤）">
                <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground font-medium">
                  {outPricePreview != null ? `¥${outPricePreview.toFixed(2)}` : "—"}
                </div>
              </FormField>
              <FormField label="标准规格价（元/份）" hint="= 出库价 × 封装规格 ÷ 500">
                <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground font-medium">
                  {standardPackagePreview != null ? `¥${standardPackagePreview.toFixed(2)}` : "—"}
                </div>
              </FormField>
            </FormSection>

            <FormSection title="备注" cols={1}>
              <FormField label="备注（延伸用途）">
                <Textarea
                  value={form.remark}
                  onChange={(e) => setForm({ ...form, remark: e.target.value })}
                  placeholder="如 还可烹制虾仁、鱼类等多种肉质细嫩的原料"
                  className="min-h-[70px] text-base px-4 py-3"
                />
              </FormField>
            </FormSection>
          </div>
          <DialogFooter className="px-6 pt-0 pb-6">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="h-11 px-6">
              <span aria-live="polite" className="inline-flex items-center">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 配方食材选择器（复用菜品 BOM Picker） */}
      {pickerMode && (
        <BomPickerDialog
          key={pickerKey}
          open={pickerMode !== null}
          onOpenChange={(open) => !open && setPickerMode(null)}
          type={pickerMode === "seasoning" ? "seasoning" : "support"}
          title={pickerMode === "seasoning" ? "选择调料" : "选择净料/小料"}
          allCategories={pickerMode === "net"}
          onSelect={handlePickerSelect}
          refs={{ ingredientCategories: categories }}
          onLoadItems={handleLoadPickerItems}
        />
      )}

      {/* 删除确认 */}
      <Dialog open={deleteRow !== null} onOpenChange={() => setDeleteRow(null)}>
        <DialogContent className="sm:max-w-[400px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除酱料“{deleteRow?.name}”吗？被菜品引用时无法删除。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRow(null)}
              disabled={deleteLoading}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="h-11 px-6"
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
