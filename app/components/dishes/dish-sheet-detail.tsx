"use client";

import { useState } from "react";
import { Trash2, RotateCcw, Pencil, CheckCircle } from "lucide-react";
import { SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/app/components/ui/data-table";
import { DetailSection, InfoCell } from "@/app/components/ui/detail-section";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { DishStatusTag } from "@/app/components/ui/dish-status-tag";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BomType, DishDetail, formatCost, calcGrossMarginPercent, netSpecText, calcCost } from "@/app/components/dish-form/types";
import { ProcessAccordion } from "@/app/components/dish-form/process-accordion";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { EmptyValue } from "@/app/components/ui/empty-value";

interface DishSheetDetailProps {
  dish: DishDetail;
  onDelete: (id: number) => void;
  onUnpublish: (id: number) => void;
  onPublish: (id: number) => void;
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
  if (!type) return <EmptyValue />;
  const classes: Record<string, string> = {
    荤菜: "bg-red-100 text-red-700 hover:bg-red-100",
    素菜: "bg-green-100 text-green-700 hover:bg-green-100",
    小荤菜: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  };
  return <Badge className={classes[type] || "bg-muted text-muted-foreground"}>{type}</Badge>;
}

function BomTypeBadge({ type }: { type: BomType }) {
  return <Badge className={BOM_TYPE_COLORS[type]}>{BOM_TYPE_LABELS[type]}</Badge>;
}

interface BomTableRow {
  id: string;
  type: BomType;
  name: string;
  spec: string | null;
  productName: string | null;
  amountG: string | number | null;
  /** 份量：净料/小料与标准化调料共用同一套枚举 */
  portion: string | null;
  cost: number | null;
}

export function DishSheetDetail({ dish, onDelete, onUnpublish, onPublish, onEdit }: DishSheetDetailProps) {
  const [confirmAction, setConfirmAction] = useState<"delete" | "unpublish" | "publish" | null>(null);

  // 成本按当前食材价格实时重算，避免原料调价后展示历史 BOM 行成本
  const bomRows: BomTableRow[] = [
    ...(dish.netDetails?.filter((d) => d.role === "main").map((d, idx) => ({
      id: `main-${idx}`,
      type: "main" as BomType,
      name: d.netIngredient?.name || "—",
      spec: netSpecText(d.netIngredient, d.spec),
      productName: null,
      amountG: d.amountG ?? null,
      portion: d.netIngredient?.portion ?? null,
      cost: calcCost("main", d.netIngredient?.outPricePerJin, d.amountG),
    })) ?? []),
    ...(dish.netDetails?.filter((d) => d.role === "support").map((d, idx) => ({
      id: `support-${idx}`,
      type: "support" as BomType,
      name: d.netIngredient?.name || "—",
      spec: netSpecText(d.netIngredient, d.spec),
      productName: null,
      amountG: d.amountG ?? null,
      portion: d.netIngredient?.portion ?? null,
      cost: calcCost("support", d.netIngredient?.outPricePerJin, d.amountG),
    })) ?? []),
    ...(dish.minorDetails?.map((d, idx) => ({
      id: `minor-${idx}`,
      type: "minor" as BomType,
      name: d.name || d.netIngredient?.name || "—",
      spec: netSpecText(d.netIngredient, null),
      productName: d.brand ?? null,
      amountG: d.amountG ?? null,
      portion: d.netIngredient?.portion ?? null,
      cost: calcCost("minor", d.netIngredient?.outPricePerJin, d.amountG),
    })) ?? []),
    ...(dish.seasoningDetails?.map((d, idx) => ({
      id: `seasoning-${idx}`,
      type: "seasoning" as BomType,
      name: d.name || "—",
      spec: d.spec ?? null,
      productName: d.brand ?? null,
      amountG: d.amountG ?? null,
      portion: d.portion ?? null,
      cost: calcCost("seasoning", d.pricePerJin, d.amountG),
    })) ?? []),
    ...(dish.sauceDetails?.map((d, idx) => ({
      id: `sauce-${idx}`,
      type: "sauce" as BomType,
      name: d.sauce?.name || "—",
      spec: null,
      productName: d.brand ?? null,
      amountG: d.amountG ?? null,
      portion: null,
      cost: calcCost("sauce", d.sauce?.outPricePerJin, d.amountG),
    })) ?? []),
  ];

  const computedCost = bomRows.reduce((sum, row) => sum + (row.cost ?? 0), 0);

  const handleConfirm = () => {
    if (confirmAction === "delete") onDelete(dish.id);
    if (confirmAction === "unpublish") onUnpublish(dish.id);
    if (confirmAction === "publish") onPublish(dish.id);
    setConfirmAction(null);
  };

  return (
    <SheetContent className="w-[66.666%] sm:max-w-[66.666vw] flex flex-col p-0">
      <SheetHeader className="px-6 py-4 border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-lg font-medium truncate">{dish.name}</SheetTitle>
              <DishStatusTag status={dish.status} />
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              {dish.code}
            </SheetDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0 pr-10">
            {dish.status === "draft" ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  title="发布"
                  onClick={() => setConfirmAction("publish")}
                  className="h-8"
                >
                  <CheckCircle className="mr-1 h-4 w-4" />
                  发布
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="编辑"
                  onClick={() => onEdit(dish.id)}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="删除"
                  onClick={() => setConfirmAction("delete")}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  title="下架"
                  onClick={() => setConfirmAction("unpublish")}
                  className="h-8"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  下架
                </Button>
                {dish.status === "published" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="编辑"
                    onClick={() => onEdit(dish.id)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <DetailSection title="基础信息" cols={4}>
          <InfoCell
            label="类别"
            value={
              <CategoryTag l1Code={dish.category?.code} name={dish.category?.name} />
            }
          />
          <InfoCell label="菜系" value={dish.cuisine || "—"} />
          <InfoCell label="做法" value={dish.technique || "—"} />
          <InfoCell label="口味" value={dish.taste || "—"} />
          <InfoCell label="份量" value={<PortionTag portion={dish.portion} />} />
          <InfoCell label="季节" value={dish.season || "—"} />
          <InfoCell label="荤素" value={<MeatTypeBadge type={dish.meatType} />} />
          <InfoCell label="创建时间" value={formatDateTime(dish.createdAt)} />
          <InfoCell label="售价" value={formatCost(dish.price)} emphasis />
          <InfoCell
            label="毛利率"
            value={
              calcGrossMarginPercent(computedCost, dish.price) != null
                ? `${calcGrossMarginPercent(computedCost, dish.price)}%`
                : "—"
            }
          />
          <InfoCell label="用料成本价" value={formatCost(computedCost)} emphasis />
          <InfoCell
            label="菜品描述"
            value={dish.intro || "—"}
            className="col-span-2 lg:col-span-4"
          />
        </DetailSection>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">菜品用料</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable<BomTableRow>
              data={bomRows}
              columns={[
                {
                  header: "序号",
                  cell: (_, rowIdx) => (
                    <span className="text-muted-foreground">{rowIdx + 1}</span>
                  ),
                },
                { header: "类型", cell: (row) => <BomTypeBadge type={row.type} /> },
                { header: "名称", accessorKey: "name" },
                {
                  header: "规格",
                  cell: (row) => (
                    <span className="text-sm text-muted-foreground">
                      {row.type === "sauce" ? row.productName || "—" : row.spec || "—"}
                    </span>
                  ),
                },
                {
                  header: "份量",
                  cell: (row) => <PortionTag portion={row.portion} />,
                },
                {
                  header: "用量",
                  cell: (row) => (
                    <span className="font-medium">
                      {row.amountG != null ? `${row.amountG}g` : "—"}
                    </span>
                  ),
                },
                {
                  header: "成本价",
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
            <ProcessAccordion processes={dish.processes || []} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmAction != null} onOpenChange={() => setConfirmAction(null)}>
<AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {confirmAction === "delete"
                ? "确认删除"
                : confirmAction === "publish"
                  ? "确认发布"
                  : "确认下架"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            {confirmAction === "delete"
              ? `确定要删除菜品「${dish.name}」吗？此操作不可撤销。`
              : confirmAction === "publish"
                ? `确定要发布菜品「${dish.name}」吗？发布后将锁定基础信息、菜品用料与加工工艺，不可再修改。`
                : `确定要下架菜品「${dish.name}」吗？下架后将回到草稿状态，可继续编辑。`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} className="h-11 px-6">
              取消
            </Button>
            <Button
              variant={
                confirmAction === "delete"
                  ? "destructive"
                  : confirmAction === "publish"
                    ? "default"
                    : "secondary"
              }
              onClick={handleConfirm}
              className="h-11 px-6"
            >
              {confirmAction === "delete" ? "删除" : confirmAction === "publish" ? "确认发布" : "确认下架"}
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </SheetContent>
  );
}
