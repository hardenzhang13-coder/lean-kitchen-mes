"use client";

import { useEffect, useState } from "react";
import { Plus, FileText, Search, Eye, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { toast } from "sonner";

interface ReceiptItem {
  id: number;
  ingredientId: number | null;
  itemName: string;
  spec: string | null;
  qty: number;
  priceUnit: string;
  unitPrice: number;
  amount: number;
  stockUnit: string;
  stockInQty: number;
  storage: string;
  ingredient: { id: number; name: string; code: string } | null;
}

interface Receipt {
  id: number;
  receiptDate: string;
  summary: string | null;
  totalAmount: number;
  operator: string | null;
  createdAt: string;
  isSettled: boolean;
  items: ReceiptItem[];
}

export default function PurchasesPage() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detailReceipt, setDetailReceipt] = useState<Receipt | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/purchase-receipts?${params.toString()}`);
      const data = await res.json();
      setReceipts(data);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const filtered = receipts.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (r.summary && r.summary.toLowerCase().includes(s)) ||
      (r.operator && r.operator.toLowerCase().includes(s)) ||
      String(r.id).includes(s)
    );
  });

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/purchase-receipts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("采购单已删除");
      setDeleteId(null);
      fetchData();
    } catch {
      toast.error("删除出错");
    }
  };

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
      {/* 顶部：标题 + 二级菜单 + 操作按钮 */}
      <div className="flex items-center justify-between">
        <PageHeader
          title="采购管理"
          description="管理采购单与采购报销"
        />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button className="px-4 py-1.5 rounded-md text-sm font-medium bg-background shadow-sm">
              采购单
            </button>
            <button
              className="px-4 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => router.push("/purchases/reimbursements")}
            >
              采购报销
            </button>
          </div>
          <Button onClick={() => router.push("/purchases/new")}>
            <Plus className="mr-2 h-4 w-4" />
            录入采购单
          </Button>
        </div>
      </div>

      {/* 筛选区 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索摘要或负责人..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[150px] h-11 cursor-pointer"
            />
            <span className="text-sm text-muted-foreground">至</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[150px] h-11 cursor-pointer"
            />
            {(startDate || endDate || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSearch("");
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
              <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>暂无采购单</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/purchases/new")}
              >
                录入第一单
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>采购日期</TableHead>
                    <TableHead>采购单摘要</TableHead>
                    <TableHead>总金额</TableHead>
                    <TableHead>负责人</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="w-[120px] text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">#{r.id}</TableCell>
                      <TableCell>{formatDateTime(r.receiptDate)}</TableCell>
                      <TableCell>{r.summary || "—"}</TableCell>
                      <TableCell className="font-semibold">
                        ¥{Number(r.totalAmount).toFixed(2)}
                      </TableCell>
                      <TableCell>{r.operator || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailReceipt(r)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          详情
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

      {/* 详情弹窗 */}
      <Dialog
        open={!!detailReceipt}
        onOpenChange={(open) => !open && setDetailReceipt(null)}
      >
        <DialogContent className="sm:max-w-[1400px] max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>采购单详情 #{detailReceipt?.id}</DialogTitle>
          </DialogHeader>
          {detailReceipt && (
            <div className="px-6 pb-6 space-y-4">
              {/* 基本信息 */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">采购日期：</span>
                  <span>{formatDateTime(detailReceipt.receiptDate)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">负责人：</span>
                  <span>{detailReceipt.operator || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">总金额：</span>
                  <span className="font-semibold">
                    ¥{Number(detailReceipt.totalAmount).toFixed(2)}
                  </span>
                </div>
                <div className="col-span-3">
                  <span className="text-muted-foreground">摘要：</span>
                  <span>{detailReceipt.summary || "—"}</span>
                </div>
              </div>

              {/* 明细表格 */}
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>食材名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>金额</TableHead>
                      <TableHead>入库量</TableHead>
                      <TableHead>储存</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailReceipt.items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground text-xs">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.ingredient?.name || item.itemName}
                        </TableCell>
                        <TableCell>{item.spec || "—"}</TableCell>
                        <TableCell>
                          {item.qty}
                          {item.priceUnit}
                        </TableCell>
                        <TableCell>
                          ¥{Number(item.unitPrice).toFixed(2)}/{item.priceUnit}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ¥{Number(item.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {item.stockInQty}
                          {item.stockUnit}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs">
                            {item.storage}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDetailReceipt(null)}
                >
                  关闭
                </Button>
                {!detailReceipt.isSettled && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setDetailReceipt(null);
                      setDeleteId(detailReceipt.id);
                    }}
                  >
                    删除采购单
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            确定要删除采购单 #{deleteId} 吗？此操作将同步回滚库存，不可撤销。
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
