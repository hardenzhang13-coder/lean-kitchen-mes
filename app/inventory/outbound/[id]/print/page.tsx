"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatPortionsCount } from "@/lib/shared/prepped-stock";

interface PrintDetail {
  code: string;
  storeName: string;
  scheduleCode: string | null;
  scheduleTitle: string;
  scheduleDate: string;
  totalPortions: number;
  totalAmount: number;
  asPlanned: boolean;
  status: string;
  operator: string;
  items: {
    id: number;
    code: string | null;
    name: string;
    l1Name: string;
    l2Name: string;
    packageSpec: number | null;
    requiredPortions: number;
    shippedPortions: number;
    amount: number;
    pricePerJin: number | null;
    prepStatus: string;
    sortIndex: number;
  }[];
}

export default function OutboundPrintPage() {
  const params = useParams();
  const id = Number(params.id);
  const [data, setData] = useState<PrintDetail | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch("/api/outbound-orders/" + id)
      .then((res) => res.json())
      .then((json) => setData(json.data as PrintDetail))
      .catch(() => setData(null));
  }, [id]);

  if (!data) {
    return <div className="p-12 text-muted-foreground">加载中…</div>;
  }

  return (
    <div className="p-8 max-w-[900px] mx-auto print:p-2">
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          打印
        </Button>
      </div>
      <h1 className="text-xl font-bold mb-4">
        净菜出库单 {data.code}
        {data.status === "voided" && <span className="ml-2 text-red-600">（已作废）</span>}
      </h1>
      <p className="text-sm mb-1">
        门店：{data.storeName}　　来源排程：{data.scheduleCode}（{data.scheduleTitle}）
      </p>
      <p className="text-sm mb-4">
        生产日期：{new Date(data.scheduleDate).toLocaleDateString("zh-CN")}　　库管负责人：{data.operator}　　打印时间：{new Date().toLocaleString("zh-CN")}
      </p>
      <table className="w-full border-collapse text-sm" border={1}>
        <thead>
          <tr className="bg-muted/50">
            <th className="border border-border px-2 py-1.5 text-left">一级分类</th>
            <th className="border border-border px-2 py-1.5 text-left">二级分类</th>
            <th className="border border-border px-2 py-1.5 text-left">序号</th>
            <th className="border border-border px-2 py-1.5 text-left">名称</th>
            <th className="border border-border px-2 py-1.5 text-left">封装规格</th>
            <th className="border border-border px-2 py-1.5 text-right">计划份数</th>
            <th className="border border-border px-2 py-1.5 text-right">本次出库</th>
            <th className="border border-border px-2 py-1.5 text-right">行金额</th>
            <th className="border border-border px-2 py-1.5 text-left">状态</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it) => (
            <tr key={it.id}>
              <td className="border border-border px-2 py-1.5">{it.l1Name}</td>
              <td className="border border-border px-2 py-1.5">{it.l2Name}</td>
              <td className="border border-border px-2 py-1.5">{it.sortIndex}</td>
              <td className="border border-border px-2 py-1.5">{it.name}</td>
              <td className="border border-border px-2 py-1.5">{it.packageSpec} g/份</td>
              <td className="border border-border px-2 py-1.5 text-right">{formatPortionsCount(it.requiredPortions)}</td>
              <td className="border border-border px-2 py-1.5 text-right font-medium">{formatPortionsCount(it.shippedPortions)}</td>
              <td className="border border-border px-2 py-1.5 text-right">
                {it.pricePerJin != null ? "¥" + it.amount.toFixed(2) : "价缺失"}
              </td>
              <td className="border border-border px-2 py-1.5">
                {it.prepStatus === "unfinished" ? "未切配" : it.prepStatus === "insufficient" ? "量不足" : "正常"}
              </td>
            </tr>
          ))}
          <tr className="font-medium">
            <td className="border border-border px-2 py-1.5 text-right" colSpan={6}>合计</td>
            <td className="border border-border px-2 py-1.5 text-right">{formatPortionsCount(data.totalPortions)}</td>
            <td className="border border-border px-2 py-1.5 text-right">¥{data.totalAmount.toFixed(2)}</td>
            <td className="border border-border px-2 py-1.5">{data.asPlanned ? "按计划出库" : "未按计划出库"}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-8 text-sm">司机签字：＿＿＿＿＿＿＿＿　　门店收货人：＿＿＿＿＿＿＿＿</p>
    </div>
  );
}