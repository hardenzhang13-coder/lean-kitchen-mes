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

export type CascadeCategoryL3 = { code: string; name: string };
export type CascadeCategoryL2 = {
  code: string;
  name: string;
  /** 三级子级（可选层）；缺省或空数组表示该二级下无三级 */
  children?: CascadeCategoryL3[];
};
export type CascadeCategory = {
  code: string;
  name: string;
  children: CascadeCategoryL2[];
};

interface CategoryCascadeSelectProps {
  /** 已按业务规则过滤的一级分类（含二级、三级子集） */
  categories: CascadeCategory[];
  l1Code: string;
  l2Code: string;
  /** 三级分类（可选）；空字符串 = 不限三级 */
  l3Code?: string;
  /** 确定后回传选中的一、二、三级编码（l3 为空字符串表示不限三级） */
  onChange: (l1Code: string, l2Code: string, l3Code: string) => void;
  viewMode?: boolean;
  placeholder?: string;
  className?: string;
  /** 弹窗标题，默认「选择食材分类」；调味品域传「选择调味品分类」 */
  dialogTitle?: string;
  /** 禁用触发器（如净料转化未选来源食材时） */
  disabled?: boolean;
}

/**
 * 三级分类级联选择：单字段触发、单弹窗三栏同屏（左 L1 / 中 L2 / 右 L3 磁贴）。
 * 一二级必选，三级可选（「不限三级」= 只选到二级）；底部路径栏 + 确定才生效，取消不改动表单值。
 * 交互定稿见 /ui-kit 样张（2026-11-28 验收）。
 */
export function CategoryCascadeSelect({
  categories,
  l1Code,
  l2Code,
  l3Code = "",
  onChange,
  viewMode = false,
  placeholder = "请选择",
  className,
  dialogTitle = "选择食材分类",
  disabled = false,
}: CategoryCascadeSelectProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ l1: "", l2: "", l3: "" });

  const findL1 = (code: string) => categories.find((c) => c.code === code);
  const findL2 = (l1: string, l2: string) =>
    findL1(l1)?.children.find((c) => c.code === l2);
  const findL3 = (l1: string, l2: string, l3: string) =>
    findL2(l1, l2)?.children?.find((c) => c.code === l3);

  const pathText = (l1: string, l2: string, l3: string) => {
    const n1 = findL1(l1);
    if (!n1) return "";
    const n2 = findL2(l1, l2);
    if (!n2) return `${n1.name} / 未选择二级`;
    const n3 = l3 ? findL3(l1, l2, l3) : undefined;
    return n3 ? `${n1.name} / ${n2.name} / ${n3.name}` : `${n1.name} / ${n2.name}`;
  };

  const display = useMemo(
    () => pathText(l1Code, l2Code, l3Code),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, l1Code, l2Code, l3Code]
  );

  const draftL1Node = findL1(draft.l1);
  const draftL2Node = findL2(draft.l1, draft.l2);
  const draftL3Options = useMemo(
    () => draftL2Node?.children ?? [],
    [draftL2Node]
  );

  if (viewMode) {
    return (
      <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground">
        {display || "—"}
      </div>
    );
  }

  const handleConfirm = () => {
    if (!draft.l1 || !draft.l2) return;
    onChange(draft.l1, draft.l2, draft.l3);
    setOpen(false);
  };

  return (
    <>
      <SkeuComboboxTrigger
        label={display}
        placeholder={placeholder}
        className={className}
        open={open}
        disabled={disabled}
        onClick={() => {
          // 打开时以已提交值为草稿起点，取消不改动表单值
          setDraft({ l1: l1Code, l2: l2Code, l3: l3Code });
          setOpen(true);
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <AppDialogContent size="wide" className="flex flex-col max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-lg">{dialogTitle}</DialogTitle>
            <DialogDescription className="sr-only">
              左栏一级、中栏二级、右栏三级磁贴；三级可选，确定后生效
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-[150px_150px_1fr] grid-rows-[auto_1fr] border border-skeu-border rounded-xl overflow-hidden">
            {/* 列标题行 */}
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground skeu-surface-muted border-r border-b border-skeu-border">
              一级分类
            </div>
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground skeu-surface-muted border-r border-b border-skeu-border">
              二级分类
            </div>
            <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-white border-b border-skeu-border">
              三级分类（可选）
            </div>
            {/* L1 */}
            <div className="skeu-surface-muted border-r border-skeu-border overflow-y-auto skeu-scroll p-2 space-y-0.5">
              {categories.map((l1) => {
                const active = l1.code === draft.l1;
                return (
                  <button
                    key={l1.code}
                    type="button"
                    onClick={() => setDraft({ l1: l1.code, l2: "", l3: "" })}
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
            {/* L2 */}
            <div className="skeu-surface-muted border-r border-skeu-border overflow-y-auto skeu-scroll p-2 space-y-0.5">
              {draftL1Node ? (
                draftL1Node.children.map((l2) => {
                  const active = l2.code === draft.l2;
                  const l3Count = l2.children?.length ?? 0;
                  return (
                    <button
                      key={l2.code}
                      type="button"
                      onClick={() => setDraft({ ...draft, l2: l2.code, l3: "" })}
                      className={cn(
                        "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-left transition-colors",
                        active
                          ? "bg-[var(--sk-primary-soft)] text-[var(--sk-primary-ink)] font-semibold shadow-sk-inset"
                          : "text-foreground hover:bg-white/70"
                      )}
                    >
                      <span className="truncate">{l2.name}</span>
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground shrink-0">
                        {l3Count > 0 ? l3Count : "—"}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-6 text-xs text-muted-foreground">
                  请先选择一级分类
                </p>
              )}
            </div>
            {/* L3 */}
            <div className="bg-white overflow-y-auto skeu-scroll p-4">
              {draftL2Node ? (
                draftL3Options.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <L3Tile
                      active={!draft.l3}
                      onClick={() => setDraft({ ...draft, l3: "" })}
                    >
                      不限三级
                    </L3Tile>
                    {draftL3Options.map((l3) => (
                      <L3Tile
                        key={l3.code}
                        active={l3.code === draft.l3}
                        onClick={() => setDraft({ ...draft, l3: l3.code })}
                      >
                        {l3.name}
                      </L3Tile>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">
                    该分类暂无三级分类，可直接确定
                  </p>
                )
              ) : (
                <p className="py-6 text-sm text-muted-foreground">
                  请先在中栏选择二级分类
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-[13px] text-muted-foreground min-w-0 truncate">
              已选：
              <b className="text-[var(--sk-primary-ink)] font-semibold">
                {pathText(draft.l1, draft.l2, draft.l3) || "未选择"}
              </b>
            </div>
            <div className="flex gap-2 shrink-0">
              <SkeuButton variant="outline" onClick={() => setOpen(false)}>
                取消
              </SkeuButton>
              <SkeuButton
                variant="primary"
                disabled={!draft.l1 || !draft.l2}
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

function L3Tile({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
        active
          ? "border-[var(--sk-primary-to)] text-[var(--sk-primary-ink)] font-semibold bg-[var(--sk-primary-soft)] shadow-[var(--sk-primary-shadow)]"
          : "border-skeu-border-strong skeu-surface hover:border-[#f97316aa]"
      )}
    >
      <span className="truncate">{children}</span>
      {active && <Check className="h-4 w-4 shrink-0 ml-1" />}
    </button>
  );
}
