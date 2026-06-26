"use client";

import { useState } from "react";
import { Trash2, RotateCcw, Pencil } from "lucide-react";
import { SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/app/components/data-table";
import { StatusBadge } from "@/app/components/status-badge";
import { CategoryTag } from "@/app/components/category-tag";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BomType, VALID_STAGES, formatCost } from "@/app/components/dish-form/types";

interface NetDetail {
  role?: string | null;
  amountG?: string | number | null;
  netIngredient?: { name: string; unitPrice?: number | null; unit?: string | null } | null;
}

interface MinorDetail {
  amountG?: string | number | null;
  name?: string | null;
  unitPrice?: number | null;
  unit?: string | null;
}

interface SeasoningDetail {
  amountG?: string | number | null;
  name?: string | null;
  unitPrice?: number | null;
  unit?: string | null;
}

interface SauceDetail {
  amountG?: string | number | null;
  sauce?: { name: string; unitPrice?: number | null; unit?: string | null } | null;
}

interface ProcessDetail {
  stage: string;
  stepNo: number;
  object: string;
  action: string;
  description?: string | null;
  tool?: string | null;
  standard?: string | null;
}

interface DishSheetDetailProps {
  dish: {
    id: number;
    code: string;
    name: string;
    intro: string | null;
    category?: { id: number; code: string; name: string } | null;
    cuisine?: string | null;
    technique?: string | null;
    taste?: string | null;
    portion?: string | null;
    season?: string | null;
    meatType?: string | null;
    cost?: number | null;
    status: string;
    createdAt?: string | Date;
    netDetails?: NetDetail[];
    minorDetails?: MinorDetail[];
    seasoningDetails?: SeasoningDetail[];
    sauceDetails?: SauceDetail[];
    processes?: ProcessDetail[];
  };
  onDelete: (id: number) => void;
  onUnpublish: (id: number) => void;
  onEdit: (id: number) => void;
}

const BOM_TYPE_LABELS: Record<BomType, string> = {
  main: "主料",
  support: "辅料",
  minor: "小料",
  seasoning: "调料",
  sauce: "酱料",
};

const BOM_TYPE_COLORS: Record<BomType, string> = {
  main: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  support: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  minor: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  seasoning: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  sauce: "bg-rose-100 text-rose-700 hover:bg-rose-100",
};

const formatDateTime = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function MeatTypeBadge({ type }: { type?: string | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  const classes: Record<string, string> = {
    荤菜: "bg-red-100 text-red-700 hover:bg-red-100",
    素菜: "bg-green-100 text-green-700 hover:bg-green-100",
    小荤菜: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  };
  return <Badge className={classes[type] || "bg-muted text-muted-foreground"}>{type}</Badge>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function BomTypeBadge({ type }: { type: BomType }) {
  return <Badge className={BOM_TYPE_COLORS[type]}>{BOM_TYPE_LABELS[type]}</Badge>;
}

const STAGE_ORDER: Record<string, number> = {
  "初加工": 0,
  "预处理": 1,
  "上灶加工": 2,
  "出锅成品": 3,
};

function ProcessTimeline({ processes }: { processes: ProcessDetail[] }) {
  if (processes.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        暂无加工工艺
      </div>
    );
  }

  const stepsByStage = VALID_STAGES.map((stage) => ({
    stage,
    steps: processes
      .filter((p) => p.stage === stage)
      .sort((a, b) => a.stepNo - b.stepNo),
  }));

  return (
    <div className="space-y-4">
      {stepsByStage.map(({ stage, steps }, stageIdx) => (
        <div key={stage} className="relative">
          {stageIdx > 0 && (
            <div className="absolute left-[11px] -top-4 h-4 border-l border-dashed border-muted-foreground/30" />
          )}
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
              {STAGE_ORDER[stage] + 1}
            </span>
            <span className="text-sm font-semibold">{stage}</span>
            <span className="text-xs text-muted-foreground">{steps.length} 步</span>
          </div>
          {steps.length > 0 && (
            <div className="border-l border-dashed border-muted-foreground/30 ml-2.5 pl-4 pt-1 space-y-3">
              {steps.map((step, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                    <span className="font-medium">{step.object}</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    <span className="font-medium">{step.action}</span>
                  </div>
                  {(step.tool || step.description) && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {step.tool && <div>工具：{step.tool}</div>}
                      {step.description && <div>{step.description}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface BomTableRow {
  id: string;
  type: BomType;
  name: string;
  amountG: string | number | null;
  unit: string | null;
  unitPrice: number | null;
  cost: number | null;
}

export function DishSheetDetail({ dish, onDelete, onUnpublish, onEdit }: DishSheetDetailProps) {
  const [confirmAction, setConfirmAction] = useState<"delete" | "unpublish" | null>(null);

  const statusLabel = dish.status === "published" ? "已发布" : "草稿";

  const bomRows: BomTableRow[] = [
    ...(dish.netDetails?.filter((d) => d.role === "main").map((d, idx) => ({
      id: `main-${idx}`,
      type: "main" as BomType,
      name: d.netIngredient?.name || "—",
      amountG: d.amountG ?? null,
      unit: d.netIngredient?.unit || null,
      unitPrice: d.netIngredient?.unitPrice ?? null,
      cost: calcLineCost(d.netIngredient?.unitPrice, d.amountG),
    })) ?? []),
    ...(dish.netDetails?.filter((d) => d.role === "support").map((d, idx) => ({
      id: `support-${idx}`,
      type: "support" as BomType,
      name: d.netIngredient?.name || "—",
      amountG: d.amountG ?? null,
      unit: d.netIngredient?.unit || null,
      unitPrice: d.netIngredient?.unitPrice ?? null,
      cost: calcLineCost(d.netIngredient?.unitPrice, d.amountG),
    })) ?? []),
    ...(dish.minorDetails?.map((d, idx) => ({
      id: `minor-${idx}`,
      type: "minor" as BomType,
      name: d.name || "—",
      amountG: d.amountG ?? null,
      unit: d.unit || null,
      unitPrice: d.unitPrice ?? null,
      cost: calcLineCost(d.unitPrice, d.amountG),
    })) ?? []),
    ...(dish.seasoningDetails?.map((d, idx) => ({
      id: `seasoning-${idx}`,
      type: "seasoning" as BomType,
      name: d.name || "—",
      amountG: d.amountG ?? null,
      unit: d.unit || null,
      unitPrice: d.unitPrice ?? null,
      cost: calcLineCost(d.unitPrice, d.amountG),
    })) ?? []),
    ...(dish.sauceDetails?.map((d, idx) => ({
      id: `sauce-${idx}`,
      type: "sauce" as BomType,
      name: d.sauce?.name || "—",
      amountG: d.amountG ?? null,
      unit: d.sauce?.unit || null,
      unitPrice: d.sauce?.unitPrice ?? null,
      cost: calcLineCost(d.sauce?.unitPrice, d.amountG),
    })) ?? []),
  ];

  const handleConfirm = () => {
    if (confirmAction === "delete") onDelete(dish.id);
    if (confirmAction === "unpublish") onUnpublish(dish.id);
    setConfirmAction(null);
  };

  return (
    <SheetContent className="w-[45%] sm:max-w-[45vw] flex flex-col p-0">
      <SheetHeader className="px-6 py-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-lg font-medium truncate">{dish.name}</SheetTitle>
              <StatusBadge status={statusLabel} />
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              {dish.code}
            </SheetDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0 pr-10">
            <Button
              variant="ghost"
              size="icon"
              title="编辑"
              onClick={() => onEdit(dish.id)}
              className="h-8 w-8"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            {dish.status === "draft" ? (
              <Button
                variant="ghost"
                size="icon"
                title="删除"
                onClick={() => setConfirmAction("delete")}
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                title="下架"
                onClick={() => setConfirmAction("unpublish")}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                下架
              </Button>
            )}
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">基础信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            <InfoRow label="编号" value={dish.code} />
            <InfoRow label="名称" value={dish.name} />
            <InfoRow
              label="类别"
              value={<CategoryTag l1Code={dish.category?.code} name={dish.category?.name} />}
            />
            <InfoRow label="菜系" value={dish.cuisine || "—"} />
            <InfoRow label="做法" value={dish.technique || "—"} />
            <InfoRow label="口味" value={dish.taste || "—"} />
            <InfoRow label="份量" value={dish.portion || "—"} />
            <InfoRow label="季节" value={dish.season || "—"} />
            <InfoRow label="荤素" value={<MeatTypeBadge type={dish.meatType} />} />
            <InfoRow label="描述" value={dish.intro || "—"} />
            <InfoRow label="创建时间" value={formatDateTime(dish.createdAt)} />
            <InfoRow
              label="估算总成本"
              value={<span className="font-semibold">{formatCost(dish.cost)}</span>}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">菜品用料</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<BomTableRow>
              data={bomRows}
              columns={[
                { header: "类型", cell: (row) => <BomTypeBadge type={row.type} /> },
                { header: "名称", accessorKey: "name" },
                {
                  header: "用量",
                  cell: (row) => (
                    <span className="text-muted-foreground">
                      {row.amountG != null ? `${row.amountG} ${row.unit || "g"}` : "—"}
                    </span>
                  ),
                },
                { header: "单位", accessorKey: "unit" },
                {
                  header: "单价",
                  cell: (row) => (
                    <span className="text-muted-foreground">
                      {row.unitPrice != null ? `¥${Number(row.unitPrice).toFixed(2)}` : "—"}
                    </span>
                  ),
                },
                {
                  header: "成本",
                  className: "text-right",
                  cell: (row) => <span className="font-medium">{formatCost(row.cost)}</span>,
                },
              ]}
              emptyState={{ title: "暂无数据" }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">加工工艺</CardTitle>
          </CardHeader>
          <CardContent>
            <ProcessTimeline processes={dish.processes || []} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmAction != null} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {confirmAction === "delete" ? "确认删除" : "确认下架"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            {confirmAction === "delete"
              ? `确定要删除菜品「${dish.name}」吗？此操作不可撤销。`
              : `确定要下架菜品「${dish.name}」吗？下架后将回到草稿状态，可继续编辑。`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} className="h-11 px-6">
              取消
            </Button>
            <Button
              variant={confirmAction === "delete" ? "destructive" : "default"}
              onClick={handleConfirm}
              className="h-11 px-6"
            >
              {confirmAction === "delete" ? "删除" : "下架"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SheetContent>
  );
}

function calcLineCost(unitPrice: number | null | undefined, amountG: string | number | null | undefined) {
  if (unitPrice == null || amountG == null) return null;
  const amount = typeof amountG === "string" ? Number(amountG) : amountG;
  if (Number.isNaN(amount)) return null;
  return Number((unitPrice * amount / 1000).toFixed(4));
}
