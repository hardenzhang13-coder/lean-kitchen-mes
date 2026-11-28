"use client";

import { useState } from "react";
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

export interface CategoryFilterL3 {
  code: string;
  name: string;
}
export interface CategoryFilterL2 {
  code: string;
  name: string;
  children?: CategoryFilterL3[];
}
export interface CategoryFilterNode {
  code: string;
  name: string;
  children?: CategoryFilterL2[];
}

interface CategoryFilterProps {
  categories: CategoryFilterNode[];
  /** 当前一级分类 */
  l1: string;
  /** 当前二级分类 */
  l2: string;
  /** 当前三级分类；传入该 prop（含空字符串）即启用三级筛选 */
  l3?: string;
  onChange: (l1: string, l2: string, l3?: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * 分类筛选器（食材库标准件）。
 * 与表单级联选择同款的级联弹窗：左栏一级列表、右栏二级磁贴，点选即生效。
 * 传入 l3 时升级为三栏（一级 / 二级 / 三级磁贴）：点二级应用但不关弹窗，可继续点三级；
 * 点三级 /「不限三级」应用后关闭。不传 l3 保持两级：点二级应用并关闭。
 */
export function CategoryFilter({
  categories,
  l1,
  l2,
  l3,
  onChange,
  placeholder,
  className,
}: CategoryFilterProps) {
  const [open, setOpen] = useState(false);
  const hasL3 = l3 !== undefined;

  const l1Node = categories.find((node) => node.code === l1);
  const children = l1Node?.children ?? [];
  const l2Node = children.find((child) => child.code === l2);
  const l3Options = l2Node?.children ?? [];

  const activeL2 = l2Node;
  const activeL3 = l3Options.find((child) => child.code === l3);
  const label = l1Node
    ? activeL2
      ? activeL3
        ? `${l1Node.name} · ${activeL2.name} · ${activeL3.name}`
        : `${l1Node.name} · ${activeL2.name}`
      : l1Node.name
    : placeholder || "全部分类";
  const isActive = !!(l1 || l2 || l3);

  const close = () => setOpen(false);

  const clear = () => {
    onChange("", "", "");
    close();
  };

  const selectL2 = (code: string) => {
    if (hasL3) {
      // 三级模式下点二级只应用不关闭，便于继续选三级
      onChange(l1, code, "");
      return;
    }
    onChange(l1, code, "");
    close();
  };

  const selectL3 = (code: string) => {
    onChange(l1, l2, code);
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
            <DialogTitle className="text-lg">筛选食材分类</DialogTitle>
            <DialogDescription className="sr-only">
              左侧选择一级分类，右侧选择二级分类，点选即生效
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 grid grid-cols-[180px_1fr] border border-skeu-border rounded-xl overflow-hidden">
            <div className="skeu-surface-muted border-r border-skeu-border overflow-y-auto skeu-scroll p-2 space-y-0.5">
              <L1Row
                active={!l1}
                onClick={() => {
                  onChange("", "", "");
                  close();
                }}
              >
                全部一级
              </L1Row>
              {categories.map((node) => (
                <L1Row
                  key={node.code}
                  active={node.code === l1}
                  onClick={() => onChange(node.code, "", "")}
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
                hasL3 ? (
                  <div className="grid grid-cols-[150px_1fr] gap-4 items-start">
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {l1Node.name} · 二级
                      </div>
                      <TileGrid
                        options={children}
                        value={l2}
                        allLabel={`全部${l1Node.name}`}
                        onSelect={selectL2}
                        emptyText="该分类下暂无二级分类"
                        cols="grid-cols-1"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-2">
                        三级分类（可选）
                      </div>
                      {l2Node ? (
                        l3Options.length > 0 ? (
                          <TileGrid
                            options={l3Options}
                            value={l3 ?? ""}
                            allLabel="不限三级"
                            onSelect={selectL3}
                            emptyText=""
                          />
                        ) : (
                          <p className="py-6 text-sm text-muted-foreground">
                            该分类暂无三级分类
                          </p>
                        )
                      ) : (
                        <p className="py-6 text-sm text-muted-foreground">
                          请先选择二级分类
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
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
                )
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  请先在左侧选择一级分类
                </p>
              )}
            </div>
          </div>

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
  cols = "grid-cols-2 sm:grid-cols-3",
}: {
  options: { code: string; name: string }[];
  value: string;
  allLabel: string;
  onSelect: (code: string) => void;
  emptyText: string;
  cols?: string;
}) {
  return (
    <div className={cn("grid gap-2", cols)}>
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
      {options.length === 0 && emptyText && (
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
