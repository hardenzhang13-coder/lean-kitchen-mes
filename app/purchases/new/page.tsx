"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  X,
  ImageIcon,
  Loader2,
  Sparkles,
  AlertCircle,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/app/components/date-picker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RecognizedItem {
  name: string;
  spec?: string;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  amount?: number;
  matched: boolean;
  matchType: string;
  ingredientId: number | null;
  itemName: string;
  stockUnit: string;
  priceUnit: string;
  storage: string;
  category: string;
}

interface FormItem {
  id: string;
  ingredientId: number | null;
  itemName: string;
  spec: string;
  qty: number;
  priceUnit: string;
  unitPrice: number;
  amount: number;
  stockUnit: string;
  stockInQty: number;
  storage: string;
  category: string;
  matched: boolean;
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

export default function NewPurchasePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [receiptDate, setReceiptDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [summary, setSummary] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [imageBase64, setImageBase64] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeStatus, setRecognizeStatus] = useState("");
  const [items, setItems] = useState<FormItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 快速录入弹窗
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddItem, setQuickAddItem] = useState<FormItem | null>(null);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddL1Code, setQuickAddL1Code] = useState("");
  const [quickAddL2Code, setQuickAddL2Code] = useState("");
  const [quickAddUnit, setQuickAddUnit] = useState("斤");
  const [quickAddPriceUnit, setQuickAddPriceUnit] = useState("斤");
  const [quickAddStorage, setQuickAddStorage] = useState("冷藏");
  const [l1Categories, setL1Categories] = useState<L1Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // 读取图片为 base64
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

  // AI 识别
  const handleRecognize = async () => {
    if (!imageBase64) {
      toast.error("请先选择采购单图片");
      return;
    }
    setRecognizing(true);
    setRecognizeStatus("正在上传图片并请求 AI 识别…");
    try {
      setRecognizeStatus("AI 正在分析图片内容…");
      const res = await fetch("/api/purchase-receipts/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imageBase64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "识别失败");
        return;
      }

      setRecognizeStatus("正在匹配食材库…");
      const mappedItems: FormItem[] = (data.items || []).map((item: RecognizedItem, idx: number) => ({
        id: `item-${idx}`,
        ingredientId: item.ingredientId,
        itemName: item.itemName,
        spec: item.spec || "",
        qty: item.qty || 1,
        priceUnit: item.priceUnit,
        unitPrice: item.unitPrice || 0,
        amount: item.amount || (item.qty || 1) * (item.unitPrice || 0),
        stockUnit: item.stockUnit,
        stockInQty: item.qty || 1,
        storage: item.storage,
        category: item.category,
        matched: item.matched,
      }));

      setItems(mappedItems);
      const autoTotal = mappedItems.reduce((s: number, it: FormItem) => s + (it.amount || 0), 0);
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

  // 更新明细字段
  const updateItem = (id: string, field: keyof FormItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        if (field === "qty" || field === "unitPrice") {
          updated.amount = Number(updated.qty || 0) * Number(updated.unitPrice || 0);
        }
        if (field === "qty") {
          updated.stockInQty = Number(value);
        }
        return updated;
      })
    );
  };

  // 删除明细行
  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // 获取当前选中的 L1 对应的 L2 选项
  const currentL2Options = l1Categories.find((c) => c.code === quickAddL1Code)?.children || [];

  // 快速录入弹窗
  const openQuickAdd = async (item: FormItem) => {
    setQuickAddItem(item);
    setQuickAddName(item.itemName);
    setQuickAddL1Code("");
    setQuickAddL2Code("");
    setQuickAddUnit(item.stockUnit || "斤");
    setQuickAddPriceUnit(item.priceUnit || "斤");
    setQuickAddStorage(item.storage || "冷藏");

    try {
      const [catRes, unitRes] = await Promise.all([
        fetch("/api/ingredient-categories"),
        fetch("/api/units"),
      ]);
      const cats = await catRes.json();
      const unitList = await unitRes.json();
      setL1Categories(cats);
      setUnits(unitList);
      if (cats.length > 0) {
        setQuickAddL1Code(cats[0].code);
        if (cats[0].children?.length > 0) {
          setQuickAddL2Code(cats[0].children[0].code);
        }
      }
    } catch {
      // ignore
    }
    setQuickAddOpen(true);
  };

  const handleQuickAddSubmit = async () => {
    if (!quickAddName.trim() || !quickAddL2Code) {
      toast.error("请填写完整信息");
      return;
    }
    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: quickAddName,
          l2Code: quickAddL2Code,
          unit: quickAddUnit,
          priceUnit: quickAddPriceUnit,
          season: "四季",
          storage: quickAddStorage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建失败");
        return;
      }

      // 更新当前行
      if (quickAddItem) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === quickAddItem.id
              ? {
                  ...it,
                  ingredientId: data.id,
                  itemName: data.name,
                  stockUnit: data.unit,
                  priceUnit: data.priceUnit,
                  storage: data.storage,
                  category: "原料",
                  matched: true,
                }
              : it
          )
        );
      }
      toast.success("食材录入成功");
      setQuickAddOpen(false);
    } catch {
      toast.error("创建出错");
    }
  };

  // 提交
  const handleSubmit = async () => {
    if (!receiptDate) {
      toast.error("请选择采购日期");
      return;
    }
    if (items.length === 0) {
      toast.error("请至少添加一项采购明细");
      return;
    }
    const invalidItem = items.find((it) => !it.itemName.trim());
    if (invalidItem) {
      toast.error("存在未填写名称的明细项");
      return;
    }

    // 校验：是否存在未匹配的食材
    const unmatchedItems = items.filter((it) => !it.matched || it.category === "未匹配");
    if (unmatchedItems.length > 0) {
      const names = unmatchedItems.map((it) => it.itemName).join("、");
      toast.error(`请先完成原料信息录入：${names}`);
      return;
    }

    const payload = {
      receiptDate,
      summary: summary || null,
      totalAmount: Number(totalAmount) || items.reduce((s, it) => s + (it.amount || 0), 0),
      imageUrl: null,
      items: items.map((it) => ({
        ingredientId: it.ingredientId,
        itemName: it.itemName,
        spec: it.spec || null,
        qty: Number(it.qty),
        priceUnit: it.priceUnit,
        unitPrice: Number(it.unitPrice),
        amount: Number(it.amount),
        stockUnit: it.stockUnit,
        stockInQty: Number(it.stockInQty),
        storage: it.storage,
      })),
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/purchase-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "录入失败");
        return;
      }
      toast.success("采购单录入成功");
      router.push("/purchases");
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/purchases")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">录入采购单</h1>
            <p className="text-sm text-muted-foreground">上传采购单图片，AI 自动识别并入库</p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          确认录入
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：表单 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 图片上传 */}
          <div
            className={cn(
              "relative border-2 border-dashed border-border rounded-xl p-6 text-center space-y-3 hover:bg-muted/50 transition-colors cursor-pointer",
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
              <div className="relative">
                <img src={imagePreview} alt="采购单" className="max-h-64 mx-auto rounded-lg object-contain" />
                <button
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImagePreview("");
                    setImageBase64("");
                  }}
                  disabled={recognizing}
                >
                  <X className="h-3 w-3" />
                </button>
                {recognizing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-lg text-white z-20">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p className="text-sm font-medium">AI 正在识别采购单</p>
                    <p className="text-xs opacity-80 mt-0.5">{recognizeStatus || "请稍候…"}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">点击或拖拽选择采购单图片</p>
                  <p className="text-xs text-muted-foreground">支持 JPG、PNG，仅用于 AI 识别</p>
                </div>
              </>
            )}
          </div>

          {imageBase64 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleRecognize}
              disabled={recognizing}
            >
              {recognizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              {recognizing ? "识别中..." : "AI 识别图片内容"}
            </Button>
          )}

          {/* 基础信息 */}
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-medium">基础信息</h3>
            <div className="space-y-2">
              <Label>采购日期 <span className="text-red-500">*</span></Label>
              <DatePicker
                value={receiptDate}
                onChange={(v) => setReceiptDate(v)}
                placeholder="请选择采购日期"
              />
            </div>
            <div className="space-y-2">
              <Label>采购摘要</Label>
              <Textarea
                placeholder="填写采购摘要..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>采购总金额 <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.01"
                placeholder="自动汇总或手动填写"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                明细合计：¥{items.reduce((s, it) => s + (Number(it.amount) || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* 右侧：明细表格 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">采购明细 ({items.length} 项)</h3>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">暂无明细</p>
              <p className="text-xs text-muted-foreground mt-1">上传采购单图片并点击「AI 识别」自动提取</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>状态</TableHead>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>食材名称</TableHead>
                    <TableHead>规格</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>计价单位</TableHead>
                    <TableHead>单价</TableHead>
                    <TableHead>金额</TableHead>
                    <TableHead>入库单位</TableHead>
                    <TableHead>入库量</TableHead>
                    <TableHead>储存</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow
                      key={item.id}
                      className={
                        !item.matched || item.category === "未匹配"
                          ? "bg-red-50/50"
                          : item.category === "调料-未入库"
                          ? "bg-amber-50/50"
                          : undefined
                      }
                    >
                      {/* 状态与录入 */}
                      <TableCell>
                        {!item.matched || item.category === "未匹配" ? (
                          <div className="flex flex-col gap-1 min-w-[80px]">
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              <AlertCircle className="mr-1 h-3 w-3" />
                              未匹配
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-blue-600 px-0 justify-start"
                              onClick={() => openQuickAdd(item)}
                            >
                              录入
                            </Button>
                          </div>
                        ) : item.category === "调料-未入库" ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            调料-不入库
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            已匹配
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <Input
                          value={item.itemName}
                          onChange={(e) => updateItem(item.id, "itemName", e.target.value)}
                          className="min-w-[120px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.spec}
                          onChange={(e) => updateItem(item.id, "spec", e.target.value)}
                          className="min-w-[80px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.qty}
                          onChange={(e) => updateItem(item.id, "qty", e.target.value)}
                          className="min-w-[70px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.priceUnit}
                          onChange={(e) => updateItem(item.id, "priceUnit", e.target.value)}
                          className="min-w-[70px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                          className="min-w-[80px]"
                        />
                      </TableCell>
                      <TableCell className="font-semibold">
                        ¥{(Number(item.amount) || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.stockUnit}
                          onChange={(e) => updateItem(item.id, "stockUnit", e.target.value)}
                          className="min-w-[70px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.stockInQty}
                          onChange={(e) => updateItem(item.id, "stockInQty", e.target.value)}
                          className="min-w-[70px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={item.storage}
                          onChange={(e) => updateItem(item.id, "storage", e.target.value)}
                          className="min-w-[70px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* 快速录入弹窗 */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>快速录入为食材</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>食材名称</Label>
              <Input value={quickAddName} onChange={(e) => setQuickAddName(e.target.value)} />
            </div>
            {/* 一二级级联选择 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>一级分类</Label>
                <Select
                  value={quickAddL1Code}
                  onValueChange={(v) => {
                    if (!v) return;
                    setQuickAddL1Code(v);
                    const l1 = l1Categories.find((c) => c.code === v);
                    if (l1?.children && l1.children.length > 0) {
                      setQuickAddL2Code(l1.children[0].code);
                    } else {
                      setQuickAddL2Code("");
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="选择一级分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {l1Categories.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>二级分类</Label>
                <Select
                  value={quickAddL2Code}
                  onValueChange={(v) => v && setQuickAddL2Code(v)}
                >
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="选择二级分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentL2Options.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>入库单位</Label>
                <Select value={quickAddUnit} onValueChange={(v) => v && setQuickAddUnit(v)}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.name}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>计价单位</Label>
                <Select value={quickAddPriceUnit} onValueChange={(v) => v && setQuickAddPriceUnit(v)}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.name}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>储存条件</Label>
              <Select value={quickAddStorage} onValueChange={(v) => v && setQuickAddStorage(v)}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="冷藏">冷藏</SelectItem>
                  <SelectItem value="冷冻">冷冻</SelectItem>
                  <SelectItem value="常温">常温</SelectItem>
                  <SelectItem value="干货">干货</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setQuickAddOpen(false)}>
                取消
              </Button>
              <Button onClick={handleQuickAddSubmit}>确认录入</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
