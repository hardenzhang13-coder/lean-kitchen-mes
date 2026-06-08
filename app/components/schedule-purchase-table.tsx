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

interface PurchasePlan {
  id: number;
  sourceType: string;
  sourceId: number;
  itemName: string;
  l2Code: string | null;
  l2Name: string;
  grossNeed: number;
  suggestedPurchase: number;
  unit: string;
  purchaseSpec: string | null;
  priceUnit: string | null;
  actualPurchase: number | null;
  actualAmount: number | null;
}

interface SchedulePurchaseTableProps {
  rows: PurchasePlan[];
  editable?: boolean;
  onChange?: (id: number, field: "actualPurchase" | "actualAmount", value: number | null) => void;
}

export function SchedulePurchaseTable({ rows, editable, onChange }: SchedulePurchaseTableProps) {
  const handleDownload = () => {
    const headers = [
      "编号", "名称", "计划采购量", "计量单位", "实际采购量", "采购规格",
      "计价单位", "采购金额", "二级分类",
    ];
    const data = rows.map((r) => [
      `${r.sourceType.toUpperCase()}-${r.sourceId}`,
      r.itemName,
      Number(r.suggestedPurchase).toFixed(2),
      r.unit,
      r.actualPurchase != null ? Number(r.actualPurchase).toFixed(2) : "",
      r.purchaseSpec || "—",
      r.priceUnit || "—",
      r.actualAmount != null ? Number(r.actualAmount).toFixed(2) : "",
      r.l2Name,
    ]);
    const csv = [headers, ...data]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `采购计划单.csv`;
    link.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">采购计划明细</h4>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-1 h-4 w-4" />
          下载 CSV
        </Button>
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>编号</TableHead>
              <TableHead>名称</TableHead>
              <TableHead>计划采购量</TableHead>
              <TableHead>计量单位</TableHead>
              <TableHead>实际采购量</TableHead>
              <TableHead>采购规格</TableHead>
              <TableHead>计价单位</TableHead>
              <TableHead>采购金额</TableHead>
              <TableHead>二级分类</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">
                  {row.sourceType.toUpperCase()}-{row.sourceId}
                </TableCell>
                <TableCell className="font-medium">{row.itemName}</TableCell>
                <TableCell>{Number(row.suggestedPurchase).toFixed(2)}</TableCell>
                <TableCell>{row.unit}</TableCell>
                <TableCell>
                  {editable ? (
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={row.actualPurchase ?? ""}
                      className="w-24 h-8 rounded-md border border-input bg-background px-2 text-sm"
                      onBlur={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        onChange?.(row.id, "actualPurchase", val);
                      }}
                    />
                  ) : (
                    <span className="text-muted-foreground">
                      {row.actualPurchase != null ? Number(row.actualPurchase).toFixed(2) : "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {row.purchaseSpec || "—"}
                </TableCell>
                <TableCell>{row.priceUnit || "—"}</TableCell>
                <TableCell>
                  {editable ? (
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={row.actualAmount ?? ""}
                      className="w-24 h-8 rounded-md border border-input bg-background px-2 text-sm"
                      onBlur={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        onChange?.(row.id, "actualAmount", val);
                      }}
                    />
                  ) : (
                    <span className="text-muted-foreground">
                      {row.actualAmount != null ? `¥${Number(row.actualAmount).toFixed(2)}` : "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell>{row.l2Name}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
