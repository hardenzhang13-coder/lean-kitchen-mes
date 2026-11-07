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
import { formatWeight } from "@/lib/shared/weight-format";
import { downloadCSV } from "@/lib/client/csv";

export interface CuttingOrderRow {
  id: number;
  sourceType: string;
  sourceId: number;
  itemName: string;
  l1Name: string;
  l2Name: string;
  spec: string | null;
  requiredQty: number;
  unit: string;
  portions: number | null;
}

/** 单头信息（打印 / 导出用） */
export interface ScheduleDocMeta {
  title: string;
  scheduleDate: string;
  storeName: string;
  scheduleId: number;
}

interface ScheduleCuttingTableProps {
  rows: CuttingOrderRow[];
  meta: ScheduleDocMeta;
}

export function ScheduleCuttingTable({ rows, meta }: ScheduleCuttingTableProps) {
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
      ["单号", "SCH-" + String(meta.scheduleId).padStart(4, "0")],
      ["打印时间", new Date().toLocaleString("zh-CN")],
      [],
    ];
    const headers = ["一级分类", "二级分类", "编号", "名称", "规格", "切配量", "计量单位", "切配份数"];
    const data = rows.map((r) => [
      r.l1Name,
      r.l2Name,
      r.sourceType === "net" ? "NET-" + r.sourceId : "MIN-" + r.sourceId,
      r.itemName,
      r.spec || "",
      String(r.requiredQty),
      r.unit,
      r.portions != null ? String(r.portions) : "",
    ]);
    downloadCSV("切配工单.csv", [...headerRows, headers, ...data]);
  };

  const handlePrint = () => {
    window.open("/schedules/" + meta.scheduleId + "/print?doc=cutting", "_blank");
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
              <TableHead className="text-right">切配量</TableHead>
              <TableHead>计量单位</TableHead>
              <TableHead className="text-right">切配份数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const prev = rows[i - 1];
              const showL1 = !prev || prev.l1Name !== row.l1Name;
              const showL2 = !prev || prev.l1Name !== row.l1Name || prev.l2Name !== row.l2Name;
              return (
                <TableRow key={row.id}>
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
                  <TableCell className="font-mono text-xs">
                    {row.sourceType === "net" ? "NET-" + row.sourceId : "MIN-" + row.sourceId}
                  </TableCell>
                  <TableCell className="font-medium">{row.itemName}</TableCell>
                  <TableCell>{row.spec || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right">{formatWeight(Number(row.requiredQty))}</TableCell>
                  <TableCell>{row.unit}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">{row.portions ?? "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
