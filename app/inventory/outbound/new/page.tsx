"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Check,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/app/components/ui/page-header";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { toast } from "sonner";
import {
  calcLineAmount,
  formatPortionsCount,
} from "@/lib/shared/prepped-stock";
import { formatWeight } from "@/lib/shared/weight-format";

interface StoreItem {
  id: number;
  name: string;
  code: string;
}

interface ScheduleItem {
  id: number;
  code: string | null;
  title: string;
  scheduleDate: string;
  status: string;
}

interface QuoteLine {
  key: string;
  sourceType: string;
  sourceId: number;
  itemCode: string | null;
  itemName: string;
  l1Name: string | null;
  l2Name: string | null;
  packageSpec: number;
  requiredPortions: number;
  requiredQty: number;
  availablePortions: number;
  pricePerJin: number | null;
  prepStatus: "normal" | "insufficient" | "unfinished";
  suggestedPortions: number;
}

interface PagedResponse<T> {
  data?: T[];
  pagination?: { totalPages?: number };
}

function parseShipped(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function fetchAllPages<T>(baseUrl: string): Promise<T[]> {
  const rows: T[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const res = await fetch(`${baseUrl}${separator}page=${page}&pageSize=100`);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "请求失败");
    }
    const json = (await res.json()) as PagedResponse<T>;
    rows.push(...(json.data ?? []));
    totalPages = json.pagination?.totalPages ?? 1;
    page += 1;
  } while (page <= totalPages);

  return rows;
}

function prepBadge(status: QuoteLine["prepStatus"]) {
  if (status === "unfinished") {
    return <StatusBadge status="未切配" variant="danger" />;
  }
  if (status === "insufficient") {
    return <StatusBadge status="量不足" variant="warning" />;
  }
  return <StatusBadge status="正常" variant="success" />;
}

function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center"
      role="alert"
    >
      <AlertCircle className="mb-3 h-6 w-6 text-destructive" />
      <p className="font-medium">数据加载失败</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        重试
      </Button>
    </div>
  );
}

export default function NewOutboundPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [shipMap, setShipMap] = useState<Record<string, string>>({});
  const [storeSearch, setStoreSearch] = useState("");
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [storesLoading, setStoresLoading] = useState(true);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const scheduleRequestRef = useRef(0);
  const quoteRequestRef = useRef(0);

  const loadStores = useCallback(async () => {
    setStoresLoading(true);
    setStoresError(null);
    try {
      const rows = await fetchAllPages<StoreItem>("/api/stores?activeOnly=1");
      setStores(rows);
    } catch (e) {
      setStores([]);
      setStoresError(e instanceof Error ? e.message : "加载门店失败");
    } finally {
      setStoresLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStores();
  }, [loadStores]);

  const loadSchedules = useCallback(async (id: number) => {
    const requestId = scheduleRequestRef.current + 1;
    scheduleRequestRef.current = requestId;
    setSchedulesLoading(true);
    setSchedulesError(null);
    try {
      const [active, completed] = await Promise.all([
        fetchAllPages<ScheduleItem>(
          `/api/schedules?status=${encodeURIComponent("进行中")}&storeId=${id}`
        ),
        fetchAllPages<ScheduleItem>(
          `/api/schedules?status=${encodeURIComponent("已完成")}&storeId=${id}`
        ),
      ]);
      if (scheduleRequestRef.current !== requestId) return;
      const unique = new Map([...active, ...completed].map((item) => [item.id, item]));
      setSchedules(
        [...unique.values()].sort(
          (a, b) => new Date(b.scheduleDate).getTime() - new Date(a.scheduleDate).getTime()
        )
      );
    } catch (e) {
      if (scheduleRequestRef.current !== requestId) return;
      setSchedules([]);
      setSchedulesError(e instanceof Error ? e.message : "加载排程单失败");
    } finally {
      if (scheduleRequestRef.current === requestId) setSchedulesLoading(false);
    }
  }, []);

  const pickStore = async (id: number) => {
    setStoreId(id);
    setScheduleId(null);
    setSchedules([]);
    setLines([]);
    setShipMap({});
    setScheduleSearch("");
    setStep(2);
    await loadSchedules(id);
  };

  const loadQuote = useCallback(async (id: number) => {
    const requestId = quoteRequestRef.current + 1;
    quoteRequestRef.current = requestId;
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const res = await fetch("/api/outbound-orders?scheduleId=" + id);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "加载出库明细失败");
      if (quoteRequestRef.current !== requestId) return;
      const quoteLines = (json.data?.lines ?? []) as QuoteLine[];
      setLines(quoteLines);
      setShipMap(
        Object.fromEntries(
          quoteLines.map((line) => [line.key, String(line.suggestedPortions)])
        )
      );
    } catch (e) {
      if (quoteRequestRef.current !== requestId) return;
      setLines([]);
      setShipMap({});
      setQuoteError(e instanceof Error ? e.message : "加载出库明细失败");
    } finally {
      if (quoteRequestRef.current === requestId) setQuoteLoading(false);
    }
  }, []);

  const pickSchedule = async (id: number) => {
    setScheduleId(id);
    setStep(3);
    setLines([]);
    setShipMap({});
    await loadQuote(id);
  };

  const filteredStores = useMemo(() => {
    const keyword = storeSearch.trim().toLowerCase();
    if (!keyword) return stores;
    return stores.filter(
      (store) =>
        store.name.toLowerCase().includes(keyword) ||
        store.code.toLowerCase().includes(keyword)
    );
  }, [storeSearch, stores]);

  const filteredSchedules = useMemo(() => {
    const keyword = scheduleSearch.trim().toLowerCase();
    if (!keyword) return schedules;
    return schedules.filter(
      (schedule) =>
        schedule.title.toLowerCase().includes(keyword) ||
        (schedule.code ?? "").toLowerCase().includes(keyword) ||
        new Date(schedule.scheduleDate).toLocaleDateString("zh-CN").includes(keyword)
    );
  }, [scheduleSearch, schedules]);

  const getLineError = useCallback((line: QuoteLine): string | null => {
    const shipped = parseShipped(shipMap[line.key] ?? "");
    if (shipped === null) return "请输入有效出库数";
    if (shipped < 0) return "出库数不能为负数";
    if (shipped > line.availablePortions) {
      return `最多可出 ${formatPortionsCount(line.availablePortions)}`;
    }
    return null;
  }, [shipMap]);

  const invalidLines = useMemo(
    () => lines.filter((line) => getLineError(line) !== null),
    [getLineError, lines]
  );

  const summary = useMemo(() => {
    let planP = 0;
    let shipP = 0;
    let amount = 0;
    let unfinished = 0;
    for (const line of lines) {
      const shipped = parseShipped(shipMap[line.key] ?? "") ?? 0;
      planP += line.requiredPortions;
      shipP += shipped;
      if (line.pricePerJin != null) {
        amount += calcLineAmount(
          line.pricePerJin,
          Math.round(shipped * line.packageSpec * 10) / 10
        );
      }
      if (line.prepStatus === "unfinished") unfinished += 1;
    }
    return {
      planP: Math.round(planP * 100) / 100,
      shipP: Math.round(shipP * 100) / 100,
      amount: Math.round(amount * 100) / 100,
      unfinished,
    };
  }, [lines, shipMap]);

  const submit = async () => {
    if (!scheduleId || lines.length === 0) return;

    const firstInvalid = lines.find((line) => getLineError(line) !== null);
    if (firstInvalid) {
      inputRefs.current[firstInvalid.key]?.focus();
      toast.error(getLineError(firstInvalid) || "请检查出库数");
      return;
    }
    if (summary.shipP <= 0) {
      toast.error("本次出库总数必须大于 0");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/outbound-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          items: lines.map((line) => ({
            sourceType: line.sourceType,
            sourceId: line.sourceId,
            shippedPortions: parseShipped(shipMap[line.key] ?? "") ?? 0,
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
      toast.error("创建出错，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const store = stores.find((item) => item.id === storeId);
  const schedule = schedules.find((item) => item.id === scheduleId);
  const canSubmit =
    !submitting &&
    !quoteLoading &&
    invalidLines.length === 0 &&
    summary.shipP > 0;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="返回出库单列表"
          onClick={() => router.push("/inventory?tab=outbound")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title="创建出库单"
          description="按排程的切配工单生成，按份出库，金额按净菜档案出库价自动核算"
        />
      </div>

      <div className="flex items-center gap-3 text-sm" aria-label="创建出库单步骤">
        {([
          { number: 1, label: "选择门店" },
          { number: 2, label: "选择排程单" },
          { number: 3, label: "确认出库明细" },
        ] as const).map((item) => (
          <div key={item.number} className="flex items-center gap-3">
            <div
              className={
                "flex items-center gap-1.5 " +
                (step === item.number
                  ? "font-medium text-primary"
                  : step > item.number
                    ? "text-success"
                    : "text-muted-foreground")
              }
              aria-current={step === item.number ? "step" : undefined}
            >
              <span
                className={
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs " +
                  (step === item.number
                    ? "bg-primary text-primary-foreground"
                    : step > item.number
                      ? "bg-success-muted text-success"
                      : "bg-muted")
                }
              >
                {step > item.number ? <Check className="h-3.5 w-3.5" /> : item.number}
              </span>
              {item.label}
            </div>
            {item.number < 3 && <div className="h-px w-8 bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-9 pl-8"
              placeholder="搜索门店名称或编号"
              aria-label="搜索门店"
              value={storeSearch}
              onChange={(event) => setStoreSearch(event.target.value)}
            />
          </div>

          {storesLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="正在加载门店">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-24 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : storesError ? (
            <InlineError message={storesError} onRetry={loadStores} />
          ) : filteredStores.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="font-medium">{stores.length === 0 ? "暂无可用门店" : "未找到匹配门店"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {stores.length === 0 ? "请先在设置中新增并启用门店" : "请调整搜索关键词"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {filteredStores.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void pickStore(item.id)}
                  aria-pressed={storeId === item.id}
                  className={
                    "min-h-24 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-muted/40 " +
                    (storeId === item.id ? "border-primary bg-primary/5" : "border-border")
                  }
                >
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {item.name}
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">{item.code}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <div>
              <div className="text-xs text-muted-foreground">当前门店</div>
              <div className="font-medium">{store?.name ?? "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 w-[260px] pl-8"
                  placeholder="搜索排程标题、编号或日期"
                  aria-label="搜索排程单"
                  value={scheduleSearch}
                  onChange={(event) => setScheduleSearch(event.target.value)}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                更换门店
              </Button>
            </div>
          </div>

          {schedulesLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="正在加载排程单">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-28 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : schedulesError ? (
            <InlineError
              message={schedulesError}
              onRetry={() => storeId && void loadSchedules(storeId)}
            />
          ) : filteredSchedules.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="font-medium">
                {schedules.length === 0 ? "该门店暂无可出库排程" : "未找到匹配排程"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {schedules.length === 0
                  ? "仅展示进行中或已完成的排程单"
                  : "请调整搜索关键词"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {filteredSchedules.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void pickSchedule(item.id)}
                  aria-pressed={scheduleId === item.id}
                  className={
                    "min-h-28 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-muted/40 " +
                    (scheduleId === item.id ? "border-primary bg-primary/5" : "border-border")
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate font-medium" title={item.title}>
                      {item.title}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {item.code ?? "排程 #" + item.id}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(item.scheduleDate).toLocaleDateString("zh-CN")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <b>{store?.name ?? "—"}</b>
            </span>
            <span className="min-w-0 truncate">
              排程单：<b>{schedule?.title ?? "—"}</b>
            </span>
            {schedule && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {new Date(schedule.scheduleDate).toLocaleDateString("zh-CN")}
              </span>
            )}
            <span className="text-muted-foreground">
              按当前实际库存计算可出量，未切配的净菜默认不出库
            </span>
          </div>

          {quoteLoading ? (
            <div className="space-y-2" aria-label="正在加载出库明细">
              <div className="h-10 rounded-lg bg-muted animate-pulse" />
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : quoteError ? (
            <InlineError
              message={quoteError}
              onRetry={() => scheduleId && void loadQuote(scheduleId)}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>一级分类</TableHead>
                    <TableHead>二级分类</TableHead>
                    <TableHead>序号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>封装规格</TableHead>
                    <TableHead className="text-right">计划出库数（份）</TableHead>
                    <TableHead className="text-right">计划量</TableHead>
                    <TableHead className="text-right">库存份数</TableHead>
                    <TableHead className="text-right">本次出库数（份）</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead>备货状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => {
                    const shipped = parseShipped(shipMap[line.key] ?? "") ?? 0;
                    const lineError = getLineError(line);
                    const amount =
                      line.pricePerJin != null
                        ? calcLineAmount(
                            line.pricePerJin,
                            Math.round(shipped * line.packageSpec * 10) / 10
                          )
                        : null;
                    return (
                      <TableRow
                        key={line.key}
                        className={
                          line.prepStatus === "unfinished"
                            ? "bg-danger-muted/40"
                            : line.prepStatus === "insufficient"
                              ? "bg-warning-muted/40"
                              : ""
                        }
                      >
                        <TableCell className="bg-muted/30 font-medium">
                          {line.l1Name ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {line.l2Name ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {String(index + 1).padStart(2, "0")}
                        </TableCell>
                        <TableCell className="font-medium">
                          {line.itemName}
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {line.itemCode}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {line.packageSpec} g/份
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatPortionsCount(line.requiredPortions)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatWeight(line.requiredQty)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatPortionsCount(line.availablePortions)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            ref={(node) => {
                              inputRefs.current[line.key] = node;
                            }}
                            type="number"
                            min={0}
                            max={line.availablePortions}
                            step={0.5}
                            inputMode="decimal"
                            aria-label={`${line.itemName} 本次出库数`}
                            aria-invalid={lineError !== null}
                            aria-describedby={
                              lineError ? `outbound-error-${line.key}` : undefined
                            }
                            className={
                              "inline-block h-9 w-24 text-right tabular-nums " +
                              (lineError ? "border-destructive" : "")
                            }
                            value={shipMap[line.key] ?? ""}
                            onChange={(event) =>
                              setShipMap((current) => ({
                                ...current,
                                [line.key]: event.target.value,
                              }))
                            }
                          />
                          {lineError && (
                            <span
                              id={`outbound-error-${line.key}`}
                              className="mt-1 block text-xs text-destructive"
                            >
                              {lineError}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {amount != null ? "¥" + amount.toFixed(2) : "价缺失"}
                        </TableCell>
                        <TableCell>{prepBadge(line.prepStatus)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!quoteLoading && !quoteError && (
            <div
              className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/30 p-4 text-sm"
              role="status"
            >
              <span>共 <b>{lines.length}</b> 行</span>
              <span>计划 <b>{formatPortionsCount(summary.planP)}</b></span>
              <span>本次出库 <b className="text-primary">{formatPortionsCount(summary.shipP)}</b></span>
              <span>合计金额 <b className="text-primary">¥{summary.amount.toFixed(2)}</b></span>
              <span>未切配 <b className="text-destructive">{summary.unfinished}</b> 行</span>
              {summary.shipP <= 0 && (
                <span className="text-sm text-destructive">本次出库总数必须大于 0</span>
              )}
              {summary.unfinished > 0 && (
                <span className="text-sm text-warning">
                  未切配的净菜默认不出库，本单将标记为未按计划出库
                </span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              上一步
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitting ? "提交中…" : "确认出库"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
