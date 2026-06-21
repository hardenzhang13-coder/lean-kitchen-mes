"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Search,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  RotateCcw,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ProcessTimeline } from "./process-timeline";
import { SelectTileMode } from "@/app/components/select-tile-mode";

// ---- Types ----
type DishCategory = { id: number; code: string; name: string };

type IngredientOption = {
  id: number;
  name: string;
  code?: string;
  brand?: string;
  alias?: string | null;
  unitPrice?: number;
  unit?: string;
};

type BomItem = {
  id: string;
  sourceId: number;
  name: string;
  amountG: string;
  spec?: string;
  brand?: string;
};

type ProcessStep = {
  stage: string;
  stepNo: number;
  object: string;
  action: string;
  description?: string | null;
  tool?: string | null;
  standard?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DishCategory[];
  netIngredients: IngredientOption[];
  minorIngredients: IngredientOption[];
  seasonings: IngredientOption[];
  sauces: IngredientOption[];
  editingDish?: {
    id: number;
    name: string;
    intro: string | null;
    categoryId: number;
    cuisine: string | null;
    technique: string | null;
    taste: string | null;
    portion: string;
    season: string;
    meatType: string | null;
    status: string;
    netDetails: any[];
    seasoningDetails: any[];
    sauceDetails: any[];
    processes: ProcessStep[];
  } | null;
  onSuccess: () => void;
}

// ---- Options ----
const cuisineOptions = ["川菜", "粤菜", "湘菜", "鲁菜", "苏菜", "浙菜", "闽菜", "徽菜", "家常菜"];
const techniqueOptions = ["爆炒", "红烧", "清蒸", "炖煮", "煎炸", "凉拌", "干锅", "烧烤", "卤制", "煲汤", "烩", "熘", "扒", "焗"];
const tasteOptions = ["麻辣", "咸鲜", "酸甜", "酸辣", "香辣", "清淡", "酱香", "蒜香", "椒盐", "糖醋", "鱼香", "蚝油"];
const portionOptions = ["正餐份量", "小份", "大份", "例份"];
const seasonOptions = ["四季", "春", "夏", "秋", "冬"];
const meatTypeOptions = ["荤菜", "素菜", "小荤菜"];

const steps = [
  { key: 1, title: "基本信息" },
  { key: 2, title: "主料与辅料" },
  { key: 3, title: "小料与酱料" },
  { key: 4, title: "调料" },
  { key: 5, title: "加工工艺" },
];

// Helper: generate UUID
const uid = () => Math.random().toString(36).slice(2, 10);

export function DishCreateWizard({
  open,
  onOpenChange,
  categories,
  netIngredients,
  minorIngredients,
  seasonings,
  sauces,
  editingDish,
  onSuccess,
}: Props) {
  const isEdit = !!editingDish;
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    intro: "",
    categoryId: "",
    cuisine: "",
    technique: "",
    taste: "",
    portion: "正餐份量",
    season: "四季",
    meatType: "",
  });

  // BOM state
  const [mainBom, setMainBom] = useState<BomItem[]>([]);
  const [supportBom, setSupportBom] = useState<BomItem[]>([]);
  const [minorBom, setMinorBom] = useState<BomItem[]>([]);
  const [sauceBom, setSauceBom] = useState<BomItem[]>([]);
  const [seasoningBom, setSeasoningBom] = useState<BomItem[]>([]);

  // Process state
  const [processes, setProcesses] = useState<ProcessStep[]>([]);

  // Search pickers
  const [pickerOpen, setPickerOpen] = useState<"main" | "support" | "minor" | "sauce" | "seasoning" | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [manualName, setManualName] = useState("");

  // Load editing data
  useEffect(() => {
    if (editingDish) {
      setForm({
        name: editingDish.name,
        intro: editingDish.intro || "",
        categoryId: String(editingDish.categoryId),
        cuisine: editingDish.cuisine || "",
        technique: editingDish.technique || "",
        taste: editingDish.taste || "",
        portion: editingDish.portion,
        season: editingDish.season,
        meatType: editingDish.meatType || "",
      });
      setMainBom(
        editingDish.netDetails
          ?.filter((d: any) => d.role === "main")
          .map((d: any) => ({
            id: uid(),
            sourceId: d.netIngId,
            name: d.netIngredient?.name || "",
            amountG: String(d.amountG),
            spec: d.spec || "",
          })) || []
      );
      setSupportBom(
        editingDish.netDetails
          ?.filter((d: any) => d.role === "support")
          .map((d: any) => ({
            id: uid(),
            sourceId: d.netIngId,
            name: d.netIngredient?.name || "",
            amountG: String(d.amountG),
            spec: d.spec || "",
          })) || []
      );
      setMinorBom(
        editingDish.seasoningDetails
          ?.filter((d: any) => d.type === "minor")
          .map((d: any) => ({
            id: uid(),
            sourceId: d.sourceId,
            name: d.name || "",
            amountG: String(d.amountG),
            brand: d.brand || "",
          })) || []
      );
      setSeasoningBom(
        editingDish.seasoningDetails
          ?.filter((d: any) => d.type === "seasoning")
          .map((d: any) => ({
            id: uid(),
            sourceId: d.sourceId,
            name: d.name || "",
            amountG: String(d.amountG),
            brand: d.brand || "",
          })) || []
      );
      setSauceBom(
        editingDish.sauceDetails?.map((d: any) => ({
          id: uid(),
          sourceId: d.sauceId,
          name: d.sauce?.name || "",
          amountG: String(d.amountG),
          brand: d.brand || "",
        })) || []
      );
      setProcesses(editingDish.processes || []);
    } else {
      resetForm();
    }
  }, [editingDish]);

  const resetForm = () => {
    setStep(1);
    setForm({
      name: "",
      intro: "",
      categoryId: "",
      cuisine: "",
      technique: "",
      taste: "",
      portion: "正餐份量",
      season: "四季",
      meatType: "",
    });
    setMainBom([]);
    setSupportBom([]);
    setMinorBom([]);
    setSauceBom([]);
    setSeasoningBom([]);
    setProcesses([]);
  };

  // ---- Validation ----
  const validateStep1 = () => {
    if (!form.name.trim()) return "菜品名称不能为空";
    if (!form.categoryId) return "请选择菜品类别";
    if (!form.cuisine) return "请选择菜系";
    if (!form.technique) return "请选择做法";
    if (!form.taste) return "请选择口味";
    if (!form.portion) return "请选择份量";
    if (!form.season) return "请选择季节";
    if (!form.meatType) return "请选择荤素类型";
    return null;
  };

  const canPublish = () => {
    if (validateStep1()) return false;
    if (mainBom.length === 0 && supportBom.length === 0) return false;
    if (seasoningBom.length === 0) return false;
    return true;
  };

  // ---- Navigation ----
  const handleNext = () => {
    if (step === 1) {
      const err = validateStep1();
      if (err) { toast.error(err); return; }
    }
    setStep((s) => Math.min(s + 1, 5));
  };
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  // ---- Submit helpers ----
  const buildPayload = () => {
    const netDetails = [
      ...mainBom.map((b) => ({ role: "main" as const, netIngId: b.sourceId, amountG: Number(b.amountG) || 0, spec: b.spec || null })),
      ...supportBom.map((b) => ({ role: "support" as const, netIngId: b.sourceId, amountG: Number(b.amountG) || 0, spec: b.spec || null })),
    ];
    const seasoningDetails = [
      ...minorBom.map((b) => ({ type: "minor" as const, sourceId: b.sourceId, amountG: Number(b.amountG) || 0, brand: b.brand || null })),
      ...seasoningBom.map((b) => ({ type: "seasoning" as const, sourceId: b.sourceId, amountG: Number(b.amountG) || 0, brand: b.brand || null })),
    ];
    const sauceDetails = sauceBom.map((b) => ({
      sauceId: b.sourceId,
      amountG: Number(b.amountG) || 0,
      brand: b.brand || null,
    }));
    return { netDetails, seasoningDetails, sauceDetails };
  };

  const handleSave = async (targetStatus: "draft" | "pending" | "published") => {
    if (targetStatus === "published") {
      const err = validateStep1();
      if (err) { toast.error(err); return; }
      if (mainBom.length === 0 && supportBom.length === 0) {
        toast.error("主料与辅料不能为空"); return;
      }
      if (seasoningBom.length === 0) {
        toast.error("调料不能为空"); return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        intro: form.intro || null,
        categoryId: Number(form.categoryId),
        cuisine: form.cuisine,
        technique: form.technique,
        taste: form.taste,
        portion: form.portion,
        season: form.season,
        meatType: form.meatType,
        status: targetStatus,
      };

      let dishId: number;
      if (isEdit) {
        const res = await fetch(`/api/dishes/${editingDish!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || "保存失败"); return; }
        dishId = editingDish!.id;
      } else {
        const res = await fetch("/api/dishes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || "创建失败"); return; }
        dishId = data.data?.id;
      }

      // Save BOM
      const { netDetails, seasoningDetails, sauceDetails } = buildPayload();
      const hasBom = netDetails.length > 0 || seasoningDetails.length > 0 || sauceDetails.length > 0;
      if (hasBom) {
        await fetch(`/api/dishes/${dishId}/bom`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ netDetails, seasoningDetails, sauceDetails }),
        });
      }

      // Save processes
      if (processes.length > 0) {
        await fetch(`/api/dishes/${dishId}/processes`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ processes }),
        });
      }

      toast.success(targetStatus === "published" ? "发布成功" : "草稿已保存");
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  // ---- BOM helpers ----
  const addBomItem = (
    setter: React.Dispatch<React.SetStateAction<BomItem[]>>,
    item: Omit<BomItem, "id">
  ) => {
    setter((prev) => [...prev, { ...item, id: uid() }]);
  };
  const removeBomItem = (setter: React.Dispatch<React.SetStateAction<BomItem[]>>, id: string) => {
    setter((prev) => prev.filter((b) => b.id !== id));
  };
  const updateBomItem = (
    setter: React.Dispatch<React.SetStateAction<BomItem[]>>,
    id: string,
    field: keyof BomItem,
    value: string
  ) => {
    setter((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)));
  };

  // ---- Picker logic ----
  const getPickerOptions = () => {
    const s = pickerSearch.trim().toLowerCase();
    switch (pickerOpen) {
      case "main":
      case "support":
        return netIngredients.filter((i) => i.name.toLowerCase().includes(s));
      case "minor":
        return minorIngredients.filter((i) => i.name.toLowerCase().includes(s));
      case "sauce":
        return sauces.filter((i) => i.name.toLowerCase().includes(s));
      case "seasoning":
        return seasonings.filter((i) => i.name.toLowerCase().includes(s));
      default:
        return [];
    }
  };

  const getPickerTitle = () => {
    switch (pickerOpen) {
      case "main": return "选择主料";
      case "support": return "选择辅料";
      case "minor": return "选择小料";
      case "sauce": return "选择酱料";
      case "seasoning": return "选择调料";
      default: return "";
    }
  };

  const handlePick = (item: IngredientOption) => {
    const base = { sourceId: item.id, name: item.name, amountG: "" };
    switch (pickerOpen) {
      case "main":
        addBomItem(setMainBom, { ...base, spec: "" });
        break;
      case "support":
        addBomItem(setSupportBom, { ...base, spec: "" });
        break;
      case "minor":
        addBomItem(setMinorBom, { ...base, brand: item.brand || "" });
        break;
      case "sauce":
        addBomItem(setSauceBom, { ...base, brand: item.brand || "" });
        break;
      case "seasoning":
        addBomItem(setSeasoningBom, { ...base, brand: item.alias || item.brand || "" });
        break;
    }
    setPickerOpen(null);
    setPickerSearch("");
    setManualName("");
  };

  const handleManualAdd = () => {
    if (!manualName.trim()) return;
    const base = { sourceId: -1, name: manualName.trim(), amountG: "" };
    switch (pickerOpen) {
      case "main": addBomItem(setMainBom, { ...base, spec: "" }); break;
      case "support": addBomItem(setSupportBom, { ...base, spec: "" }); break;
      case "minor": addBomItem(setMinorBom, { ...base, brand: "" }); break;
      case "sauce": addBomItem(setSauceBom, { ...base, brand: "" }); break;
      case "seasoning": addBomItem(setSeasoningBom, { ...base, brand: "" }); break;
    }
    setPickerOpen(null);
    setPickerSearch("");
    setManualName("");
  };

  // ---- Render helpers ----
  const renderTileGroup = (
    label: string,
    options: string[],
    value: string,
    onChange: (v: string) => void,
    required?: boolean
  ) => (
    <div className="space-y-2">
      <Label className="text-base">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <SelectTileMode
        value={value}
        onChange={onChange}
        options={options.map((opt) => ({ value: opt, label: opt }))}
        placeholder={`请选择${label}`}
        title={`选择${label}`}
        searchPlaceholder={`搜索${label}...`}
        required={required}
      />
    </div>
  );

  const renderBomSection = (
    title: string,
    items: BomItem[],
    setter: React.Dispatch<React.SetStateAction<BomItem[]>>,
    pickerType: "main" | "support" | "minor" | "sauce" | "seasoning",
    showSpec?: boolean
  ) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setPickerOpen(pickerType); setPickerSearch(""); setManualName(""); }}
        >
          <Plus className="h-4 w-4 mr-1" />
          添加
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无{title}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg border p-2">
              <span className="flex-1 text-sm font-medium truncate">{item.name}</span>
              {showSpec && (
                <Input
                  value={item.spec || ""}
                  onChange={(e) => updateBomItem(setter, item.id, "spec", e.target.value)}
                  placeholder="规格"
                  className="w-[100px] h-8 text-sm"
                />
              )}
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={item.amountG}
                  onChange={(e) => updateBomItem(setter, item.id, "amountG", e.target.value)}
                  placeholder="用量"
                  className="w-[80px] h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">g</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                aria-label="删除BOM项"
                onClick={() => removeBomItem(setter, item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onOpenChange(false); resetForm(); } }}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto [&>button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {isEdit ? "编辑菜品" : "新增菜品"} — {steps.find((s) => s.key === step)?.title}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1">
          {steps.map((s) => (
            <div key={s.key} className="flex items-center gap-1">
              <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium ${
                  s.key === step
                    ? "bg-primary text-primary-foreground"
                    : s.key < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.key < step ? <Check className="h-3.5 w-3.5" /> : s.key}
              </div>
              <span
                className={`text-xs ${
                  s.key === step ? "text-foreground font-medium" : "text-muted-foreground"
                }`}
              >
                {s.title}
              </span>
              {s.key < steps.length && <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-6 py-2">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-base">菜品名称 <span className="text-destructive">*</span></Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如 宫保鸡丁"
                  className="h-11 text-base px-4"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">菜品类别 <span className="text-destructive">*</span></Label>
                <SelectTileMode
                  value={form.categoryId}
                  onChange={(v) => setForm({ ...form, categoryId: v })}
                  options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                  placeholder="请选择菜品类别"
                  title="选择菜品类别"
                  searchPlaceholder="搜索类别..."
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base">菜品描述</Label>
              <Textarea
                value={form.intro}
                onChange={(e) => setForm({ ...form, intro: e.target.value })}
                placeholder="简要描述菜品特点（可选）"
                rows={3}
                className="text-base px-4 py-3"
              />
            </div>
            <div className="grid grid-cols-2 gap-5">
              {renderTileGroup("菜系", cuisineOptions, form.cuisine, (v) => setForm({ ...form, cuisine: v }), true)}
              {renderTileGroup("做法", techniqueOptions, form.technique, (v) => setForm({ ...form, technique: v }), true)}
            </div>
            <div className="grid grid-cols-2 gap-5">
              {renderTileGroup("口味", tasteOptions, form.taste, (v) => setForm({ ...form, taste: v }), true)}
              {renderTileGroup("荤素类型", meatTypeOptions, form.meatType, (v) => setForm({ ...form, meatType: v }), true)}
            </div>
            <div className="grid grid-cols-2 gap-5">
              {renderTileGroup("份量", portionOptions, form.portion, (v) => setForm({ ...form, portion: v }), true)}
              {renderTileGroup("季节", seasonOptions, form.season, (v) => setForm({ ...form, season: v }), true)}
            </div>
          </div>
        )}

        {/* Step 2: Main & Support */}
        {step === 2 && (
          <div className="space-y-5 py-2">
            {renderBomSection("主料", mainBom, setMainBom, "main", true)}
            {renderBomSection("辅料", supportBom, setSupportBom, "support", true)}
          </div>
        )}

        {/* Step 3: Minor & Sauce */}
        {step === 3 && (
          <div className="space-y-5 py-2">
            {renderBomSection("小料", minorBom, setMinorBom, "minor")}
            {renderBomSection("酱料", sauceBom, setSauceBom, "sauce")}
          </div>
        )}

        {/* Step 4: Seasoning */}
        {step === 4 && (
          <div className="space-y-5 py-2">
            {renderBomSection("调料", seasoningBom, setSeasoningBom, "seasoning")}
          </div>
        )}

        {/* Step 5: Process */}
        {step === 5 && (
          <div className="py-2">
            <ProcessTimeline steps={processes} onChange={setProcesses} />
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="outline" onClick={handlePrev} className="h-10">
                <ChevronLeft className="mr-1 h-4 w-4" />
                上一步
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step >= 2 && step < 5 && (
              <Button
                variant="outline"
                onClick={() => handleSave("draft")}
                disabled={submitting}
                className="h-10"
              >
                <span aria-live="polite" className="inline-flex items-center">
                  {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  <Save className="mr-1 h-4 w-4" />
                  存草稿
                </span>
              </Button>
            )}
            {step < 5 ? (
              <Button onClick={handleNext} className="h-10">
                下一步
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleSave("draft")}
                  disabled={submitting}
                  className="h-10"
                >
                  <span aria-live="polite" className="inline-flex items-center">
                    {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    <Save className="mr-1 h-4 w-4" />
                    存草稿
                  </span>
                </Button>
                <Button
                  onClick={() => handleSave("published")}
                  disabled={submitting || !canPublish()}
                  className="h-10"
                >
                  <span aria-live="polite" className="inline-flex items-center">
                    {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    <Send className="mr-1 h-4 w-4" />
                    发布
                  </span>
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Ingredient Picker Dialog */}
      <Dialog open={!!pickerOpen} onOpenChange={() => { setPickerOpen(null); setPickerSearch(""); setManualName(""); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{getPickerTitle()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="输入名称模糊搜索..."
                className="pl-9 h-10"
                autoFocus
              />
            </div>
            <div className="max-h-[240px] overflow-y-auto space-y-1">
              {getPickerOptions().map((item) => (
                <button
                  key={item.id}
                  onClick={() => handlePick(item)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted transition-colors flex items-center justify-between"
                >
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.brand && (
                    <span className="text-xs text-muted-foreground">{item.brand}</span>
                  )}
                </button>
              ))}
              {getPickerOptions().length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">
                  未找到匹配结果
                </div>
              )}
            </div>
            {getPickerOptions().length === 0 && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs text-muted-foreground">搜索无结果？可手动输入名称添加：</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="手动输入名称"
                    className="h-10"
                  />
                  <Button onClick={handleManualAdd} disabled={!manualName.trim()}>
                    添加
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
