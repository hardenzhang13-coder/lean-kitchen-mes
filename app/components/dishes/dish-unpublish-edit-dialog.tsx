"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { getDishStatusOption } from "@/lib/shared/dish-status";

/**
 * 「下架并编辑」确认弹窗：非草稿菜品点击编辑时，先下架为草稿再进入编辑页。
 * 详情操作簇与列表操作列共用；状态机 unpublish 支持 published / inactive → draft。
 */
export function DishUnpublishEditDialog({
  dish,
  open,
  onOpenChange,
}: {
  dish: { id: number; name: string; status: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const statusLabel = getDishStatusOption(dish.status)?.label ?? "非草稿";

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/dishes/${dish.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "下架失败");
        return;
      }
      toast.success("已下架为草稿");
      onOpenChange(false);
      router.push(`/dishes/${dish.id}/edit`);
    } catch {
      toast.error("下架失败");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="compact">
        <DialogHeader>
          <DialogTitle className="text-lg">下架并编辑</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-base">
          菜品「{dish.name}」当前为{statusLabel}
          ，下架为草稿后才能编辑；历史排程与切配计划不受影响。是否下架并继续编辑？
        </p>
        <DialogFooter>
          <SkeuButton variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </SkeuButton>
          <SkeuButton
            variant="primary"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? "下架中..." : "下架并编辑"}
          </SkeuButton>
        </DialogFooter>
      </AppDialogContent>
    </Dialog>
  );
}
