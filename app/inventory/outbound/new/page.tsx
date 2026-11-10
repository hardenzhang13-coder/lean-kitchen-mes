"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, CalendarDays, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/app/components/ui/page-header";
import { toast } from "sonner";
import { formatPortionsCount, calcLineAmount, type PlanCuttingConfirmStatus } from "@/lib/shared/prepped-stock";
import { formatWeight } from "@/lib/shared/weight-format";

interface StoreItem { id: number; name: string; code: string }
interface ScheduleItem {
  id: number; code: string | null; title: string; scheduleDate: string; status: string;
}
interface QuoteLine {
  key: string; sourceType: string; sourceId: number;
  itemCode: string | null; itemName: string;
  l1Name: string | null; l2Name: string | null;
  packageSpec: number; requiredPortions: number; requiredQty: number;
  availablePortions: number; pricePerJin: number | null;
  prepStatus: "normal" | "insufficient" | "unfinished";
  suggestedPortions: number;
}

type ListResp<T> = T[] | { data: T[] };

function unwrapList<T>(json: ListResp<T>): T[] {
  return Array.isArray(json) ? json : json.data ?? [];
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "请求失败");
  const json = await res.json();
  return (json.data ?? json) as T;
}

function prepBadge(st: PlanCuttingConfirmStatus | string) {
  if (st === "unfinished") return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">未切配</span>;
  if (st === "insufficient") return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-600">量不足</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">正常</span>;
}

export default function NewOutboundPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [shipMap, setShipMap] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJson<ListResp<StoreItem>>("/api/stores?activeOnly=1&pageSize=100")
      .then((json) => setStores(unwrapList(json)))
      .catch(() => toast.error("加载门店失败"));
  }, []);

  const pickStore = useCallback(async (id: number) => {
    setStoreId(id);
    setScheduleId(null);
    setStep(2);
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        fetchJson<ListResp<ScheduleItem>>("/api/schedules?status=进行中&pageSize=50&storeId=" + id),
        fetchJson<ListResp<ScheduleItem>>("/api/schedules?status=已完成&pageSize=50&storeId=" + id),
      ]);
      setSchedules([...unwrapList(a), ...unwrapList(b)]);
    } catch {
      toast.error("加载排程失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const pickSchedule = useCallback(async (id: number) => {
    setScheduleId(id);
    setStep(3);
    setLoading(true);
    try {
      const quote = await fetchJson<{ lines: QuoteLine[] }>("/api/outbound-orders?scheduleId=" + id);
      setLines(quote.lines);
      const map: Record<string, number> = {};
      quote.lines.forEach((l) => { map[l.key] = l.suggestedPortions; });
      setShipMap(map);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加载出库明细失败");
      setStep(2);
    } finally {
      setLoading(false);
    }
  }, []);

  const summary = useMemo(() => {
    let planP = 0, shipP = 0, amount = 0, unfinished = 0;
    for (const l of lines) {
      const shipped = shipMap[l.key] ?? 0;
      planP += l.requiredPortions;
      shipP += shipped;
      if (l.pricePerJin != null) amount += calcLineAmount(l.pricePerJin, Math.round(shipped * l.packageSpec * 10) / 10);
      if (l.prepStatus === "unfinished") unfinished++;
    }
    return { planP: Math.round(planP * 100) / 100, shipP: Math.round(shipP * 100) / 100, amount: Math.round(amount * 100) / 100, unfinished };
  }, [lines, shipMap]);

  const submit = async () => {
    if (!scheduleId) return;
    for (const l of lines) {
      const shipped = shipMap[l.key] ?? 0;
      if (shipped < 0 || shipped > l.availablePortions) {
        toast.error(`${l.itemName} 出库份数需在 0 ~ ${l.availablePortions} 之间`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/outbound-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          items: lines.map((l) => ({
            sourceType: l.sourceType,
            sourceId: l.sourceId,
            shippedPortions: shipMap[l.key] ?? 0,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "创建失败");
        return;
      }
      toast.success(`出库单 ${json.data.code} 已创建，库存已扣减`);
      router.push("/inventory/outbound/" + json.data.id);
    } catch {
      toast.error("创建出错");
    } finally {
      setSubmitting(false);
    }
  };

  const store = stores.find((s) => s.id === storeId);
  const schedule = schedules.find((s) => s.id === scheduleId);

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" aria-label="返回" onClick={() => router.push("/inventory")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title="创建出库单"
          description="按排程的切配工单生成，按份出库，金额按净菜档案出库价自动核算"
        />
      </div>

      <div className="flex items-center gap-3 text-sm">
        {([
          { n: 1, label: "选择门店" },
          { n: 2, label: "选择排程计划" },
          { n: 3, label: "确认出库明细" },
        ] as const).map((s, i) => (
          <div key={s.n} className="flex items-center gap-3">
            <div className={"flex items-center gap-1.5 " + (step === s.n ? "text-primary font-medium" : step > s.n ? "text-green-600" : "text-muted-foreground")}>
              <span className={"w-5 h-5 rounded-full inline-flex items-center justify-center text-xs " + (step === s.n ? "bg-primary text-white" : step > s.n ? "bg-green-50" : "bg-muted")}>
                {step > s.n ? <Check className="h-3 w-3" /> : s.n}
              </span>
              {s.label}
            </div>
            {i < 2 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => pickStore(s.id)}
              className={"rounded-lg border p-4 text-left transition-colors hover:border-primary " + (storeId === s.id ? "border-primary bg-primary/5" : "border-border")}
            >
              <div className="font-medium flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{s.name}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.code}</div>
            </button>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {loading ? (
            <div className="h-[200px] bg-muted rounded animate-pulse" />
          ) : schedules.length === 0 ? (
            <p className="text-muted-foreground">该门店暂无可出库的排程</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {schedules.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickSchedule(s.id)}
                  className={"rounded-lg border p-4 text-left transition-colors hover:border-primary " + (scheduleId === s.id ? "border-primary bg-primary/5" : "border-border")}
                >
                  <div className="font-medium flex items-center justify-between">
                    <span className="truncate">{s.code ?? "排程 #" + s.id}</span>
                    <span className={"text-xs px-2 py-0.5 rounded-full " + (s.status === "进行中" ? "bg-primary/10 text-primary" : "bg-green-50 text-green-600")}>{s.status}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1.5 space-y-0.5">
                    <div className="truncate">{s.title}</div>
                    <div className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(s.scheduleDate).toLocaleDateString("zh-CN")}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" onClick={() => setStep(1)}>上一步</Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm flex flex-wrap gap-x-6 gap-y-1">
            <span><b>{schedule?.title}</b></span>
            <span className="font-mono text-muted-foreground">{schedule?.code}</span>
            <span>📍 {store?.name}</span>
            <span>📅 {schedule && new Date(schedule.scheduleDate).toLocaleDateString("zh-CN")}</span>
            <span className="text-muted-foreground">按当前实际库存计算可出量 · 未切配的货标红、默认不出</span>
          </div>

          {loading ? (
            <div className="h-[300px] bg-muted rounded animate-pulse" />
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>一级分类</TableHead>
                    <TableHead>二级分类</TableHead>
                    <TableHead>序号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>封装规格</TableHead>
                    <TableHead className="text-right">计划份数</TableHead>
                    <TableHead className="text-right">计划量</TableHead>
                    <TableHead className="text-right">库存份数</TableHead>
                    <TableHead className="text-right">本次出库</TableHead>
                    <TableHead className="text-right">行金额</TableHead>
                    <TableHead>状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => {
                    const shipped = shipMap[l.key] ?? 0;
                    const invalid = shipped < 0 || shipped > l.availablePortions;
                    const amount = l.pricePerJin != null ? calcLineAmount(l.pricePerJin, Math.round(shipped * l.packageSpec * 10) / 10) : null;
                    return (
                      <TableRow key={l.key} className={"transition-colors hover:bg-muted/40 " + (l.prepStatus === "unfinished" ? "bg-red-50 hover:bg-red-100/60" : l.prepStatus === "insufficient" ? "bg-amber-50 hover:bg-amber-100/60" : "")}>
                        <TableCell className="font-medium bg-muted/30">{l.l1Name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{l.l2Name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{String(i + 1).padStart(2, "0")}</TableCell>
                        <TableCell className="font-medium">{l.itemName}<span className="block font-mono text-[11px] text-muted-foreground">{l.itemCode}</span></TableCell>
                        <TableCell className="text-muted-foreground">{l.packageSpec} g/份</TableCell>
                        <TableCell className="text-right font-medium">{formatPortionsCount(l.requiredPortions)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatWeight(l.requiredQty)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatPortionsCount(l.availablePortions)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            className={"w-20 text-right inline-block " + (invalid ? "border-red-500" : "")}
                            value={String(shipped)}
                            onChange={(e) => setShipMap((m) => ({ ...m, [l.key]: e.target.value === "" ? 0 : Number(e.target.value) }))}
                          /> <span className="text-xs text-muted-foreground">份</span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{amount != null ? "¥" + amount.toFixed(2) : "价缺失"}</TableCell>
                        <TableCell>{prepBadge(l.prepStatus)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border bg-muted/40 p-4 text-sm">
            <span>共 <b>{lines.length}</b> 行</span>
            <span>计划 <b>{formatPortionsCount(summary.planP)}</b></span>
            <span>本次出库 <b className="text-primary">{formatPortionsCount(summary.shipP)}</b></span>
            <span>合计金额 <b className="text-primary">¥{summary.amount.toFixed(2)}</b></span>
            <span>未切配 <b className="text-red-600">{summary.unfinished}</b> 行</span>
            {summary.unfinished > 0 && (
              <span className="text-xs text-amber-600">⚠️ 未切配的净菜默认不出库，将在单据上标注，本单将标记为「未按计划出库」</span>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>上一步</Button>
            <Button onClick={submit} disabled={submitting || loading}>
              {submitting ? "提交中…" : "确认出库"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}