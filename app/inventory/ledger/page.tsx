"use client";

import { useEffect, useState } from "react";
import { BookOpen, Search, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/app/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { DatePicker } from "@/app/components/date-picker";
import { toast } from "sonner";

interface LedgerItem {
  id: number;
  sourceId: number;
  name: string;
  code: string;
  changeQty: number;
  unit: string;
  balance: number;
}

interface LedgerGroup {
  key: string;
  type: string;
  source: string;
  changeTime: string;
  operator: string | null;
  operatorName?: string | null;
  settlementStatus: string;
  itemCount: number;
  totalQty: number;
  receiptId?: number;
  receiptDate?: string;
  receiptSummary?: string;
  receiptTotalAmount?: number;
  receiptOperator?: string;
  receiptOperatorName?: string | null;
  items: LedgerItem[];
}

export default function LedgerPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detailGroup, setDetailGroup] = useState<LedgerGroup | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/inventory/ledger?${params.toString()}`);
      const data = await res.json();
      setGroups(data);
    } catch {
      toast.error("获取台账数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, typeFilter]);

  const filtered = groups.filter((g) => {
    const matchSearch = !search
      ? true
      : (g.receiptSummary && g.receiptSummary.toLowerCase().includes(search.toLowerCase())) ||
        g.source.toLowerCase().includes(search.toLowerCase()) ||
        (g.operatorName && g.operatorName.toLowerCase().includes(search.toLowerCase())) ||
        (g.operator && g.operator.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter ? true : g.settlementStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* 顶部：标题 + 二级菜单 */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="库存台账"
          description="按采购单/出库单维度查询库存流水"
        />
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            className="px-4 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => router.push("/inventory")}
          >
            实时库存
          </button>
          <button className="px-4 py-1.5 rounded-md text-sm font-medium bg-background shadow-sm">
            库存台账
          </button>
        </div>
      </div>

      {/* 筛选区 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索来源摘要或负责人..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <DatePicker
              value={startDate}
              onChange={(v) => setStartDate(v)}
              placeholder="开始日期"
              className="w-[180px]"
            />
            <span className="text-sm text-muted-foreground">至</span>
            <DatePicker
              value={endDate}
              onChange={(v) => setEndDate(v)}
              placeholder="结束日期"
              className="w-[180px]"
            />
            <Select value={typeFilter} onValueChange={(v) => v && setTypeFilter(v)}>
              <SelectTrigger className="w-[120px] h-10">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="入库">入库</SelectItem>
                <SelectItem value="出库">出库</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
              <SelectTrigger className="w-[120px] h-10">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="待结算">待结算</SelectItem>
                <SelectItem value="已结算">已结算</SelectItem>
              </SelectContent>
            </Select>
            {(search || startDate || endDate || typeFilter || statusFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStartDate("");
                  setEndDate("");
                  setTypeFilter("");
                  setStatusFilter("");
                }}
              >
                清除
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[300px] bg-muted rounded animate-pulse" />
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>暂无台账记录</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>类型</TableHead>
                    <TableHead>来源/摘要</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead>食材种数</TableHead>
                    <TableHead>总数量</TableHead>
                    <TableHead>结算状态</TableHead>
                    <TableHead>负责人</TableHead>
                    <TableHead className="w-[80px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => (
                    <TableRow key={g.key} className="hover:bg-muted/40">
                      <TableCell>
                        <StatusBadge status={g.type} />
                      </TableCell>
                      <TableCell className="font-medium max-w-[300px]">
                        {g.receiptSummary || g.source}
                      </TableCell>
                      <TableCell>{formatDateTime(g.changeTime)}</TableCell>
                      <TableCell>{g.itemCount} 种</TableCell>
                      <TableCell>
                        {g.type === "入库" ? "+" : "-"}
                        {g.totalQty.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={g.settlementStatus} />
                      </TableCell>
                      <TableCell>
                        {g.receiptOperatorName || g.operatorName || g.receiptOperator || g.operator || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailGroup(g)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          明细
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 明细弹窗 */}
      <Dialog
        open={!!detailGroup}
        onOpenChange={(open) => !open && setDetailGroup(null)}
      >
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {detailGroup?.type === "入库" && detailGroup?.receiptId
                ? `采购单 #${detailGroup.receiptId} 明细`
                : `${detailGroup?.source} 明细`}
            </DialogTitle>
          </DialogHeader>
          {detailGroup && (
            <div className="px-6 pb-6 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">类型：</span>
                  <StatusBadge status={detailGroup.type} />
                </div>
                <div>
                  <span className="text-muted-foreground">日期：</span>
                  <span>{formatDateTime(detailGroup.changeTime)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">负责人：</span>
                  <span>
                    {detailGroup.receiptOperatorName || detailGroup.operatorName || detailGroup.receiptOperator || detailGroup.operator || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">结算状态：</span>
                  <StatusBadge status={detailGroup.settlementStatus} />
                </div>
                {detailGroup.receiptTotalAmount != null && (
                  <div>
                    <span className="text-muted-foreground">采购金额：</span>
                    <span className="font-semibold">
                      ¥{Number(detailGroup.receiptTotalAmount).toFixed(2)}
                    </span>
                  </div>
                )}
                {detailGroup.receiptSummary && (
                  <div className="col-span-3">
                    <span className="text-muted-foreground">摘要：</span>
                    <span>{detailGroup.receiptSummary}</span>
                  </div>
                )}
              </div>

              {/* 明细表格 */}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>食材名称</TableHead>
                      <TableHead>变动量</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>结存</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailGroup.items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground text-xs">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          {detailGroup.type === "入库" ? "+" : "-"}
                          {Number(item.changeQty).toFixed(2)}
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell className="font-semibold">
                          {Number(item.balance).toFixed(2)} {item.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDetailGroup(null)}
                >
                  关闭
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
