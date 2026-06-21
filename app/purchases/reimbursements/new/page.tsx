"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/app/components/date-picker";
import { toast } from "sonner";

interface Receipt {
  id: number;
  receiptDate: string;
  summary: string;
  totalAmount: number;
  operator: string;
}

export default function NewReimbursementPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/purchase-receipts?${params.toString()}`);
      const data = await res.json();
      setReceipts(data.data || []);
    } catch {
      toast.error("获取采购单失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [startDate, endDate]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalAmount = receipts
    .filter((r) => selectedIds.has(r.id))
    .reduce((s, r) => s + Number(r.totalAmount), 0);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("请填写报销主题");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("请至少选择一张采购单");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/purchase-reimbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          summary: summary || null,
          receiptIds: Array.from(selectedIds),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "创建失败");
        return;
      }
      toast.success("报销单创建成功");
      router.push("/purchases/reimbursements");
    } catch {
      toast.error("提交出错");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="返回报销列表" onClick={() => router.push("/purchases/reimbursements")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">创建采购报销</h1>
            <p className="text-sm text-muted-foreground">选择需要报销的采购单，生成费用报销表单</p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={submitting}>
          <span aria-live="polite" className="inline-flex items-center">
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            生成报销单
          </span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧表单 */}
        <div className="space-y-4 rounded-lg border p-4 h-fit">
          <h3 className="font-medium">报销信息</h3>
          <div className="space-y-2">
            <Label>报销主题 <span className="text-destructive">*</span></Label>
            <Input
              placeholder="如：2024年6月食材采购报销"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>摘要</Label>
            <Textarea
              placeholder="填写报销摘要..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
            />
          </div>
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">已选采购单</span>
              <span className="font-medium">{selectedIds.size} 张</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">合计金额</span>
              <span className="font-bold text-lg">¥{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* 右侧采购单选择 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">选择采购单</span>
            <div className="flex items-center gap-2 ml-auto">
              <DatePicker
                value={startDate}
                onChange={(v) => setStartDate(v)}
                placeholder="开始日期"
                className="w-[160px]"
              />
              <span className="text-sm text-muted-foreground">至</span>
              <DatePicker
                value={endDate}
                onChange={(v) => setEndDate(v)}
                placeholder="结束日期"
                className="w-[160px]"
              />
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); }}>
                  清除
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="h-[300px] bg-muted rounded animate-pulse" />
          ) : receipts.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 border border-dashed rounded-lg">
              <p>该时间范围内暂无采购单</p>
            </div>
          ) : (
            <div className="space-y-2">
              {receipts.map((r) => {
                const selected = selectedIds.has(r.id);
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                      selected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleSelect(r.id)}
                  >
                    {selected ? (
                      <CheckSquare className="h-5 w-5 text-primary shrink-0" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">采购单 #{r.id}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(r.receiptDate).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {r.summary || "无摘要"} · 负责人：{r.operator || "—"}
                      </div>
                    </div>
                    <div className="font-semibold shrink-0">
                      ¥{Number(r.totalAmount).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
