"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
import { DatePicker } from "@/app/components/ui/date-picker";
import { LoadingState } from "@/app/components/ui/loading-state";
import { Pagination } from "@/app/components/ui/pagination";
import { SelectField } from "@/app/components/ui/select-field";
import { dayOffsetInputValue } from "@/lib/shared/date-format";
import { GRAMS_PER_JIN } from "@/lib/shared/unit-conversion";
import { toast } from "sonner";

interface NetOption {
  id: number;
  code: string;
  name: string;
  unit: string;
  l2Code: string;
  packageSpec: number | null;
  yieldRate: number | null;
}

interface CategoryL1Option {
  code: string;
  name: string;
  children?: Array<{ code: string; name: string }>;
}

interface PickedRow {
  sourceId: number;
  code: string;
  name: string;
  unit: string;
  l2Code: string;
  packageSpec: number | null;
  yieldRate: number | null;
  portions: string;
}

interface SelfProductionOrderDialogProps {
  mode: "create" | "edit";
  orderId?: number;
  onClose: () => void;
  onSaved: () => void;
}

const OPTION_PAGE_SIZE = 8;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toPickedRow(option: NetOption): PickedRow {
  return {
    sourceId: option.id,
    code: option.code,
    name: option.name,
    unit: option.unit,
    l2Code: option.l2Code,
    packageSpec: option.packageSpec,
    yieldRate: option.yieldRate,
    portions: "1",
  };
}

function requiredQtyOf(row: PickedRow): number | null {
  const portions = Number(row.portions);
  const packageSpec = row.packageSpec != null ? Number(row.packageSpec) : 0;
  if (!(portions > 0) || !(packageSpec > 0)) return null;
  return round2(portions * packageSpec);
}

function grossNeedOf(row: PickedRow): number | null {
  const requiredQty = requiredQtyOf(row);
  if (requiredQty == null) return null;
  const yieldRate = row.yieldRate != null ? Number(row.yieldRate) : 0;
  return round2(yieldRate > 0 ? (requiredQty * 100) / yieldRate : requiredQty);
}

/** 毛料需求换算为斤（与排程/生产计划展示口径一致，1 斤 = 500g）。 */
function grossJinOf(row: PickedRow): number | null {
  const gross = grossNeedOf(row);
  return gross == null ? null : round2(gross / GRAMS_PER_JIN);
}

/** 内部生产单新建/编辑：生产日期 + 净料/小料份数。标题由日期派生，不在表单填写。 */
export function SelfProductionOrderDialog({
  mode,
  orderId,
  onClose,
  onSaved,
}: SelfProductionOrderDialogProps) {
  const [produceDate, setProduceDate] = useState(dayOffsetInputValue(0));
  const [remark, setRemark] = useState("");
  const [picked, setPicked] = useState<PickedRow[]>([]);
  const [options, setOptions] = useState<NetOption[]>([]);
  const [categories, setCategories] = useState<CategoryL1Option[]>([]);
  const [l1Code, setL1Code] = useState("");
  const [l2Code, setL2Code] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ totalItems: number; totalPages: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(mode === "edit");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let alive = true;
    const loadCategories = async () => {
      try {
        const res = await fetch("/api/ingredient-categories?pageSize=100");
        const json = await res.json();
        if (alive) setCategories(json.data || []);
      } catch {
        if (alive) toast.error("获取食材分类失败");
      }
    };
    loadCategories();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !orderId) return;
    let alive = true;
    const loadDetail = async () => {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/self-production-orders/${orderId}`);
        const json = await res.json();
        if (!alive) return;
        if (!res.ok) {
          toast.error(json.error || "获取内部生产单失败");
          return;
        }
        const detail = json.data;
        setProduceDate(new Date(detail.produceDate).toISOString().slice(0, 10));
        setRemark(detail.remark || "");
        setPicked(
          (detail.items as Array<{
            sourceId: number;
            itemCode: string;
            itemName: string;
            unit: string;
            l2Code: string;
            packageSpec: number | null;
            yieldRate: number | null;
            portions: number;
          }>).map((item) => ({
            sourceId: item.sourceId,
            code: item.itemCode,
            name: item.itemName,
            unit: item.unit,
            l2Code: item.l2Code,
            packageSpec: item.packageSpec,
            yieldRate: item.yieldRate,
            portions: String(item.portions),
          }))
        );
      } catch {
        if (alive) toast.error("获取内部生产单失败");
      } finally {
        if (alive) setLoadingDetail(false);
      }
    };
    loadDetail();
    return () => {
      alive = false;
    };
  }, [mode, orderId]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(OPTION_PAGE_SIZE),
        });
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (l1Code) params.set("l1Code", l1Code);
        if (l2Code) params.set("l2Code", l2Code);
        const res = await fetch("/api/net-ingredients?" + params.toString());
        const json = await res.json();
        if (!alive) return;
        setOptions(json.data || []);
        setPagination(json.pagination || null);
      } catch {
        if (alive) toast.error("获取净料失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [page, debouncedSearch, l1Code, l2Code]);

  const l2Options = useMemo(() => {
    const source = l1Code
      ? categories.filter((category) => category.code === l1Code)
      : categories;
    return source.flatMap((category) =>
      (category.children ?? []).map((child) => ({
        value: child.code,
        label: child.name,
      }))
    );
  }, [categories, l1Code]);

  const pickedIds = useMemo(() => new Set(picked.map((row) => row.sourceId)), [picked]);
  const totalPortions = useMemo(
    () => round2(picked.reduce((sum, row) => sum + (Number(row.portions) || 0), 0)),
    [picked]
  );

  const addOption = (option: NetOption) => {
    setPicked((previous) => {
      if (previous.some((row) => row.sourceId === option.id)) return previous;
      return [...previous, toPickedRow(option)];
    });
  };

  const removeRow = (sourceId: number) => {
    setPicked((previous) => previous.filter((row) => row.sourceId !== sourceId));
  };

  const updatePortions = (sourceId: number, value: string) => {
    setPicked((previous) =>
      previous.map((row) => (row.sourceId === sourceId ? { ...row, portions: value } : row))
    );
  };

  const invalidRow = picked.find((row) => {
    const portions = Number(row.portions);
    return (
      !(portions > 0) ||
      Math.abs(portions * 100 - Math.round(portions * 100)) > 1e-6 ||
      !(row.packageSpec && row.packageSpec > 0)
    );
  });

  const canSubmit = !!produceDate && picked.length > 0 && !invalidRow && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload = {
        produceDate,
        remark: remark.trim() || undefined,
        items: picked.map((row) => ({
          sourceId: row.sourceId,
          portions: Number(row.portions),
        })),
      };
      const res = await fetch(
        mode === "edit" && orderId
          ? `/api/self-production-orders/${orderId}`
          : "/api/self-production-orders",
        {
          method: mode === "edit" ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "保存失败");
        return;
      }
      toast.success(mode === "edit" ? "更新成功" : "内部生产单已创建");
      onSaved();
    } catch {
      toast.error("保存出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <AppDialogContent
        size="workbench"
        className="[&>button]:cursor-pointer p-0 flex flex-col max-h-[calc(100dvh-24px)]"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-lg">
            {mode === "edit" ? "编辑内部生产单" : "内部生产单"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <FormField id="self-production-date" label="生产日期" required optionalHint={false}>
              <DatePicker
                value={produceDate}
                onChange={setProduceDate}
                placeholder="请选择生产日期"
                className="w-[240px]"
                showWeekday
              />
            </FormField>
            <FormField id="self-production-remark" label="备注" optionalHint={false}>
              <Input
                value={remark}
                onChange={(event) => setRemark(event.target.value)}
                placeholder="如：备货、临时加单"
                className="w-[280px]"
                maxLength={200}
              />
            </FormField>
          </div>

          {loadingDetail ? (
            <LoadingState type="list" rows={3} />
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-10">
              <div className="lg:col-span-4">
                <div className="flex flex-col rounded-lg border bg-card">
                  <div className="flex items-center justify-between border-b px-4 py-3">
                    <h4 className="text-sm font-semibold text-foreground">已选净料 / 小料</h4>
                    <span className="text-xs text-muted-foreground">
                      {picked.length} 种 · {totalPortions} 份
                    </span>
                  </div>
                  <div className="h-[360px] overflow-y-auto p-3">
                    {picked.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        请在右侧选择净料或小料
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {picked.map((row) => (
                          <li key={row.sourceId} className="rounded-md border px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{row.name}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  包装规格 {row.packageSpec ? `${row.packageSpec}g` : "缺失"}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  切配量{" "}
                                  <span className="font-medium tabular-nums text-foreground">
                                    {requiredQtyOf(row) != null ? `${requiredQtyOf(row)}g` : "—"}
                                  </span>
                                  <span className="mx-1.5">·</span>
                                  毛料需求{" "}
                                  <span className="font-medium tabular-nums text-foreground">
                                    {grossJinOf(row) != null ? `${grossJinOf(row)}斤` : "—"}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label={`减少 ${row.name} 份数`}
                                  onClick={() =>
                                    updatePortions(
                                      row.sourceId,
                                      String(Math.max(1, (Number(row.portions) || 1) - 1))
                                    )
                                  }
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input
                                  type="number"
                                  min={1}
                                  value={row.portions}
                                  onChange={(event) =>
                                    updatePortions(row.sourceId, event.target.value)
                                  }
                                  className="h-7 w-14 text-center font-mono"
                                  aria-label={`${row.name} 份数`}
                                />
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  aria-label={`增加 ${row.name} 份数`}
                                  onClick={() =>
                                    updatePortions(
                                      row.sourceId,
                                      String((Number(row.portions) || 0) + 1)
                                    )
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <span className="text-xs text-muted-foreground">份</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground"
                                  aria-label={`移除 ${row.name}`}
                                  onClick={() => removeRow(row.sourceId)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {!row.packageSpec && (
                              <p className="mt-1 text-xs text-destructive">
                                该净料缺少封装规格，无法纳入内部生产单
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="flex flex-col rounded-lg border bg-card">
                  <div className="space-y-2 border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="搜索净料名称或编号..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="w-full"
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        共 {pagination?.totalItems ?? options.length} 种
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <SelectField
                        value={l1Code}
                        onChange={(value) => {
                          setL1Code(value);
                          setL2Code("");
                          setPage(1);
                        }}
                        className="w-[150px]"
                        options={[
                          { value: "", label: "全部一级分类" },
                          ...categories.map((category) => ({
                            value: category.code,
                            label: category.name,
                          })),
                        ]}
                      />
                      <SelectField
                        value={l2Code}
                        onChange={(value) => {
                          setL2Code(value);
                          setPage(1);
                        }}
                        className="w-[160px]"
                        options={[
                          { value: "", label: "全部二级分类" },
                          ...l2Options,
                        ]}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setL1Code("");
                          setL2Code("");
                          setPage(1);
                        }}
                        className={l1Code || l2Code ? undefined : "invisible"}
                        aria-hidden={!(l1Code || l2Code)}
                        tabIndex={l1Code || l2Code ? undefined : -1}
                      >
                        清除
                      </Button>
                    </div>
                  </div>
                  <div className="h-[360px] p-3">
                    {loading ? (
                      <LoadingState type="list" rows={3} />
                    ) : options.length === 0 ? (
                      <p className="py-16 text-center text-sm text-muted-foreground">
                        没有匹配的净料或小料
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {options.map((option) => {
                          const added = pickedIds.has(option.id);
                          const missingPackage = !(option.packageSpec && option.packageSpec > 0);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={added}
                              className={
                                "relative rounded-md border p-2.5 text-left transition-colors " +
                                (added
                                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                                  : "hover:bg-muted/50")
                              }
                              onClick={() => addOption(option)}
                              disabled={added || missingPackage}
                            >
                              {added && (
                                <span className="absolute right-2 top-2 text-xs text-primary">
                                  已添加
                                </span>
                              )}
                              <div className="truncate pr-10 text-sm font-medium">
                                {option.name}
                              </div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                包装规格{" "}
                                {option.packageSpec ? `${option.packageSpec}g` : "缺失"}
                              </div>
                              {missingPackage && !added && (
                                <div className="mt-1 text-xs text-destructive">缺包装规格</div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {pagination && pagination.totalItems > OPTION_PAGE_SIZE && (
                    <div className="border-t px-4 py-2">
                      <Pagination
                        currentPage={page}
                        totalPages={pagination.totalPages}
                        onPageChange={setPage}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t px-6 pb-5 pt-4">
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {picked.length === 0
                ? "请至少选择一种净料或小料"
                : invalidRow
                  ? `「${invalidRow.name}」的份数或封装规格无效`
                  : `共 ${picked.length} 种 / ${totalPortions} 份`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="h-11 px-6"
              >
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit} className="h-11 px-6">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </div>
          </div>
        </DialogFooter>
      </AppDialogContent>
    </Dialog>
  );
}
