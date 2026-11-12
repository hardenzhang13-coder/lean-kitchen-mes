"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, PackageOpen, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  NetIngredientFormFields,
  NetIngredientFormData,
  CategoryL1,
  RawIngredientOption,
} from "@/app/components/ingredients/net-ingredient-form-fields";
import { EmptyState } from "@/app/components/ui/empty-state";
import { LoadingState } from "@/app/components/ui/loading-state";
import { TablePreviewDialog } from "@/app/components/ui/table-preview-dialog";
import { parseList } from "@/lib/client/api";
import { toast } from "sonner";

export type NetIngredientItem = {
  id: number;
  code: string;
  name: string;
  packageSpec: number | null;
  packageMaterial: string | null;
  packageSize: string | null;
  processingFeePerJin: number | null;
  yieldRate: number | null;
  unitPrice: number;
  costPricePerJin: number | null;
  outPricePerJin: number | null;
  standardPackagePrice: number | null;
  grossMarginRate: number | null;
  unit: string;
  sourceIngredientId: number | null;
  l2Code: string;
};

interface NetIngredientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "net" | "minor" | "convert";
  sourceIngredientId?: number;
  initialData?: NetIngredientItem;
  categories: CategoryL1[];
  rawIngredients: RawIngredientOption[];
  onSuccess?: () => void;
}

const emptyForm: NetIngredientFormData = {
  name: "",
  l1Code: "",
  l2Code: "",
  sourceIngredientId: "",
  packageSpec: "500",
  packageMaterial: "密封袋",
  packageSize: "50cm×40cm",
  // 封装加工费默认 0.35 元/斤（最常见档位，可改）
  processingFeePerJin: "0.35",
  yieldRate: "",
  unitPrice: "",
  grossMarginRate: "",
};

export function NetIngredientFormDialog({
  open,
  onOpenChange,
  mode = "net",
  sourceIngredientId: propSourceId,
  initialData,
  categories,
  rawIngredients,
  onSuccess,
}: NetIngredientFormDialogProps) {
  const [form, setForm] = useState<NetIngredientFormData>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [rightList, setRightList] = useState<NetIngredientItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const unitPriceManuallySet = useRef(false);
  /** 右侧规格列表请求序号：防止切换来源原料后，旧请求的响应覆盖新数据 */
  const listRequestSeq = useRef(0);

  const isMinor = mode === "minor";
  const isConvert = mode === "convert";

  const findParentL1 = useCallback(
    (l2Code?: string) => {
      if (!l2Code) return undefined;
      return categories.find((cat) =>
        cat.children.some((child) => child.code === l2Code)
      );
    },
    [categories]
  );

  const getRawIngredient = useCallback(
    (id?: number) => {
      if (!id) return undefined;
      return rawIngredients.find((ri) => ri.id === id);
    },
    [rawIngredients]
  );

  // Initialize form when dialog opens or props change
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;

    unitPriceManuallySet.current = false;

    if (initialData) {
      const parentL1 = findParentL1(initialData.l2Code);
      setForm({
        name: initialData.name || "",
        l1Code: isMinor ? "MIN" : parentL1?.code || "",
        l2Code: initialData.l2Code || "",
        sourceIngredientId: initialData.sourceIngredientId
          ? String(initialData.sourceIngredientId)
          : "",
        packageSpec: initialData.packageSpec != null ? String(initialData.packageSpec) : "",
        packageMaterial: initialData.packageMaterial || "",
        packageSize: initialData.packageSize || "",
        processingFeePerJin:
          initialData.processingFeePerJin != null ? String(initialData.processingFeePerJin) : "",
        yieldRate: initialData.yieldRate != null ? String(initialData.yieldRate) : "",
        unitPrice: String(initialData.unitPrice),
        grossMarginRate:
          initialData.grossMarginRate != null ? String(initialData.grossMarginRate) : "",
      });
      return;
    }

    if (isConvert && propSourceId) {
      const raw = getRawIngredient(propSourceId);
      const parentL1 = raw ? findParentL1(raw.l2Code) : undefined;
      setForm({
        ...emptyForm,
        l1Code: parentL1?.code || "",
        l2Code: raw?.l2Code || "",
        sourceIngredientId: String(propSourceId),
      });
      return;
    }

    if (isMinor) {
      const minorL1 = categories.find((c) => c.code === "MIN");
      const firstL2 = minorL1?.children[0];
      setForm({ ...emptyForm, l1Code: "MIN", l2Code: firstL2?.code || "" });
      return;
    }

    // 新增净料：默认选中第一个一级分类与二级分类
    const firstL1 = categories[0];
    const firstL2 = firstL1?.children[0];
    setForm({
      ...emptyForm,
      l1Code: firstL1?.code || "",
      l2Code: firstL2?.code || "",
    });
  }, [open, initialData, isConvert, isMinor, propSourceId, findParentL1, getRawIngredient, categories]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 自动计算净料单价（净料/小料同口径）：来源原料每斤单价 ÷ (出成率 / 100)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    if (unitPriceManuallySet.current) return;

    const sourceId = Number(form.sourceIngredientId);
    const yieldRate = Number(form.yieldRate);
    if (!sourceId || !yieldRate || yieldRate <= 0 || yieldRate > 500) {
      return;
    }

    const raw = getRawIngredient(sourceId);
    const pricePerJin = raw?.pricePerJin != null ? Number(raw.pricePerJin) : null;
    if (pricePerJin == null || pricePerJin <= 0) return;

    // 净料单价（元/斤）= 原料每斤单价 ÷ (出成率 / 100)
    const calculated = Number((pricePerJin / (yieldRate / 100)).toFixed(2));
    setForm((prev) =>
      prev.unitPrice !== String(calculated)
        ? { ...prev, unitPrice: String(calculated) }
        : prev
    );
  }, [open, isMinor, form.sourceIngredientId, form.yieldRate, getRawIngredient]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Load right-side list (按来源原料聚合已建规格，净料/小料同)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    const sourceId = Number(form.sourceIngredientId);
    const seq = ++listRequestSeq.current;
    if (!sourceId) {
      setRightList([]);
      return;
    }

    const fetchList = async () => {
      setLoadingList(true);
      // 切换来源时先清空，避免残留上一来源的规格数据（此前会显示"最新一次转化"的净料）
      setRightList([]);
      try {
        const res = await fetch(
          `/api/net-ingredients?sourceIngredientId=${sourceId}`
        );
        if (res.ok) {
          const list = await parseList<NetIngredientItem>(res);
          if (listRequestSeq.current === seq) setRightList(list);
        }
      } catch {
        // ignore
      } finally {
        if (listRequestSeq.current === seq) setLoadingList(false);
      }
    };

    fetchList();
  }, [open, isMinor, form.sourceIngredientId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleChange = (field: keyof NetIngredientFormData, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "l1Code" && !isMinor) {
        next.l2Code = "";
      }
      return next;
    });

    if (field === "unitPrice") {
      unitPriceManuallySet.current = true;
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = `${isMinor ? "小料" : "净料"}名称不能为空`;
    if (!form.l2Code) next.l2Code = "请选择二级分类";
    if (!form.sourceIngredientId) next.sourceIngredientId = "请选择来源原料";

    const yieldRate = Number(form.yieldRate);
    if (!form.yieldRate || yieldRate <= 0 || yieldRate > 500) {
      next.yieldRate = "出成率必须在 0.01-500 之间（上浆/挂糊类可超过 100）";
    }
    // 包装规格（g）必填
    const pkg = Number(form.packageSpec);
    if (!form.packageSpec || !Number.isInteger(pkg) || pkg < 1) {
      next.packageSpec = "请填写有效的包装规格（g）";
    }
    if (form.processingFeePerJin && Number(form.processingFeePerJin) < 0) {
      next.processingFeePerJin = "封装加工费不能为负数";
    }

    if (
      form.grossMarginRate !== "" &&
      (Number.isNaN(Number(form.grossMarginRate)) ||
        Number(form.grossMarginRate) < 0 ||
        Number(form.grossMarginRate) >= 100)
    ) {
      next.grossMarginRate = "毛利率必须在 0-95 之间，留空 = 0";
    }

    if (form.unitPrice === "" || Number(form.unitPrice) < 0) {
      next.unitPrice = "请输入有效的单价";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetForCreate = () => {
    unitPriceManuallySet.current = false;
    if (isMinor) {
      const minorL1 = categories.find((c) => c.code === "MIN");
      const firstL2 = minorL1?.children[0];
      setForm({ ...emptyForm, l1Code: "MIN", l2Code: firstL2?.code || "" });
    } else {
      const firstL1 = categories[0];
      const firstL2 = firstL1?.children[0];
      setForm({
        ...emptyForm,
        l1Code: firstL1?.code || "",
        l2Code: firstL2?.code || "",
      });
    }
    setErrors({});
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        unitPrice: Number(form.unitPrice),
        l2Code: form.l2Code,
        sourceIngredientId: Number(form.sourceIngredientId),
        yieldRate: Number(form.yieldRate),
        packageSpec: Number(form.packageSpec),
        packageMaterial: form.packageMaterial.trim() || null,
        packageSize: form.packageSize.trim() || null,
        processingFeePerJin: form.processingFeePerJin
          ? Number(form.processingFeePerJin)
          : null,
        grossMarginRate: form.grossMarginRate !== "" ? Number(form.grossMarginRate) : null,
        autoCalculate: false,
      };

      const url = initialData?.id
        ? `/api/net-ingredients/${initialData.id}`
        : "/api/net-ingredients";
      const method = initialData?.id ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "保存失败");
        return;
      }

      toast.success(initialData?.id ? "更新成功" : "创建成功");

      // 小料与编辑/转净料场景保存后关闭弹窗；新增净料保持打开以便连续录入同来源规格
      if (initialData?.id || isConvert || isMinor) {
        onOpenChange(false);
        onSuccess?.();
      } else {
        resetForCreate();
        const sourceId = Number(form.sourceIngredientId);
        if (sourceId) {
          const seq = ++listRequestSeq.current;
          setLoadingList(true);
          setRightList([]);
          try {
            const listRes = await fetch(
              `/api/net-ingredients?sourceIngredientId=${sourceId}`
            );
            if (listRes.ok) {
              const list = await parseList<NetIngredientItem>(listRes);
              if (listRequestSeq.current === seq) setRightList(list);
            }
          } catch {
            // ignore
          } finally {
            if (listRequestSeq.current === seq) setLoadingList(false);
          }
        }
      }
    } catch {
      toast.error("保存出错");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditFromList = (row: NetIngredientItem) => {
    const parentL1 = findParentL1(row.l2Code);
    unitPriceManuallySet.current = true;
    setForm({
      name: row.name || "",
      l1Code: isMinor ? "MIN" : parentL1?.code || "",
      l2Code: row.l2Code || "",
      sourceIngredientId: row.sourceIngredientId ? String(row.sourceIngredientId) : "",
      packageSpec: row.packageSpec != null ? String(row.packageSpec) : "",
      packageMaterial: row.packageMaterial || "",
      packageSize: row.packageSize || "",
      processingFeePerJin:
        row.processingFeePerJin != null ? String(row.processingFeePerJin) : "",
      yieldRate: row.yieldRate != null ? String(row.yieldRate) : "",
      unitPrice: String(row.unitPrice),
      grossMarginRate: row.grossMarginRate != null ? String(row.grossMarginRate) : "",
    });
  };

  const dialogTitle = useMemo(() => {
    if (isMinor && initialData?.id) return "编辑小料";
    if (isMinor) return "新增小料";
    if (initialData?.id) return "编辑净料";
    if (isConvert) return "转净料";
    return "新增净料";
  }, [isMinor, initialData, isConvert]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1200px] max-w-[calc(100%-4rem)] [&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-6 py-4 px-6 overflow-y-auto flex-1 min-h-0">
          <div className="flex-1 space-y-4 min-w-0">
            <NetIngredientFormFields
              form={form}
              onChange={handleChange}
              categories={categories}
              rawIngredients={rawIngredients}
              mode={isMinor ? "minor" : "net"}
              readOnly={
                isConvert
                  ? {
                      l1Code: true,
                      l2Code: true,
                      sourceIngredientId: true,
                    }
                  : undefined
              }
              errors={errors}
            />
          </div>

          <div className="lg:w-[680px] flex flex-col min-h-0 rounded-lg border bg-card">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground">
                {isMinor ? "已创建的小料规格" : "已创建的净料规格"}
              </h4>
              <Button
                variant="ghost"
                size="icon"
                title="完整预览"
                onClick={() => setPreviewOpen(true)}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {loadingList ? (
                <LoadingState type="table" rows={5} cols={10} />
              ) : rightList.length === 0 ? (
                <EmptyState
                  icon={PackageOpen}
                  title={isMinor ? "暂无小料" : "暂无净料"}
                  description="该原料尚未创建规格"
                />
              ) : (
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="whitespace-nowrap">编号</TableHead>
                        <TableHead className="whitespace-nowrap">名称</TableHead>
                        <TableHead className="whitespace-nowrap">包装规格</TableHead>
                        <TableHead className="whitespace-nowrap">包装物料</TableHead>
                        <TableHead className="whitespace-nowrap">包装尺寸</TableHead>
                        <TableHead className="whitespace-nowrap">出成率</TableHead>
                        <TableHead className="whitespace-nowrap">净料单价</TableHead>
                        <TableHead className="whitespace-nowrap">加工费</TableHead>
                        <TableHead className="whitespace-nowrap">毛利率</TableHead>
                        <TableHead className="whitespace-nowrap">出库价</TableHead>
                        <TableHead className="whitespace-nowrap">标准规格价</TableHead>
                        <TableHead className="whitespace-nowrap text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rightList.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-sm whitespace-nowrap font-medium">
                            {row.code}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.packageSpec != null ? `${row.packageSpec}g` : "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.packageMaterial || "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.packageSize || "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.yieldRate != null ? `${row.yieldRate}%` : "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            ¥{Number(row.unitPrice).toFixed(2)}/斤
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.processingFeePerJin != null
                              ? `¥${Number(row.processingFeePerJin).toFixed(2)}/斤`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.grossMarginRate != null ? `${row.grossMarginRate}%` : "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap font-medium">
                            {row.outPricePerJin != null
                              ? `¥${Number(row.outPricePerJin).toFixed(2)}/斤`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {row.standardPackagePrice != null
                              ? `¥${Number(row.standardPackagePrice).toFixed(2)}/份`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="编辑"
                              onClick={() => handleEditFromList(row)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
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
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              保存
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>

      <TablePreviewDialog<NetIngredientItem>
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={isMinor ? "已创建的小料规格" : "已创建的净料规格"}
        description={rightList.length > 0 ? `共 ${rightList.length} 条` : undefined}
        emptyTitle="该原料尚未创建规格"
        columns={[
          { header: "编号", accessorKey: "code" },
          { header: "名称", accessorKey: "name" },
          {
            header: "包装规格",
            cell: (row) => (row.packageSpec != null ? `${row.packageSpec}g` : "—"),
          },
          {
            header: "包装物料",
            cell: (row) => row.packageMaterial || "—",
          },
          {
            header: "包装尺寸",
            cell: (row) => row.packageSize || "—",
          },
          {
            header: "出成率",
            cell: (row) => (row.yieldRate != null ? `${row.yieldRate}%` : "—"),
          },
          {
            header: "净料单价",
            cell: (row) => `¥${Number(row.unitPrice).toFixed(2)}/斤`,
          },
          {
            header: "加工费",
            cell: (row) =>
              row.processingFeePerJin != null
                ? `¥${Number(row.processingFeePerJin).toFixed(2)}/斤`
                : "—",
          },
          {
            header: "成本价",
            cell: (row) =>
              row.costPricePerJin != null
                ? `¥${Number(row.costPricePerJin).toFixed(2)}/斤`
                : "—",
          },
          {
            header: "毛利率",
            cell: (row) =>
              row.grossMarginRate != null ? `${row.grossMarginRate}%` : "—",
          },
          {
            header: "出库价",
            cell: (row) =>
              row.outPricePerJin != null
                ? `¥${Number(row.outPricePerJin).toFixed(2)}/斤`
                : "—",
          },
          {
            header: "标准规格价",
            cell: (row) =>
              row.standardPackagePrice != null
                ? `¥${Number(row.standardPackagePrice).toFixed(2)}/份`
                : "—",
          },
        ]}
        data={rightList}
      />
    </Dialog>
  );
}
