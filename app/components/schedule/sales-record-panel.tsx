"use client";

import { ClipboardList, PencilLine } from "lucide-react";
import { EmptyState } from "@/app/components/ui/empty-state";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { EmptyValue } from "@/app/components/ui/empty-value";
import type { SalesRecordItem } from "./sales-record-dialog";

const fmtMoney = (n: number | null) =>
  n == null ? "—" : "¥" + Number(n).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (r: number | null) => (r == null ? "—" : (r * 100).toFixed(1) + "%");

interface SalesRecordPanelProps {
  items: SalesRecordItem[];
  onOpenRecord: () => void;
}

/**
 * 排程详情页「销售回录」Tab 内容。
 * 三态：未回录（空状态引导）/ 部分回录（可继续补录）/ 已回录（复盘视图，按售出率降序）。
 */
export function SalesRecordPanel({ items, onOpenRecord }: SalesRecordPanelProps) {
  const totalCount = items.length;
  const recorded = items.filter((it) => it.soldQty != null);
  const recordedCount = recorded.length;
  const allRecorded = recordedCount === totalCount && totalCount > 0;

  const planQty = items.reduce((s, it) => s + it.quantity, 0);
  const soldQty = recorded.reduce((s, it) => s + (it.soldQty ?? 0), 0);
  const revenue = recorded.reduce((s, it) => s + (it.soldQty ?? 0) * (Number(it.dish.price) || 0), 0);
  const sellThrough = planQty > 0 ? soldQty / planQty : null;

  // 已回录时按售出率降序（卖得好的在上，滞销菜沉底）
  const rows = allRecorded
    ? [...items].sort((a, b) => (b.soldQty ?? 0) / b.quantity - (a.soldQty ?? 0) / a.quantity)
    : items;

  const lastRecord = recorded
    .filter((it) => it.soldRecordedAt)
    .sort((a, b) => String(b.soldRecordedAt).localeCompare(String(a.soldRecordedAt)))[0];

  // ===== 未回录：空状态 =====
  if (recordedCount === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="尚未回录销售数据"
        description="每天生产结束后，将各菜品实际售出份数录回系统；支持手动逐菜录入，或上传门店 CSV 批量导入"
        action={{ label: "立即回录", onClick: onOpenRecord }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 头部汇总 */}
      <div className="flex items-center gap-2 flex-wrap">
        {allRecorded ? (
          <>
            <span className="rounded-full border border-skeu-border bg-white px-2.5 py-1 text-xs text-muted-foreground">
              售出 <b className="text-foreground">{soldQty}</b> 份
            </span>
            <span className="rounded-full border border-skeu-border bg-white px-2.5 py-1 text-xs text-muted-foreground">
              售出率 <b className="text-foreground">{fmtPct(sellThrough)}</b>
            </span>
            <span className="rounded-full border border-skeu-border bg-white px-2.5 py-1 text-xs text-muted-foreground">
              营收 <b className="text-foreground">{fmtMoney(revenue)}</b>
            </span>
          </>
        ) : (
          <span className="rounded-full border border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)] px-2.5 py-1 text-xs text-[var(--status-warning)]">
            已回录 {recordedCount}/{totalCount} 道 · 可随时继续补录
          </span>
        )}
        <span className="flex-1" />
        <SkeuButton variant="outline" size="sm" onClick={onOpenRecord}>
          <PencilLine className="h-4 w-4" />
          {allRecorded ? "修改回录" : "继续回录"}
        </SkeuButton>
      </div>

      {!allRecorded && (
        <p className="text-xs text-muted-foreground">
          已回录 {recordedCount}/{totalCount} 道
          {lastRecord?.soldRecordedAt && (
            <>
              {" "}· 最后回录 {new Date(lastRecord.soldRecordedAt).toLocaleString("zh-CN")}
              {lastRecord.soldRecordedBy ? ` · ${lastRecord.soldRecordedBy}` : ""}
            </>
          )}
        </p>
      )}
      {allRecorded && lastRecord?.soldRecordedAt && (
        <p className="text-xs text-muted-foreground">
          最后回录 {new Date(lastRecord.soldRecordedAt).toLocaleString("zh-CN")}
          {lastRecord.soldRecordedBy ? ` · ${lastRecord.soldRecordedBy}` : ""}
        </p>
      )}

      {/* 复盘表 */}
      <div className="skeu-scroll overflow-x-auto rounded-[var(--sk-radius-md)] border border-skeu-border bg-white shadow-sk-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2 px-3 font-medium w-10">序号</th>
              <th className="py-2 px-3 font-medium">菜品 / 规格</th>
              <th className="py-2 px-3 font-medium w-[32%]">售出进度（售出 / 计划）</th>
              <th className="py-2 px-3 font-medium text-right w-16">偏差</th>
              <th className="py-2 px-3 font-medium text-right w-24">销售额</th>
              {!allRecorded && <th className="py-2 px-3 font-medium text-right w-16">售出</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((it, idx) => {
              const sold = it.soldQty;
              const rate = sold != null ? sold / it.quantity : null;
              const pct = rate == null ? 0 : Math.min(rate * 100, 100);
              const over = sold != null && sold > it.quantity;
              const low = allRecorded && rate != null && rate < 0.6;
              const price = Number(it.dish.price) || 0;
              const diff = sold != null ? sold - it.quantity : null;
              return (
                <tr
                  key={it.id}
                  className={
                    "border-b last:border-0 transition-colors hover:bg-muted/40 " +
                    (low ? "bg-[var(--status-warning-bg)]" : "")
                  }
                >
                  <td className="py-2.5 px-3 text-muted-foreground">{idx + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-medium">
                      {it.dish.name}
                      {low && (
                        <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded bg-[var(--status-warning)] text-white">
                          滞销
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[it.dish.portion, it.dish.meatType, it.dish.category?.name]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    {sold != null ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={
                              "h-full rounded-full " +
                              (over
                                ? "bg-[var(--status-danger)]"
                                : rate! >= 1
                                  ? "bg-[var(--status-success)]"
                                  : "bg-primary")
                            }
                            style={{ width: pct + "%" }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          <b className="text-foreground">{sold}</b> / {it.quantity} · {fmtPct(rate)}
                        </span>
                        {over && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--status-danger-bg)] text-[var(--status-danger)] font-medium whitespace-nowrap">
                            超售 +{sold - it.quantity}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">待回录</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {diff == null ? (
                      <EmptyValue />
                    ) : diff > 0 ? (
                      <span className="text-[var(--status-danger)] font-semibold">+{diff}</span>
                    ) : diff < 0 ? (
                      <span className="text-muted-foreground">{diff}</span>
                    ) : (
                      <span>0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {sold != null && price > 0 ? fmtMoney(sold * price) : "—"}
                  </td>
                  {!allRecorded && (
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {sold != null ? <b>{sold}</b> : (
                        <span className="text-xs text-muted-foreground">待回录</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {allRecorded && (
        <p className="text-xs text-muted-foreground">
          * 按售出率降序排列：卖得好的在上，滞销菜（售出率 &lt; 60%）沉底标黄
        </p>
      )}
    </div>
  );
}