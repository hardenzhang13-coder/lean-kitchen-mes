"use client";

import { useMemo, useState } from "react";
import {
  Dialog, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/app/components/ui/form-controls";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { formatPortionsCount, round2, rowConfirmStatus, type PlanCuttingRow } from "@/lib/shared/prepped-stock";
import { formatWeight } from "@/lib/shared/weight-format";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { EmptyState } from "@/app/components/ui/empty-state";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuSearch } from "@/app/components/ui/skeu-search";
import { SkeuSegmented } from "@/app/components/ui/skeu-segmented";

type RowStatus = "completed" | "unfinished" | "hold";

interface WorkRow {
  key: string;
  row: PlanCuttingRow;
  status: RowStatus;
  portions: number;
  remark: string;
}

interface CompleteProductionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: number;
  rows: PlanCuttingRow[];
  onCompleted: () => void;
}

const STATUS_OPTIONS: Array<{ value: RowStatus; label: string }> = [
  { value: "completed", label: "完成" },
  { value: "unfinished", label: "未完成" },
  { value: "hold", label: "暂不确认" },
];

/** 完成切配确认：按份逐行确认（完成/未完成/暂不确认），提交后净菜自动入库 */
export function CompleteProductionDialog({ open, onOpenChange, planId, rows, onCompleted }: CompleteProductionDialogProps) {
  const [workRows, setWorkRows] = useState<WorkRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  // props 变化时重置本地状态：按 React 官方建议在渲染期调整，
  // 避免在 effect 中同步 setState 造成级联渲染。
  const [syncedOpen, setSyncedOpen] = useState(open);
  const [syncedRows, setSyncedRows] = useState(rows);
  if (open !== syncedOpen || rows !== syncedRows) {
    setSyncedOpen(open);
    setSyncedRows(rows);
    if (open) {
      const pendings = rows.filter((r) => rowConfirmStatus(r) === "pending");
      setWorkRows(
        pendings.map((r) => ({
          key: `${r.sourceType}:${r.sourceId}`,
          row: r,
          status: "completed" as RowStatus,
          portions: r.portions ?? 0,
          remark: "",
        }))
      );
    }
  }

  const doneRows = useMemo(() => rows.filter((r) => rowConfirmStatus(r) !== "pending"), [rows]);

  const summary = useMemo(() => {
    let inKinds = 0, inP = 0, inG = 0, undone = 0, hold = 0;
    for (const w of workRows) {
      if (w.status === "completed") {
        inKinds++;
        inP += Number(w.portions) || 0;
        inG += (Number(w.portions) || 0) * (w.row.packageSpec ?? 0);
      } else if (w.status === "unfinished") undone++;
      else hold++;
    }
    return { inKinds, inP: round2(inP), inG: round2(inG), undone, hold };
  }, [workRows]);

  const update = (key: string, patch: Partial<WorkRow>) => {
    setWorkRows((ws) => ws.map((w) => (w.key === key ? { ...w, ...patch } : w)));
  };

  const normalizedSearch = search.trim().toLowerCase();
  const visibleRows = normalizedSearch
    ? workRows.filter(
        (w) =>
          w.row.itemName.toLowerCase().includes(normalizedSearch) ||
          w.row.sourceCode.toLowerCase().includes(normalizedSearch)
      )
    : workRows;

  const submit = async () => {
    for (const w of workRows) {
      if (w.status === "completed") {
        const p = Number(w.portions);
        if (Number.isNaN(p) || p < 0) {
          toast.error(`${w.row.itemName} 请填写有效的实际完成份数`);
          return;
        }
        if (!w.row.packageSpec || w.row.packageSpec <= 0) {
          toast.error(`${w.row.itemName} 缺少封装规格，无法按份入库`);
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/production-plans/${planId}/complete`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: workRows.map((w) => ({
            sourceKey: w.key,
            status: w.status,
            actualPortions: w.status === "completed" ? Number(w.portions) : undefined,
            remark: w.status === "unfinished" && w.remark.trim() ? w.remark.trim() : undefined,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "提交失败");
        return;
      }
      toast.success(
        `已入库 ${formatPortionsCount(json.data.inPortions)}` +
          (json.data.status === "已完成" ? "，本计划单全部确认完成" : "，尚有切配行待确认")
      );
      onOpenChange(false);
      onCompleted();
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="workbench"
        className="flex h-[min(780px,calc(100dvh-24px))] flex-col p-0 [&>button]:cursor-pointer"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle className="text-lg">完成切配确认</DialogTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            按<b>份</b>逐行确认当日切配（跨店合并口径）：默认全部「完成」，实际完成份数可改小（支持部分完成）；
            没切完改为「未完成」并标注原因；「暂不确认」保持待切配、留到下次确认（支持分批提交）。
            提交后净菜<b>自动入库</b>（份 + g 双单位）。
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto bg-[linear-gradient(180deg,#fcfbfa,#fbf9f6)] px-5 py-4">
          {workRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <SkeuSearch
                value={search}
                onChange={setSearch}
                placeholder="搜索净料名称或编号..."
                className="w-[240px]"
                aria-label="搜索待确认净料"
              />
              {normalizedSearch && (
                <span className="text-xs text-muted-foreground">
                  显示 {visibleRows.length} / {workRows.length} 行（提交仍覆盖全部待确认行）
                </span>
              )}
            </div>
          )}

          {workRows.length === 0 ? (
            <EmptyState
              title="没有待确认的切配行"
              description="当前计划单的切配行均已确认，无需重复提交。"
              className="py-10"
            />
          ) : (
            <div className="overflow-x-auto rounded-[var(--sk-radius-md)] border border-skeu-border bg-[linear-gradient(180deg,#fff,#fdfcfb)] shadow-sk-raised">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>一级分类</TableHead>
                    <TableHead>二级分类</TableHead>
                    <TableHead>编号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>封装规格</TableHead>
                    <TableHead className="text-right">计划份数</TableHead>
                    <TableHead className="text-right">计划量</TableHead>
                    <TableHead className="text-right">实际完成份数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>备注</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((w) => (
                    <TableRow key={w.key} className={"transition-colors " + (w.status === "unfinished" ? "bg-[var(--status-danger-bg)]" : "hover:bg-muted/40")}>
                      <TableCell className="font-medium">{w.row.l1Name}</TableCell>
                      <TableCell className="text-muted-foreground">{w.row.l2Name}</TableCell>
                      <TableCell className="font-mono text-xs">{w.row.sourceCode}</TableCell>
                      <TableCell className="font-medium">{w.row.itemName}</TableCell>
                      <TableCell className="text-muted-foreground">{w.row.packageSpec ?? "—"} g/份</TableCell>
                      <TableCell className="text-right font-medium">{formatPortionsCount(w.row.portions ?? 0)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatWeight(w.row.requiredQty)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          disabled={w.status !== "completed"}
                          className="skeu-input inline-block w-20 text-right"
                          value={w.status === "completed" ? String(w.portions) : ""}
                          onChange={(e) => update(w.key, { portions: e.target.value === "" ? 0 : Number(e.target.value) })}
                        /> <span className="text-xs text-muted-foreground">份</span>
                      </TableCell>
                      <TableCell>
                        <SkeuSegmented
                          value={w.status}
                          onChange={(st) =>
                            update(w.key, {
                              status: st,
                              portions: st === "completed" ? (w.row.portions ?? 0) : w.portions,
                            })
                          }
                          options={STATUS_OPTIONS}
                          ariaLabel={`${w.row.itemName} 确认状态`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          disabled={w.status !== "unfinished"}
                          placeholder="未完成原因（选填）"
                          className="skeu-input w-[140px]"
                          value={w.remark}
                          onChange={(e) => update(w.key, { remark: e.target.value })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[var(--sk-radius-md)] border border-skeu-border bg-[linear-gradient(180deg,#fff,#fdfcfb)] px-4 py-3 text-sm shadow-sk-raised">
            <span>本次入库 <b className="text-[var(--status-success)]">{summary.inKinds}</b> 种 / 共 <b className="text-[var(--status-success)]">{formatPortionsCount(summary.inP)}</b>（{formatWeight(summary.inG)}）</span>
            <span>未完成 <b className="text-[var(--status-danger)]">{summary.undone}</b> 种</span>
            <span>暂不确认 <b>{summary.hold}</b> 种（留待下次）</span>
          </div>

          {doneRows.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary>已确认 {doneRows.length} 行（只读）</summary>
              <div className="mt-2 space-y-1">
                {doneRows.map((r) => (
                  <div key={`${r.sourceType}:${r.sourceId}`}>
                    · {r.sourceCode} {r.itemName} —{" "}
                    {rowConfirmStatus(r) === "completed"
                      ? `已完成 ${formatPortionsCount(r.actualPortions ?? 0)}`
                      : `未完成${r.remark ? `（${r.remark}）` : ""}`}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <DialogFooter className="border-t bg-[linear-gradient(180deg,#fff,#fdfcfb)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <SkeuButton variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </SkeuButton>
            <SkeuButton onClick={submit} disabled={submitting || workRows.length === 0}>
              {submitting ? "提交中…" : "提交并入库"}
            </SkeuButton>
          </div>
        </DialogFooter>
      </AppDialogContent>
    </Dialog>
  );
}
