"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

function optionMatches(name: string, code: string, term: string) {
  if (!term) return true;
  return (
    name.toLowerCase().includes(term) || code.toLowerCase().includes(term)
  );
}

/**
 * 一二级分类筛选器（食材库标准件）。
 * 轻拟物触发器 + 弹层分栏：左栏一级分类、右栏该分类下的二级；
 * 选项超过 5 个时自动出现搜索框，避免长下拉。
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
  const [search, setSearch] = useState("");

  const nodes = useMemo(
    () => (fixedL1 ? categories.filter((c) => c.code === fixedL1) : categories),
    [categories, fixedL1]
  );
  const activeL1 = fixedL1 || l1;
  const l1Node = nodes.find((node) => node.code === activeL1);
  const children = l1Node?.children ?? [];

  const term = search.trim().toLowerCase();
  const filteredNodes = nodes.filter((node) =>
    optionMatches(node.name, node.code, term)
  );
  const filteredChildren = children.filter((child) =>
    optionMatches(child.name, child.code, term)
  );

  const activeL2 = children.find((child) => child.code === l2);
  const label = fixedL1
    ? activeL2?.name || placeholder || "全部二级分类"
    : l1Node
      ? activeL2
        ? `${l1Node.name} · ${activeL2.name}`
        : l1Node.name
      : placeholder || "全部分类";
  const isActive = fixedL1 ? !!l2 : !!(l1 || l2);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  const clear = () => {
    onChange(fixedL1 ?? "", "");
    close();
  };

  const showSearch = children.length > 5;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger
        aria-label="分类筛选"
        className={cn(
          "flex h-11 items-center gap-2 rounded-[var(--sk-radius-sm)] border border-skeu-border-strong skeu-surface px-3.5 text-sm font-medium shadow-sk-raised transition-transform duration-150 active:translate-y-px focus-visible:border-[var(--sk-focus)] focus-visible:bg-[var(--sk-control-bg)] focus-visible:outline-none",
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
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(
          "overflow-hidden rounded-[var(--sk-radius-md)] border-skeu-border bg-popover p-0 shadow-sk-2 ring-0",
          fixedL1 ? "w-[320px]" : "w-[560px]"
        )}
      >
        {fixedL1 ? (
          <div className="p-3">
            <PaneHeader
              label={l1Node?.name ?? ""}
              onClear={isActive ? clear : undefined}
            />
            {showSearch && <SearchBox value={search} onChange={setSearch} />}
            <ChipGrid
              options={filteredChildren}
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
          <div className="flex">
            <div className="w-[180px] shrink-0 border-r border-skeu-border bg-[var(--sk-surface-muted)] p-2">
              <div className="max-h-[300px] overflow-auto">
                <ListRow
                  active={!l1}
                  onClick={() => {
                    onChange("", "");
                    setSearch("");
                  }}
                >
                  全部一级
                </ListRow>
                {filteredNodes.map((node) => (
                  <ListRow
                    key={node.code}
                    active={node.code === l1}
                    onClick={() => {
                      onChange(node.code, "");
                      setSearch("");
                    }}
                  >
                    <span className="truncate">{node.name}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {node.children?.length ?? 0}
                    </span>
                  </ListRow>
                ))}
              </div>
            </div>

            <div className="min-w-0 flex-1 p-3">
              <PaneHeader
                label={l1Node?.name ?? "二级分类"}
                onClear={isActive ? clear : undefined}
              />
              {l1Node ? (
                <>
                  {showSearch && (
                    <SearchBox value={search} onChange={setSearch} />
                  )}
                  <ChipGrid
                    options={filteredChildren}
                    value={l2}
                    allLabel={`全部${l1Node.name}`}
                    onSelect={(code) => {
                      onChange(l1Node.code, code);
                      close();
                    }}
                    emptyText="该分类下暂无二级分类"
                  />
                </>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  先选择左侧一级分类
                </p>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PaneHeader({
  label,
  onClear,
}: {
  label: string;
  onClear?: () => void;
}) {
  return (
    <div className="mb-2 flex h-6 items-center justify-between">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-[var(--sk-primary-ink)] hover:underline"
        >
          清除筛选
        </button>
      )}
    </div>
  );
}

function SearchBox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-2 flex h-9 items-center gap-2 rounded-[var(--sk-radius-sm)] border border-skeu-border-strong bg-white px-2.5 focus-within:border-[var(--sk-focus)]">
      <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="搜索分类..."
        className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
      />
    </label>
  );
}

function ListRow({
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
        "flex h-9 w-full items-center gap-2 rounded-[var(--sk-radius-xs)] px-2.5 text-left text-sm transition-colors hover:bg-muted/60",
        active &&
          "bg-[var(--sk-primary-soft-solid)] font-semibold text-[var(--sk-primary-ink)] hover:bg-[var(--sk-primary-soft-solid)]"
      )}
    >
      {children}
    </button>
  );
}

function ChipGrid({
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
    <div className="grid max-h-[280px] grid-cols-2 gap-1.5 overflow-auto">
      <button
        type="button"
        onClick={() => onSelect("")}
        className={cn(
          "flex h-9 items-center gap-2 rounded-[var(--sk-radius-xs)] border px-2.5 text-left text-sm transition-colors",
          !value
            ? "border-[var(--sk-primary-ink)] bg-[var(--sk-primary-soft-solid)] font-semibold text-[var(--sk-primary-ink)]"
            : "border-skeu-border bg-white hover:border-skeu-border-strong"
        )}
      >
        <span className="truncate">{allLabel}</span>
        {!value && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
      </button>
      {options.map((option) => {
        const active = option.code === value;
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => onSelect(option.code)}
            className={cn(
              "flex h-9 items-center gap-2 rounded-[var(--sk-radius-xs)] border px-2.5 text-left text-sm transition-colors",
              active
                ? "border-[var(--sk-primary-ink)] bg-[var(--sk-primary-soft-solid)] font-semibold text-[var(--sk-primary-ink)]"
                : "border-skeu-border bg-white hover:border-skeu-border-strong"
            )}
          >
            <span className="truncate">{option.name}</span>
            {active && <Check className="ml-auto h-3.5 w-3.5 shrink-0" />}
          </button>
        );
      })}
      {options.length === 0 && (
        <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      )}
    </div>
  );
}
