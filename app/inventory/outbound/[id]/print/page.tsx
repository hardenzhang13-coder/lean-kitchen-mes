import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/server/session";
import { getOutboundOrderDetail } from "@/lib/server/outbound-detail";
import {
  formatPortionsValue,
  getOutboundDisplayStatus,
  OUTBOUND_STATUS_LABEL,
} from "@/lib/shared/prepped-stock";
import { PrintActions } from "./print-actions";

function fmtDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    " " +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes())
  );
}

const PRINT_CSS = [
  "* { box-sizing: border-box; margin: 0; padding: 0; }",
  "body { background: #fff; }",
  ".print-root { font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif; color: #18181b; padding: 24px; }",
  ".no-print { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }",
  ".no-print button { font-size: 14px; padding: 8px 22px; border-radius: 8px; border: 1px solid #e4e4e7; background: #fff; cursor: pointer; }",
  ".no-print button.primary { background: #ea580c; border-color: #ea580c; color: #fff; }",
  ".doc { max-width: 900px; margin: 0 auto 24px; border: 1px solid #e4e4e7; border-radius: 8px; padding: 32px 36px; background: #fff; }",
  ".doc-title { text-align: center; font-size: 20px; font-weight: 800; letter-spacing: 3px; margin-bottom: 4px; }",
  ".doc-sub { text-align: center; font-size: 12px; color: #71717a; margin-bottom: 18px; }",
  ".pm-meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px 20px; font-size: 12.5px; border-top: 2px solid #18181b; border-bottom: 1px solid #e4e4e7; padding: 10px 2px; margin-bottom: 12px; }",
  ".pm-meta span { min-width: 0; overflow-wrap: anywhere; }",
  "table { width: 100%; border-collapse: collapse; font-size: 12.5px; }",
  "thead { display: table-header-group; }",
  "tr { break-inside: avoid; page-break-inside: avoid; }",
  "th, td { border: 1px solid #d4d4d8; padding: 6px 8px; text-align: left; vertical-align: middle; }",
  "th { background: #fafafa; font-weight: 600; }",
  "td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }",
  "td.center, th.center { text-align: center; }",
  "tr.total td { background: #fafafa; font-weight: 700; }",
  ".sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; font-size: 12.5px; break-inside: avoid; page-break-inside: avoid; }",
  ".sign span { border-top: 1px solid #18181b; padding-top: 6px; }",
  "@media print { .no-print { display: none !important; } .print-root { padding: 0; } .doc { border: none; border-radius: 0; max-width: none; margin: 0; } body aside { display: none !important; } body main { margin-left: 0 !important; } }",
  "@page { size: A4; margin: 14mm 12mm; }",
].join(" ");

export default async function OutboundPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, currentUser] = await Promise.all([
    getOutboundOrderDetail(Number(id)),
    getCurrentUser(),
  ]);

  if (!detail) notFound();

  const printerName =
    currentUser?.name?.trim() || currentUser?.username?.trim() || "—";
  const outboundTime = fmtDateTime(new Date());
  const voided = detail.status === "voided";

  return (
    <div className="print-root">
      <style>{PRINT_CSS}</style>
      <div className="no-print">
        <PrintActions />
      </div>

      <div className="doc">
        <div className="doc-title">净 菜 出 库 单</div>
        <div className="doc-sub">
          精益厨房 · 门店净菜出库凭证（{detail.scheduleTitle}）
          {voided ? " · 已作废" : ""}
        </div>

        <div className="pm-meta">
          <span>
            门店：<b>{detail.storeName}</b>
          </span>
          <span>
            排程单：<b>{detail.scheduleTitle || "—"}</b>
          </span>
          <span>
            单号：<b>{detail.code}</b>
          </span>
          <span>
            出库时间：<b>{outboundTime}</b>
          </span>
          <span>
            库管负责人：<b>{printerName}</b>
          </span>
        </div>

        <table>
          <thead>
            <tr>
              <th className="center" style={{ width: 42 }}>序号</th>
              <th>一级分类</th>
              <th>二级分类</th>
              <th>名称</th>
              <th>封装规格（份）</th>
              <th className="num">计划出库数（份）</th>
              <th className="num">本次出库数（份）</th>
              <th className="num">金额</th>
              <th className="center">出库状态</th>
            </tr>
          </thead>
          <tbody>
            {detail.items.map((item, index) => {
              const status = getOutboundDisplayStatus(
                item.requiredPortions,
                item.shippedPortions
              );
              return (
                <tr key={item.id}>
                  <td className="center">{index + 1}</td>
                  <td>{item.l1Name}</td>
                  <td>{item.l2Name}</td>
                  <td>{item.name}</td>
                  <td>{item.packageSpec != null ? `${item.packageSpec} g/份` : "—"}</td>
                  <td className="num">{formatPortionsValue(item.requiredPortions)}</td>
                  <td className="num">{formatPortionsValue(item.shippedPortions)}</td>
                  <td className="num">
                    {item.pricePerJin != null ? `¥${item.amount.toFixed(2)}` : "价缺失"}
                  </td>
                  <td className="center">{OUTBOUND_STATUS_LABEL[status]}</td>
                </tr>
              );
            })}
            <tr className="total">
              <td colSpan={6} className="num">
                合计
              </td>
              <td className="num">{formatPortionsValue(detail.totalPortions)}</td>
              <td className="num">¥{detail.totalAmount.toFixed(2)}</td>
              <td className="center">
                {detail.asPlanned ? "按计划出库" : "未按计划出库"}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="sign">
          <span>库管负责人：{printerName}</span>
          <span>司机签字：＿＿＿＿＿＿</span>
          <span>门店收货人：＿＿＿＿＿＿</span>
        </div>
      </div>
    </div>
  );
}
