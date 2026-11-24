"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Loader2,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/app/components/ui/form-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/app/components/ui/page-header";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuSegmented } from "@/app/components/ui/skeu-segmented";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { FormField, FormSection } from "@/app/components/ui/form-field";
import { LoadingState } from "@/app/components/ui/loading-state";
import { toast } from "sonner";
import {
  calcPortionAmount,
  formatPortionsCount,
} from "@/lib/shared/prepped-stock";
import { formatWeight } from "@/lib/shared/weight-format";
import { formatMoney } from "@/lib/shared/display-format";

interface StoreItem {
  id: number;
  name: string;
  code: string;
}

interface SourceDoc {
  id: number;
  code: string | null;
  title: string;
  date: string;
  status: string;
  dishCount: number;
  totalQuantity: number;
}

interface BatchDoc {
  id: number;
  code: string | null;
  title: string;
  date: string;
  status: string;
  itemCount: number;
  totalPortions: number;
  totalQty: number;
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
  standardPackagePrice: number | null;
  prepStatus: "normal" | "insufficient" | "unfinished";
  suggestedPortions: number;
}

interface PagedResponse<T> {
  data?: T[];
  pagination?: { totalPages?: number };
}

type OutboundMode = "batch" | "schedule";

const OUTBOUND_MODES = [
  { value: "batch", label: "切配单" },
  { value: "schedule", label: "排程单" },
] as const;

function parseShipped(raw: string): number | null {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function toDatetimeInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function parseOutboundTime(raw: string): Date | null {
  if (!raw.trim()) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
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
      className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center"
      role="alert"
    >
      <AlertCircle className="mb-3 h-6 w-6 text-destructive" />
      <p className="font-medium">数据加载失败</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      <SkeuButton variant="outline" className="mt-4" onClick={onRetry}>
        <RefreshCw className="mr-2 h-4 w-4" />
        重试
      </SkeuButton>
    </div>
  );
}

interface NewOutboundPageProps {
  embedded?: boolean;
  onDone?: (id: number) => void;
  onCancel?: () => void;
}
export default function NewOutboundPage({
  embedded = false,
  onDone,
  onCancel,
}: NewOutboundPageProps = {}) {
  const router = useRouter();
  const [view, setView] = useState<"select" | "detail">("select");
  const [mode, setMode] = useState<OutboundMode>("batch");
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [sources, setSources] = useState<SourceDoc[]>([]);
  const [batches, setBatches] = useState<BatchDoc[]>([]);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [shipMap, setShipMap] = useState<Record<string, string>>({});
  const [outboundTime, setOutboundTime] = useState("");
  const [remark, setRemark] = useState("");
  const [storeSearch, setStoreSearch] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [batchSearch, setBatchSearch] = useState("");
  const [storesLoading, setStoresLoading] = useState(true);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const sourceRequestRef = useRef(0);
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

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    setBatchesError(null);
    try {
      const rows = await fetchAllPages<BatchDoc>(
        "/api/outbound-orders/production-batches"
      );
      setBatches(rows);
    } catch (e) {
      setBatches([]);
      setBatchesError(e instanceof Error ? e.message : "加载切配单失败");
    } finally {
      setBatchesLoading(false);
    }
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- 数据获取 effect：React 官方推荐模式；setState 均发生在 await 后的异步回调中。 */
  useEffect(() => {
    setOutboundTime(toDatetimeInputValue(new Date()));
    void loadStores();
    void loadBatches();
  }, [loadStores, loadBatches]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const loadSources = useCallback(async (id: number) => {
    const requestId = sourceRequestRef.current + 1;
    sourceRequestRef.current = requestId;
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      const rows = await fetchAllPages<SourceDoc>(
        `/api/schedules?status=${encodeURIComponent("进行中")}` +
          `&storeId=${id}&availableForOutbound=1`
      );
      if (sourceRequestRef.current !== requestId) return;
      setSources(
        rows.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      );
    } catch (e) {
      if (sourceRequestRef.current !== requestId) return;
      setSources([]);
      setSourcesError(e instanceof Error ? e.message : "加载排程单失败");
    } finally {
      if (sourceRequestRef.current === requestId) setSourcesLoading(false);
    }
  }, []);

  const resetSourceSelection = () => {
    quoteRequestRef.current += 1;
    setSourceId(null);
    setBatchId(null);
    setSources([]);
    setLines([]);
    setShipMap({});
    setSourceSearch("");
    setBatchSearch("");
    setQuoteError(null);
    setQuoteLoading(false);
  };

  const changeMode = (next: OutboundMode) => {
    setMode(next);
    resetSourceSelection();
    setView("select");
  };

  const pickStore = (id: number) => {
    setStoreId(id);
    resetSourceSelection();
    if (mode === "schedule") void loadSources(id);
  };

  const loadQuote = useCallback(
    async (nextMode: OutboundMode, source: number) => {
      const requestId = quoteRequestRef.current + 1;
      quoteRequestRef.current = requestId;
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        const query =
          nextMode === "schedule"
            ? `scheduleId=${source}`
            : `productionPlanId=${source}`;
        const res = await fetch(`/api/outbound-orders?${query}`);
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
    },
    []
  );

  const pickSchedule = (id: number) => {
    setSourceId(id);
    setBatchId(null);
    setLines([]);
    setShipMap({});
    void loadQuote("schedule", id);
  };

  const pickBatch = (id: number) => {
    setBatchId(id);
    setSourceId(null);
    setLines([]);
    setShipMap({});
    void loadQuote("batch", id);
  };

  const goToDetail = () => {
    if (storeId == null) return;
    if (mode === "schedule" && sourceId == null) return;
    if (mode === "batch" && batchId == null) return;
    if (quoteLoading) return;
    setView("detail");
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

  const filteredSources = useMemo(() => {
    const keyword = sourceSearch.trim().toLowerCase();
    if (!keyword) return sources;
    return sources.filter(
      (source) =>
        source.title.toLowerCase().includes(keyword) ||
        (source.code ?? "").toLowerCase().includes(keyword) ||
        new Date(source.date).toLocaleDateString("zh-CN").includes(keyword)
    );
  }, [sourceSearch, sources]);

  const filteredBatches = useMemo(() => {
    const keyword = batchSearch.trim().toLowerCase();
    if (!keyword) return batches;
    return batches.filter(
      (batch) =>
        batch.title.toLowerCase().includes(keyword) ||
        (batch.code ?? "").toLowerCase().includes(keyword) ||
        new Date(batch.date).toLocaleDateString("zh-CN").includes(keyword)
    );
  }, [batchSearch, batches]);

  const getOutboundTimeError = useCallback((): string | null => {
    const date = parseOutboundTime(outboundTime);
    if (!date) return "请选择有效出库时间";
    if (date.getTime() > Date.now()) return "出库时间不能晚于当前时间";
    return null;
  }, [outboundTime]);

  const getLineError = useCallback(
    (line: QuoteLine): string | null => {
      const shipped = parseShipped(shipMap[line.key] ?? "");
      if (shipped === null) return "请输入有效出库数";
      if (shipped < 0) return "出库数不能为负数";
      if (shipped > line.availablePortions) {
        return `最多可出 ${formatPortionsCount(line.availablePortions)}`;
      }
      return null;
    },
    [shipMap]
  );

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
      if (line.standardPackagePrice != null) {
        amount += calcPortionAmount(line.standardPackagePrice, shipped);
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
    if (storeId == null || lines.length === 0) return;
    if (mode === "schedule" && sourceId == null) return;
    if (mode === "batch" && batchId == null) return;

    const timeError = getOutboundTimeError();
    if (timeError) {
      toast.error(timeError);
      return;
    }
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
          storeId,
          ...(mode === "schedule"
            ? { scheduleId: sourceId }
            : { productionPlanId: batchId }),
          outboundAt: parseOutboundTime(outboundTime)?.toISOString(),
          remark: remark.trim() || undefined,
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
      if (onDone) {
        onDone(json.data.id);
        return;
      }
      router.push("/inventory/outbound/" + json.data.id);
    } catch {
      toast.error("创建出错，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  };

  const timeError = getOutboundTimeError();
  const selectedSourceId = mode === "batch" ? batchId : sourceId;
  const canProceed = storeId != null && selectedSourceId != null && !quoteLoading;
  const canSubmit =
    !submitting &&
    !quoteLoading &&
    storeId != null &&
    (mode === "batch" ? batchId != null : sourceId != null) &&
    timeError === null &&
    invalidLines.length === 0 &&
    summary.shipP > 0;

  const outboundTimeField = (
    <FormField
      id="outbound-time"
      label="出库时间"
      required
      error={timeError ?? undefined}
    >
      <Input
        type="datetime-local"
        max={toDatetimeInputValue(new Date())}
        value={outboundTime}
        onChange={(event) => setOutboundTime(event.target.value)}
        className="w-full"
        aria-label="出库时间"
      />
    </FormField>
  );

  const remarkField = (
    <FormField id="outbound-remark" label="备注">
      <Input
        maxLength={200}
        value={remark}
        onChange={(event) => setRemark(event.target.value)}
        className="w-full"
        aria-label="备注"
      />
    </FormField>
  );
  const storeList = (
    <section className="skeu-panel flex min-h-0 flex-col overflow-hidden">
      <div className="skeu-panel-toolbar shrink-0 px-3.5 py-3">
        <Input
          className="h-10"
          placeholder="搜索收货门店名称或编号"
          aria-label="搜索收货门店"
          value={storeSearch}
          onChange={(event) => setStoreSearch(event.target.value)}
        />
      </div>
      <div className="skeu-scroll min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-3">
        {storesLoading ? (
          <LoadingState type="list" rows={5} className="px-0" />
        ) : storesError ? (
          <InlineError message={storesError} onRetry={loadStores} />
        ) : filteredStores.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">
              {stores.length === 0 ? "暂无可用门店" : "未找到匹配门店"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {stores.length === 0
                ? "请先在设置中新增并启用门店"
                : "请调整搜索关键词"}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filteredStores.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => pickStore(item.id)}
                  aria-pressed={storeId === item.id}
                  className={
                    "flex min-h-16 w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors hover:border-primary hover:bg-muted/40 " +
                    (storeId === item.id
                      ? "border-primary bg-primary/5"
                      : "border-border")
                  }
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="mt-1 block font-mono text-xs text-muted-foreground">
                      {item.code}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );

  const schedulePanel = (
    <section className="skeu-panel flex min-h-0 flex-col overflow-hidden">
      <div className="skeu-panel-toolbar flex shrink-0 flex-wrap items-center gap-3 px-3.5 py-3">
        <SkeuSegmented
          value={mode}
          onChange={(value) => changeMode(value as OutboundMode)}
          options={[...OUTBOUND_MODES]}
          ariaLabel="出库来源类型"
          className="shrink-0"
        />
        <Input
          className="ml-auto h-10 w-full max-w-[280px] min-w-[180px]"
          placeholder="搜索排程标题、编号或日期"
          aria-label="搜索排程单"
          disabled={storeId === null}
          value={sourceSearch}
          onChange={(event) => setSourceSearch(event.target.value)}
        />
      </div>
      <div className="skeu-scroll min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-3">
        {storeId === null ? (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-lg border border-dashed text-center">
            <p className="text-sm text-muted-foreground">请先选择收货门店</p>
          </div>
        ) : sourcesLoading ? (
          <LoadingState type="list" rows={4} className="px-0" />
        ) : sourcesError ? (
          <InlineError
            message={sourcesError}
            onRetry={() => void loadSources(storeId)}
          />
        ) : filteredSources.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">
              {sources.length === 0 ? "该门店暂无可出库排程" : "未找到匹配单据"}
            </p>

          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredSources.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pickSchedule(item.id)}
                aria-pressed={sourceId === item.id}
                className={
                  "min-h-28 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-muted/40 " +
                  (sourceId === item.id
                    ? "border-primary bg-primary/5"
                    : "border-border")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate font-medium" title={item.title}>
                    {item.title}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {item.code ?? "排程单 #" + item.id}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(item.date).toLocaleDateString("zh-CN")}
                  </span>
                  <span className="tabular-nums">
                    {item.dishCount} 类 / {item.totalQuantity} 份
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
  const batchPanel = (
    <section className="skeu-panel flex min-h-0 flex-col overflow-hidden">
      <div className="skeu-panel-toolbar flex shrink-0 flex-wrap items-center gap-3 px-3.5 py-3">
        <SkeuSegmented
          value={mode}
          onChange={(value) => changeMode(value as OutboundMode)}
          options={[...OUTBOUND_MODES]}
          ariaLabel="出库来源类型"
          className="shrink-0"
        />
        <Input
          className="ml-auto h-10 w-full max-w-[280px] min-w-[180px]"
          placeholder="搜索切配单编号或日期"
          aria-label="搜索切配单"
          value={batchSearch}
          onChange={(event) => setBatchSearch(event.target.value)}
        />
      </div>
      <div className="skeu-scroll min-h-0 flex-1 overflow-y-auto px-3.5 pt-3 pb-3">
        {batchesLoading ? (
          <LoadingState type="list" rows={4} className="px-0" />
        ) : batchesError ? (
          <InlineError message={batchesError} onRetry={loadBatches} />
        ) : filteredBatches.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="font-medium">暂无可出库切配单</p>

          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredBatches.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={storeId === null}
                onClick={() => pickBatch(item.id)}
                aria-pressed={batchId === item.id}
                className={
                  "min-h-28 rounded-lg border p-4 text-left transition-colors enabled:hover:border-primary enabled:hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50 " +
                  (batchId === item.id
                    ? "border-primary bg-primary/5"
                    : "border-border")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate font-medium" title={item.title}>
                    {item.title}
                  </span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {item.code ?? "切配单 #" + item.id}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(item.date).toLocaleDateString("zh-CN")}
                  </span>
                  <span className="tabular-nums">
                    {item.itemCount} 种 / {formatPortionsCount(item.totalPortions)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );

  const operationArea = (
    <div
      className={
        embedded
          ? "-mx-6 -mb-4 flex shrink-0 items-center justify-between gap-3 border-t bg-white px-6 pt-4 pb-5"
          : "-mx-8 -mb-8 flex shrink-0 items-center justify-between gap-3 border-t bg-white px-8 pt-4 pb-5"
      }
    >
      {view === "select" ? (
        <>
          <span />
          <SkeuButton
            type="button"
            onClick={goToDetail}
            disabled={!canProceed}
          >
            {quoteLoading && selectedSourceId != null ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            下一步
          </SkeuButton>
        </>
      ) : (
        <>
          <SkeuButton
            type="button"
            variant="outline"
            onClick={() => setView("select")}
          >
            返回上一步
          </SkeuButton>
          <div className="flex items-center justify-end gap-2">
            {embedded && (
              <SkeuButton
                type="button"
                variant="outline"
                onClick={() => onCancel?.()}
              >
                取消
              </SkeuButton>
            )}
            <SkeuButton
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
            >
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {submitting ? "提交中…" : "确认出库"}
            </SkeuButton>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-col gap-5"
          : "flex min-h-0 flex-1 flex-col gap-6 p-8"
      }
    >
      {!embedded && (
        <div className="flex shrink-0 items-center gap-3">
          <SkeuButton
            variant="ghost"
            size="icon-sm"
            aria-label="返回出库单列表"
            onClick={() => router.push("/inventory?tab=outbound")}
          >
            <ArrowLeft className="h-5 w-5" />
          </SkeuButton>
          <PageHeader title="创建出库单" />
        </div>
      )}

      {view === "select" && (
        <>
          <FormSection cols={2} className="shrink-0">
            {outboundTimeField}
            {remarkField}
          </FormSection>
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,4fr)_minmax(0,8fr)]">
              {storeList}
              {mode === "batch" ? batchPanel : schedulePanel}
            </div>
          </div>
        </>
      )}
      {view === "detail" && (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
                    {quoteLoading ? (
            <div className="shrink-0 space-y-2" aria-label="正在加载出库明细">
              <div className="h-10 rounded-lg bg-muted animate-pulse" />
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : quoteError ? (
            <InlineError
              message={quoteError}
              onRetry={() => {
                if (mode === "schedule" && sourceId != null) void loadQuote("schedule", sourceId);
                if (mode === "batch" && batchId != null) void loadQuote("batch", batchId);
              }}
            />
          ) : (
            <div className="skeu-table-scroll skeu-scroll min-h-0 flex-1 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>一级分类</TableHead>
                    <TableHead>二级分类</TableHead>
                    <TableHead>序号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>封装规格</TableHead>
                    <TableHead className="text-right">单价</TableHead>
                    {mode === "schedule" && (
                      <>
                        <TableHead className="text-right">计划出库数（份）</TableHead>
                        <TableHead className="text-right">计划量</TableHead>
                      </>
                    )}
                    <TableHead className="text-right">
                      {mode === "batch" ? "梳理（份）" : "库存份数"}
                    </TableHead>
                    <TableHead className="text-right">本次出库数（份）</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    {mode === "schedule" && <TableHead>备货状态</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line, index) => {
                    const shipped = parseShipped(shipMap[line.key] ?? "") ?? 0;
                    const lineError = getLineError(line);
                    const amount =
                      line.standardPackagePrice != null
                        ? calcPortionAmount(line.standardPackagePrice, shipped)
                        : null;
                    return (
                      <TableRow
                        key={line.key}
                        className={
                          mode === "schedule" && line.prepStatus === "unfinished"
                            ? "bg-danger-muted/40"
                            : mode === "schedule" && line.prepStatus === "insufficient"
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
                          <span className="block font-mono text-xs text-muted-foreground">
                            {line.itemCode}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {line.packageSpec} g/份
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatMoney(line.standardPackagePrice, "份")}
                        </TableCell>
                        {mode === "schedule" && (
                          <>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatPortionsCount(line.requiredPortions)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground tabular-nums">
                              {formatWeight(line.requiredQty)}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-right font-medium tabular-nums">
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
                            aria-describedby={lineError ? `outbound-error-${line.key}` : undefined}
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
                        {mode === "schedule" && (
                          <TableCell>{prepBadge(line.prepStatus)}</TableCell>
                        )}
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
              {mode === "schedule" && (
                <span>计划 <b>{formatPortionsCount(summary.planP)}</b></span>
              )}
              <span>
                本次出库 <b className="text-primary">{formatPortionsCount(summary.shipP)}</b>
              </span>
              <span>合计金额 <b className="text-primary">¥{summary.amount.toFixed(2)}</b></span>
              {mode === "schedule" && (
                <span>未切配 <b className="text-destructive">{summary.unfinished}</b> 行</span>
              )}
              {summary.shipP <= 0 && (
                <span className="text-sm text-destructive">本次出库总数必须大于 0</span>
              )}
              {mode === "schedule" && summary.unfinished > 0 && (
                <span className="text-sm text-warning">
                  未切配的净菜默认不出库，本单将标记为未按计划出库
                </span>
              )}
            </div>
          )}

        </div>
      )}

      {operationArea}
    </div>
  );
}
