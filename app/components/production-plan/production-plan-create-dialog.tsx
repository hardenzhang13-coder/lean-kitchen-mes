"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Info, Loader2, PackagePlus, Search, X } from "lucide-react";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuSearch } from "@/app/components/ui/skeu-search";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
import { DatePicker } from "@/app/components/ui/date-picker";
import { Pagination } from "@/app/components/ui/pagination";
import { LoadingState } from "@/app/components/ui/loading-state";
import { RecordSheet } from "@/app/components/ui/record-sheet";
import { dayOffsetInputValue, formatDate, getWeekDay } from "@/lib/shared/date-format";
import { formatPortionsValue } from "@/lib/shared/prepped-stock";
import { parseObject } from "@/lib/client/api";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";

interface ScheduleOption {
  id: number;
  code: string | null;
  title: string;
  scheduleDate: string;
  status: string;
  store?: { id: number; name: string } | null;
  dishCount: number;
  totalQuantity: number;
}

interface PreviewCuttingRow {
  sourceType: string;
  sourceId: number;
  sourceCode: string;
  itemName: string;
  l1Name: string;
  l2Name: string;
  packageSpec: number | null;
  unit: string;
  portions: number | null;
  availablePortions: number;
  availableQtyG: number;
}

interface ConfirmRow {
  key: string;
  sourceType: string;
  sourceId: number;
  sourceCode: string;
  itemName: string;
  l1Name: string;
  l2Name: string;
  packageSpec: number | null;
  unit: string;
  portionsText: string;
  /** 需求份数（排程合并基线）；手工追加行为 null */
  baselinePortions: number | null;
  availablePortions: number;
  availableQtyG: number;
  isManual: boolean;
}

interface NetOption {
  id: number;
  code: string | null;
  name: string;
  packageSpec: number | null;
  unit: string;
  l2Code: string | null;
}

interface CategoryL2 {
  code: string;
  name: string;
  parentCode?: string | null;
}
interface CategoryL1 {
  code: string;
  name: string;
}

interface StockEntry {
  portions: number;
  qtyG: number;
}

interface PlanDetailRow {
  sourceType?: string;
  sourceId?: number;
  sourceCode?: string;
  itemName?: string;
  l1Name?: string;
  l2Name?: string;
  packageSpec?: number | null;
  unit?: string;
  portions?: number | null;
  origin?: "schedule" | "manual";
  originalPortions?: number | null;
}

interface PlanDetail {
  planDate: string;
  status: string;
  remark: string | null;
  cuttingOrders: PlanDetailRow[];
  sourceSchedules: Array<{
    id: number;
    code: string | null;
    title: string;
    scheduleDate: string;
    status: string;
    totalQuantity: number;
    store?: { id: number; name: string } | null;
  }>;
}

interface ScheduleDetailSource {
  id: number;
  code: string | null;
  title: string;
  scheduleDate: string;
  status: string;
  store?: { id: number; name: string } | null;
  items: Array<{ quantity: number }>;
}

export interface ProductionPlanCreateDialogProps {
  /** 编辑态：加载该计划单并回填，保存走 PUT（仅待生效可改） */
  editId?: number | null;
  /** 预选一张进行中排程单（排程详情「纳入切配计划」入口） */
  presetScheduleId?: number | null;
  presetDate?: string | null;
  onClose: () => void;
  /** 保存成功回调（新建回传 id，编辑回传 editId） */
  onSaved: (id: number) => void;
}

const OPTION_PAGE_SIZE = 10;
const PICKER_PAGE_SIZE = 12;

function parsePortions(text: string): number {
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * 新建/编辑切配计划弹窗（复用排菜模块弹窗骨架，无步进条，视图切换）。
 * 视图一：生产日期 + 备注（必填）+ 选择进行中排程单（可不选，直接确认切配量）；
 * 视图二：确认切配量——需求份数只读、计划切配份数可编辑（默认回显需求份数）、
 * 库存重点展示（库存充足行给绿色「可以移除」标识），可添加切配净菜（右侧抽屉）。
 */
export function ProductionPlanCreateDialog({
  editId,
  presetScheduleId,
  presetDate,
  onClose,
  onSaved,
}: ProductionPlanCreateDialogProps) {
  const [view, setView] = useState<"pick" | "confirm">("pick");
  const [loading, setLoading] = useState(true);

  // 视图一状态
  const [planDate, setPlanDate] = useState(presetDate || dayOffsetInputValue(0));
  const [remark, setRemark] = useState("");
  const [remarkError, setRemarkError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [known, setKnown] = useState<Map<number, ScheduleOption>>(new Map());
  const [options, setOptions] = useState<ScheduleOption[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ totalItems: number; totalPages: number } | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);

  // 视图二状态
  const [rows, setRows] = useState<ConfirmRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stockById, setStockById] = useState<Record<string, StockEntry>>({});
  /** 被移除的排程基线行：提交时以 portions=0 回传（服务端行保留 0） */
  const [removedBaseline, setRemovedBaseline] = useState<Map<number, number>>(new Map());
  /** 编辑态已保存份数（sourceId → portions），进入视图二时套到基线上 */
  const savedRef = useRef<Map<number, number>>(new Map());
  /** 用户在视图二改过的份数（sourceId → text），返回视图一后重新套用 */
  const overridesRef = useRef<Map<number, string>>(new Map());

  // 添加切配净菜抽屉
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerDebounced, setPickerDebounced] = useState("");
  const [pickerOptions, setPickerOptions] = useState<NetOption[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerPagination, setPickerPagination] = useState<{ totalItems: number; totalPages: number } | null>(null);
  const [pickerL1, setPickerL1] = useState("all");
  const [categoriesL2, setCategoriesL2] = useState<CategoryL2[]>([]);
  const [categoriesL1, setCategoriesL1] = useState<CategoryL1[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 初始化：编辑态加载计划单详情；预选态加载排程单
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (editId) {
        try {
          const res = await fetch(`/api/production-plans/${editId}`);
          const detail = await parseObject<PlanDetail>(res);
          if (!detail) {
            toast.error("切配计划单不存在");
            onClose();
            return;
          }
          if (detail.status !== "待生效") {
            toast.error("只有待生效的切配计划单可以修改");
            onClose();
            return;
          }
          if (!alive) return;
          setPlanDate(detail.planDate.slice(0, 10));
          setRemark(detail.remark ?? "");
          const scheduleIds = detail.sourceSchedules.map((schedule) => schedule.id);
          setPicked(new Set(scheduleIds));
          setKnown(
            new Map(
              detail.sourceSchedules.map((schedule) => [
                schedule.id,
                {
                  id: schedule.id,
                  code: schedule.code,
                  title: schedule.title,
                  scheduleDate: schedule.scheduleDate,
                  status: schedule.status,
                  store: schedule.store ?? null,
                  dishCount: 0,
                  totalQuantity: schedule.totalQuantity,
                },
              ])
            )
          );
          const saved = new Map<number, number>();
          const manualRows: ConfirmRow[] = [];
          for (const row of detail.cuttingOrders) {
            if (typeof row.sourceId !== "number" || typeof row.portions !== "number") continue;
            saved.set(row.sourceId, Number(row.portions));
            if (row.origin === "manual") {
              manualRows.push({
                key: (row.sourceType ?? "net") + "-" + row.sourceId,
                sourceType: row.sourceType ?? "net",
                sourceId: row.sourceId,
                sourceCode: row.sourceCode ?? "",
                itemName: row.itemName ?? "",
                l1Name: row.l1Name ?? "",
                l2Name: row.l2Name ?? "",
                packageSpec: row.packageSpec != null ? Number(row.packageSpec) : null,
                unit: row.unit ?? "g",
                portionsText: String(Number(row.portions)),
                baselinePortions: null,
                availablePortions: 0,
                availableQtyG: 0,
                isManual: true,
              });
            }
          }
          savedRef.current = saved;
          if (manualRows.length > 0) setRows(manualRows);
        } catch {
          if (alive) toast.error("获取切配计划单失败");
        }
      } else if (presetScheduleId) {
        try {
          const res = await fetch(`/api/schedules/${presetScheduleId}`);
          const source = await parseObject<ScheduleDetailSource>(res);
          if (source && alive) {
            const option: ScheduleOption = {
              id: source.id,
              code: source.code,
              title: source.title,
              scheduleDate: source.scheduleDate,
              status: source.status,
              store: source.store ?? null,
              dishCount: source.items.length,
              totalQuantity: source.items.reduce((sum, item) => sum + item.quantity, 0),
            };
            setPicked(new Set([source.id]));
            setKnown(new Map([[source.id, option]]));
          }
        } catch {
          if (alive) toast.error("获取排程单失败");
        }
      }
      if (alive) setLoading(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [editId, presetScheduleId, onClose]);

  // 视图一候选排程单（availableForPlan 排除已纳入；编辑态排除自身）
  useEffect(() => {
    if (view !== "pick") return;
    let alive = true;
    const load = async () => {
      setOptionsLoading(true);
      try {
        const params = new URLSearchParams({
          status: "进行中",
          availableForPlan: "1",
          page: String(page),
          pageSize: String(OPTION_PAGE_SIZE),
        });
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (editId) params.set("excludePlanId", String(editId));
        const res = await fetch("/api/schedules?" + params.toString());
        const data = await res.json();
        if (!alive) return;
        const list: ScheduleOption[] = data.data || [];
        setOptions(list);
        setPagination(data.pagination || null);
        setKnown((previous) => {
          const next = new Map(previous);
          for (const option of list) next.set(option.id, option);
          return next;
        });
      } catch {
        if (alive) toast.error("获取排程单失败");
      } finally {
        if (alive) setOptionsLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [view, page, debouncedSearch, editId]);

  // 分类字典（添加切配净菜时渲染分类名）
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/ingredient-categories?pageSize=100");
        const data = await res.json();
        if (!alive) return;
        setCategoriesL2(data?.l2 ?? data?.data?.l2 ?? []);
        setCategoriesL1(data?.l1 ?? data?.data?.l1 ?? []);
      } catch {
        if (alive) toast.error("获取食材分类失败");
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const l2Meta = useCallback(
    (l2Code: string | null) => {
      const l2 = categoriesL2.find((c) => c.code === l2Code);
      const l1 = l2?.parentCode
        ? categoriesL1.find((c) => c.code === l2.parentCode)
        : undefined;
      return { l1Name: l1?.name ?? "其他", l2Name: l2?.name ?? l2Code ?? "—" };
    },
    [categoriesL2, categoriesL1]
  );

  // 抽屉净菜候选
  useEffect(() => {
    if (!sheetOpen) return;
    let alive = true;
    const timer = setTimeout(async () => {
      setPickerLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pickerPage),
          pageSize: String(PICKER_PAGE_SIZE),
        });
        if (pickerDebounced) params.set("q", pickerDebounced);
        const res = await fetch("/api/net-ingredients?" + params.toString());
        const data = await res.json();
        if (!alive) return;
        setPickerOptions(data.data || []);
        setPickerPagination(data.pagination || null);
      } catch {
        if (alive) toast.error("获取净料失败");
      } finally {
        if (alive) setPickerLoading(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sheetOpen, pickerPage, pickerDebounced]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPickerDebounced(pickerSearch);
      setPickerPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [pickerSearch]);

  const pickedOptions = useMemo(
    () =>
      [...picked]
        .map((id) => known.get(id))
        .filter((option): option is ScheduleOption => !!option),
    [picked, known]
  );

  const toggle = (option: ScheduleOption) => {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(option.id)) next.delete(option.id);
      else next.add(option.id);
      return next;
    });
    setKnown((previous) => new Map(previous).set(option.id, option));
  };

  const stockOf = useCallback(
    (sourceId: number): StockEntry => stockById[String(sourceId)] ?? { portions: 0, qtyG: 0 },
    [stockById]
  );

  const loadConfirm = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const ids = [...picked];
      const res = await fetch("/api/production-plans/preview?scheduleIds=" + ids.join(","));
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "生成预览失败");
        return false;
      }
      const preview: PreviewCuttingRow[] = data.data?.cutting ?? [];
      const stock: Record<string, StockEntry> = data.data?.stockById ?? {};
      setStockById(stock);
      const baselineIds = new Set(preview.map((row) => row.sourceId));
      const nextRows: ConfirmRow[] = preview.map((row) => {
        const baseline = row.portions ?? 0;
        const savedPortions = savedRef.current.get(row.sourceId);
        const override = overridesRef.current.get(row.sourceId);
        return {
          key: row.sourceType + "-" + row.sourceId,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          sourceCode: row.sourceCode,
          itemName: row.itemName,
          l1Name: row.l1Name,
          l2Name: row.l2Name,
          packageSpec: row.packageSpec != null ? Number(row.packageSpec) : null,
          unit: row.unit,
          portionsText:
            override ?? (savedPortions != null ? String(savedPortions) : String(baseline)),
          baselinePortions: baseline,
          availablePortions: row.availablePortions,
          availableQtyG: row.availableQtyG,
          isManual: false,
        };
      });
      // 手工行（当前视图或编辑态预置）不在基线里的保留
      for (const row of rows) {
        if (!row.isManual || baselineIds.has(row.sourceId)) continue;
        nextRows.push({
          ...row,
          availablePortions: stock[String(row.sourceId)]?.portions ?? row.availablePortions,
          availableQtyG: stock[String(row.sourceId)]?.qtyG ?? row.availableQtyG,
        });
      }
      setRows(nextRows);
      return true;
    } catch {
      toast.error("生成预览失败");
      return false;
    } finally {
      setPreviewLoading(false);
    }
  }, [picked, rows]);

  const goConfirm = async () => {
    if (!planDate) {
      toast.error("请选择生产日期");
      return;
    }
    if (!remark.trim()) {
      setRemarkError("请填写备注");
      return;
    }
    setRemarkError(null);
    const ok = await loadConfirm();
    if (ok) setView("confirm");
  };

  const goBack = () => {
    overridesRef.current = new Map(rows.map((row) => [row.sourceId, row.portionsText]));
    setView("pick");
  };

  const setRowPortions = (key: string, text: string) => {
    setRows((previous) =>
      previous.map((row) => (row.key === key ? { ...row, portionsText: text } : row))
    );
  };

  const removeRow = (row: ConfirmRow) => {
    if (!row.isManual) {
      setRemovedBaseline((previous) => new Map(previous).set(row.sourceId, 0));
    }
    setRows((previous) => previous.filter((item) => item.key !== row.key));
  };

  const rowKeys = useMemo(() => new Set(rows.map((row) => row.sourceId)), [rows]);

  const pickerL1Options = useMemo(
    () =>
      Array.from(
        new Set(
          pickerOptions
            .map((net) => l2Meta(net.l2Code).l1Name)
            .filter((name): name is string => !!name)
        )
      ),
    [pickerOptions, l2Meta]
  );

  const filteredPickerOptions = useMemo(() => {
    if (pickerL1 === "all") return pickerOptions;
    return pickerOptions.filter((net) => l2Meta(net.l2Code).l1Name === pickerL1);
  }, [pickerOptions, pickerL1, l2Meta]);

  const addNet = (net: NetOption) => {
    if (rowKeys.has(net.id)) {
      toast.error("该净料已在清单中");
      return;
    }
    if (net.packageSpec == null) {
      toast.error("该净料缺少封装规格，无法纳入切配计划");
      return;
    }
    const meta = l2Meta(net.l2Code);
    const stock = stockOf(net.id);
    setRows((previous) => [
      ...previous,
      {
        key: "manual-" + net.id,
        sourceType: "net",
        sourceId: net.id,
        sourceCode: net.code ?? "",
        itemName: net.name,
        l1Name: meta.l1Name,
        l2Name: meta.l2Name,
        packageSpec: Number(net.packageSpec),
        unit: net.unit ?? "g",
        portionsText: "0",
        baselinePortions: null,
        availablePortions: stock.portions,
        availableQtyG: stock.qtyG,
        isManual: true,
      },
    ]);
    setSheetOpen(false);
    toast.success(`已添加 ${net.name}，请填写计划切配份数`);
  };

  const totalPortions = rows.reduce((sum, row) => sum + parsePortions(row.portionsText), 0);
  const removableCount = rows.filter(
    (row) =>
      !row.isManual &&
      (row.baselinePortions ?? 0) > 0 &&
      row.availablePortions >= (row.baselinePortions ?? 0)
  ).length;
  const canSubmit =
    !submitting &&
    !previewLoading &&
    rows.length > 0 &&
    round2(totalPortions) > 0 &&
    (picked.size > 0 || removedBaseline.size > 0 || true);

  const pickHint = !planDate
    ? "请选择生产日期"
    : !remark.trim()
      ? "请填写备注"
      : picked.size === 0
        ? "未选择排程单，将生成纯手工切配计划"
        : `已选 ${picked.size} 张排程单，确认后进入切配量`;

  const handleSubmit = async () => {
    if (round2(totalPortions) <= 0) {
      toast.error("至少一行计划切配份数大于 0");
      return;
    }
    setSubmitting(true);
    try {
      const adjustments = [
        ...rows.map((row) => ({ sourceId: row.sourceId, portions: parsePortions(row.portionsText) })),
        ...[...removedBaseline.entries()].map(([sourceId, portions]) => ({ sourceId, portions })),
      ];
      const res = await fetch(
        editId ? `/api/production-plans/${editId}` : "/api/production-plans",
        {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            planDate,
            remark: remark.trim(),
            scheduleIds: [...picked],
            adjustments,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || (editId ? "修改失败" : "创建失败"));
        return;
      }
      toast.success(editId ? "切配计划已修改" : "切配计划已创建");
      onSaved(editId ?? data?.data?.id);
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <AppDialogContent
        size="workbench"
        className="flex h-[min(780px,calc(100dvh-24px))] flex-col p-0 [&>button]:cursor-pointer"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-lg">
            {view === "pick"
              ? editId
                ? "编辑切配计划"
                : "新建切配计划"
              : "确认切配量"}
          </DialogTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {view === "pick"
              ? "先确认生产日期与备注，再选择进行中的门店排程单；未选择也可直接进入切配量确认。"
              : "需求份数为排程合并基线（只读）；计划切配份数默认回显需求份数，库存仅参考不抵扣。"}
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fcfbfa,#fbf9f6)] px-5 py-4 lg:overflow-hidden">
          {loading ? (
            <LoadingState type="card-grid" rows={2} />
          ) : view === "pick" ? (
            <div className="flex h-full min-h-0 flex-col gap-3.5">
              <section className="grid flex-none grid-cols-1 gap-3.5 rounded-[var(--sk-radius-md)] border border-skeu-border bg-[linear-gradient(180deg,#fff,#fdfcfb)] p-3.5 shadow-sk-raised lg:grid-cols-[minmax(320px,4fr)_minmax(0,7fr)]">
                <FormField id="plan-date" label="生产日期" required optionalHint={false}>
                  <div className="min-w-[200px] max-w-sm flex-1">
                    <DatePicker
                      value={planDate}
                      onChange={setPlanDate}
                      placeholder="请选择生产日期"
                      showWeekday
                    />
                  </div>
                </FormField>
                <FormField id="plan-remark" label="备注" required optionalHint={false}>
                  <div className="max-w-xl">
                    <Input
                      value={remark}
                      onChange={(event) => {
                        setRemark(event.target.value);
                        if (remarkError) setRemarkError(null);
                      }}
                      placeholder="必填，如：周末备货加量"
                      maxLength={200}
                      aria-invalid={!!remarkError}
                    />
                    {remarkError && (
                      <p className="mt-1 text-xs font-bold text-[#b42318]">{remarkError}</p>
                    )}
                  </div>
                </FormField>
              </section>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 lg:grid-cols-[minmax(320px,4fr)_minmax(0,7fr)] lg:grid-rows-1">
                <section className="skeu-panel flex min-h-0 flex-col overflow-hidden">
                  <header className="skeu-panel-toolbar flex items-center justify-between gap-2.5 px-3.5 py-3">
                    <h2 className="text-sm font-bold">已选排程单</h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      <b className="text-foreground">{pickedOptions.length}</b> 张 ·{" "}
                      <b className="text-foreground">
                        {pickedOptions.reduce((sum, option) => sum + option.totalQuantity, 0)}
                      </b>{" "}
                      份
                    </span>
                  </header>
                  <div className="skeu-panel-body skeu-scroll min-h-0 flex-1 overflow-y-auto p-3">
                    {pickedOptions.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        未选择排程单，可直接确认切配量
                      </p>
                    ) : (
                      <ul className="space-y-2.5">
                        {pickedOptions.map((option) => (
                          <li
                            key={option.id}
                            className="skeu-picked-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 pl-4"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-[#2f4237]">
                                {option.store?.name ?? option.title}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[#687a70]">
                                <span className="font-mono">{option.code ?? `#${option.id}`}</span>
                                <span className="tabular-nums">
                                  {formatDate(option.scheduleDate)} {getWeekDay(option.scheduleDate)}
                                </span>
                                <span className="tabular-nums">{option.totalQuantity} 份</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              aria-label={`移除 ${option.title}`}
                              onClick={() => toggle(option)}
                              className="skeu-icon-btn size-7 shrink-0 text-muted-foreground hover:text-[#b42318]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                <section className="skeu-panel flex min-h-0 flex-col overflow-hidden">
                  <div className="skeu-panel-toolbar relative flex items-center gap-2 px-3.5 py-3">
                    <SkeuSearch
                      value={search}
                      onChange={setSearch}
                      placeholder="搜索门店 / 单号 / 菜品..."
                      aria-label="搜索排程单"
                    />
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                      共 {pagination?.totalItems ?? options.length} 张可纳入
                    </span>
                  </div>
                  <div className="skeu-panel-body skeu-scroll min-h-0 flex-1 overflow-y-auto p-3">
                    {optionsLoading ? (
                      <LoadingState type="list" rows={3} />
                    ) : options.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        暂无可纳入的「进行中」排程单
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        {options.map((option) => {
                          const isPicked = picked.has(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={isPicked}
                              data-on={isPicked}
                              onClick={() => toggle(option)}
                              className="skeu-dish-card p-2.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-bold text-[#36312a]">
                                  {option.store?.name ?? option.title}
                                </span>
                                <span className="skeu-pick-dot">
                                  <Check strokeWidth={3} />
                                </span>
                              </div>
                              <div className="mt-1 font-mono text-xs text-muted-foreground">
                                {option.code ?? `#${option.id}`}
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span className="tabular-nums">
                                  {formatDate(option.scheduleDate)} {getWeekDay(option.scheduleDate)}
                                </span>
                                <span className="font-mono font-bold text-[#7a4a2a] tabular-nums">
                                  {option.totalQuantity} 份
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {pagination && pagination.totalItems > OPTION_PAGE_SIZE && (
                    <footer className="skeu-panel-toolbar flex items-center justify-center px-3.5 py-2.5">
                      <Pagination
                        currentPage={page}
                        totalPages={pagination.totalPages}
                        onPageChange={setPage}
                      />
                    </footer>
                  )}
                </section>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col gap-3.5">
              <section className="flex flex-none flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--sk-radius-md)] border border-skeu-border bg-[linear-gradient(180deg,#fff,#fdfcfb)] px-3.5 py-2.5 text-[13px] shadow-sk-raised">
                <span className="text-muted-foreground">
                  生产日期 <b className="text-foreground">{planDate}</b>
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  备注 <b className="text-foreground">{remark.trim()}</b>
                </span>
                <SkeuButton variant="outline" size="sm" onClick={goBack} disabled={submitting}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  返回修改
                </SkeuButton>
                <SkeuButton variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
                  <PackagePlus className="h-4 w-4" />
                  添加切配净菜
                </SkeuButton>
              </section>

              <section className="skeu-panel flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="skeu-panel-body skeu-scroll min-h-0 flex-1 overflow-auto p-3">
                  {previewLoading ? (
                    <LoadingState type="list" rows={4} />
                  ) : rows.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">
                      没有切配行，请点「添加切配净菜」
                    </p>
                  ) : (
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="border-b border-skeu-border text-left text-xs font-bold text-muted-foreground">
                          <th className="px-2 py-2.5">分类</th>
                          <th className="px-2 py-2.5">名称</th>
                          <th className="px-2 py-2.5 text-right">封装规格</th>
                          <th className="px-2 py-2.5 text-right">需求份数</th>
                          <th className="px-2 py-2.5 text-right">计划切配份数</th>
                          <th className="px-2 py-2.5 text-right">切配量</th>
                          <th className="px-2 py-2.5 text-right">当前库存</th>
                          <th className="px-2 py-2.5">来源</th>
                          <th className="px-2 py-2.5 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const portions = parsePortions(row.portionsText);
                          const qtyG =
                            row.packageSpec != null ? round2(portions * row.packageSpec) : null;
                          const overBaseline =
                            row.baselinePortions != null && portions > row.baselinePortions;
                          const stockEnough =
                            !row.isManual &&
                            (row.baselinePortions ?? 0) > 0 &&
                            row.availablePortions >= (row.baselinePortions ?? 0);
                          return (
                            <tr
                              key={row.key}
                              className="border-b border-skeu-border last:border-0"
                            >
                              <td className="px-2 py-2 text-xs text-muted-foreground">
                                {row.l1Name} / {row.l2Name}
                              </td>
                              <td className="px-2 py-2">
                                <div className="font-bold text-[#2f4237]">{row.itemName}</div>
                                {overBaseline && (
                                  <div className="mt-0.5 text-xs text-[#b45309]">
                                    已超出排程基线 {formatPortionsValue(row.baselinePortions ?? 0)}{" "}
                                    份，超出部分完成生产后只入库、不回写门店
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-2 text-right text-xs tabular-nums">
                                {row.packageSpec != null ? `${row.packageSpec} g/份` : "—"}
                              </td>
                              <td className="px-2 py-2 text-right">
                                <b className="font-mono text-base tabular-nums text-[#2f4237]">
                                  {row.baselinePortions != null
                                    ? formatPortionsValue(row.baselinePortions)
                                    : "—"}
                                </b>
                              </td>
                              <td className="px-2 py-2 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={row.portionsText}
                                  onChange={(event) =>
                                    setRowPortions(row.key, event.target.value)
                                  }
                                  className="skeu-input ml-auto h-8 w-24 text-right font-mono font-bold tabular-nums"
                                  aria-label={`${row.itemName} 计划切配份数`}
                                />
                              </td>
                              <td className="px-2 py-2 text-right text-xs tabular-nums">
                                {qtyG != null ? `${formatPortionsValue(qtyG)} g` : "—"}
                              </td>
                              <td className="px-2 py-2 text-right">
                                <div className="text-xs tabular-nums">
                                  <b className={cn("font-mono", stockEnough ? "text-[#1e6d47]" : "text-[#2f4237]")}>
                                    {formatPortionsValue(row.availablePortions)}
                                  </b>{" "}
                                  份 /{" "}
                                  <span className="font-mono text-muted-foreground">
                                    {formatPortionsValue(row.availableQtyG)} g
                                  </span>
                                </div>
                                {stockEnough && (
                                  <span className="mt-0.5 inline-flex h-5 items-center rounded-full bg-[#eaf6ef] px-1.5 text-xs font-bold text-[#1e6d47]">
                                    可以移除
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-xs text-muted-foreground">
                                {row.isManual ? "手工" : "排程"}
                              </td>
                              <td className="px-2 py-2 text-right">
                                <button
                                  type="button"
                                  aria-label={`移除 ${row.itemName}`}
                                  onClick={() => removeRow(row)}
                                  className="skeu-icon-btn size-7 text-muted-foreground hover:text-[#b42318]"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
                <footer className="skeu-panel-toolbar flex items-center justify-between gap-2.5 px-3.5 py-2.5 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    共 <b className="text-foreground">{rows.length}</b> 种净菜 · 合计{" "}
                    <b className="text-foreground">{formatPortionsValue(round2(totalPortions))}</b>{" "}
                    份
                    {removableCount > 0 ? ` · ${removableCount} 行库存充足可移除` : ""}
                  </span>
                  <span>库存仅参考，不抵扣采购量</span>
                </footer>
              </section>
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-[linear-gradient(180deg,#fff,#fdfcfb)] px-5 py-3.5">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span
              className={
                "flex items-center gap-2 text-[13px] " +
                (view === "confirm" && round2(totalPortions) > 0
                  ? "font-bold text-[#4d6b5c]"
                  : "text-muted-foreground")
              }
            >
              <span
                className={
                  "grid size-[22px] place-items-center rounded-full border " +
                  (view === "confirm" && round2(totalPortions) > 0
                    ? "border-[#bfdacd] bg-[#eaf6ef]"
                    : "border-skeu-border bg-[linear-gradient(180deg,#fbf9f6,#f6f3ef)]")
                }
              >
                {view === "confirm" && round2(totalPortions) > 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#1e6d47]" />
                ) : (
                  <Info className="h-3.5 w-3.5 text-[#8a847c]" />
                )}
              </span>
              {view === "confirm"
                ? round2(totalPortions) > 0
                  ? `将按最终份数重算切配与采购：${formatPortionsValue(round2(totalPortions))} 份`
                  : "至少一行计划切配份数大于 0"
                : pickHint}
            </span>
            <div className="flex items-center gap-2">
              {view === "pick" ? (
                <>
                  <SkeuButton variant="outline" onClick={onClose}>
                    取消
                  </SkeuButton>
                  <SkeuButton onClick={() => void goConfirm()} disabled={optionsLoading}>
                    确认切配量
                  </SkeuButton>
                </>
              ) : (
                <>
                  <SkeuButton variant="outline" onClick={goBack} disabled={submitting}>
                    返回修改
                  </SkeuButton>
                  <SkeuButton onClick={handleSubmit} disabled={!canSubmit}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {editId ? "确认并保存" : "确认切配计划"}
                  </SkeuButton>
                </>
              )}
            </div>
          </div>
        </DialogFooter>
      </AppDialogContent>

      <RecordSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="添加切配净菜"
        meta={<span className="font-semibold text-[#5d7265]">选中即加入切配清单</span>}
        bodyClassName="skeu-scroll bg-[linear-gradient(180deg,#fcfbfa,#f9f7f3)] px-4 py-4"
        footer={
          <span className="mr-auto text-xs text-muted-foreground">
            缺封装规格的净料无法纳入切配计划
          </span>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={pickerSearch}
              onChange={(event) => setPickerSearch(event.target.value)}
              placeholder="搜索净料 / 小料名称或编码..."
              aria-label="搜索净料"
              className="h-11 pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["全部", ...pickerL1Options].map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={pickerL1 === name}
                data-on={pickerL1 === name}
                onClick={() => setPickerL1(name)}
                className="skeu-fchip"
              >
                {name}
              </button>
            ))}
          </div>
          {pickerLoading ? (
            <LoadingState type="card-grid" rows={2} />
          ) : filteredPickerOptions.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">未找到匹配的净料</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {filteredPickerOptions.map((net) => {
                const inList = rowKeys.has(net.id);
                const disabled = inList || net.packageSpec == null;
                const meta = l2Meta(net.l2Code);
                const stock = stockOf(net.id);
                return (
                  <button
                    key={net.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => addNet(net)}
                    className={cn(
                      "skeu-dish-card p-2.5",
                      disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex h-[22px] items-center rounded-full bg-[#f4f1eb] px-1.5 text-xs font-bold text-[#6d675f]">
                        {meta.l1Name}
                      </span>
                      <span className="skeu-pick-dot">
                        <Check strokeWidth={3} />
                      </span>
                    </div>
                    <div className="mt-2 truncate pr-5 text-sm font-bold text-[#36312a]">
                      {net.name}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {net.code ?? ""}
                      {net.packageSpec != null ? ` · ${net.packageSpec} g/份` : " · 缺封装规格"}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground tabular-nums">
                      库存 {formatPortionsValue(stock.portions)} 份 / {formatPortionsValue(stock.qtyG)} g
                      {inList && <span className="ml-2 font-bold text-[#5d7265]">已在清单</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {pickerPagination && pickerPagination.totalItems > PICKER_PAGE_SIZE && (
            <Pagination
              currentPage={pickerPage}
              totalPages={pickerPagination.totalPages}
              onPageChange={setPickerPage}
            />
          )}
        </div>
      </RecordSheet>
    </Dialog>
  );
}
