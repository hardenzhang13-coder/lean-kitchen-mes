import { notFound } from "next/navigation";
import { getScheduleDetail, gramsToJin } from "@/lib/server/schedule-detail";
import { PrintActions } from "./print-actions";

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN") + "（" + WEEKDAYS[d.getDay()] + "）";
}

function fmtTime(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
}

type Detail = NonNullable<Awaited<ReturnType<typeof getScheduleDetail>>>;
type PurchaseRow = Detail["purchasePlans"][number];

const PRINT_CSS = "* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { background: #fff; }\n.print-root { font-family: \"PingFang SC\", \"Microsoft YaHei\", system-ui, sans-serif; color: #18181b; padding: 24px; }\n.no-print { display: flex; gap: 10px; justify-content: center; margin-bottom: 20px; }\n.no-print button { font-size: 14px; padding: 8px 22px; border-radius: 8px; border: 1px solid #e4e4e7; background: #fff; cursor: pointer; }\n.no-print button.primary { background: #ea580c; border-color: #ea580c; color: #fff; }\n.doc { max-width: 900px; margin: 0 auto 24px; border: 1px solid #e4e4e7; border-radius: 8px; padding: 32px 36px; background: #fff; }\n.doc-title { text-align: center; font-size: 20px; font-weight: 800; letter-spacing: 3px; margin-bottom: 4px; }\n.doc-sub { text-align: center; font-size: 12px; color: #71717a; margin-bottom: 18px; }\n.pm-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 20px; font-size: 12.5px; border-top: 2px solid #18181b; border-bottom: 1px solid #e4e4e7; padding: 10px 2px; margin-bottom: 12px; }\ntable { width: 100%; border-collapse: collapse; font-size: 12.5px; }\nth, td { border: 1px solid #d4d4d8; padding: 6px 8px; text-align: left; }\nth { background: #fafafa; font-weight: 600; }\ntd.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }\ntr.grp td { font-weight: 600; background: #fafafa; }\ntr.total td { font-weight: 700; background: #fafafa; }\n.sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; font-size: 12.5px; }\n.sign span { border-top: 1px solid #18181b; padding-top: 6px; }\n.doc-note { font-size: 12px; color: #71717a; margin-top: 16px; line-height: 1.7; }\n@media print { .no-print { display: none !important; } .print-root { padding: 0; } .doc { border: none; border-radius: 0; max-width: none; margin: 0; page-break-after: always; } .doc:last-child { page-break-after: auto; } }\n@page { size: A4; margin: 14mm 12mm; } @media print { body aside { display: none !important; } body main { margin-left: 0 !important; } }";

export default async function SchedulePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ doc?: string; mode?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const doc = sp.doc === "purchase" ? "purchase" : "cutting";
  const bySupplier = doc === "purchase" && sp.mode === "supplier";
  const detail = await getScheduleDetail(Number(id));
  if (!detail) notFound();

  const scheduleNo = detail.code ?? "SCH-" + String(detail.id).padStart(4, "0");
  const printTime = fmtTime(new Date());

  return (
    <div className="print-root">
      <style>{PRINT_CSS}</style>

      <div className="no-print">
        <PrintActions />
      </div>

      {doc === "cutting" && (
        <div className="doc">
          <div className="doc-title">切 配 工 单</div>
          <div className="doc-sub">精益厨房 · 切配加工中心执行单据（{detail.title}）</div>
          <div className="pm-meta">
            <span>收货单位：<b>净菜加工中心</b></span>
            <span>生产日期：<b>{fmtDate(detail.scheduleDate)}</b></span>
            <span>单号：<b>{scheduleNo}</b></span>
            <span>打印时间：<b>{printTime}</b></span>
          </div>
          <table>
            <thead>
              <tr>
                <th className="w-10">序号</th>
                <th>名称</th>
                <th className="num">切配份数</th>
                <th className="num">净料用量</th>
                <th className="num">毛料用量（斤）</th>
                <th className="w-16 text-center">完成状态</th>
              </tr>
            </thead>
            <tbody>
              {detail.cuttingOrders.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>{c.itemName}</td>
                  <td className="num">{c.portionsText || "—"}</td>
                  <td className="num">{c.requiredQty.toLocaleString("zh-CN")} g</td>
                  <td className="num">{c.grossNeedJin != null ? c.grossNeedJin.toFixed(2) : "—"}</td>
                  <td className="text-center text-base leading-none">☐</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sign">
            <span>制单：{detail.operatorName || detail.operator || "—"}</span>
            <span>切配组长签字：＿＿＿＿＿＿</span>
            <span>完成时间：＿＿月＿＿日 ＿＿:＿＿</span>
          </div>
        </div>
      )}

      {doc === "purchase" && !bySupplier && (
        <div className="doc">
          <div className="doc-title">采 购 计 划 单</div>
          <div className="doc-sub">精益厨房 · 全部采购明细（统一采购至净菜加工中心，{detail.title}）</div>
          <div className="pm-meta">
            <span>收货单位：<b>净菜加工中心</b></span>
            <span>生产日期：<b>{fmtDate(detail.scheduleDate)}</b></span>
            <span>单号：<b>{scheduleNo}</b></span>
            <span>打印时间：<b>{printTime}</b></span>
          </div>
          <PurchaseTable rows={detail.purchasePlans} />
          <div className="sign">
            <span>制单：{detail.operatorName || detail.operator || "—"}</span>
            <span>采购员签字：＿＿＿＿＿＿</span>
            <span>验收 / 入库：＿＿＿＿＿＿</span>
          </div>
        </div>
      )}

      {doc === "purchase" && bySupplier &&
        (() => {
          const groups = new Map<string, Detail["purchasePlans"]>();
          for (const p of detail.purchasePlans) {
            const key = p.supplierName || "未指定供应商";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(p);
          }
          return [...groups.entries()].map(([supplier, rows], gi) => (
            <div className="doc" key={supplier}>
              <div className="doc-title">采 购 计 划 单</div>
              <div className="doc-sub">
                精益厨房 · 按供应商拆单（{gi + 1}/{groups.size}，{detail.title}）
              </div>
              <div className="pm-meta">
                <span>供应商：<b>{supplier}</b></span>
                <span>收货单位：<b>净菜加工中心</b></span>
                <span>生产日期：<b>{fmtDate(detail.scheduleDate)}</b></span>
                <span>单号：<b>{scheduleNo + "-S" + (gi + 1)}</b></span>
              </div>
              <PurchaseTable rows={rows} />
              <div className="sign">
                <span>制单：{detail.operatorName || detail.operator || "—"}</span>
                <span>采购员签字：＿＿＿＿＿＿</span>
                <span>供应商送货签字：＿＿＿＿＿＿</span>
              </div>
            </div>
          ));
        })()}
    </div>
  );
}

function PurchaseTable({ rows }: { rows: PurchaseRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th className="w-10">序号</th>
          <th>食材名称</th>
          <th>采购规格</th>
          <th className="num">毛料用量（斤）</th>
          <th className="num">库存扣减</th>
          <th className="num w-24">采购量</th>
          <th>采购单位</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p, i) => {
          const zero = p.suggestedPurchase <= 0;
          return (
            <tr key={p.id} style={zero ? { color: "#a1a1aa" } : undefined}>
              <td>{i + 1}</td>
              <td>{zero ? p.itemName + "（库存充足）" : p.itemName}</td>
              <td>{p.purchaseSpec || "—"}</td>
              <td className="num">{gramsToJin(p.grossNeed)}</td>
              <td className="num">-{Number(p.stockDeducted).toFixed(2)}</td>
              <td className="num"></td>
              <td>{p.priceUnit || p.unit}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
