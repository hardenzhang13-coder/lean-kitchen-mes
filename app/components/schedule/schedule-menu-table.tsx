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
import type { ScheduleDocMeta } from "./schedule-cutting-table";

export interface ScheduleMenuItem {
  id: number;
  quantity: number;
  dish: {
    id: number;
    code: string;
    name: string;
    portion: string;
    meatType: string | null;
    cost: number | null;
    price: number | null;
    category: { name: string } | null;
  };
}

interface ScheduleMenuTableProps {
  items: ScheduleMenuItem[];
  meta: ScheduleDocMeta;
}

export function ScheduleMenuTable({ items, meta }: ScheduleMenuTableProps) {
  const totalQty = items.reduce((s, it) => s + it.quantity, 0);
  const totalCost = items.reduce((s, it) => s + (Number(it.dish.cost) || 0) * it.quantity, 0);
  const totalSales = items.reduce((s, it) => s + (Number(it.dish.price) || 0) * it.quantity, 0);
  const grossMargin =
    totalSales > 0 ? (((totalSales - totalCost) / totalSales) * 100).toFixed(1) + "%" : "—";

  const handleDownload = () => {
    const headerRows = [
      ["排程菜单"],
      ["排程标题", meta.title],
      ["门店", meta.storeName],
      ["生产日期", new Date(meta.scheduleDate).toLocaleDateString("zh-CN")],
      [],
    ];
    const headers = [
      "序号", "菜品名称", "份量", "荤素", "菜品编号",
      "数量（份）", "成本/份", "成本小计", "售价/份", "计划销售额",
    ];
    const data = items.map((it, idx) => [
      String(idx + 1),
      it.dish.name,
      it.dish.portion,
      it.dish.meatType || "",
      it.dish.code,
      String(it.quantity),
      it.dish.cost != null ? Number(it.dish.cost).toFixed(2) : "",
      (Number(it.dish.cost) || 0) * it.quantity > 0 || it.dish.cost != null
        ? ((Number(it.dish.cost) || 0) * it.quantity).toFixed(2)
        : "",
      it.dish.price != null ? Number(it.dish.price).toFixed(2) : "",
      it.dish.price != null ? ((Number(it.dish.price) || 0) * it.quantity).toFixed(2) : "",
    ]);
    const totalRow = [
      "", "合计", "", "", "", String(totalQty), "",
      totalCost.toFixed(2), "", totalSales.toFixed(2),
    ];
    downloadCSV("排程菜单.csv", [...headerRows, headers, ...data, totalRow]);
  };

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-medium text-sm">排程菜单</h4>
          <span className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
            总份数 <b className="text-foreground">{totalQty}</b>
          </span>
          <span className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
            成本合计 <b className="text-foreground">¥{totalCost.toFixed(2)}</b>
          </span>
          <span className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-1">
            计划销售额 <b className="text-foreground">¥{totalSales.toFixed(2)}</b>
          </span>
          <span className="text-xs text-muted-foreground bg-muted rounded-md px-2 py-1" title="预计毛利率 =（计划销售额 − 成本合计）÷ 计划销售额 × 100%">
            预计毛利率 <b className="text-foreground">{grossMargin}</b>
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1 h-4 w-4" />
          下载 CSV
        </Button>
      </div>
      <div className="min-w-0 max-w-full overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>序号</TableHead>
              <TableHead>菜品名称</TableHead>
              <TableHead>份量</TableHead>
              <TableHead>荤素</TableHead>
              <TableHead>菜品编号</TableHead>
              <TableHead className="text-right">数量（份）</TableHead>
              <TableHead className="text-right">成本/份</TableHead>
              <TableHead className="text-right">成本小计</TableHead>
              <TableHead className="text-right">售价/份</TableHead>
              <TableHead className="text-right">计划销售额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => {
              const cost = Number(item.dish.cost) || 0;
              const price = Number(item.dish.price) || 0;
              return (
                <TableRow key={item.id} className="transition-colors hover:bg-muted/40">
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="font-medium">{item.dish.name}</TableCell>
                  <TableCell>{item.dish.portion}</TableCell>
                  <TableCell>{item.dish.meatType || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{item.dish.code}</TableCell>
                  <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.dish.cost != null ? "¥" + cost.toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-right">{item.dish.cost != null ? "¥" + (cost * item.quantity).toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-right">{item.dish.price != null ? "¥" + price.toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    {item.dish.price != null ? "¥" + (price * item.quantity).toFixed(2) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/50">
              <TableCell colSpan={5} className="text-right font-medium">合计</TableCell>
              <TableCell className="text-right font-bold">{totalQty}</TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right font-bold">¥{totalCost.toFixed(2)}</TableCell>
              <TableCell></TableCell>
              <TableCell className="text-right font-bold text-primary">¥{totalSales.toFixed(2)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
