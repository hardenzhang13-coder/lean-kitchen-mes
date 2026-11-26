"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { cn } from "@/lib/shared/utils";

export interface CategoryFilterNode {
  code: string;
  name: string;
  children?: { code: string; name: string }[];
}

interface CategoryFilterProps {
  categories: CategoryFilterNode[];
  /** 当前一级分类；固定一级模式下忽略 */
  l1: string;
  /** 当前二级分类 */
  l2: string;
  onChange: (l1: string, l2: string) => void;
  /** 只筛某一下级（小料 MIN / 调料 SEA）：隐藏一级列，直接展示二级 */
  fixedL1?: string;
  placeholder?: string;
  className?: string;
}

/**
 * 一二级分类筛选器（食材库标准件）。
 * 与表单级联选择同款的级联弹窗：左栏一级列表、右栏二级磁贴，点选即生效。
 * 点一级切换右侧并即时应用；点二级 /「全部」应用后关闭；底部可清空筛选。
 * 小料 / 调料只有二级时传 `fixedL1`，退化为单栏二级选择。
 */
export function CategoryFilter({
  categories,
  l1,
  l2,
  onChange,
  fixedL1,
  placeholder,
  className,
}: CategoryFilterProps) {
  const [open, setOpen] = useState(false);

  const nodes = useMemo(
    () => (fixedL1 ? categories.filter((c) => c.code === fixedL1) : categories),
    [categories, fixedL1]
  );
  const activeL1 = fixedL1 || l1;
  const l1Node = nodes.find((node) => node.code === activeL1);
  const children = l1Node?.children ?? [];

  const activeL2 = children.find((child) => child.code === l2);
  const label = fixedL1
    ? activeL2?.name || placeholder || "全部二级分类"
    : l1Node
      ? activeL2
        ? `${l1Node.name} · ${activeL2.name}`
        : l1Node.name
      : placeholder || "全部分类";
  const isActive = fixedL1 ? !!l2 : !!(l1 || l2);

  const close = () => setOpen(false);

  const clear = () => {
    onChange(fixedL1 ?? "", "");
    close();
  };

  const selectL2 = (code: string) => {
    onChange(activeL1, code);
    close();
  };

  return (
    <>
      <button
        type="button"
        aria-label="分类筛选"
        data-focus="field"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-[var(--sk-radius-sm)] border border-skeu-border-strong skeu-surface px-3.5 text-sm font-medium shadow-sk-raised transition-transform duration-150 active:translate-y-px focus-visible:border-[var(--sk-focus)] focus-visible:bg-[var(--sk-control-bg)] focus-visible:outline-none",
          className
        )}
      >
        <span
          className={cn(
            "truncate text-left",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <AppDialogContent size="wide" className="flex flex-col max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {fixedL1 ? `筛选${l1Node?.name ?? "分类"}` : "筛选食材分类"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              左侧选择一级分类，右侧选择二级分类，点选即生效
            </DialogDescription>
          </DialogHeader>

          {fixedL1 ? (
            <div className="flex-1 min-h-0 bg-white overflow-y-auto skeu-scroll p-4 rounded-xl border border-skeu-border">
              <TileGrid
                options={children}
                value={l2}
                allLabel="全部"
                onSelect={(code) => {
                  onChange(fixedL1, code);
                  close();
                }}
                emptyText="该分类下暂无二级分类"
              />
            </div>
          ) : (
            <div className="flex-1 min-h-0 grid grid-cols-[180px_1fr] border border-skeu-border rounded-xl overflow-hidden">
              <div className="skeu-surface-muted border-r border-skeu-border overflow-y-auto skeu-scroll p-2 space-y-0.5">
                <L1Row
                  active={!l1}
                  onClick={() => {
                    onChange("", "");
                    close();
                  }}
                >
                  全部一级
                </L1Row>
                {nodes.map((node) => (
                  <L1Row
                    key={node.code}
                    active={node.code === l1}
                    onClick={() => onChange(node.code, "")}
                  >
                    <span className="truncate">{node.name}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {node.children?.length ?? 0}
                    </span>
                  </L1Row>
                ))}
              </div>
              <div className="bg-white overflow-y-auto skeu-scroll p-4">
                {l1Node ? (
                  <>
                    <div className="text-xs text-muted-foreground mb-3">
                      {l1Node.name} · 选择二级分类
                    </div>
                    <TileGrid
                      options={children}
                      value={l2}
                      allLabel={`全部${l1Node.name}`}
                      onSelect={selectL2}
                      emptyText="该分类下暂无二级分类"
                    />
                  </>
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    请先在左侧选择一级分类
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-[13px] text-muted-foreground min-w-0 truncate">
              当前筛选：
              <b className="text-[var(--sk-primary-ink)] font-semibold">
                {isActive ? label : "全部分类"}
              </b>
            </div>
            <div className="flex gap-2 shrink-0">
              {isActive && (
                <SkeuButton variant="ghost" size="sm" onClick={clear}>
                  清空筛选
                </SkeuButton>
              )}
              <SkeuButton variant="primary" size="sm" onClick={close}>
                完成
              </SkeuButton>
            </div>
          </div>
        </AppDialogContent>
      </Dialog>
    </>
  );
}

function L1Row({
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
        "w-full flex items-center rounded-lg px-3 py-2.5 text-sm text-left transition-colors",
        active
          ? "bg-[var(--sk-primary-soft)] text-[var(--sk-primary-ink)] font-semibold shadow-sk-inset"
          : "text-foreground hover:bg-white/70"
      )}
    >
      {children}
    </button>
  );
}

function TileGrid({
  options,
  value,
  allLabel,
  onSelect,
  emptyText,
}: {
  options: { code: string; name: string }[];
  value: string;
  allLabel: string;
  onSelect: (code: string) => void;
  emptyText: string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      <Tile active={!value} onClick={() => onSelect("")}>
        {allLabel}
      </Tile>
      {options.map((option) => (
        <Tile
          key={option.code}
          active={option.code === value}
          onClick={() => onSelect(option.code)}
        >
          {option.name}
        </Tile>
      ))}
      {options.length === 0 && (
        <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
    </div>
  );
}

function Tile({
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
