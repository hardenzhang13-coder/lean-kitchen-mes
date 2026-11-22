"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Copy, Pencil, RotateCcw, Trash2, ArrowRightLeft } from "lucide-react";
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
import { DishScaleDialog } from "./dish-scale-dialog";
import { toast } from "sonner";

type StatusAction = "publish" | "deactivate" | "restore";

const STATUS_ACTION_META: Record<
  StatusAction,
  { label: string; confirmTitle: string; confirmText: string }
> = {
  publish: {
    label: "发布",
    confirmTitle: "确认发布",
    confirmText:
      "确定要发布该菜品吗？发布后将锁定基础信息、菜品用料与加工工艺，不可再修改。",
  },
  deactivate: {
    label: "停用",
    confirmTitle: "确认停用",
    confirmText: "确定要停用该菜品吗？停用后新排程不再可选，历史排程与生产计划不受影响。",
  },
  restore: {
    label: "恢复发布",
    confirmTitle: "确认恢复发布",
    confirmText: "确定要恢复发布该菜品吗？恢复后可在新建排程中选择。",
  },
};

function statusActionOf(status: string): StatusAction | null {
  if (status === "draft") return "publish";
  if (status === "published") return "deactivate";
  if (status === "inactive") return "restore";
  return null;
}

/**
 * 菜品档案操作簇：删除（danger）/ 复制、编辑、转化（outline）/ 状态主操作（primary 最右），
 * 覆盖列表操作列全部操作。路由详情页与列表正面弹窗共用；状态流转一律走 POST /api/dishes/[id]/status。
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
  const [pendingAction, setPendingAction] = useState<StatusAction | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<DeleteErrorInfo | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [copying, setCopying] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);

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
      toast.success(
        action === "publish"
          ? "发布成功"
          : action === "deactivate"
            ? "已停用"
            : "已恢复发布"
      );
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
      const newId = data.data?.id ?? data.id;
      toast.success(`已复制为「${copyName.trim()}」`);
      setCopyOpen(false);
      if (newId) router.push(`/dishes/${newId}`);
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
      {dish.status === "draft" && (
        <SkeuButton
          variant="outline"
          onClick={() => router.push(`/dishes/${dish.id}/edit`)}
        >
          <Pencil className="h-4 w-4" />
          编辑
        </SkeuButton>
      )}
      <SkeuButton variant="outline" onClick={() => setScaleOpen(true)}>
        <ArrowRightLeft className="h-4 w-4" />
        转化
      </SkeuButton>
      {actionMeta && statusAction && (
        <SkeuButton variant="primary" onClick={() => setPendingAction(statusAction)}>
          {statusAction === "publish" ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <RotateCcw className="h-4 w-4" />
          )}
          {actionMeta.label}
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
              variant="primary"
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
