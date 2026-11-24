"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator } from "lucide-react";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { PageShell } from "@/app/components/ui/page-shell";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { PageHeader } from "@/app/components/ui/page-header";

// 三类食材节点（颜色 = 全站统一的食材类型色），统一流向菜品库
// 2026-11-24：净料/小料节点撤下首页（清单页保留）；新增「香料」占位节点，与食材、调味品同级；
// 「酱料」节点维持隐藏（模型/API/菜品 BOM 保留）
const NODES = [
  { id: "raw", name: "食材", glyph: "原", color: "#f97316", desc: "采购入库、库存管理的基本单位", href: "/ingredients/raw" },
  { id: "seasoning", name: "调味品", glyph: "调", color: "#3b82f6", desc: "按单品/复合/成品酱料归类，可转化调料清单", href: "/ingredients/seasoning" },
  { id: "spice", name: "香料", glyph: "香", color: "#f59e0b", desc: "占位模块：与食材、调味品同级，后续接入", href: null },
] as const;

type NodeId = (typeof NODES)[number]["id"];

// 流向终点：三类食材统一汇入菜品配方
const DISH_TARGET = {
  id: "dish",
  name: "菜品库",
  glyph: "菜",
  color: "#8b5cf6",
  desc: "三类食材统一流向菜品配方",
  href: "/dishes",
} as const;

type BoardId = NodeId | (typeof DISH_TARGET)["id"];

// 流向：三类食材 → 菜品库；颜色跟随来源节点
const FLOWS: Array<{ from: NodeId; to: BoardId; color: string }> = [
  { from: "raw", to: "dish", color: "#f97316" },
  { from: "seasoning", to: "dish", color: "#3b82f6" },
  { from: "spice", to: "dish", color: "#f59e0b" },
];

// 血缘：上游/下游（悬停高亮用）
const REL: Record<string, { up: string[]; down: string[] }> = {};
FLOWS.forEach((f) => {
  (REL[f.from] = REL[f.from] || { up: [], down: [] }).down.push(f.to);
  (REL[f.to] = REL[f.to] || { up: [], down: [] }).up.push(f.from);
});
function lineage(id: string): Set<string> {
  const set = new Set<string>([id]);
  const walk = (x: string, dir: "up" | "down") =>
    (REL[x]?.[dir] || []).forEach((n) => {
      if (!set.has(n)) {
        set.add(n);
        walk(n, dir);
      }
    });
  walk(id, "up");
  walk(id, "down");
  return set;
}

type Counts = Record<Extract<BoardId, "raw" | "seasoning">, number>;

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
              原料 · 调味品
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
                （单价 = 原料每斤单价 ÷ 出成率）
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span
              className="shrink-0 rounded-md px-2 py-1 font-semibold text-white"
              style={{ background: "#8b5cf6" }}
            >
              自制酱料
            </span>
            <span className="text-muted-foreground">
              成本价 = 配方成本小计合计 ÷ 用量合计 × 500 ＋ 加工费
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span
              className="shrink-0 rounded-md px-2 py-1 font-semibold text-white"
              style={{ background: "#a78bfa" }}
            >
              外购酱料
            </span>
            <span className="text-muted-foreground">
              成本价 = 每斤单价（元/斤）
              <span className="ml-1 text-muted-foreground/70">
                （零售参考价按采购规格换算）
              </span>
            </span>
          </div>
        </div>
      </AppDialogContent>
    </Dialog>
  );
}

export default function IngredientsPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<Counts>({ raw: 0, seasoning: 0 });
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // React 官方推荐的数据获取模式：setState 均发生在 await 之后的异步回调中，
    // 不构成同步级联渲染
    fetchCounts();
    const refresh = () => fetchCounts();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [fetchCounts]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 转化流连线（节点渲染完成后取坐标，窗口变化重算）
  useEffect(() => {
    const compute = () => {
      const board = boardRef.current;
      if (!board) return;
      const b = board.getBoundingClientRect();
      const out: Record<string, string> = {};
      FLOWS.forEach((f) => {
        const a = nodeRefs.current[f.from];
        const t = nodeRefs.current[f.to];
        if (!a || !t) return;
        const ra = a.getBoundingClientRect();
        const rt = t.getBoundingClientRect();
        const x1 = ra.right - b.left + 2;
        const y1 = ra.top - b.top + ra.height / 2;
        const x2 = rt.left - b.left - 6;
        const y2 = rt.top - b.top + rt.height / 2;
        const dx = Math.max(46, (x2 - x1) * 0.5);
        out[`${f.from}-${f.to}`] =
          `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      });
      setPaths(out);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const hoverSet = hoverId ? lineage(hoverId) : null;
  const isFlowActive = (i: number) =>
    hoverId !== null && (FLOWS[i].from === hoverId || FLOWS[i].to === hoverId);

  const nodeCard = (n: {
    id: BoardId;
    name: string;
    glyph: string;
    color: string;
    desc: string;
    href: string | null;
  }) => {
    const dimmed = hoverSet !== null && !hoverSet.has(n.id);
    const clickable = n.href !== null;
    const count =
      n.id === "raw" || n.id === "seasoning" ? counts[n.id] : null;
    return (
      <div
        key={n.id}
        ref={(el) => {
          nodeRefs.current[n.id] = el;
        }}
        onMouseEnter={() => setHoverId(n.id)}
        onMouseLeave={() => setHoverId(null)}
        onClick={clickable ? () => router.push(n.href as string) : undefined}
        className={`relative rounded-2xl border-[1.5px] bg-white p-5 transition-all duration-200 border-[#e2e8f0] ${
          clickable
            ? "cursor-pointer hover:-translate-y-[3px] hover:shadow-[0_12px_32px_rgba(15,23,42,0.10)]"
            : "cursor-default"
        } ${dimmed ? "scale-[0.985] opacity-[0.18]" : ""}`}
      >
        {clickable ? (
          <span className="absolute right-4 top-4 text-xs font-semibold text-[#a78bfa] opacity-0 transition-opacity hover:opacity-100">
            进入清单 →
          </span>
        ) : (
          <span className="absolute right-4 top-4 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            占位
          </span>
        )}
        <div className="flex items-center gap-3.5">
          <span
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[15px] text-[22px] font-extrabold text-white shadow-[0_4px_12px_rgba(15,23,42,0.12)]"
            style={{ background: n.color }}
          >
            {n.glyph}
          </span>
          <div className="min-w-0">
            <div className="text-[17px] font-extrabold">{n.name}</div>
            <div className="mt-0.5 text-xs leading-normal text-slate-500">{n.desc}</div>
          </div>
          {count !== null && (
            <div className="ml-auto shrink-0 pl-2.5 text-right">
              <b className="text-[26px] font-extrabold leading-none" style={{ color: n.color }}>
                {count}
              </b>
              <span className="ml-0.5 text-xs text-slate-500">种</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          title="食材库"
          description="食材、调味品、香料，统一流向菜品库"
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
      <div className="min-h-0 flex-1 overflow-auto">
      {/* 主体：三类食材节点与流向菜品库（香料为占位节点；酱料节点已隐入口，模型/API/菜品 BOM 保留） */}
      {/* pt-4 是给卡片 hover 上浮预留的空间：滚动容器会裁切越界内容，
          没有这段内边距，卡片上浮时顶部边框会被切掉 */}
      <div className="mt-20 overflow-x-auto pt-4">
        <div
          ref={boardRef}
          className="relative mx-auto grid min-w-[1180px] max-w-[1240px] grid-cols-[1fr_110px_1fr]"
        >
          <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible">
            <defs>
              {FLOWS.map((f, i) => (
                <marker
                  key={i}
                  id={`mh-${i}`}
                  viewBox="0 0 10 10"
                  refX="8.5"
                  refY="5"
                  markerWidth="6.5"
                  markerHeight="6.5"
                  orient="auto"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill={f.color} />
                </marker>
              ))}
            </defs>
            {FLOWS.map((f, i) => {
              const d = paths[`${f.from}-${f.to}`];
              if (!d) return null;
              const active = isFlowActive(i);
              const faded = hoverId !== null && !active;
              return (
                <g key={i} opacity={faded ? "0.12" : "1"}>
                  <path
                    d={d}
                    fill="none"
                    stroke={f.color}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity={active ? "1" : "0.55"}
                    markerEnd={`url(#mh-${i})`}
                  />
                  <circle r="2.6" fill={f.color} opacity={active || hoverId === null ? "1" : "0.1"}>
                    <animateMotion
                      dur={`${2 + i * 0.35}s`}
                      repeatCount="indefinite"
                      path={d}
                      begin={`${i * 0.5}s`}
                    />
                  </circle>
                </g>
              );
            })}
          </svg>

          <div className="relative z-[2] flex flex-col justify-center gap-16">
            {NODES.map((n) => nodeCard(n))}
          </div>
          <div />
          <div className="relative z-[2] flex flex-col justify-center">
            {nodeCard(DISH_TARGET)}
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

