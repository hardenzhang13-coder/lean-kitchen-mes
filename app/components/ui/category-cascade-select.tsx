"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuComboboxTrigger } from "@/app/components/ui/skeu-combobox-trigger";
import { cn } from "@/lib/shared/utils";

export type CascadeCategory = {
  code: string;
  name: string;
  children: { code: string; name: string }[];
};

interface CategoryCascadeSelectProps {
  /** 已按业务规则过滤的一级分类（含二级子集） */
  categories: CascadeCategory[];
  l1Code: string;
  l2Code: string;
  /** 确定后回传选中的一、二级编码 */
  onChange: (l1Code: string, l2Code: string) => void;
  viewMode?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * 一二级分类级联选择：单字段触发、单弹窗两级同屏。
 * 左栏一级列表、右栏二级磁贴，底部路径栏 + 确定才生效，取消不改动表单值。
 */
export function CategoryCascadeSelect({
  categories,
  l1Code,
  l2Code,
  onChange,
  viewMode = false,
  placeholder = "请选择",
  className,
}: CategoryCascadeSelectProps) {
  const [open, setOpen] = useState(false);
  const [draftL1, setDraftL1] = useState("");
  const [draftL2, setDraftL2] = useState("");

  const l1Name = useMemo(
    () => categories.find((c) => c.code === l1Code)?.name ?? "",
    [categories, l1Code]
  );
  const l2Name = useMemo(() => {
    if (!l2Code) return "";
    for (const l1 of categories) {
      const hit = l1.children.find((c) => c.code === l2Code);
      if (hit) return hit.name;
    }
    return "";
  }, [categories, l2Code]);

  const draftL1Category = useMemo(
    () => categories.find((c) => c.code === draftL1),
    [categories, draftL1]
  );
  const draftL2Name = useMemo(() => {
    if (!draftL2) return "";
    for (const l1 of categories) {
      const hit = l1.children.find((c) => c.code === draftL2);
      if (hit) return hit.name;
    }
    return "";
  }, [categories, draftL2]);

  const display = l1Name
    ? l2Name
      ? `${l1Name} / ${l2Name}`
      : `${l1Name} / 未选择二级`
    : "";

  if (viewMode) {
    return (
      <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground">
        {display || "—"}
      </div>
    );
  }

  const handleConfirm = () => {
    if (!draftL1 || !draftL2) return;
    onChange(draftL1, draftL2);
    setOpen(false);
  };

  return (
    <>
      <SkeuComboboxTrigger
        label={display}
        placeholder={placeholder}
        className={className}
        open={open}
        onClick={() => {
          // 打开时以已提交值为草稿起点，取消不改动表单值
          setDraftL1(l1Code);
          setDraftL2(l2Code);
          setOpen(true);
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <AppDialogContent size="wide" className="flex flex-col max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-lg">选择食材分类</DialogTitle>
            <DialogDescription className="sr-only">
              左侧选择一级分类，右侧选择二级分类
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-[180px_1fr] border border-skeu-border rounded-xl overflow-hidden">
            <div className="skeu-surface-muted border-r border-skeu-border overflow-y-auto skeu-scroll p-2 space-y-0.5">
              {categories.map((l1) => {
                const active = l1.code === draftL1;
                return (
                  <button
                    key={l1.code}
                    type="button"
                    onClick={() => {
                      setDraftL1(l1.code);
                      setDraftL2("");
                    }}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-left transition-colors",
                      active
                        ? "bg-[var(--sk-primary-soft)] text-[var(--sk-primary-ink)] font-semibold shadow-sk-inset"
                        : "text-foreground hover:bg-white/70"
                    )}
                  >
                    <span className="truncate">{l1.name}</span>
                    {active && (
                      <span className="size-1.5 rounded-full bg-[var(--sk-primary-to)] shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="bg-white overflow-y-auto skeu-scroll p-4">
              <div className="text-xs text-muted-foreground mb-3">
                {draftL1Category
                  ? `${draftL1Category.name} · 选择二级分类`
                  : "请先在左侧选择一级分类"}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(draftL1Category?.children ?? []).map((l2) => {
                  const active = l2.code === draftL2;
                  return (
                    <button
                      key={l2.code}
                      type="button"
                      onClick={() => setDraftL2(l2.code)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
                        active
                          ? "border-[var(--sk-primary-to)] text-[var(--sk-primary-ink)] font-semibold bg-[var(--sk-primary-soft)] shadow-[var(--sk-primary-shadow)]"
                          : "border-skeu-border-strong skeu-surface hover:border-[#f97316aa]"
                      )}
                    >
                      <span className="truncate">{l2.name}</span>
                      {active && <Check className="h-4 w-4 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-[13px] text-muted-foreground min-w-0">
              已选：
              <b className="text-[var(--sk-primary-ink)] font-semibold">
                {draftL1
                  ? draftL2
                    ? `${draftL1Category?.name} / ${draftL2Name}`
                    : `${draftL1Category?.name} / 未选择二级`
                  : "未选择"}
              </b>
            </div>
            <div className="flex gap-2 shrink-0">
              <SkeuButton variant="outline" onClick={() => setOpen(false)}>
                取消
              </SkeuButton>
              <SkeuButton
                variant="primary"
                disabled={!draftL1 || !draftL2}
                onClick={handleConfirm}
              >
                确定
              </SkeuButton>
            </div>
          </div>
        </AppDialogContent>
      </Dialog>
    </>
  );
}
