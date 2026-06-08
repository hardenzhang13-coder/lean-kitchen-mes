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
import { formatWeight } from "@/app/lib/schedule-utils";

interface CuttingOrder {
  id: number;
  sourceType: string;
  sourceId: number;
  itemName: string;
  l1Code: string | null;
  l2Code: string | null;
  l1Name: string;
  l2Name: string;
  requiredQty: number;
  unit: string;
  actualQty: number | null;
}

interface ScheduleCuttingTableProps {
  rows: CuttingOrder[];
  editable?: boolean;
  onChange?: (id: number, actualQty: number | null) => void;
}

export function ScheduleCuttingTable({ rows, editable, onChange }: ScheduleCuttingTableProps) {
  // 按一级分类 → 二级分类分组，计算 rowspan
  const l1Groups = new Map<string, CuttingOrder[]>();
  for (const row of rows) {
    const key = row.l1Code || "other";
    if (!l1Groups.has(key)) l1Groups.set(key, []);
    l1Groups.get(key)!.push(row);
  }

  const processed: Array<CuttingOrder & { l1Rowspan: number; l2Rowspan: number }> = [];
  for (const [, l1Rows] of l1Groups) {
    const l2Groups = new Map<string, CuttingOrder[]>();
    for (const row of l1Rows) {
      const key = row.l2Code || "other";
      if (!l2Groups.has(key)) l2Groups.set(key, []);
      l2Groups.get(key)!.push(row);
    }

    let l1First = true;
    for (const [, l2Rows] of l2Groups) {
      let l2First = true;
      for (const row of l2Rows) {
        processed.push({
          ...row,
          l1Rowspan: l1First ? l1Rows.length : 0,
          l2Rowspan: l2First ? l2Rows.length : 0,
        });
        l1First = false;
        l2First = false;
      }
    }
  }

  const handleDownload = () => {
    const headers = ["一级分类", "二级分类", "编号", "名称", "切配量", "实际切配量", "计量单位"];
    const data = processed.map((r) => [
      r.l1Name,
      r.l2Name,
      r.sourceType === "net" ? `NET-${r.sourceId}` : `MIN-${r.sourceId}`,
      r.itemName,
      formatWeight(Number(r.requiredQty)),
      r.actualQty != null ? formatWeight(Number(r.actualQty)) : "",
      r.unit,
    ]);
    const csv = [headers, ...data]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `切配工单.csv`;
    link.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">切配工单明细</h4>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1 h-4 w-4" />
          下载 CSV
        </Button>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">一级分类</TableHead>
              <TableHead className="w-[120px]">二级分类</TableHead>
              <TableHead>编号</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>切配量</TableHead>
              <TableHead>实际切配量</TableHead>
              <TableHead>计量单位</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processed.map((row) => (
              <TableRow key={row.id}>
                {row.l1Rowspan > 0 && (
                  <TableCell rowSpan={row.l1Rowspan} className="font-medium bg-muted/30">
                    {row.l1Name}
                  </TableCell>
                )}
                {row.l2Rowspan > 0 && (
                  <TableCell rowSpan={row.l2Rowspan} className="text-muted-foreground bg-muted/20">
                    {row.l2Name}
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs">
                  {row.sourceType === "net" ? `NET-${row.sourceId}` : `MIN-${row.sourceId}`}
                </TableCell>
                <TableCell className="font-medium">{row.itemName}</TableCell>
                <TableCell>{formatWeight(Number(row.requiredQty))}</TableCell>
                <TableCell>
                  {editable ? (
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={row.actualQty ?? ""}
                      className="w-24 h-8 rounded-md border border-input bg-background px-2 text-sm"
                      onBlur={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        onChange?.(row.id, val);
                      }}
                    />
                  ) : (
                    <span className="text-muted-foreground">
                      {row.actualQty != null ? formatWeight(Number(row.actualQty)) : "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell>{row.unit}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
