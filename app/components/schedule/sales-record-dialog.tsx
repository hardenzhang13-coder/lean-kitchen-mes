"use client";

import { useMemo, useRef, useState } from "react";
import { Download, ClipboardPaste, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormDialog } from "@/app/components/ui/form-dialog";
import { Input } from "@/app/components/ui/form-controls";
import { toast } from "sonner";
import { parseCSV, downloadCSV } from "@/lib/client/csv";
import { AppDialogContent } from "@/app/components/ui/app-dialog";

/** 排程明细行（含回录字段，与 /api/schedules/[id] items 一致） */
export interface SalesRecordItem {
  id: number;
  dishId: number;
  quantity: number;
  soldQty: number | null;
  soldRecordedAt: string | null;
  soldRecordedBy: string | null;
  dish: {
    id: number;
    code: string;
    name: string;
    portion: string;
    meatType: string | null;
    cost: number | null;
    price: number | null;
    category: { name: string } | null;
  };
}

type DraftMap = Record<number, string>;

type ImportStatus = "ok" | "overwrite" | "merged" | "unmatched" | "skip";

interface ImportRow {
  lineNo: number;
  code: string;
  name: string;
  qty: string;
  status: ImportStatus;
  note: string;
  itemId: number | null;
  merged: number;
}

function validateQty(v: string): string | null {
  if (v === "") return null;
  if (!/^\d+$/.test(v)) return "请输入整数";
  const n = Number(v);
  if (n > 9999) return "超出范围(0~9999)";
  return null;
}

const fmtMoney = (n: number | null) =>
  n == null ? "—" : "¥" + Number(n).toFixed(2);

interface SalesRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: number;
  scheduleCode: string | null;
  items: SalesRecordItem[];
  onSaved: () => void;
}

export function SalesRecordDialog({
  open,
  onOpenChange,
  scheduleId,
  scheduleCode,
  items,
  onSaved,
}: SalesRecordDialogProps) {
  const [mode, setMode] = useState<"manual" | "import">("manual");
  const [draft, setDraft] = useState<DraftMap>({});
  const [saving, setSaving] = useState(false);

  // 导入相关状态
  const [csvText, setCsvText] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // 打开时重置草稿（预填已有回录值）：按 React 官方建议在渲染期调整，
  // 避免在 effect 中同步 setState 造成级联渲染。
  const [syncedOpen, setSyncedOpen] = useState(open);
  const [syncedItems, setSyncedItems] = useState(items);
  if (open !== syncedOpen || items !== syncedItems) {
    setSyncedOpen(open);
    setSyncedItems(items);
    if (open) {
      setMode("manual");
      setCsvText("");
      setImportRows([]);
      const next: DraftMap = {};
      items.forEach((it) => {
        next[it.id] = it.soldQty == null ? "" : String(it.soldQty);
      });
      setDraft(next);
    }
  }

  const summary = useMemo(() => {
    const entries = Object.values(draft).filter((v) => v !== "");
    const errs = Object.values(draft).some((v) => validateQty(v) !== null);
    const total = entries.reduce((s, v) => s + Number(v), 0);
    const planTotal = items.reduce((s, it) => s + it.quantity, 0);
    return {
      count: entries.length,
      total,
      errs,
      rate: planTotal > 0 ? ((total / planTotal) * 100).toFixed(1) : "0.0",
    };
  }, [draft, items]);

  const onQtyInput = (id: number, v: string) => {
    setDraft((d) => ({ ...d, [id]: v }));
  };

  const fillSold = (id: number) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setDraft((d) => ({ ...d, [id]: String(it.quantity) }));
  };

  const fillAllSold = () => {
    setDraft((d) => {
      const next = { ...d };
      items.forEach((it) => {
        if (next[it.id] === "") next[it.id] = String(it.quantity);
      });
      return next;
    });
  };

  const clearAll = () => {
    setDraft((d) => {
      const next = { ...d };
      items.forEach((it) => {
        next[it.id] = "";
      });
      return next;
    });
  };

  // ===== 保存（手动） =====
  const saveManual = async () => {
    // 仅提交有变更的行，避免无意义地刷新未改行的回录时间
    const changed = items
      .filter((it) => {
        const v = draft[it.id];
        const newVal = v === "" ? null : Number(v);
        return newVal !== it.soldQty;
      })
      .map((it) => ({
        itemId: it.id,
        soldQty: draft[it.id] === "" ? null : Number(draft[it.id]),
      }));
    if (changed.length === 0) {
      toast.info("没有变更，无需保存");
      return;
    }
    // 已回录数据的修改需二次确认（讨论定义：修改留痕，操作入日志）
    const hasExisting = changed.some((c) => items.find((i) => i.id === c.itemId)?.soldQty != null);
    if (hasExisting) {
      const overwriteCount = changed.filter(
        (c) => items.find((i) => i.id === c.itemId)?.soldQty != null
      ).length;
      if (!window.confirm(`将覆盖 ${overwriteCount} 道菜的已有回录数据，确认保存？`)) return;
    }
    await submit(changed, "manual");
  };

  // ===== 导入解析 =====
  const findItem = (code: string, name: string): SalesRecordItem | null => {
    if (code) {
      const hit = items.find((i) => i.dish.code === code);
      if (hit) return hit;
    }
    if (name) {
      const hit = items.find((i) => i.dish.name === name);
      if (hit) return hit;
    }
    return null;
  };

  const parseImport = () => {
    const text = csvText.trim();
    if (!text) {
      toast.error("请先上传或粘贴 CSV 内容");
      return;
    }
    const rows = parseCSV(text);
    if (rows.length === 0) {
      toast.error("CSV 内容为空");
      return;
    }
    const hasHeader = /编号|名称/.test(rows[0].join(","));
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const byItem = new Map<number, ImportRow>();
    const result: ImportRow[] = [];
    dataRows.forEach((cols, idx) => {
      const lineNo = idx + (hasHeader ? 2 : 1);
      let code = cols[0] ?? "";
      let name = cols[1] ?? "";
      let qty = cols[2] ?? "";
      // 兼容两列（缺编号）：首列非编号且次列为数字时视为 名称,售出
      if (qty === "" && name !== "" && /^\d+$/.test(name) && !items.some((i) => i.dish.code === code)) {
        qty = name;
        name = code;
        code = "";
      }
      if (qty === "") {
        result.push({ lineNo, code, name, qty, status: "skip", note: "售出为空", itemId: null, merged: 1 });
        return;
      }
      if (!/^\d+$/.test(qty) || Number(qty) > 9999) {
        result.push({ lineNo, code, name, qty, status: "skip", note: "售出非法", itemId: null, merged: 1 });
        return;
      }
      const item = findItem(code, name);
      if (!item) {
        result.push({ lineNo, code, name, qty, status: "unmatched", note: "未匹配", itemId: null, merged: 1 });
        return;
      }
      const first = byItem.get(item.id);
      if (first) {
        first.qty = String(Number(first.qty) + Number(qty));
        first.merged += 1;
        result.push({ lineNo, code, name, qty, status: "merged", note: `并入第${first.lineNo}行`, itemId: item.id, merged: 1 });
      } else {
        const row: ImportRow = {
          lineNo,
          code,
          name,
          qty,
          status: item.soldQty != null ? "overwrite" : "ok",
          note: "",
          itemId: item.id,
          merged: 1,
        };
        byItem.set(item.id, row);
        result.push(row);
      }
    });
    setImportRows(result);
    const valid = result.filter((r) => r.status === "ok" || r.status === "overwrite").length;
    toast.success(`解析完成：${valid} 行有效`);
  };

  const resolveUnmatched = (lineNo: number, val: string) => {
    setImportRows((rows) =>
      rows.map((r) => {
        if (r.lineNo !== lineNo || r.status !== "unmatched") return r;
        if (val === "ignore") return { ...r, status: "skip", note: "已忽略" };
        const item = items.find((i) => i.id === Number(val));
        if (!item) return r;
        return { ...r, itemId: item.id, status: item.soldQty != null ? "overwrite" : "ok", name: item.dish.name };
      })
    );
  };

  const importSummary = useMemo(() => {
    const valid = importRows.filter((r) => r.status === "ok" || r.status === "overwrite");
    return {
      validCount: valid.length,
      overwriteCount: valid.filter((r) => r.status === "overwrite").length,
      unmatchedCount: importRows.filter((r) => r.status === "unmatched").length,
      skipCount: importRows.filter((r) => r.status === "skip").length,
    };
  }, [importRows]);

  const saveImport = async () => {
    const valid = importRows.filter((r) => (r.status === "ok" || r.status === "overwrite") && r.itemId != null);
    if (valid.length === 0) {
      toast.error("没有可导入的有效行");
      return;
    }
    const doSave = () =>
      submit(
        valid.map((r) => ({ itemId: r.itemId as number, soldQty: Number(r.qty) })),
        "import"
      );
    if (importSummary.overwriteCount > 0) {
      if (!window.confirm(`将覆盖 ${importSummary.overwriteCount} 道菜的已有回录数据，确认导入？`)) return;
      doSave();
    } else {
      doSave();
    }
  };

  const submit = async (
    rows: Array<{ itemId: number; soldQty: number | null }>,
    source: "manual" | "import"
  ) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/sold-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rows, source }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) {
        toast.error(json?.error || "保存失败");
        return;
      }
      const recorded = items.filter((it) =>
        rows.some((r) => r.itemId === it.id) ? rows.find((r) => r.itemId === it.id)!.soldQty != null : it.soldQty != null
      ).length;
      const total = items.length;
      toast.success(
        recorded >= total
          ? `回录完成：已回录全部 ${total} 道`
          : `已保存 ${recorded}/${total} 道，可随时继续回录`
      );
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("保存出错");
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = () => {
    const header = ["编号", "菜品名称", "售出份数"];
    const body = items.map((it) => [it.dish.code, it.dish.name, ""]);
    downloadCSV(`销售回录模板_${scheduleCode ?? scheduleId}.csv`, [header, ...body]);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
<AppDialogContent size="wide" className="max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>销售回录</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {scheduleCode ?? `排程 #${scheduleId}`} · 共 {items.length} 道菜
          </p>
        </DialogHeader>

        {/* Tab 切换 */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
          {(
            [
              ["manual", "手动录入"],
              ["import", "批量导入"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={
                "px-4 py-1.5 text-sm rounded-md transition-colors " +
                (mode === key
                  ? "bg-card text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {mode === "manual" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={fillAllSold}>
                  全部售罄
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  清空
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  售出 &gt; 计划记为超售，不阻断保存；留空 = 未录
                </span>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="py-2 px-3 font-medium w-10">序号</th>
                      <th className="py-2 px-3 font-medium">菜品 / 规格</th>
                      <th className="py-2 px-3 font-medium text-right w-16">计划</th>
                      <th className="py-2 px-3 font-medium text-right w-20">售价</th>
                      <th className="py-2 px-3 font-medium text-right w-36">售出份数</th>
                      <th className="py-2 px-3 font-medium w-14">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const v = draft[it.id] ?? "";
                      const err = validateQty(v);
                      const num = v === "" ? null : Number(v);
                      const over = num != null && !err && num > it.quantity;
                      return (
                        <tr key={it.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                          <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium">{it.dish.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {[it.dish.portion, it.dish.meatType, it.dish.category?.name]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-semibold tabular-nums">{it.quantity}</td>
                          <td className="py-2 px-3 text-right text-muted-foreground tabular-nums">
                            {fmtMoney(it.dish.price)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="inline-flex flex-col items-end gap-1">
                              <Input
                                className={
                                  "w-24 text-right tabular-nums h-8 " + (err ? "border-destructive" : "")
                                }
                                inputMode="numeric"
                                value={v}
                                onChange={(e) => onQtyInput(it.id, e.target.value)}
                              />
                              {err ? (
                                <span className="text-xs text-destructive">{err}</span>
                              ) : over ? (
                                <span className="text-xs text-destructive font-medium">
                                  超售 +{num - it.quantity}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <button className="text-primary text-xs hover:underline" onClick={() => fillSold(it.id)}>
                              售罄
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="mr-1 h-4 w-4" />
                  下载 CSV 模板
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  选择 CSV 文件
                </Button>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
              </div>
              <textarea
                className="w-full min-h-[88px] border rounded-md p-3 text-xs font-mono outline-none focus:border-primary resize-y"
                placeholder={"粘贴 CSV 文本，表头：编号, 菜品名称, 售出份数\n编号可留空（按菜品名称匹配）"}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={parseImport}>
                  <ClipboardPaste className="mr-1 h-4 w-4" />
                  解析预览
                </Button>
                {importRows.length > 0 && (
                  <span className="text-xs text-muted-foreground">核对匹配结果后确认导入</span>
                )}
              </div>

              {importRows.length > 0 && (
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="py-2 px-3 font-medium w-12">行号</th>
                        <th className="py-2 px-3 font-medium w-24">编号</th>
                        <th className="py-2 px-3 font-medium">名称</th>
                        <th className="py-2 px-3 font-medium text-right w-20">售出</th>
                        <th className="py-2 px-3 font-medium w-32">匹配结果</th>
                        <th className="py-2 px-3 font-medium w-40">处理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((r) => (
                        <tr
                          key={r.lineNo}
                          className={
                            "border-b last:border-0 " +
                            (r.status === "unmatched" ? "bg-[var(--status-danger-bg)]" : "")
                          }
                        >
                          <td className="py-2 px-3 text-muted-foreground">{r.lineNo}</td>
                          <td className="py-2 px-3 font-mono text-xs">{r.code || "—"}</td>
                          <td className="py-2 px-3 font-medium">
                            {r.itemId != null
                              ? items.find((i) => i.id === r.itemId)?.dish.name ?? r.name
                              : r.name}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            <b>{r.qty || "—"}</b>
                            {r.merged > 1 && (
                              <div className="text-xs text-muted-foreground">合并 {r.merged} 行</div>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {r.status === "ok" && <span className="text-xs text-[var(--status-success)]">匹配成功</span>}
                            {r.status === "overwrite" && (
                              <span className="text-xs text-[var(--status-info)]">将覆盖</span>
                            )}
                            {r.status === "merged" && (
                              <span className="text-xs text-[var(--status-warning)]">重复 · {r.note}</span>
                            )}
                            {r.status === "unmatched" && (
                              <span className="text-xs text-[var(--status-danger)]">未匹配</span>
                            )}
                            {r.status === "skip" && (
                              <span className="text-xs text-muted-foreground">跳过 · {r.note}</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {r.status === "unmatched" ? (
                              <select
                                className="text-xs border rounded px-2 py-1 bg-card max-w-[150px]"
                                value=""
                                onChange={(e) => resolveUnmatched(r.lineNo, e.target.value)}
                              >
                                <option value="">选择菜品…</option>
                                {items.map((i) => (
                                  <option key={i.id} value={i.id}>
                                    {i.dish.name}
                                  </option>
                                ))}
                                <option value="ignore">忽略本行</option>
                              </select>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {mode === "manual" ? (
              <>
                已录 <b className="text-foreground">{summary.count}</b>/{items.length} 道 · 售出合计{" "}
                <b className="text-foreground">{summary.total}</b> 份 · 预计售出率{" "}
                <b className="text-foreground">{summary.rate}%</b>
                {summary.errs && (
                  <span className="text-destructive ml-1 inline-flex items-center gap-1">
                    <CircleAlert className="h-3 w-3" /> 存在非法输入
                  </span>
                )}
              </>
            ) : importRows.length > 0 ? (
              <>
                有效 <b className="text-foreground">{importSummary.validCount}</b> 行 · 未匹配{" "}
                <b className="text-foreground">{importSummary.unmatchedCount}</b> 行 · 跳过{" "}
                <b className="text-foreground">{importSummary.skipCount}</b> 行
              </>
            ) : (
              "上传 CSV 或粘贴文本后解析预览"
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              取消
            </Button>
            {mode === "manual" ? (
              <Button onClick={saveManual} disabled={saving || summary.errs}>
                保存回录
              </Button>
            ) : (
              <Button onClick={saveImport} disabled={saving || importSummary.validCount === 0}>
                确认导入
              </Button>
            )}
          </div>
        </DialogFooter>
      </AppDialogContent>
    </FormDialog>
  );
}
