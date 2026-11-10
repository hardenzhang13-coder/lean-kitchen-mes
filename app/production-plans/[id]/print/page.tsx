import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { resolveUsernameToName } from "@/lib/server/user-resolve";
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

type CuttingRow = {
  id?: number;
  itemName: string;
  portionsText: string | null;
  requiredQty: number;
  grossNeedJin: number | null;
};
type PurchaseRow = {
  id?: number;
  itemName: string;
  purchaseSpec: string | null;
  grossNeed: number;
  unit: string;
  priceUnit: string | null;
  suggestedPurchase: number;
  supplierName: string | null;
};

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
  ".pm-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 20px; font-size: 12.5px; border-top: 2px solid #18181b; border-bottom: 1px solid #e4e4e7; padding: 10px 2px; margin-bottom: 12px; }",
  "table { width: 100%; border-collapse: collapse; font-size: 12.5px; }",
  "th, td { border: 1px solid #d4d4d8; padding: 6px 8px; text-align: left; }",
  "th { background: #fafafa; font-weight: 600; }",
  "td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }",
  ".sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; font-size: 12.5px; }",
  ".sign span { border-top: 1px solid #18181b; padding-top: 6px; }",
  "@media print { .no-print { display: none !important; } .print-root { padding: 0; } .doc { border: none; border-radius: 0; max-width: none; margin: 0; page-break-after: always; } .doc:last-child { page-break-after: auto; } body aside { display: none !important; } body main { margin-left: 0 !important; } }",
  "@page { size: A4; margin: 14mm 12mm; }",
].join(" ");

const toJin = (grams: number) => (grams / 500).toFixed(2);

export default async function ProductionPlanPrintPage({
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

  const plan = await prisma.productionPlan.findFirst({ where: { id: Number(id), deletedAt: null } });
  if (!plan) notFound();

  const operatorName = await resolveUsernameToName(plan.operator);
  const scheduleNo = plan.code ?? "PPL-" + String(plan.id).padStart(4, "0");
  const printTime = fmtTime(new Date());
  const cutting = (plan.cuttingJson ?? []) as unknown as CuttingRow[];
  const purchases = (plan.purchaseJson ?? []) as unknown as PurchaseRow[];

  const metaRow = (extra: React.ReactNode) => (
    <div className="pm-meta">
      {extra}
      <span>收货单位：<b>净菜加工中心</b></span>
      <span>生产日期：<b>{fmtDate(plan.planDate.toISOString())}</b></span>
      <span>单号：<b>{scheduleNo}</b></span>
      <span>打印时间：<b>{printTime}</b></span>
    </div>
  );

  return (
    <div className="print-root">
      <style>{PRINT_CSS}</style>
      <div className="no-print"><PrintActions /></div>

      {doc === "cutting" && (
        <div className="doc">
          <div className="doc-title">切 配 工 单（汇总）</div>
          <div className="doc-sub">精益厨房 · 切配加工中心执行单据（{plan.title}）</div>
          {metaRow(null)}
          <table>
            <thead>
              <tr>
                <th className="w-10">序号</th>
                <th>名称</th>
                <th className="num">切配份数</th>
                <th className="num">净料用量</th>
                <th className="num">毛料用量（斤）</th>
                <th className="w-16" style={{ textAlign: "center" }}>完成状态</th>
              </tr>
            </thead>
            <tbody>
              {cutting.map((c, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{c.itemName}</td>
                  <td className="num">{c.portionsText || "—"}</td>
                  <td className="num">{Number(c.requiredQty).toLocaleString("zh-CN")} g</td>
                  <td className="num">{c.grossNeedJin != null ? Number(c.grossNeedJin).toFixed(2) : "—"}</td>
                  <td style={{ textAlign: "center", fontSize: 15 }}>☐</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="sign">
            <span>制单：{operatorName || plan.operator || "—"}</span>
            <span>切配组长签字：＿＿＿＿＿＿</span>
            <span>完成时间：＿＿月＿＿日 ＿＿:＿＿</span>
          </div>
        </div>
      )}

      {doc === "purchase" && !bySupplier && (
        <div className="doc">
          <div className="doc-title">采 购 计 划 单（汇总）</div>
          <div className="doc-sub">精益厨房 · 全部采购明细（统一采购至净菜加工中心，{plan.title}）</div>
          {metaRow(null)}
          <PurchaseTable rows={purchases} />
          <div className="sign">
            <span>制单：{operatorName || plan.operator || "—"}</span>
            <span>采购员签字：＿＿＿＿＿＿</span>
            <span>验收 / 入库：＿＿＿＿＿＿</span>
          </div>
        </div>
      )}

      {doc === "purchase" && bySupplier &&
        (() => {
          const groups = new Map<string, PurchaseRow[]>();
          for (const p of purchases) {
            const key = p.supplierName || "未指定供应商";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(p);
          }
          return [...groups.entries()].map(([supplier, rows], gi) => (
            <div className="doc" key={supplier}>
              <div className="doc-title">采 购 计 划 单</div>
              <div className="doc-sub">精益厨房 · 按供应商拆单（{gi + 1}/{groups.size}，{plan.title}）</div>
              {metaRow(<span>供应商：<b>{supplier}</b></span>)}
              <PurchaseTable rows={rows} />
              <div className="sign">
                <span>制单：{operatorName || plan.operator || "—"}</span>
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
          const zero = Number(p.suggestedPurchase) <= 0;
          return (
            <tr key={i} style={zero ? { color: "#a1a1aa" } : undefined}>
              <td>{i + 1}</td>
              <td>{zero ? p.itemName + "（库存充足）" : p.itemName}</td>
              <td>{p.purchaseSpec || "—"}</td>
              <td className="num">{toJin(Number(p.grossNeed))}</td>
              <td className="num">—</td>
              <td className="num"></td>
              <td>{p.priceUnit || p.unit}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
