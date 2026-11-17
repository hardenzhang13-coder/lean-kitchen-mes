"use client";

import { Download } from "lucide-react";
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
import type { SelfProductionItemDetail } from "./types";

interface SelfProductionItemsTableProps {
  items: SelfProductionItemDetail[];
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/** 内部生产单明细表：与排程菜单/生产计划明细同构（汇总条 + 表格 + 合计行 + CSV）。 */
export function SelfProductionItemsTable({ items }: SelfProductionItemsTableProps) {
  const totalPortions = round2(items.reduce((sum, item) => sum + item.portions, 0));
  const totalRequiredQty = round2(
    items.reduce((sum, item) => sum + (item.requiredQty ?? 0), 0)
  );
  const totalGrossJin = round2(
    items.reduce((sum, item) => sum + (item.grossNeedJin ?? 0), 0)
  );

  const handleDownload = () => {
    const headerRows = [["内部生产单明细"], []];
    const headers = [
      "序号",
      "编号",
      "名称",
      "一级分类",
      "二级分类",
      "包装规格（g）",
      "份数",
      "切配量（g）",
      "毛料需求（斤）",
    ];
    const data = items.map((item, index) => [
      String(index + 1),
      item.itemCode,
      item.itemName,
      item.l1Name,
      item.l2Name,
      item.packageSpec != null ? String(item.packageSpec) : "",
      String(item.portions),
      item.requiredQty != null ? String(item.requiredQty) : "",
      item.grossNeedJin != null ? String(item.grossNeedJin) : "",
    ]);
    const totalRow = [
      "",
      "合计",
      "",
      "",
      "",
      "",
      String(totalPortions),
      String(totalRequiredQty),
      String(totalGrossJin),
    ];
    downloadCSV("内部生产单明细.csv", [...headerRows, headers, ...data, totalRow]);
  };

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-medium">生产明细</h4>
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            总份数 <b className="text-foreground">{totalPortions}</b>
          </span>
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            切配量 <b className="text-foreground">{totalRequiredQty}g</b>
          </span>
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            毛料需求 <b className="text-foreground">{totalGrossJin}斤</b>
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload} disabled={items.length === 0}>
          <Download className="mr-1 h-4 w-4" />
          下载 CSV
        </Button>
      </div>
      <div className="max-w-full overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>序号</TableHead>
              <TableHead>编号</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>分类</TableHead>
              <TableHead className="text-right">包装规格</TableHead>
              <TableHead className="text-right">份数</TableHead>
              <TableHead className="text-right">切配量（g）</TableHead>
              <TableHead className="text-right">毛料需求（斤）</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={item.id} className="transition-colors hover:bg-muted/40">
                <TableCell>{index + 1}</TableCell>
                <TableCell className="font-mono text-xs">{item.itemCode}</TableCell>
                <TableCell className="font-medium">{item.itemName}</TableCell>
                <TableCell>
                  {item.l1Name} / {item.l2Name}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.packageSpec != null ? `${item.packageSpec}g` : "—"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {item.portions}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.requiredQty != null ? item.requiredQty : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {item.grossNeedJin != null ? item.grossNeedJin : "—"}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50">
              <TableCell colSpan={5} className="text-right font-medium">
                合计
              </TableCell>
              <TableCell className="text-right font-bold">{totalPortions}</TableCell>
              <TableCell className="text-right font-bold">{totalRequiredQty}</TableCell>
              <TableCell className="text-right font-bold">{totalGrossJin}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
