"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCSV } from "@/lib/client/csv";
import type { ScheduleDocMeta } from "./schedule-cutting-table";

export interface PurchasePlanRow {
  id?: number;
  sourceType: string;
  sourceId: number;
  sourceCode: string | null;
  itemName: string;
  l1Name: string;
  l2Name: string;
  grossNeed: number;
  /** 库存扣减（斤）；null = 未做库存抵扣（如生产计划单，库存模块改版中） */
  stockDeducted: number | null;
  suggestedPurchase: number;
  unit: string;
  purchaseSpec: string | null;
  priceUnit: string | null;
  supplierName: string | null;
  estimatedAmount: number | null;
}

/** 克 → 斤（1斤 = 500g），保留 2 位小数 */
function toJin(grams: number): string {
  return (grams / 500).toFixed(2);
}

interface SchedulePurchaseTableProps {
  rows: PurchasePlanRow[];
  meta: ScheduleDocMeta;
}

export function SchedulePurchaseTable({ rows, meta }: SchedulePurchaseTableProps) {
  const l1Span = new Map<string, number>();
  const l2Span = new Map<string, number>();
  for (const r of rows) {
    l1Span.set(r.l1Name, (l1Span.get(r.l1Name) ?? 0) + 1);
    const key = r.l1Name + "|" + r.l2Name;
    l2Span.set(key, (l2Span.get(key) ?? 0) + 1);
  }

  const totalAmount = rows.reduce((s, r) => s + (r.estimatedAmount ?? 0), 0);
  const dateText = new Date(meta.scheduleDate).toLocaleDateString("zh-CN");

  const handleDownload = () => {
    const headerRows = [
      ["采购计划单"],
      ["排程标题", meta.title],
      ["收货单位", "净菜加工中心（统一采购，与门店无关）"],
      ["生产日期", dateText],
      ["单号", meta.code ?? "SCH-" + String(meta.scheduleId).padStart(4, "0")],
      ["打印时间", new Date().toLocaleString("zh-CN")],
      [],
    ];
    const headers = ["序号", "食材名称", "采购规格", "毛料用量（斤）", "库存扣减", "采购量", "采购单位"];
    const data = rows.map((r, idx) => [
      String(idx + 1),
      r.itemName,
      r.purchaseSpec || "",
      toJin(r.grossNeed),
      r.stockDeducted != null ? "-" + Number(r.stockDeducted).toFixed(2) : "",
      "", // 采购量：纸质单手写实际采购量
      r.priceUnit || r.unit,
    ]);
    downloadCSV("采购计划单.csv", [...headerRows, headers, ...data]);
  };

  const printAll = () => {
    window.open((meta.printBase ?? "/schedules/") + meta.scheduleId + "/print?doc=purchase&mode=all", "_blank");
  };
  const printBySupplier = () => {
    window.open((meta.printBase ?? "/schedules/") + meta.scheduleId + "/print?doc=purchase&mode=supplier", "_blank");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">采购计划明细</h4>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="mr-1 h-4 w-4" />
            下载 CSV
          </Button>
          <Button variant="outline" size="sm" onClick={printAll}>
            <Printer className="mr-1 h-4 w-4" />
            打印采购单（全部）
          </Button>
          <Button variant="outline" size="sm" onClick={printBySupplier}>
            <Printer className="mr-1 h-4 w-4" />
            按供应商打印
          </Button>
        </div>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">一级分类</TableHead>
              <TableHead className="w-[100px]">二级分类</TableHead>
              <TableHead>编号</TableHead>
              <TableHead>食材名称</TableHead>
              <TableHead>采购规格</TableHead>
              <TableHead className="text-right">毛料需求（斤）</TableHead>
              <TableHead className="text-right">库存扣减</TableHead>
              <TableHead className="text-right">建议采购量</TableHead>
              <TableHead>采购单位</TableHead>
              <TableHead>供应商</TableHead>
              <TableHead className="text-right">预估金额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const prev = rows[i - 1];
              const showL1 = !prev || prev.l1Name !== row.l1Name;
              const showL2 = !prev || prev.l1Name !== row.l1Name || prev.l2Name !== row.l2Name;
              const zero = row.suggestedPurchase <= 0;
              return (
                <TableRow
                  key={row.id ?? `${row.sourceType}:${row.sourceId}`}
                  className={(zero ? "text-muted-foreground " : "") + "transition-colors hover:bg-muted/40"}
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
                  <TableCell className="font-medium">
                    {zero ? row.itemName + "（库存充足）" : row.itemName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {row.purchaseSpec || "—"}
                  </TableCell>
                  <TableCell className="text-right">{toJin(row.grossNeed)}</TableCell>
                  <TableCell className="text-right" title={row.stockDeducted != null ? "" : "库存模块改版中，暂不抵扣"}>{row.stockDeducted != null ? "-" + toJin(Number(row.stockDeducted)) : "—"}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {row.suggestedPurchase > 0 ? row.suggestedPurchase.toLocaleString("zh-CN") : "0"}
                  </TableCell>
                  <TableCell>{row.priceUnit || row.unit}</TableCell>
                  <TableCell>{row.supplierName || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right">
                    {row.estimatedAmount != null ? "¥" + row.estimatedAmount.toFixed(2) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/50">
              <TableCell colSpan={10} className="text-right font-medium">
                合计（{rows.length} 项）
              </TableCell>
              <TableCell className="text-right font-bold">
                {totalAmount > 0 ? "¥" + totalAmount.toFixed(2) : "—"}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
