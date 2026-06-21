"use client";

import { useEffect, useState } from "react";
import { Plus, FileText, Search, Eye, Trash2, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DatePicker } from "@/app/components/date-picker";
import { ImagePreviewModal } from "@/app/components/image-preview-modal";
import { CategoryTag } from "@/app/components/category-tag";
import { DataTable } from "@/app/components/data-table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/app/components/status-badge";

interface ReceiptItem {
  id: number;
  ingredientId: number | null;
  seasoningIngredientId: number | null;
  itemName: string;
  brand: string | null;
  spec: string | null;
  qty: number;
  purchaseUnit: string;
  unitPrice: number;
  amount: number;
  stockUnit: string;
  stockInQty: number;
  l2Code: string | null;
  l2Name: string | null;
  isManual: boolean;
  ingredient: { id: number; name: string; code: string } | null;
  seasoningIngredient: { id: number; name: string; code: string } | null;
}

interface Receipt {
  id: number;
  receiptDate: string;
  summary: string | null;
  totalAmount: number;
  operator: string | null;
  operatorName?: string | null;
  supplierName?: string | null;
  purchasingUnit: string;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  isSettled: boolean;
  items: ReceiptItem[];
}

const statusTabs = [
  { key: "待结算", label: "待结算" },
  { key: "已结算", label: "已结算" },
  { key: "已作废", label: "已作废" },
  { key: "", label: "全部" },
];

export default function PurchasesPage() {
  const router = useRouter();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("待结算");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [detailReceipt, setDetailReceipt] = useState<Receipt | null>(null);
  const [voidId, setVoidId] = useState<number | null>(null);
  const [forceDeleteId, setForceDeleteId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (status) params.set("status", status);
      if (search.trim()) params.set("q", search.trim());
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/purchase-receipts?${params.toString()}`);
      const data = await res.json();
      setReceipts(data.data || []);
      setTotalCount(data.pagination?.totalItems || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    fetchData();
  }, [startDate, endDate, status, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, status]);

  const handleVoid = async (id: number) => {
    try {
      const res = await fetch(`/api/purchase-receipts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "作废失败");
        return;
      }
      toast.success("采购单已作废");
      setVoidId(null);
      setDetailReceipt(null);
      fetchData();
    } catch {
      toast.error("作废出错");
    }
  };

  const handleForceDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/purchase-receipts/${id}?force=true`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "删除失败");
        return;
      }
      toast.success("采购单已彻底删除");
      setForceDeleteId(null);
      setDetailReceipt(null);
      fetchData();
    } catch {
      toast.error("删除出错");
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
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
      <div className="flex items-center justify-between">
        <PageHeader title="采购管理" description="管理采购单与采购报销" />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-muted rounded-md p-1">
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

      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              status === tab.key
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setStatus(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索摘要、供应商或操作人..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Label className="text-sm text-muted-foreground">创建时间</Label>
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
            {(startDate || endDate || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSearch("");
                  setPage(1);
                }}
              >
                清除
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataTable<Receipt>
            data={receipts}
            loading={loading}
            columns={[
              { header: "编号", cell: (r) => <span className="font-medium">#{r.id}</span> },
              { header: "状态", cell: (r) => <StatusBadge status={r.status} /> },
              { header: "采购单位", accessorKey: "purchasingUnit" },
              { header: "采购单摘要", accessorKey: "summary" },
              { header: "采购日期", cell: (r) => formatDate(r.receiptDate) },
              { header: "供应商", cell: (r) => r.supplierName || "—" },
              {
                header: "总金额",
                cell: (r) => (
                  <span className="font-semibold">
                    ¥{Number(r.totalAmount).toFixed(2)}
                  </span>
                ),
              },
              { header: "操作人", cell: (r) => r.operatorName || r.operator || "—" },
              {
                header: "创建时间",
                cell: (r) => (
                  <span className="text-muted-foreground text-sm">
                    {formatDateTime(r.createdAt)}
                  </span>
                ),
              },
            ]}
            pagination={
              totalCount > 0
                ? {
                    currentPage: page,
                    totalPages,
                    totalItems: totalCount,
                    pageSize,
                    onPageChange: setPage,
                  }
                : undefined
            }
            emptyState={{
              icon: FileText,
              title: "暂无采购单",
              action: {
                label: "录入第一单",
                onClick: () => router.push("/purchases/new"),
              },
            }}
            rowActions={(r) => (
              <>
                {r.status === "待结算" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="编辑"
                    onClick={() => router.push(`/purchases/new?id=${r.id}`)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title="查看详情"
                  onClick={() => setDetailReceipt(r)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {r.status === "待结算" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="作废"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setVoidId(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {r.status === "已作废" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="彻底删除"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setForceDeleteId(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          />
        </CardContent>
      </Card>

      {/* 详情弹窗 */}
      <Dialog
        open={!!detailReceipt}
        onOpenChange={(open) => !open && setDetailReceipt(null)}
      >
        <DialogContent className="sm:max-w-[1100px] w-full max-w-[calc(100%-2rem)] h-[calc(100vh-2rem)] max-h-[900px] p-0 flex flex-col overflow-hidden [&>button]:cursor-pointer">
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base">
                采购单详情 #{detailReceipt?.id}
                {detailReceipt && <StatusBadge status={detailReceipt.status} />}
                {detailReceipt?.status === "待结算" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setVoidId(detailReceipt.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    作废
                  </Button>
                )}
                {detailReceipt?.status === "已作废" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => setForceDeleteId(detailReceipt.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    彻底删除
                  </Button>
                )}
              </DialogTitle>
            </div>
          </DialogHeader>
          {detailReceipt && (
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4 p-5 overflow-hidden">
              {/* 左侧 */}
              <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
                <div className="rounded-md border p-4 space-y-3 shrink-0">
                  <h4 className="font-medium text-sm">基础信息</h4>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">采购日期：</span>
                      <span>{formatDate(detailReceipt.receiptDate)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">供应商：</span>
                      <span>{detailReceipt.supplierName || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">采购单位：</span>
                      <span>{detailReceipt.purchasingUnit || "—"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">操作人：</span>
                      <span>
                        {detailReceipt.operatorName ||
                          detailReceipt.operator ||
                          "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">创建时间：</span>
                      <span>{formatDateTime(detailReceipt.createdAt)}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">摘要：</span>
                      <span>{detailReceipt.summary || "—"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">总金额：</span>
                      <span className="font-semibold text-base">
                        ¥{Number(detailReceipt.totalAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {detailReceipt.imageUrl && (
                  <div className="rounded-md border p-3 space-y-2 shrink-0">
                    <h4 className="font-medium text-sm">采购单图片</h4>
                    <div
                      className="h-[140px] rounded-md bg-muted/50 flex items-center justify-center cursor-pointer overflow-hidden"
                      onClick={() => setPreviewImage(detailReceipt.imageUrl)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={detailReceipt.imageUrl}
                        alt="采购单"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧明细 */}
              <div className="rounded-md border flex flex-col min-h-0 overflow-hidden">
                <h4 className="font-medium text-sm px-4 py-3 border-b shrink-0">
                  采购明细（{detailReceipt.items.length} 项）
                </h4>
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>分类</TableHead>
                        <TableHead>食材名称</TableHead>
                        <TableHead>规格</TableHead>
                        <TableHead>采购数量</TableHead>
                        <TableHead>金额</TableHead>
                        <TableHead>入库</TableHead>
                        <TableHead>单价</TableHead>
                        <TableHead>来源</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailReceipt.items.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground text-xs">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <CategoryTag
                              l2Code={item.l2Code}
                              name={item.l2Name || item.l2Code || "—"}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.ingredient?.name ||
                              item.seasoningIngredient?.name ||
                              item.itemName}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.spec || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {item.qty}
                            {item.purchaseUnit}
                          </TableCell>
                          <TableCell className="font-semibold whitespace-nowrap text-sm">
                            ¥{Number(item.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {item.stockInQty}
                            {item.stockUnit}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            ¥
                            {item.stockInQty > 0
                              ? (item.amount / item.stockInQty).toFixed(2)
                              : "0.00"}
                            /{item.stockUnit}
                          </TableCell>
                          <TableCell className="text-xs">
                            {item.isManual ? (
                              <StatusBadge status="手动" />
                            ) : (
                              <StatusBadge status="AI" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 作废确认弹窗 */}
      <Dialog open={voidId !== null} onOpenChange={() => setVoidId(null)}>
        <DialogContent className="sm:max-w-[400px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle>确认作废</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            确定要作废采购单 #{voidId} 吗？此操作将同步回滚库存，不可撤销。
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setVoidId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => voidId && handleVoid(voidId)}
            >
              确认作废
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 彻底删除确认弹窗 */}
      <Dialog
        open={forceDeleteId !== null}
        onOpenChange={() => setForceDeleteId(null)}
      >
        <DialogContent className="sm:max-w-[400px] [&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle>确认彻底删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            确定要彻底删除采购单 #{forceDeleteId} 吗？此操作将物理删除采购单及明细记录，不可恢复。
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setForceDeleteId(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => forceDeleteId && handleForceDelete(forceDeleteId)}
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImagePreviewModal
        src={previewImage || ""}
        open={!!previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
