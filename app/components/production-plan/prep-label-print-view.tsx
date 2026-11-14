"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatPrepLabelDate,
  type PrepLabelItem,
} from "@/lib/shared/prep-label";

export function PrepLabelPrintView({ labels }: { labels: PrepLabelItem[] }) {
  const [productionDate, setProductionDate] = useState(() =>
    formatPrepLabelDate(new Date())
  );
  const hasAutoPrinted = useRef(false);

  const printAll = () => {
    setProductionDate(formatPrepLabelDate(new Date()));
    window.setTimeout(() => window.print(), 80);
  };

  useEffect(() => {
    if (hasAutoPrinted.current) return;
    hasAutoPrinted.current = true;
    const timer = window.setTimeout(printAll, 600);
    return () => window.clearTimeout(timer);
  }, []);

  const copies = labels.flatMap((label) =>
    Array.from({ length: label.copies }, (_, copyIndex) => ({
      ...label,
      copyIndex,
    }))
  );

  return (
    <>
      <style>{LABEL_PRINT_CSS}</style>
      <div className="label-print-toolbar">
        <div>
          <strong>净菜标签打印</strong>
          <span>
            共 {copies.length} 张 · 生产日期 {productionDate}
          </span>
        </div>
        <div className="label-print-actions">
          <span>IP802 · 50×40mm · 页边距无 · 缩放 100% · 关闭页眉页脚</span>
          <button type="button" className="primary" onClick={printAll}>
            打印全部标签
          </button>
          <button type="button" onClick={() => window.close()}>
            关闭
          </button>
        </div>
      </div>

      <div className="label-print-sheet">
        {copies.map((label) => (
          <article
            key={`${label.sourceType}:${label.sourceId}:${label.copyIndex}`}
            className="prep-label"
          >
            <div className="prep-label-name">{label.itemName}</div>
            <div className="prep-label-meta">
              包装规格：{label.packageSpec}g
            </div>
            <div className="prep-label-meta">
              包装物料：{label.packageMaterial || "—"}
            </div>
            <div className="prep-label-meta">
              包装尺寸：{label.packageSize || "—"}
            </div>
            <div className="prep-label-meta prep-label-date-label">
              生产日期：
            </div>
            <div className="prep-label-date">{productionDate}</div>
          </article>
        ))}
      </div>
    </>
  );
}

const LABEL_PRINT_CSS = [
  "* { box-sizing: border-box; }",
  "body { background: #f4f4f5; }",
  ".label-print-toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 14px 20px; border-bottom: 1px solid #e4e4e7; background: rgba(255,255,255,.96); font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif; }",
  ".label-print-toolbar strong { display: block; font-size: 14px; color: #18181b; }",
  ".label-print-toolbar span { display: block; margin-top: 2px; font-size: 12px; color: #71717a; }",
  ".label-print-actions { display: flex; align-items: center; gap: 8px; }",
  ".label-print-actions button { padding: 7px 14px; border: 1px solid #d4d4d8; border-radius: 7px; background: #fff; color: #3f3f46; cursor: pointer; }",
  ".label-print-actions button.primary { border-color: #ea580c; background: #ea580c; color: #fff; }",
  ".label-print-sheet { display: flex; flex-wrap: wrap; align-content: flex-start; gap: 8mm; padding: 10mm; }",
  ".prep-label { width: 50mm; height: 40mm; padding: 2.2mm 3mm; overflow: hidden; border: 1px solid #d4d4d8; border-radius: 1.5mm; background: #fff; color: #18181b; font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif; font-weight: 800; box-shadow: 0 2px 8px rgba(0,0,0,.08); break-inside: avoid; }",
  ".prep-label, .prep-label * { font-weight: 800; }",
  ".prep-label-name { overflow: hidden; font-size: 12pt; line-height: 1.2; white-space: nowrap; text-overflow: ellipsis; }",
  ".prep-label-meta { margin-top: .75mm; overflow: hidden; font-size: 10.5pt; line-height: 1.15; white-space: nowrap; text-overflow: ellipsis; }",
  ".prep-label-date-label { margin-top: 1mm; }",
  ".prep-label-date { margin-top: .15mm; overflow: hidden; font-size: 10.5pt; line-height: 1.15; white-space: nowrap; text-overflow: ellipsis; }",
  "@page { size: 50mm 40mm; margin: 0; }",
  "@media print { .label-print-toolbar, .label-print-warning { display: none !important; } body { margin: 0 !important; background: #fff !important; } body aside { display: none !important; } body main { margin-left: 0 !important; } .label-print-sheet { display: block; padding: 0; margin: 0; } .prep-label { margin: 0; border: 0; border-radius: 0; box-shadow: none; break-after: page; page-break-after: always; } .prep-label:last-child { break-after: auto; page-break-after: auto; } }",
].join("");
