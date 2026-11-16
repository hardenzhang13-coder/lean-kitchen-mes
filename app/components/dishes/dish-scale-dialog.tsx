"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { Input } from "@/app/components/ui/form-controls";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { StatusBadge } from "@/app/components/ui/status-badge";
import type { DishDetail } from "@/app/components/dish-form/types";
import { PORTION_OPTIONS, portionScaleFactor } from "@/lib/shared/portion-scale";
import { syncNamePackageSpec } from "@/lib/shared/name-utils";
import type {
  DishScalePlan,
  DishScaleSpecPlan,
} from "@/lib/shared/dish-scale";
import { toast } from "sonner";

type EditSpec = {
  name: string;
  packageSpec: string;
  yieldRate: string;
  processingFeePerJin: string;
  grossMarginRate: string;
};

type DishScaleDialogProps = {
  dish: DishDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (dish: DishDetail) => void;
};

function specKey(spec: { kind: string; sourceNetIngId: number }): string {
  return `${spec.kind}:${spec.sourceNetIngId}`;
}

function buildEdits(plan: DishScalePlan): Record<string, EditSpec> {
  const next: Record<string, EditSpec> = {};
  for (const item of [...plan.net, ...plan.minor]) {
    if (item.status !== "missing") continue;
    next[specKey(item)] = {
      name: item.proposal.name,
      packageSpec: String(item.proposal.packageSpec),
      yieldRate: String(item.proposal.yieldRate),
      processingFeePerJin:
        item.proposal.processingFeePerJin != null
          ? String(item.proposal.processingFeePerJin)
          : "",
      grossMarginRate:
        item.proposal.grossMarginRate != null
          ? String(item.proposal.grossMarginRate)
          : "",
    };
  }
  return next;
}

function isEditValid(edit: EditSpec | undefined): boolean {
  if (!edit) return false;
  if (!edit.name.trim()) return false;
  const packageSpec = Number(edit.packageSpec);
  if (!Number.isInteger(packageSpec) || packageSpec < 1) return false;
  const yieldRate = Number(edit.yieldRate);
  if (!(yieldRate > 0) || yieldRate > 500) return false;
  const fee = edit.processingFeePerJin.trim();
  if (fee !== "" && (Number.isNaN(Number(fee)) || Number(fee) < 0)) {
    return false;
  }
  const margin = edit.grossMarginRate.trim();
  if (
    margin !== "" &&
    (Number.isNaN(Number(margin)) || Number(margin) < 0 || Number(margin) > 95)
  ) {
    return false;
  }
  return true;
}

export function DishScaleDialog({
  dish,
  open,
  onOpenChange,
  onSuccess,
}: DishScaleDialogProps) {
  const defaultPortion = useMemo(
    () =>
      PORTION_OPTIONS.find((option) => option.value !== dish.portion)?.value ??
      "",
    [dish.portion]
  );
  const [portion, setPortion] = useState(defaultPortion);
  const [plan, setPlan] = useState<DishScalePlan | null>(null);
  const [edits, setEdits] = useState<Record<string, EditSpec>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPreview = useCallback(
    async (targetPortion: string) => {
      if (!targetPortion) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dishes/${dish.id}/scale/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portion: targetPortion }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "获取转化预览失败");
        }
        const nextPlan = data.data as DishScalePlan;
        setPlan(nextPlan);
        setEdits(buildEdits(nextPlan));
      } catch (err) {
        setPlan(null);
        setError(err instanceof Error ? err.message : "获取转化预览失败");
      } finally {
        setLoading(false);
      }
    },
    [dish.id]
  );

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || !portion) return;
    void loadPreview(portion);
  }, [open, portion, loadPreview]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePortionChange = (value: string) => {
    setPortion(value);
    setPlan(null);
    setEdits({});
  };

  const updateEdit = (key: string, patch: Partial<EditSpec>) => {
    setEdits((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const missingSpecs = plan
    ? [...plan.net, ...plan.minor].filter((item) => item.status === "missing")
    : [];
  const blockedSpecs = missingSpecs.filter((item) => !item.canCreate);
  const factor =
    plan?.factor ?? portionScaleFactor(dish.portion, portion) ?? null;
  const canSubmit =
    Boolean(plan) &&
    !loading &&
    !error &&
    blockedSpecs.length === 0 &&
    missingSpecs.every((item) => isEditValid(edits[specKey(item)])) &&
    !submitting;

  const handleSubmit = async () => {
    if (!plan || !canSubmit) return;
    setSubmitting(true);
    try {
      const specs = missingSpecs.map((item) => {
        const edit = edits[specKey(item)];
        return {
          kind: item.kind,
          sourceNetIngId: item.sourceNetIngId,
          name: edit.name.trim(),
          packageSpec: Number(edit.packageSpec),
          yieldRate: Number(edit.yieldRate),
          processingFeePerJin:
            edit.processingFeePerJin.trim() === ""
              ? null
              : Number(edit.processingFeePerJin),
          grossMarginRate:
            edit.grossMarginRate.trim() === ""
              ? null
              : Number(edit.grossMarginRate),
        };
      });

      const res = await fetch(`/api/dishes/${dish.id}/scale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portion, specs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "转化失败");
        return;
      }
      const newDish = data.data as DishDetail;
      toast.success(
        `已生成「${portion}」菜品档案${newDish.code ? "：" + newDish.code : ""}`
      );
      onSuccess(newDish);
    } catch {
      toast.error("转化失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="workbench"
        className="flex max-h-[90vh] flex-col p-0"
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-lg">菜品转化</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <p className="text-sm text-muted-foreground">
            将「{dish.name}」（<PortionTag portion={dish.portion} />
            ）转化生成新的份量规格档案（草稿），菜品用量、净料与小料规格同步换算，源档案不受影响。
          </p>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">目标份量</span>
            <SelectTileMode
              options={PORTION_OPTIONS.filter(
                (option) => option.value !== dish.portion
              ).map((option) => ({
                value: option.value,
                label: option.label,
                description: option.description,
              }))}
              value={portion}
              onChange={handlePortionChange}
              placeholder="请选择目标份量"
              title="选择目标份量"
              searchable={false}
            />
            <p className="text-xs text-muted-foreground">
              净料/小料与菜品用量按份量倍率自动换算
              {factor != null && factor > 0 ? `：全部明细 ×${factor}` : ""}
            </p>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">用料成本</span>
              <span className="font-medium tabular-nums">
                {dish.cost != null && factor != null && factor > 0
                  ? `¥${Number(dish.cost).toFixed(2)} × ${factor} = ¥${(
                      Number(dish.cost) * factor
                    ).toFixed(2)}`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">售价</span>
              <span className="font-medium tabular-nums">
                {dish.price != null && factor != null && factor > 0
                  ? `¥${Number(dish.price).toFixed(2)} × ${factor} = ¥${(
                      Number(dish.price) * factor
                    ).toFixed(2)}`
                  : "—"}
              </span>
            </div>
          </div>

          {loading ? (
            <LoadingState type="list" rows={2} />
          ) : error ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadPreview(portion)}
              >
                重试
              </Button>
            </div>
          ) : plan ? (
            <div className="space-y-4">
              <PlanSummary plan={plan} />
              <SpecSection
                title="净料（主料 / 辅料）"
                items={plan.net}
                edits={edits}
                onEdit={updateEdit}
              />
              <SpecSection
                title="小料"
                items={plan.minor}
                edits={edits}
                onEdit={updateEdit}
              />
              {blockedSpecs.length > 0 && (
                <p className="text-sm text-destructive">
                  以下食材缺少来源原料，无法自动创建目标规格：
                  {[...new Set(blockedSpecs.map((item) => item.sourceName))].join(
                    "、"
                  )}
                  。请先在食材库补齐后重试。
                </p>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 px-6"
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-11 px-6"
          >
            {submitting ? "转化中..." : "确认转化"}
          </Button>
        </DialogFooter>
      </AppDialogContent>
    </Dialog>
  );
}

function PlanSummary({ plan }: { plan: DishScalePlan }) {
  const total = plan.net.length + plan.minor.length;
  const missing = [...plan.net, ...plan.minor].filter(
    (item) => item.status === "missing"
  ).length;
  const existing = total - missing;

  return (
    <p className="rounded-md border bg-card px-3 py-2 text-sm text-muted-foreground">
      共 {total} 个净料/小料：
      <span className="font-medium text-foreground"> {existing} </span>
      个目标规格已存在，
      <span className="font-medium text-foreground"> {missing} </span>
      个需要新建。待新建项可在下方确认或修改。
    </p>
  );
}

function SpecSection({
  title,
  items,
  edits,
  onEdit,
}: {
  title: string;
  items: DishScaleSpecPlan[];
  edits: Record<string, EditSpec>;
  onEdit: (key: string, patch: Partial<EditSpec>) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{items.length} 项</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <SpecRow
            key={specKey(item)}
            item={item}
            edit={edits[specKey(item)]}
            onEdit={(patch) => onEdit(specKey(item), patch)}
          />
        ))}
      </div>
    </section>
  );
}

function SpecRow({
  item,
  edit,
  onEdit,
}: {
  item: DishScaleSpecPlan;
  edit: EditSpec | undefined;
  onEdit: (patch: Partial<EditSpec>) => void;
}) {
  const isExisting = item.status === "existing";

  return (
    <div
      className={
        "space-y-2 rounded-md border p-3 " +
        (isExisting ? "bg-card" : "border-warning/40 bg-warning/5")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.sourceName}</p>
          <p className="text-xs text-muted-foreground">
            来源原料：{item.sourceIngredientName ?? "—"} · 源规格：
            {item.sourcePackageSpec != null
              ? `${item.sourcePackageSpec}g`
              : "—"}
          </p>
        </div>
        <StatusBadge
          status={isExisting ? "已存在" : "待创建"}
          variant={isExisting ? "success" : "warning"}
          size="sm"
        />
      </div>

      {isExisting ? (
        <p className="text-sm text-muted-foreground">
          目标规格：{item.existing?.name}（{item.existing?.code}） ·{" "}
          {item.existing?.packageSpec ?? "—"}g
        </p>
      ) : (
        <>
          {!item.canCreate && (
            <p className="text-xs text-destructive">
              缺少来源原料，无法自动创建；请先在食材库维护。
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            <EditField label="名称">
              <Input
                value={edit?.name ?? ""}
                onChange={(e) => onEdit({ name: e.target.value })}
                disabled={!item.canCreate}
                className="h-9 px-2 text-sm"
              />
            </EditField>
            <EditField label="封装规格 (g)">
              <Input
                type="number"
                min={1}
                value={edit?.packageSpec ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const numeric = Number(raw);
                  const patch: Partial<EditSpec> = { packageSpec: raw };
                  if (
                    edit &&
                    Number.isInteger(numeric) &&
                    numeric >= 1
                  ) {
                    patch.name = syncNamePackageSpec(edit.name, numeric);
                  }
                  onEdit(patch);
                }}
                disabled={!item.canCreate}
                className="h-9 px-2 text-sm"
              />
            </EditField>
            <EditField label="出成率 (%)">
              <Input
                type="number"
                min={0.01}
                max={500}
                step={0.01}
                value={edit?.yieldRate ?? ""}
                onChange={(e) => onEdit({ yieldRate: e.target.value })}
                disabled={!item.canCreate}
                className="h-9 px-2 text-sm"
              />
            </EditField>
            <EditField label="加工费 (元/斤)">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={edit?.processingFeePerJin ?? ""}
                onChange={(e) =>
                  onEdit({ processingFeePerJin: e.target.value })
                }
                disabled={!item.canCreate}
                className="h-9 px-2 text-sm"
              />
            </EditField>
            <EditField label="毛利率 (%)">
              <Input
                type="number"
                min={0}
                max={95}
                step={0.1}
                value={edit?.grossMarginRate ?? ""}
                onChange={(e) => onEdit({ grossMarginRate: e.target.value })}
                disabled={!item.canCreate}
                className="h-9 px-2 text-sm"
              />
            </EditField>
          </div>
        </>
      )}
    </div>
  );
}

function EditField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="block text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
