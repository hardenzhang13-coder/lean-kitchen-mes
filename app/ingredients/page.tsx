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

// 五类食材节点（颜色 = 全站统一的食材类型色）
const NODES = [
  { id: "raw", name: "食材", glyph: "原", color: "#f97316", desc: "采购入库、库存管理的基本单位", href: "/ingredients/raw" },
  { id: "seasoning", name: "调料", glyph: "调", color: "#3b82f6", desc: "标准化产品形态的基础调味品", href: "/ingredients/seasoning" },
  { id: "net", name: "净料", glyph: "净", color: "#10b981", desc: "原料初加工后的规格化半成品", href: "/ingredients/net" },
  { id: "minor", name: "小料", glyph: "料", color: "#f43f5e", desc: "增香提味、按标准规格封装", href: "/ingredients/minor" },
  { id: "sauce", name: "酱料", glyph: "酱", color: "#8b5cf6", desc: "复合调味半成品，决定菜品味型", href: "/ingredients/sauce" },
] as const;

type NodeId = (typeof NODES)[number]["id"];

// 转化流：颜色跟随来源节点；箭头表达「谁转化成谁」
const FLOWS: Array<{ from: NodeId; to: NodeId; color: string }> = [
  { from: "raw", to: "net", color: "#f97316" },
  { from: "raw", to: "minor", color: "#fb923c" },
  { from: "minor", to: "sauce", color: "#f43f5e" },
  { from: "seasoning", to: "sauce", color: "#3b82f6" },
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

type Counts = Record<NodeId, number>;

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
              原料 · 调料
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
  const [counts, setCounts] = useState<Counts>({ raw: 0, net: 0, minor: 0, seasoning: 0, sauce: 0 });
  const [hoverId, setHoverId] = useState<NodeId | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [paths, setPaths] = useState<Record<string, string>>({});
  const boardRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Partial<Record<NodeId, HTMLDivElement | null>>>({});

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

  const nodeCard = (n: (typeof NODES)[number]) => {
    const dimmed = hoverSet !== null && !hoverSet.has(n.id);
    return (
      <div
        key={n.id}
        ref={(el) => {
          nodeRefs.current[n.id] = el;
        }}
        onMouseEnter={() => setHoverId(n.id)}
        onMouseLeave={() => setHoverId(null)}
        onClick={() => router.push(n.href)}
        className={`relative cursor-pointer rounded-2xl border-[1.5px] bg-white p-5 transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_12px_32px_rgba(15,23,42,0.10)] ${
          n.id === "sauce" ? "border-[#ddd6fe] bg-gradient-to-b from-white from-60% to-[#faf8ff]" : "border-[#e2e8f0]"
        } ${dimmed ? "scale-[0.985] opacity-[0.18]" : ""}`}
      >
        <span className="absolute right-4 top-4 text-xs font-semibold text-[#a78bfa] opacity-0 transition-opacity hover:opacity-100">
          进入清单 →
        </span>
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
          <div className="ml-auto shrink-0 pl-2.5 text-right">
            <b className="text-[26px] font-extrabold leading-none" style={{ color: n.color }}>
              {counts[n.id]}
            </b>
            <span className="ml-0.5 text-xs text-slate-500">种</span>
          </div>
        </div>
        {n.id === "sauce" && (
          <div className="mt-3.5 flex gap-2">
            <div className="flex-1 rounded-[10px] border border-[#e9e2ff] bg-[#f3efff] p-2 px-[11px] text-xs leading-normal text-[#6d28d9]">
              <b className="mb-px block text-xs">自制</b>由调料与小料配比而成
            </div>
            <div className="flex-1 rounded-[10px] border border-[#e9e2ff] bg-[#f3efff] p-2 px-[11px] text-xs leading-normal text-[#6d28d9]">
              <b className="mb-px block text-xs">外购</b>成品酱料直接采购
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          title="原料库"
          description="原料与调料经初加工、配比组合，转化为净料、小料与酱料"
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
      {/* 主体：五个食材清单与转化流 */}
      {/* pt-4 是给卡片 hover 上浮预留的空间：滚动容器会裁切越界内容，
          没有这段内边距，卡片上浮时顶部边框会被切掉 */}
      <div className="mt-20 overflow-x-auto pt-4">
        <div
          ref={boardRef}
          className="relative mx-auto grid min-w-[1180px] max-w-[1240px] grid-cols-[1fr_110px_1fr_110px_1fr]"
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

          <div className="relative z-[2] flex flex-col justify-center gap-24">
            {nodeCard(NODES[0])}
            {nodeCard(NODES[1])}
          </div>
          <div />
          <div className="relative z-[2] flex flex-col justify-center gap-24">
            {nodeCard(NODES[2])}
            {nodeCard(NODES[3])}
          </div>
          <div />
          <div className="relative z-[2] flex flex-col justify-center">
            {nodeCard(NODES[4])}
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

