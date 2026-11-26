"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, CheckCircle, Copy, Pencil, PowerOff, RotateCcw, Trash2, ArrowRightLeft } from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { FormField } from "@/app/components/ui/form-field";
import { Input } from "@/app/components/ui/form-controls";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { DeleteConfirmDialog, type DeleteErrorInfo } from "@/app/components/ui/delete-confirm-dialog";
import type { DishDetail } from "@/app/components/dish-form/types";
import { usePortionProfiles } from "@/lib/client/use-portion-profiles";
import { isBasePortion } from "@/lib/shared/portion-scale";
import { DishScaleDialog } from "./dish-scale-dialog";
import { DishUnpublishEditDialog } from "./dish-unpublish-edit-dialog";
import { toast } from "sonner";

type StatusAction = "publish" | "unpublish" | "deactivate" | "restore";

const STATUS_ACTION_META: Record<
  StatusAction,
  {
    label: string;
    confirmTitle: string;
    confirmText: string;
    /** 确认键配色：停用为警示动作（warn），其余为推进（primary） */
    confirmVariant: "primary" | "warn";
    toastText: string;
  }
> = {
  publish: {
    label: "发布",
    confirmTitle: "确认发布",
    confirmText:
      "确定要发布该菜品吗？发布后将锁定基础信息、菜品用料与加工工艺，不可再修改。",
    confirmVariant: "primary",
    toastText: "发布成功",
  },
  unpublish: {
    label: "下架",
    confirmTitle: "确认下架",
    confirmText:
      "确定要下架该菜品吗？下架后回到草稿可重新编辑，新建排程不再可选，历史排程与切配计划不受影响。",
    confirmVariant: "primary",
    toastText: "已下架",
  },
  deactivate: {
    label: "停用",
    confirmTitle: "确认停用",
    confirmText: "确定要停用该菜品吗？停用后新排程不再可选，历史排程与切配计划不受影响。",
    confirmVariant: "warn",
    toastText: "已停用",
  },
  restore: {
    label: "恢复发布",
    confirmTitle: "确认恢复发布",
    confirmText: "确定要恢复发布该菜品吗？恢复后可在新建排程中选择。",
    confirmVariant: "primary",
    toastText: "已恢复发布",
  },
};

function statusActionOf(status: string): StatusAction | null {
  if (status === "draft") return "publish";
  if (status === "published") return "deactivate";
  if (status === "inactive") return "restore";
  return null;
}

/**
 * 菜品档案操作簇（详情弹窗与路由详情页共用），按「状态 × 操作」矩阵渲染：
 * 删除（danger）/ 复制、编辑、下架（outline）/ 状态动作（发布·恢复发布 primary、停用 warn）/
 * 转化（primary，仅已发布的基本单元菜品，置于最右主操作位）。
 * 编辑全状态可达：非草稿先走「下架并编辑」确认（DishUnpublishEditDialog）。
 * 状态流转一律走 POST /api/dishes/[id]/status。
 */
export function DishDetailActions({
  dish,
  onChanged,
  onDeleted,
}: {
  dish: DishDetail;
  /** 状态变更成功后回调（路由页刷新详情、列表页刷新列表并重取详情） */
  onChanged: () => void;
  /** 删除成功后回调（路由页回列表、列表页关弹窗） */
  onDeleted: () => void;
}) {
  const router = useRouter();
  const { profiles } = usePortionProfiles();
  // 转化仅开放给已发布的基本单元（单人份）菜品：场景规格互相转化会破坏倍率口径，未定版菜品不可投产
  const canScale =
    isBasePortion(dish.portion, profiles) && dish.status === "published";
  const [pendingAction, setPendingAction] = useState<StatusAction | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<DeleteErrorInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [copying, setCopying] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [unpublishEditOpen, setUnpublishEditOpen] = useState(false);

  const statusAction = statusActionOf(dish.status);
  const actionMeta = statusAction ? STATUS_ACTION_META[statusAction] : null;

  const runStatusAction = async (action: StatusAction) => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/dishes/${dish.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "状态更新失败");
        return;
      }
      toast.success(STATUS_ACTION_META[action].toastText);
      setPendingAction(null);
      onChanged();
    } catch {
      toast.error("状态更新失败");
    } finally {
      setConfirming(false);
    }
  };

  const handleDelete = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/dishes/${dish.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError({ message: data.error || "删除失败" });
        return;
      }
      toast.success("删除成功");
      onDeleted();
    } catch {
      setDeleteError({ message: "删除失败" });
    } finally {
      setConfirming(false);
    }
  };

  const openCopy = () => {
    setCopyName(`${dish.name}-副本`);
    setCopyOpen(true);
  };

  const handleCopy = async () => {
    if (!copyName.trim()) return;
    setCopying(true);
    try {
      const res = await fetch(`/api/dishes/${dish.id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: copyName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "复制失败");
        return;
      }
      toast.success(`已复制为「${copyName.trim()}」`);
      setCopyOpen(false);
      // 复制是衍生新建：原地刷新 + toast，不跳离当前页
      onChanged();
    } catch {
      toast.error("复制失败");
    } finally {
      setCopying(false);
    }
  };

  return (
    <>
      <SkeuButton
        variant="danger"
        onClick={() => {
          setDeleteError(null);
          setDeleteOpen(true);
        }}
      >
        <Trash2 className="h-4 w-4" />
        删除
      </SkeuButton>
      <SkeuButton variant="outline" onClick={openCopy}>
        <Copy className="h-4 w-4" />
        复制
      </SkeuButton>
      <SkeuButton
        variant="outline"
        onClick={() => {
          if (dish.status === "draft") router.push(`/dishes/${dish.id}/edit`);
          else setUnpublishEditOpen(true);
        }}
      >
        <Pencil className="h-4 w-4" />
        编辑
      </SkeuButton>
      {dish.status !== "draft" && (
        <SkeuButton variant="outline" onClick={() => setPendingAction("unpublish")}>
          <ArrowDownToLine className="h-4 w-4" />
          下架
        </SkeuButton>
      )}
      {actionMeta && statusAction && (
        <SkeuButton
          variant={statusAction === "deactivate" ? "warn" : "primary"}
          onClick={() => setPendingAction(statusAction)}
        >
          {statusAction === "publish" ? (
            <CheckCircle className="h-4 w-4" />
          ) : statusAction === "deactivate" ? (
            <PowerOff className="h-4 w-4" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {actionMeta.label}
        </SkeuButton>
      )}
      {canScale && (
        <SkeuButton variant="primary" onClick={() => setScaleOpen(true)}>
          <ArrowRightLeft className="h-4 w-4" />
          转化
        </SkeuButton>
      )}

      <Dialog open={pendingAction !== null} onOpenChange={() => setPendingAction(null)}>
        <AppDialogContent size="compact">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {pendingAction ? STATUS_ACTION_META[pendingAction].confirmTitle : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            {pendingAction ? STATUS_ACTION_META[pendingAction].confirmText : ""}
          </p>
          <DialogFooter>
            <SkeuButton variant="outline" onClick={() => setPendingAction(null)}>
              取消
            </SkeuButton>
            <SkeuButton
              variant={pendingAction ? STATUS_ACTION_META[pendingAction].confirmVariant : "primary"}
              onClick={() => pendingAction && runStatusAction(pendingAction)}
              disabled={confirming}
            >
              {pendingAction ? STATUS_ACTION_META[pendingAction].label : ""}
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <DishScaleDialog
        dish={dish}
        open={scaleOpen}
        onOpenChange={setScaleOpen}
        onSuccess={() => {
          setScaleOpen(false);
          onChanged();
        }}
      />

      <DishUnpublishEditDialog
        dish={dish}
        open={unpublishEditOpen}
        onOpenChange={setUnpublishEditOpen}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteError(null);
        }}
        title="确认删除"
        message={`确定要删除菜品「${dish.name}」吗？此操作不可撤销。`}
        error={deleteError}
        onConfirm={handleDelete}
        confirming={confirming}
      />

      <Dialog open={copyOpen} onOpenChange={() => setCopyOpen(false)}>
        <AppDialogContent size="form">
          <DialogHeader>
            <DialogTitle className="text-lg">复制菜品</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-base">
              将以「{dish.name}」（{dish.portion}）为模板生成新的草稿档案，用料与加工工艺完整复制。
            </p>
            <FormField id="copy-name" label="新菜品名称" required>
              <Input
                id="copy-name"
                value={copyName}
                onChange={(e) => setCopyName(e.target.value)}
                placeholder="请输入新菜品名称"
                className="h-11 text-base px-4"
              />
            </FormField>
          </div>
          <DialogFooter>
            <SkeuButton variant="outline" onClick={() => setCopyOpen(false)}>
              取消
            </SkeuButton>
            <SkeuButton
              variant="primary"
              onClick={handleCopy}
              disabled={copying || !copyName.trim()}
            >
              {copying ? "复制中..." : "确认复制"}
            </SkeuButton>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </>
  );
}
