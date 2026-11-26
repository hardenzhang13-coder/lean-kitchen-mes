"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, ChevronRight } from "lucide-react";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { PageShell } from "@/app/components/ui/page-shell";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { PageHeader } from "@/app/components/ui/page-header";
import { cn } from "@/lib/shared/utils";

type BoardId = "raw" | "seasoning" | "spice" | "dish";

type IngredientNode = {
  id: BoardId;
  name: string;
  glyph: string;
  color: string;
  desc: string;
  href: string | null;
  /** iOS 风格磁贴：渐变底 + 彩色柔影，配色语言与设置首页一致 */
  tileClass: string;
};

type Counts = {
  raw: number;
  net: number;
  minor: number;
  seasoningBase: number;
  seasoningItem: number;
  seasoningCompound: number;
  seasoningSauce: number;
  dishSinglePortion: number;
};

type ModuleSummary = { value: number; unit: string };

type ModuleMetric = { label: string; value: number | null; unit: string };

// 保留现有文字图标；辅助文案按当前模块边界重写。
const SOURCE_NODES: IngredientNode[] = [
  {
    id: "raw",
    name: "食材",
    glyph: "原",
    color: "#f97316",
    desc: "采购档案与净料、小料转化",
    href: "/ingredients/raw",
    tileClass:
      "bg-[linear-gradient(180deg,#FFA24D_0%,#F07018_100%)] shadow-[0_2px_5px_rgba(240,112,24,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(240,112,24,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
  },
  {
    id: "seasoning",
    name: "调味品",
    glyph: "调",
    color: "#3b82f6",
    desc: "原材料层，转化为三种标准化调料",
    href: "/ingredients/seasoning",
    tileClass:
      "bg-[linear-gradient(180deg,#5B9FFF_0%,#2F6FE0_100%)] shadow-[0_2px_5px_rgba(47,111,224,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(47,111,224,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
  },
  {
    id: "spice",
    name: "香料",
    glyph: "香",
    color: "#f59e0b",
    desc: "预留模块，暂未启用",
    href: null,
    tileClass:
      "bg-[linear-gradient(180deg,#FFBE4D_0%,#E8992B_100%)] shadow-[0_2px_5px_rgba(232,153,43,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(232,153,43,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
  },
];

const DISH_NODE: IngredientNode = {
  id: "dish",
  name: "菜品库",
  glyph: "菜",
  color: "#8b5cf6",
  desc: "调用食材与调味品组菜",
  href: "/dishes",
  tileClass:
    "bg-[linear-gradient(180deg,#9F8CFF_0%,#6E54E8_100%)] shadow-[0_2px_5px_rgba(110,84,232,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(110,84,232,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
};

// 流向结构保持不变：三类食材入口统一指向菜品库。
const FLOWS: Array<{ from: BoardId; to: BoardId; color: string }> = [
  { from: "raw", to: "dish", color: "#f97316" },
  { from: "seasoning", to: "dish", color: "#3b82f6" },
  { from: "spice", to: "dish", color: "#f59e0b" },
];

// 血缘：上游/下游（悬停高亮用）
const REL: Record<string, { up: string[]; down: string[] }> = {};
FLOWS.forEach((flow) => {
  (REL[flow.from] = REL[flow.from] || { up: [], down: [] }).down.push(flow.to);
  (REL[flow.to] = REL[flow.to] || { up: [], down: [] }).up.push(flow.from);
});

function lineage(id: string): Set<string> {
  const set = new Set<string>([id]);
  const walk = (nodeId: string, direction: "up" | "down") => {
    (REL[nodeId]?.[direction] || []).forEach((nextId) => {
      if (!set.has(nextId)) {
        set.add(nextId);
        walk(nextId, direction);
      }
    });
  };
  walk(id, "up");
  walk(id, "down");
  return set;
}

/** 计价规则弹窗：统一链路 + 各类型成本价由来 */
function PricingRulesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="wide" className="[&>button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="text-lg">计价规则</DialogTitle>
        </DialogHeader>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2.5">
          <span className="mr-1 text-xs font-semibold text-muted-foreground">
            统一链路
          </span>
          <span className="rounded-lg bg-muted px-3 py-[6px] text-xs font-semibold text-foreground">
            成本价<span className="ml-1 font-normal text-muted-foreground">元/斤</span>
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            ÷（1 − 毛利率）
          </span>
          <span className="rounded-lg bg-muted px-3 py-[6px] text-xs font-semibold text-foreground">
            出库价<span className="ml-1 font-normal text-muted-foreground">元/斤</span>
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            × 包装规格（g）÷ 500
          </span>
          <span className="rounded-lg bg-muted px-3 py-[6px] text-xs font-semibold text-foreground">
            标准规格价
            <span className="ml-1 font-normal text-muted-foreground">元/份</span>
          </span>
        </div>

          <div className="mt-4 grid gap-x-10 gap-y-3 border-t border-dashed border-border pt-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 text-xs">
            <span
              className="shrink-0 rounded-md px-2 py-1 font-semibold text-white"
              style={{ background: "#f59e0b" }}
            >
              食材 · 调味品
            </span>
            <span className="text-muted-foreground">
              成本价 = 每斤单价（元/斤）
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span
              className="shrink-0 rounded-md px-2 py-1 font-semibold text-white"
              style={{ background: "#10b981" }}
            >
              净料 · 小料
            </span>
            <span className="text-muted-foreground">
              成本价 = 净料/小料单价 ＋ 封装加工费
              <span className="ml-1 text-muted-foreground/70">
                （单价 = 食材每斤单价 ÷ 出成率）
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span
              className="shrink-0 rounded-md px-2 py-1 font-semibold text-white"
              style={{ background: "#8b5cf6" }}
            >
              调料 · 转化
            </span>
            <span className="text-muted-foreground">
              单价 = 调味品每斤单价 ÷ 出成率；成本价 = 单价 ＋ 封装加工费
            </span>
          </div>
        </div>
      </AppDialogContent>
    </Dialog>
  );
}

/**
 * 食材库 iOS 流向卡：沿用当前卡片骨架；明细数据作为轻量信息行融入，不复制 demo 独立样式。
 */
function FlowCard({
  node,
  summary,
  metrics,
  dimmed,
  cardRef,
  onMouseEnter,
  onMouseLeave,
  onOpen,
}: {
  node: IngredientNode;
  summary?: ModuleSummary;
  metrics?: ModuleMetric[];
  dimmed: boolean;
  cardRef: (element: HTMLDivElement | null) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpen: () => void;
}) {
  const clickable = node.href !== null;
  const emphasized = node.id === "dish";
  const cardClass = cn(
    "group relative flex flex-col justify-center bg-[linear-gradient(180deg,#ffffff_0%,#fcfbf9_100%)]",
    "transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
    emphasized
      ? [
          "min-h-[132px] gap-4 rounded-[18px] border border-black/[0.08] p-5 pr-6",
          "shadow-[0_2px_6px_rgba(15,23,42,0.05),0_10px_30px_rgba(15,23,42,0.10)]",
          "hover:-translate-y-0.5 hover:border-black/[0.12] hover:shadow-[0_4px_10px_rgba(15,23,42,0.07),0_18px_44px_rgba(15,23,42,0.16)]",
          "active:translate-y-0 active:shadow-[0_2px_6px_rgba(15,23,42,0.10)]",
        ]
      : [
          "min-h-[124px] gap-3 rounded-[14px] border border-black/[0.06] p-3.5 pr-4",
          "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_3px_12px_rgba(15,23,42,0.06)]",
          "hover:-translate-y-px hover:border-black/[0.09] hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_10px_24px_rgba(15,23,42,0.12)]",
          "active:translate-y-0 active:border-black/[0.09] active:shadow-[0_1px_3px_rgba(15,23,42,0.10)]",
        ],
    clickable && "cursor-pointer",
    !clickable && "cursor-default select-none opacity-70",
    dimmed && "scale-[0.985] opacity-[0.18]"
  );

  return (
    <div
      ref={cardRef}
      role={clickable ? "link" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      aria-disabled={clickable ? undefined : true}
      className={cardClass}
    >
      <div
        className={cn(
          "flex w-full items-center",
          emphasized ? "gap-4" : "gap-3"
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center text-white",
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.40)] [text-shadow:0_1px_1px_rgba(0,0,0,0.18)]",
            "transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover:scale-[1.04] group-active:scale-95",
            emphasized
              ? "h-14 w-14 rounded-[16px] text-[26px] font-bold"
              : "h-11 w-11 rounded-[11px] text-[20px] font-semibold",
            node.tileClass
          )}
          aria-hidden
        >
          {node.glyph}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              "font-semibold leading-snug text-foreground",
              emphasized ? "text-base" : "text-[15px]"
            )}
          >
            {node.name}
          </span>
          <span
            className={cn(
              "line-clamp-2 leading-snug text-muted-foreground",
              emphasized ? "text-sm" : "text-[13px]"
            )}
          >
            {node.desc}
          </span>
        </span>
        <span className="ml-auto flex shrink-0 items-center pl-2">
          {summary ? (
            <span className="text-right">
              <span
                className={cn(
                  "block font-bold leading-none tabular-nums",
                  emphasized ? "text-2xl" : "text-xl"
                )}
                style={{ color: node.color }}
              >
                {summary.value}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {summary.unit}
              </span>
            </span>
          ) : clickable ? (
            <ChevronRight
              className={cn(
                "text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5",
                emphasized ? "h-5 w-5" : "h-4 w-4"
              )}
              aria-hidden
            />
          ) : null}
        </span>
      </div>

      {metrics && metrics.length > 0 ? (
        <div className="ml-14 flex flex-wrap items-baseline gap-x-5 gap-y-1.5">
          {metrics.map((metric) => (
            <span
              key={metric.label}
              className="inline-flex items-baseline gap-1 whitespace-nowrap"
            >
              <span className="text-xs text-muted-foreground">{metric.label}</span>
              {metric.value === null ? (
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                  —
                </span>
              ) : (
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {metric.value}
                </span>
              )}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
export default function IngredientsPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({
    raw: 0,
    net: 0,
    minor: 0,
    seasoningBase: 0,
    seasoningItem: 0,
    seasoningCompound: 0,
    seasoningSauce: 0,
    dishSinglePortion: 0,
  });
  const [hoverId, setHoverId] = useState<BoardId | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [paths, setPaths] = useState<Record<string, string>>({});
  const boardRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Partial<Record<BoardId, HTMLDivElement | null>>>({});

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/ingredients/summary");
      if (!res.ok) return;
      const json = await res.json();
      if (json?.data) setCounts(json.data);
    } catch {
      // 静默失败：保留当前展示的数字
    }
  }, []);

  useEffect(() => {
    // React 官方推荐的数据获取模式：setState 均发生在 await 之后的异步回调中，
    // 不构成同步级联渲染
    // eslint-disable-next-line react-hooks/set-state-in-effect -- React 官方数据获取模式，setState 在异步回调后触发
    fetchCounts();
    const refresh = () => fetchCounts();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [fetchCounts]);

  // 流向连线结构保留：节点渲染完成后取坐标，窗口变化重算
  useEffect(() => {
    const compute = () => {
      const board = boardRef.current;
      if (!board) return;
      const boardBox = board.getBoundingClientRect();
      const nextPaths: Record<string, string> = {};
      FLOWS.forEach((flow) => {
        const source = nodeRefs.current[flow.from];
        const target = nodeRefs.current[flow.to];
        if (!source || !target) return;
        const sourceBox = source.getBoundingClientRect();
        const targetBox = target.getBoundingClientRect();
        const x1 = sourceBox.right - boardBox.left + 2;
        const y1 = sourceBox.top - boardBox.top + sourceBox.height / 2;
        const x2 = targetBox.left - boardBox.left - 6;
        const y2 = targetBox.top - boardBox.top + targetBox.height / 2;
        const dx = Math.max(52, (x2 - x1) * 0.5);
        nextPaths[`${flow.from}-${flow.to}`] =
          `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      });
      setPaths(nextPaths);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const hoverSet = hoverId ? lineage(hoverId) : null;
  const isFlowActive = (index: number) =>
    hoverId !== null &&
    (FLOWS[index].from === hoverId || FLOWS[index].to === hoverId);

  const renderFlowCard = (node: IngredientNode) => {
    const summary =
      node.id === "dish"
        ? { value: counts.dishSinglePortion, unit: "单人份" }
        : undefined;
    const metrics =
      node.id === "raw"
        ? [
            { label: "食材", value: counts.raw, unit: "种" },
            { label: "净料", value: counts.net, unit: "种" },
            { label: "小料", value: counts.minor, unit: "种" },
          ]
        : node.id === "seasoning"
          ? [
              { label: "调料", value: counts.seasoningBase, unit: "种" },
              { label: "单品调料", value: counts.seasoningItem, unit: "种" },
              { label: "复合调料", value: counts.seasoningCompound, unit: "种" },
              { label: "成品酱料", value: counts.seasoningSauce, unit: "种" },
            ]
          : node.id === "spice"
            ? [
                { label: "东方香料", value: null, unit: "种" },
                { label: "西方香料", value: null, unit: "种" },
              ]
            : undefined;

    return (
      <FlowCard
        key={node.id}
        node={node}
        summary={summary}
        metrics={metrics}
        dimmed={hoverSet !== null && !hoverSet.has(node.id)}
        cardRef={(element) => {
          nodeRefs.current[node.id] = element;
        }}
        onMouseEnter={() => setHoverId(node.id)}
        onMouseLeave={() => setHoverId(null)}
        onOpen={() => {
          if (node.href) router.push(node.href);
        }}
      />
    );
  };

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          title="原料库"
          description="从采购食材到菜品配方的统一入口"
          actions={
            <SkeuButton
              variant="outline"
              onClick={() => setPricingOpen(true)}
            >
              <Calculator className="h-4 w-4" />
              计价规则
            </SkeuButton>
          }
        />
      }
    >
      <div className="skeu-scroll min-h-0 flex-1 overflow-auto">
        {/* 保留原有三节点流向菜品库结构，只提升卡片语言与页面留白 */}
        <div className="mt-10 overflow-x-auto px-1 pb-10 pt-6">
          <div
            ref={boardRef}
            className="relative mx-auto grid w-full min-w-[1280px] max-w-[1440px] grid-cols-[1fr_180px_1fr] gap-x-6"
          >
            <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible">
              <defs>
                {FLOWS.map((flow, index) => (
                  <marker
                    key={`${flow.from}-${flow.to}`}
                    id={`mh-${index}`}
                    viewBox="0 0 10 10"
                    refX="8.5"
                    refY="5"
                    markerWidth="6.5"
                    markerHeight="6.5"
                    orient="auto"
                  >
                    <path d="M0,0 L10,5 L0,10 z" fill={flow.color} />
                  </marker>
                ))}
              </defs>
              {FLOWS.map((flow, index) => {
                const path = paths[`${flow.from}-${flow.to}`];
                if (!path) return null;
                const active = isFlowActive(index);
                const faded = hoverId !== null && !active;
                return (
                  <g key={`${flow.from}-${flow.to}`} opacity={faded ? "0.12" : "1"}>
                    <path
                      d={path}
                      fill="none"
                      stroke={flow.color}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      opacity={active ? "1" : "0.55"}
                      markerEnd={`url(#mh-${index})`}
                    />
                    <circle
                      r="2.6"
                      fill={flow.color}
                      opacity={active || hoverId === null ? "1" : "0.1"}
                    >
                      <animateMotion
                        dur={`${2 + index * 0.35}s`}
                        repeatCount="indefinite"
                        path={path}
                        begin={`${index * 0.5}s`}
                      />
                    </circle>
                  </g>
                );
              })}
            </svg>

            <div className="relative z-[2] flex flex-col justify-center gap-20">
              {SOURCE_NODES.map(renderFlowCard)}
            </div>
            <div />
            <div className="relative z-[2] flex flex-col justify-center">
              {renderFlowCard(DISH_NODE)}
            </div>
          </div>
        </div>
      </div>

      <PricingRulesDialog
        open={pricingOpen}
        onOpenChange={setPricingOpen}
      />
    </PageShell>
  );
}
