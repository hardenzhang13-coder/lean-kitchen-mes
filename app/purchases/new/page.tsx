"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  ImageIcon,
  Loader2,
  Sparkles,
  AlertCircle,
  Save,
  Trash2,
  Eye,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DatePicker } from "@/app/components/date-picker";
import { ImagePreviewModal } from "@/app/components/image-preview-modal";
import { CategoryTag } from "@/app/components/category-tag";
import { SearchableSelect } from "@/app/components/searchable-select";
import { SupplierSelect } from "@/app/components/supplier-select";
import { IngredientFormDialog } from "@/app/components/ingredient-form-dialog";
import { FormField, FormSection } from "@/app/components/form-field";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  calculateStockInfo,
  getDefaultSpec,
  isHighConfidenceSpec,
} from "@/lib/spec-parser";

interface FormItem {
  id: string;
  ingredientId: number | null;
  seasoningIngredientId: number | null;
  itemName: string;
  brand: string;
  spec: string;
  qty: number;
  priceUnit: string;
  purchaseUnit: string;
  unitPrice: number;
  amount: number;
  stockUnit: string;
  stockInQty: number;
  l2Code: string | null;
  l2Name: string | null;
  category: string;
  matched: boolean;
  isManual: boolean;
  storage?: string;
}

interface L1Category {
  code: string;
  name: string;
  children: { code: string; name: string }[];
}

interface Unit {
  id: number;
  name: string;
  category: string;
}

type CreatedIngredient = {
  id: number;
  name: string;
  alias?: string | null;
  brand?: string | null;
  l2Code: string;
  stockUnit?: string | null;
  purchaseUnit?: string | null;
  priceUnit?: string | null;
  unit?: string | null;
  storage?: string | null;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getCategoryNames(categories: L1Category[], l2Code: string | null) {
  for (const l1 of categories) {
    const l2 = l1.children.find((c) => c.code === l2Code);
    if (l2) return { l1Name: l1.name, l2Name: l2.name };
  }
  return { l1Name: "—", l2Name: l2Code || "—" };
}

export default function NewPurchasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const isEdit = !!editId;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [receiptDate, setReceiptDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [summary, setSummary] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [supplierName, setSupplierName] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeStatus, setRecognizeStatus] = useState("");
  const [items, setItems] = useState<FormItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [ingredientDialogOpen, setIngredientDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<FormItem | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<FormItem | null>(null);

  const [categories, setCategories] = useState<L1Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const unitOptions = useMemo(
    () => units.map((u) => ({ value: u.name, label: u.name })),
    [units]
  );
  const unitNames = useMemo(() => units.map((u) => u.name), [units]);

  useEffect(() => {
    if (!editId) return;
    fetch(`/api/purchase-receipts/${editId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          toast.error(data.error || "加载采购单失败");
          return;
        }
        const receipt = data.data;
        setReceiptDate(receipt.receiptDate.split("T")[0]);
        setSummary(receipt.summary || "");
        setTotalAmount(String(Number(receipt.totalAmount).toFixed(2)));
        setSupplierId(receipt.supplierId || "");
        setSupplierName(receipt.supplierName || "");
        setImageBase64(receipt.imageUrl || "");
        setImagePreview(receipt.imageUrl || "");
        const mappedItems: FormItem[] = receipt.items.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any, idx: number) => ({
            id: `edit-${idx}-${Date.now()}`,
            ingredientId: item.ingredientId,
            seasoningIngredientId: item.seasoningIngredientId,
            itemName: item.itemName,
            brand: item.brand || "",
            spec: item.spec,
            qty: item.qty,
            priceUnit: item.purchaseUnit,
            purchaseUnit: item.purchaseUnit,
            unitPrice: Number(item.unitPrice),
            amount: Number(item.amount),
            stockUnit: item.stockUnit,
            stockInQty: item.stockInQty,
            l2Code: item.l2Code,
            l2Name: item.l2Name || "",
            category: getCategoryNames(categories, item.l2Code).l1Name,
            matched: !!(item.ingredientId || item.seasoningIngredientId),
            isManual: item.isManual,
            storage: item.storage || "常温",
          })
        );
        setItems(mappedItems);
      })
      .catch(() => toast.error("加载采购单失败"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    fetch("/api/ingredient-categories")
      .then((r) => r.json())
      .then((data) => setCategories(data))
      .catch(() => {});
    fetch("/api/units")
      .then((r) => r.json())
      .then((data) => setUnits(data))
      .catch(() => {});
  }, []);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await readFileAsBase64(file);
      setImageBase64(base64);
      setImagePreview(base64);
      toast.success("图片已加载");
    } catch {
      toast.error("图片读取失败");
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      try {
        const base64 = await readFileAsBase64(file);
        setImageBase64(base64);
        setImagePreview(base64);
        toast.success("图片已加载");
      } catch {
        toast.error("图片读取失败");
      }
    }
  }, []);

  const triggerReplace = () => {
    fileInputRef.current?.click();
  };

  const handleRecognize = async () => {
    if (!imageBase64) {
      toast.error("请先选择采购单图片");
      return;
    }
    setRecognizing(true);
    setRecognizeStatus("AI 正在分析图片内容…");
    try {
      const res = await fetch("/api/purchase-receipts/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "识别失败");
        return;
      }

      if (data.supplierId) {
        setSupplierId(data.supplierId);
        setSupplierName(data.supplierName || "");
      }
      if (data.summary && !summary) {
        setSummary(data.summary);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedItems: FormItem[] = (data.items || []).map((item: any, idx: number) => {
        const purchaseUnit = item.purchaseUnit || item.unit || "件";
        const stockUnit =
          item.stockUnit || item.purchaseUnit || item.unit || "件";
        const rawSpec = (item.spec || "").trim();
        const isPlaceholder = /^(散称|散装|无|—|-)?$/.test(rawSpec);
        const spec = isPlaceholder
          ? getDefaultSpec(stockUnit)
          : rawSpec || getDefaultSpec(stockUnit);
        const stockInfo = isHighConfidenceSpec(spec, unitNames)
          ? calculateStockInfo({ spec, qty: item.qty ?? 1, unitNames })
          : { stockInQty: 1 };

        let l2Code = item.l2Code || null;
        let l2Name = item.l2Name || item.categoryName || "";
        let category = item.category || "未匹配";

        if (!l2Code && categories.length > 0) {
          if (l2Name) {
            for (const l1 of categories) {
              const l2 = l1.children.find((c) => c.name === l2Name);
              if (l2) {
                l2Code = l2.code;
                category = l1.name;
                break;
              }
            }
          } else if (category && category !== "未匹配") {
            const l1 = categories.find((c) => c.name === category);
            if (l1?.children[0]) {
              l2Code = l1.children[0].code;
              l2Name = l1.children[0].name;
            }
          }
        }

        return {
          id: `item-${idx}-${Date.now()}`,
          ingredientId: item.ingredientId ?? null,
          seasoningIngredientId: item.seasoningIngredientId ?? null,
          itemName: item.itemName || item.name || "",
          brand: item.brand || "",
          spec,
          qty: item.qty ?? 1,
          priceUnit: purchaseUnit,
          purchaseUnit,
          unitPrice: item.unitPrice ?? 0,
          amount: item.amount ?? (item.qty ?? 1) * (item.unitPrice ?? 0),
          stockUnit: stockInfo.stockUnit || stockUnit,
          stockInQty: stockInfo.stockInQty ?? 1,
          l2Code,
          l2Name,
          category,
          matched: item.matched ?? false,
          isManual: false,
          storage: item.storage || "常温",
        };
      });

      setItems(mappedItems);
      const autoTotal = mappedItems.reduce(
        (s: number, it: FormItem) => s + (it.amount || 0),
        0
      );
      if (autoTotal > 0 && !totalAmount) {
        setTotalAmount(String(autoTotal.toFixed(2)));
      }
      toast.success(`识别完成，共 ${mappedItems.length} 项`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "识别请求异常";
      toast.error(`识别出错：${message}`);
    } finally {
      setRecognizing(false);
      setRecognizeStatus("");
    }
  };

  const ensureSpec = (it: FormItem): string => {
    if (it.spec.trim()) return it.spec.trim();
    return getDefaultSpec(it.stockUnit);
  };

  const recalcStock = (it: FormItem): Partial<FormItem> => {
    const spec = ensureSpec(it);
    if (!isHighConfidenceSpec(spec, unitNames)) {
      return { stockUnit: it.stockUnit, stockInQty: 1 };
    }
    const info = calculateStockInfo({ spec, qty: it.qty, unitNames });
    return {
      stockUnit: info.stockUnit || it.stockUnit,
      stockInQty: info.stockInQty ?? 1,
    };
  };

  const patchItem = (
    it: FormItem,
    field: keyof FormItem,
    value: FormItem[keyof FormItem]
  ): FormItem => {
    const updated = { ...it, [field]: value };
    if (field === "qty" || field === "unitPrice") {
      updated.amount = round2(
        Number(updated.qty || 0) * Number(updated.unitPrice || 0)
      );
    }
    if (field === "spec" || field === "qty" || field === "purchaseUnit") {
      if (field === "spec") {
        updated.spec = ensureSpec(updated);
      }
      const stock = recalcStock(updated);
      Object.assign(updated, stock);
    }
    if (field === "stockUnit") {
      const info = calculateStockInfo({
        spec: ensureSpec(updated),
        qty: updated.qty,
        targetStockUnit: updated.stockUnit,
        unitNames,
      });
      if (info.stockInQty != null) {
        updated.stockInQty = info.stockInQty;
      }
      if (info.stockUnit) {
        updated.stockUnit = info.stockUnit;
      }
    }
    if (Number(updated.qty) > 0) {
      updated.unitPrice = round2(
        Number(updated.amount) / Number(updated.qty)
      );
    }
    return updated;
  };

  const updateItem = (
    id: string,
    field: keyof FormItem,
    value: FormItem[keyof FormItem]
  ) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? patchItem(it, field, value) : it))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const openIngredientDialog = (item: FormItem) => {
    setDialogItem(item);
    setIngredientDialogOpen(true);
  };

  const handleIngredientSuccess = (
    data: CreatedIngredient,
    type: "ingredient" | "seasoning"
  ) => {
    if (!dialogItem) return;
    const isSeasoning = type === "seasoning";

    const { l1Name, l2Name } = getCategoryNames(categories, data.l2Code);

    setItems((prev) =>
      prev.map((it) =>
        it.id === dialogItem.id
          ? {
              ...it,
              ingredientId: isSeasoning ? null : data.id,
              seasoningIngredientId: isSeasoning ? data.id : null,
              itemName: data.name,
              brand: data.brand || data.alias || it.brand || "",
              l2Code: data.l2Code,
              l2Name,
              stockUnit: data.stockUnit || data.unit || it.stockUnit,
              purchaseUnit: data.purchaseUnit || data.priceUnit || it.purchaseUnit,
              category: l1Name,
              matched: true,
              storage: data.storage || it.storage || "常温",
            }
          : it
      )
    );
    setDialogItem(null);
  };

  const openEditDialog = (item: FormItem) => {
    setEditForm(patchItem({ ...item }, "qty", item.qty));
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditForm(null);
  };

  const updateEditForm = (
    field: keyof FormItem,
    value: FormItem[keyof FormItem]
  ) => {
    setEditForm((prev) => (prev ? patchItem(prev, field, value) : null));
  };

  const handleEditSave = () => {
    if (!editForm) return;
    if (!editForm.itemName.trim()) {
      toast.error("食材名称不能为空");
      return;
    }
    if (!ensureSpec(editForm)) {
      toast.error("采购规格不能为空");
      return;
    }
    if (!editForm.purchaseUnit) {
      toast.error("请选择采购单位");
      return;
    }
    if (!editForm.stockUnit) {
      toast.error("请选择入库单位");
      return;
    }
    if (Number(editForm.qty) <= 0) {
      toast.error("数量必须大于 0");
      return;
    }
    if (Number(editForm.stockInQty) < 0) {
      toast.error("入库数量不能小于 0");
      return;
    }
    if (Number(editForm.amount) < 0) {
      toast.error("采购金额不能为负数");
      return;
    }

    setItems((prev) =>
      prev.map((it) => (it.id === editForm.id ? editForm : it))
    );
    closeEditDialog();
  };

  const validateItem = (it: FormItem): string | null => {
    if (!it.itemName.trim()) return "食材名称不能为空";
    if (!ensureSpec(it)) return "采购规格不能为空";
    if (!it.purchaseUnit) return "采购单位不能为空";
    if (!it.stockUnit) return "入库单位不能为空";
    if (Number(it.qty) <= 0) return "数量必须大于 0";
    if (Number(it.stockInQty) < 0) return "入库数量不能小于 0";
    if (Number(it.amount) < 0) return "采购金额不能为负数";
    if (!it.matched) return "请先完成食材匹配";
    return null;
  };

  const handleSubmit = async () => {
    if (!receiptDate) {
      toast.error("请选择采购日期");
      return;
    }
    if (items.length === 0) {
      toast.error("请至少添加一项采购明细");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const error = validateItem(items[i]);
      if (error) {
        toast.error(`第 ${i + 1} 行：${error}`);
        return;
      }
    }

    const payload = {
      receiptDate,
      supplierId: supplierId ? Number(supplierId) : undefined,
      supplierName: supplierName || null,
      summary: summary || null,
      totalAmount: Number(totalAmount) || items.reduce((s, it) => s + (it.amount || 0), 0),
      imageUrl: imageBase64 || null,
      items: items.map((it) => ({
        ingredientId: it.ingredientId,
        seasoningIngredientId: it.seasoningIngredientId,
        itemName: it.itemName,
        brand: it.brand || null,
        l2Code: it.l2Code,
        l2Name: it.l2Name,
        isManual: it.isManual,
        spec: ensureSpec(it),
        qty: Number(it.qty),
        priceUnit: it.purchaseUnit,
        purchaseUnit: it.purchaseUnit,
        unitPrice: Number(it.unitPrice),
        amount: Number(it.amount),
        stockUnit: it.stockUnit,
        stockInQty: Number(it.stockInQty),
        storage: it.storage || "常温",
      })),
    };

    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/purchase-receipts/${editId}`
        : "/api/purchase-receipts";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || (isEdit ? "保存失败" : "录入失败"));
        return;
      }
      toast.success(isEdit ? "采购单已更新" : "采购单录入成功");
      router.push("/purchases");
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmountComputed = items
    .reduce((s, it) => s + (Number(it.amount) || 0), 0)
    .toFixed(2);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-8 gap-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between flex-none">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/purchases")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEdit ? "编辑采购单" : "录入采购单"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? "修改待结算采购单信息"
                : "上传采购单图片，AI 自动识别并入库"}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {isEdit ? "保存修改" : "确认录入"}
        </Button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* 左侧 */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* 图片上传区 */}
          <div
            className={cn(
              "relative flex-none h-[140px] border-2 border-dashed border-border rounded-md p-4 text-center hover:bg-muted/50 transition-colors cursor-pointer",
              recognizing && "pointer-events-none opacity-80"
            )}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={recognizing}
            />
            {imagePreview ? (
              <div className="relative group h-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="采购单"
                  className="h-full mx-auto rounded-md object-contain"
                />
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewOpen(true);
                  }}
                >
                  <span className="text-white text-sm font-medium flex items-center">
                    <Eye className="mr-1 h-4 w-4" /> 预览
                  </span>
                </div>
                {recognizing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-md text-white z-20">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p className="text-sm font-medium">AI 正在识别采购单</p>
                    <p className="text-xs opacity-80 mt-0.5">
                      {recognizeStatus || "请稍候…"}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center space-y-3">
                <ImageIcon className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">点击或拖拽选择采购单图片</p>
                  <p className="text-xs text-muted-foreground">
                    支持 JPG、PNG，用于 AI 识别与详情展示
                  </p>
                </div>
              </div>
            )}
          </div>

          {imageBase64 && (
            <div className="grid grid-cols-2 gap-3 flex-none">
              <Button onClick={handleRecognize} disabled={recognizing}>
                {recognizing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {recognizing ? "识别中..." : "AI 识别"}
              </Button>
              <Button variant="outline" onClick={triggerReplace}>
                更换采购单
              </Button>
            </div>
          )}

          {/* 基础信息 */}
          <div className="flex-1 min-h-0 rounded-md border p-4 space-y-3 overflow-hidden">
            <h3 className="font-medium flex-none">基础信息</h3>
            <div className="space-y-2 flex-none">
              <Label>
                采购日期 <span className="text-red-500">*</span>
              </Label>
              <DatePicker
                value={receiptDate}
                onChange={(v) => setReceiptDate(v)}
                placeholder="请选择采购日期"
              />
            </div>
            <div className="space-y-2 flex-none">
              <Label>供应商</Label>
              <SupplierSelect
                value={supplierId}
                onChange={(id, name) => {
                  setSupplierId(id);
                  setSupplierName(name);
                }}
              />
            </div>
            <div className="space-y-2 flex-none">
              <Label>采购摘要</Label>
              <Textarea
                placeholder="填写采购摘要..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2 flex-none">
              <Label>
                采购总金额 <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="自动汇总或手动填写"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                明细合计：¥{totalAmountComputed}
              </p>
            </div>
          </div>
        </div>

        {/* 右侧明细 */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="flex items-center justify-between flex-none mb-3">
            <h3 className="font-medium">采购明细 ({items.length} 项)</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("手动增加功能还在开发中")}
            >
              <Plus className="mr-1 h-4 w-4" /> 手动增加
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="flex-1 rounded-md border border-dashed flex flex-col items-center justify-center text-center">
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">暂无明细</p>
              <p className="text-xs text-muted-foreground mt-1">
                上传采购单图片并点击「AI 识别」自动提取
              </p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 rounded-md border overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="whitespace-nowrap w-[70px]">状态</TableHead>
                    <TableHead className="whitespace-nowrap w-[80px]"></TableHead>
                    <TableHead className="whitespace-nowrap w-10">#</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[90px]">二级分类</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[160px]">食材名称</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[150px]">产品品牌名称/别名</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[140px]">采购规格</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[80px]">数量</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[100px]">采购单位</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[100px]">采购金额</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[100px]">入库单位</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[90px]">入库数量</TableHead>
                    <TableHead className="whitespace-nowrap min-w-[110px]">食材单价</TableHead>
                    <TableHead className="whitespace-nowrap w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    const stockUnitPrice =
                      Number(item.stockInQty) > 0
                        ? (Number(item.amount) / Number(item.stockInQty)).toFixed(2)
                        : "0.00";
                    return (
                      <TableRow
                        key={item.id}
                        className={cn(!item.matched && "bg-red-50/50")}
                      >
                        <TableCell className="py-2">
                          {!item.matched ? (
                            <span className="inline-flex items-center rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              <AlertCircle className="mr-1 h-3 w-3" /> 未匹配
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              正常
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          {!item.matched ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-blue-600 px-1"
                              onClick={() => openIngredientDialog(item)}
                            >
                              新增食材
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-blue-600 px-1"
                              onClick={() => openEditDialog(item)}
                            >
                              编辑
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="py-2">{idx + 1}</TableCell>
                        <TableCell className="py-2">
                          <CategoryTag
                            l2Code={item.l2Code}
                            name={item.l2Name || item.l2Code || "—"}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={item.itemName}
                            onChange={(e) =>
                              updateItem(item.id, "itemName", e.target.value)
                            }
                            className="h-9 w-full min-w-0"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={item.brand}
                            onChange={(e) =>
                              updateItem(item.id, "brand", e.target.value)
                            }
                            className="h-9 w-full min-w-0"
                            placeholder="-"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            value={item.spec}
                            onChange={(e) =>
                              updateItem(item.id, "spec", e.target.value)
                            }
                            className="h-9 w-full min-w-0"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number"
                            value={item.qty}
                            onChange={(e) =>
                              updateItem(item.id, "qty", e.target.value)
                            }
                            className="h-9 w-full min-w-0"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <SearchableSelect
                            options={unitOptions}
                            value={item.purchaseUnit}
                            onChange={(v) =>
                              updateItem(item.id, "purchaseUnit", v)
                            }
                            placeholder="单位"
                            title="选择采购单位"
                            searchPlaceholder="搜索单位..."
                            emptyText="暂无匹配单位"
                            clearable={false}
                          />
                        </TableCell>
                        <TableCell className="font-semibold whitespace-nowrap py-2 min-w-[100px]">
                          ¥{(Number(item.amount) || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2">
                          <SearchableSelect
                            options={unitOptions}
                            value={item.stockUnit}
                            onChange={(v) => updateItem(item.id, "stockUnit", v)}
                            placeholder="单位"
                            title="选择入库单位"
                            searchPlaceholder="搜索单位..."
                            emptyText="暂无匹配单位"
                            clearable={false}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.stockInQty}
                            onChange={(e) =>
                              updateItem(item.id, "stockInQty", e.target.value)
                            }
                            className="h-9 w-full min-w-0"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm py-2 min-w-[110px]">
                          ¥{stockUnitPrice}/{item.stockUnit || "—"}
                        </TableCell>
                        <TableCell className="py-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">编辑采购明细</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="py-2">
              <FormSection title="明细信息" cols={2}>
                <FormField label="食材ID" readOnly className="col-span-2">
                  <div className="h-11 flex items-center px-4 border rounded-md bg-muted/50 text-sm">
                    {editForm.ingredientId || editForm.seasoningIngredientId || "—"}
                  </div>
                </FormField>
                <FormField label="一级分类" readOnly>
                  <div className="h-11 flex items-center px-4 border rounded-md bg-muted/50 text-sm">
                    {getCategoryNames(categories, editForm.l2Code).l1Name}
                  </div>
                </FormField>
                <FormField label="二级分类" readOnly>
                  <div className="h-11 flex items-center px-4 border rounded-md bg-muted/50 text-sm">
                    {getCategoryNames(categories, editForm.l2Code).l2Name}
                  </div>
                </FormField>
                <FormField label="食材名称" required>
                  <Input
                    value={editForm.itemName}
                    onChange={(e) =>
                      updateEditForm("itemName", e.target.value)
                    }
                    placeholder="如 带皮五花肉"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField label="产品品牌名称/别名">
                  <Input
                    value={editForm.brand}
                    onChange={(e) => updateEditForm("brand", e.target.value)}
                    placeholder="可选"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField label="采购规格" required>
                  <Input
                    value={editForm.spec}
                    onChange={(e) => updateEditForm("spec", e.target.value)}
                    placeholder="如 1千克*10袋"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField label="数量" required>
                  <Input
                    type="number"
                    value={editForm.qty}
                    onChange={(e) => updateEditForm("qty", e.target.value)}
                    placeholder="1"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField label="采购单位" required>
                  <SearchableSelect
                    options={unitOptions}
                    value={editForm.purchaseUnit}
                    onChange={(v) => updateEditForm("purchaseUnit", v)}
                    placeholder="选择采购单位"
                    title="选择采购单位"
                    searchPlaceholder="搜索单位..."
                    emptyText="暂无匹配单位"
                    clearable={false}
                  />
                </FormField>
                <FormField label="食材单价" required>
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.unitPrice}
                    onChange={(e) =>
                      updateEditForm("unitPrice", e.target.value)
                    }
                    placeholder="单价 × 数量 = 金额"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField label="采购金额">
                  <div className="h-11 flex items-center px-4 border rounded-md bg-muted/50 text-sm">
                    ¥{Number(editForm.amount || 0).toFixed(2)}
                  </div>
                </FormField>
                <FormField label="入库单位" required>
                  <SearchableSelect
                    options={unitOptions}
                    value={editForm.stockUnit}
                    onChange={(v) => updateEditForm("stockUnit", v)}
                    placeholder="选择入库单位"
                    title="选择入库单位"
                    searchPlaceholder="搜索单位..."
                    emptyText="暂无匹配单位"
                    clearable={false}
                  />
                </FormField>
                <FormField label="入库数量" required className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.stockInQty}
                    onChange={(e) =>
                      updateEditForm("stockInQty", e.target.value)
                    }
                    placeholder="默认与数量相同"
                    className="h-11 text-base px-4"
                  />
                </FormField>
              </FormSection>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeEditDialog}
              className="h-11 px-6"
            >
              取消
            </Button>
            <Button onClick={handleEditSave} className="h-11 px-6">
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImagePreviewModal
        src={imagePreview}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      <IngredientFormDialog
        open={ingredientDialogOpen}
        onOpenChange={setIngredientDialogOpen}
        initialData={
          dialogItem
            ? {
                name: dialogItem.itemName,
                l2Code: dialogItem.l2Code || undefined,
                brand: dialogItem.brand,
                alias: dialogItem.brand,
                purchaseSpec: dialogItem.spec,
                purchaseUnit: dialogItem.purchaseUnit,
                stockUnit: dialogItem.stockUnit,
                latestRefPrice: dialogItem.unitPrice,
                storage: dialogItem.storage,
              }
            : undefined
        }
        categories={categories}
        units={units}
        onSuccess={handleIngredientSuccess}
      />
    </div>
  );
}
