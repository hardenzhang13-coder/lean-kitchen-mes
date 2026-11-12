"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCSV } from "@/lib/client/csv";
import {
  formatPortionsCount,
  type PlanCuttingConfirmStatus,
} from "@/lib/shared/prepped-stock";
import { calculatePrepLabelCopies } from "@/lib/shared/prep-label";

export interface CuttingOrderRow {
  id?: number;
  sourceType: string;
  sourceId: number;
  sourceCode: string | null;
  /** 包装规格（g，净料档案）：切配份数 = 切配量 ÷ 包装规格 */
  packageSpec: number | null;
  /** 切配份数展示（如「1 份 + 300 g」「零配 800 g」「2 份」） */
  portionsText: string | null;
  /** 毛料用量（斤）：经来源原料关联采购计划（打印/导出用） */
  grossNeedJin: number | null;
  itemName: string;
  l1Name: string;
  l2Name: string;
  spec: string | null;
  requiredQty: number;
  unit: string;
  portions: number | null;
  confirmStatus?: PlanCuttingConfirmStatus;
  actualPortions?: number | null;
  remark?: string | null;
}

/** 单头信息（打印 / 导出用） */
export interface ScheduleDocMeta {
  title: string;
  scheduleDate: string;
  storeName: string;
  scheduleId: number;
  /** 排程编号（SCH-日期-序号），创建时落库 */
  code?: string | null;
  /** 打印路由前缀：门店排程 /schedules/，生产计划单 /production-plans/ */
  printBase?: string;
}

interface ScheduleCuttingTableProps {
  rows: CuttingOrderRow[];
  meta: ScheduleDocMeta;
  showConfirmColumns?: boolean;
  /** 生产计划单切配表：开启行级净菜标签打印 */
  enableLabelPrint?: boolean;
}

export function ScheduleCuttingTable({
  rows,
  meta,
  showConfirmColumns = false,
  enableLabelPrint = false,
}: ScheduleCuttingTableProps) {
  const [printRow, setPrintRow] = useState<CuttingOrderRow | null>(null);
  const [printCopies, setPrintCopies] = useState("1");
  const [printError, setPrintError] = useState("");

  const l1Span = new Map<string, number>();
  const l2Span = new Map<string, number>();
  for (const r of rows) {
    l1Span.set(r.l1Name, (l1Span.get(r.l1Name) ?? 0) + 1);
    const key = r.l1Name + "|" + r.l2Name;
    l2Span.set(key, (l2Span.get(key) ?? 0) + 1);
  }

  const dateText = new Date(meta.scheduleDate).toLocaleDateString("zh-CN");

  const handleDownload = () => {
    const headerRows = [
      ["切配工单"],
      ["排程标题", meta.title],
      ["门店", meta.storeName],
      ["生产日期", dateText],
      ["单号", meta.code ?? "SCH-" + String(meta.scheduleId).padStart(4, "0")],
      ["打印时间", new Date().toLocaleString("zh-CN")],
      [],
    ];
    const headers = ["序号", "名称", "切配份数", "净料用量", "毛料用量（斤）", "完成状态"];
    const data = rows.map((r, idx) => [
      String(idx + 1),
      r.itemName,
      r.portionsText || "",
      Number(r.requiredQty) + " g",
      r.grossNeedJin != null ? r.grossNeedJin.toFixed(2) : "",
      "", // 完成状态：纸质单手写打钩
    ]);
    downloadCSV("切配工单.csv", [...headerRows, headers, ...data]);
  };

  const handlePrint = () => {
    window.open((meta.printBase ?? "/schedules/") + meta.scheduleId + "/print?doc=cutting", "_blank");
  };

  const openLabelPrint = (row: CuttingOrderRow) => {
    const maxCopies =
      row.packageSpec == null
        ? 0
        : calculatePrepLabelCopies(row.requiredQty, row.packageSpec);
    if (maxCopies <= 0) return;
    setPrintRow(row);
    setPrintCopies("1");
    setPrintError("");
  };

  const confirmLabelPrint = () => {
    if (!printRow || printRow.packageSpec == null) return;
    const maxCopies = calculatePrepLabelCopies(printRow.requiredQty, printRow.packageSpec);
    const copies = Number(printCopies);
    if (!Number.isInteger(copies) || copies <= 0 || copies > maxCopies) {
      setPrintError(`请输入 1-${maxCopies} 之间的整数`);
      return;
    }

    const query = new URLSearchParams({
      sourceType: printRow.sourceType,
      sourceId: String(printRow.sourceId),
      copies: String(copies),
    });
    window.open(
      `/production-plans/${meta.scheduleId}/labels?${query.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
    setPrintRow(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">切配工单明细</h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-1 h-4 w-4" />
            下载 CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1 h-4 w-4" />
            打印切配单
          </Button>
        </div>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">一级分类</TableHead>
              <TableHead className="w-[110px]">二级分类</TableHead>
              <TableHead>编号</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>规格</TableHead>
              <TableHead className="text-right" title="计划份数 = 净料用量 ÷ 包装规格（净料档案）">计划份数</TableHead>
              <TableHead className="text-right">净料用量</TableHead>
              {showConfirmColumns && (
                <>
                  <TableHead className="text-right">实际完成份数</TableHead>
                  <TableHead>确认结果</TableHead>
                  <TableHead>备注</TableHead>
                </>
              )}
              {enableLabelPrint && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const prev = rows[i - 1];
              const showL1 = !prev || prev.l1Name !== row.l1Name;
              const showL2 = !prev || prev.l1Name !== row.l1Name || prev.l2Name !== row.l2Name;
              const confirmStatus = row.confirmStatus ?? "pending";
              return (
                <TableRow
                  key={row.id ?? `${row.sourceType}:${row.sourceId}`}
                  className={
                    "transition-colors hover:bg-muted/40 " +
                    (showConfirmColumns && confirmStatus === "unfinished" ? "bg-red-50/70" : "")
                  }
                >
                  {showL1 && (
                    <TableCell rowSpan={l1Span.get(row.l1Name)} className="font-medium bg-muted/30">
                      {row.l1Name}
                    </TableCell>
                  )}
                  {showL2 && (
                    <TableCell rowSpan={l2Span.get(row.l1Name + "|" + row.l2Name)} className="text-muted-foreground bg-muted/20">
                      {row.l2Name}
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-xs">{row.sourceCode || "—"}</TableCell>
                  <TableCell className="font-medium">{row.itemName}</TableCell>
                  <TableCell>{row.packageSpec != null ? row.packageSpec + "g" : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{row.portionsText || "—"}</TableCell>
                  <TableCell className="text-right">{Number(row.requiredQty).toLocaleString("zh-CN")} g</TableCell>
                  {showConfirmColumns && (
                    <>
                      <TableCell className="text-right">
                        {confirmStatus === "pending"
                          ? "—"
                          : formatPortionsCount(row.actualPortions ?? 0)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            "inline-flex rounded-md px-2 py-0.5 text-xs font-medium " +
                            (confirmStatus === "completed"
                              ? "bg-[var(--status-success-bg)] text-[var(--status-success)]"
                              : confirmStatus === "unfinished"
                                ? "bg-[var(--status-danger-bg)] text-[var(--status-danger)]"
                                : "bg-[var(--status-neutral-bg)] text-[var(--status-neutral)]")
                          }
                        >
                          {confirmStatus === "completed"
                            ? "已完成"
                            : confirmStatus === "unfinished"
                              ? "未完成"
                              : "待确认"}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.remark || "—"}
                      </TableCell>
                    </>
                  )}
                  {enableLabelPrint && (() => {
                    const maxCopies =
                      row.packageSpec == null
                        ? 0
                        : calculatePrepLabelCopies(row.requiredQty, row.packageSpec);
                    return (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openLabelPrint(row)}
                          disabled={maxCopies <= 0}
                          title={
                            maxCopies > 0
                              ? `打印 ${row.itemName} 的净菜标签`
                              : "缺少有效包装规格，无法打印标签"
                          }
                        >
                          <Printer className="mr-1 h-4 w-4" />
                          打印标签
                        </Button>
                      </TableCell>
                    );
                  })()}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={printRow !== null} onOpenChange={(open) => !open && setPrintRow(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg">打印净菜标签</DialogTitle>
          </DialogHeader>
          {printRow && (() => {
            const maxCopies =
              printRow.packageSpec == null
                ? 0
                : calculatePrepLabelCopies(printRow.requiredQty, printRow.packageSpec);
            return (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">{printRow.itemName}</p>
                  <p className="mt-1 text-muted-foreground">
                    包装规格：{printRow.packageSpec}g · 本行共 {maxCopies} 张
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="label-print-copies" className="text-sm font-medium">
                    本次打印数量
                  </label>
                  <Input
                    id="label-print-copies"
                    type="number"
                    min={1}
                    max={maxCopies}
                    step={1}
                    value={printCopies}
                    onChange={(event) => {
                      setPrintCopies(event.target.value);
                      setPrintError("");
                    }}
                    className="h-11 text-base"
                  />
                  {printError ? (
                    <p className="text-xs text-destructive">{printError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">默认打印 1 张，最多 {maxCopies} 张</p>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintRow(null)}>取消</Button>
            <Button onClick={confirmLabelPrint}>
              <Printer className="mr-2 h-4 w-4" />
              进入打印
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
