"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseCSV, downloadCSV } from "@/app/lib/csv";
import { toast } from "sonner";

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  sample: string;
};

export type ImportRow<T = Record<string, string>> = {
  index: number;
  data: T;
  errors: string[];
};

interface ImportDialogProps<T = Record<string, string>> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  fields: ImportField[];
  templateFilename?: string;
  onValidate: (rows: T[]) => ImportRow<T>[];
  onImport: (rows: T[]) => Promise<void> | void;
}

export function ImportDialog<T extends Record<string, string> = Record<string, string>>({
  open,
  onOpenChange,
  title = "批量导入",
  fields,
  templateFilename = "template.csv",
  onValidate,
  onImport,
}: ImportDialogProps<T>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ImportRow<T>[]>([]);
  const [importing, setImporting] = useState(false);

  const validRows = useMemo(
    () => parsed.filter((r) => r.errors.length === 0),
    [parsed]
  );

  const headerRow = useMemo(() => fields.map((f) => f.label), [fields]);
  const sampleRow = useMemo(() => fields.map((f) => f.sample), [fields]);

  const reset = () => {
    setFileName("");
    setParsed([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleDownloadTemplate = () => {
    downloadCSV(templateFilename, [headerRow, sampleRow]);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast.error("文件内容为空或缺少数据行");
        setParsed([]);
        return;
      }
      const dataRows = rows.slice(1);
      const mapped: T[] = dataRows.map((cells) => {
        const obj: Record<string, string> = {};
        fields.forEach((f, idx) => {
          obj[f.key] = cells[idx] ?? "";
        });
        return obj as T;
      });
      setParsed(onValidate(mapped));
    } catch {
      toast.error("文件解析失败，请检查 CSV 格式");
      setParsed([]);
    }
  };

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      await onImport(validRows.map((r) => r.data));
      toast.success(`成功导入 ${validRows.length} 条数据`);
      reset();
      onOpenChange(false);
    } catch {
      toast.error("导入失败，请稍后重试");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[960px] max-h-[90vh] overflow-y-auto [&>button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Button
              variant="outline"
              className="h-11"
              onClick={handleDownloadTemplate}
            >
              <Download className="mr-2 h-4 w-4" />
              下载导入模板
            </Button>
            <div className="text-sm text-muted-foreground">
              仅支持 .csv 文件，编码建议 UTF-8
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer rounded-xl border border-dashed border-input bg-muted/20 hover:bg-muted/40 transition-colors p-8 flex flex-col items-center justify-center gap-2"
          >
            <div className="rounded-full bg-muted p-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-base font-medium">
              {fileName ? fileName : "点击或拖拽上传 CSV 文件"}
            </p>
            <p className="text-sm text-muted-foreground">
              {fileName ? "点击更换文件" : "支持 .csv 格式"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {parsed.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">数据预览</h4>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    共 <span className="font-medium text-foreground">{parsed.length}</span> 行
                  </span>
                  {validRows.length > 0 && (
                    <span className="text-green-600">
                      有效 {validRows.length} 行
                    </span>
                  )}
                  {parsed.length - validRows.length > 0 && (
                    <span className="text-destructive">
                      异常 {parsed.length - validRows.length} 行
                    </span>
                  )}
                </div>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">行号</TableHead>
                      {fields.map((f) => (
                        <TableHead key={f.key}>{f.label}</TableHead>
                      ))}
                      <TableHead>校验结果</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.slice(0, 20).map((row) => (
                      <TableRow
                        key={row.index}
                        className={
                          row.errors.length > 0
                            ? "bg-destructive/5 hover:bg-destructive/10"
                            : "hover:bg-muted/40"
                        }
                      >
                        <TableCell className="text-muted-foreground">
                          {row.index + 1}
                        </TableCell>
                        {fields.map((f) => (
                          <TableCell key={f.key} className="whitespace-nowrap">
                            {row.data[f.key] || "—"}
                          </TableCell>
                        ))}
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <ul className="text-xs text-destructive space-y-0.5">
                              {row.errors.map((e, i) => (
                                <li key={i}>{e}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-xs text-green-600">通过</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsed.length > 20 && (
                <p className="text-xs text-muted-foreground text-center">
                  仅展示前 20 行，实际将导入全部 {parsed.length} 行
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="h-11 px-6"
          >
            取消
          </Button>
          <Button
            onClick={handleImport}
            disabled={validRows.length === 0 || importing}
            className="h-11 px-6"
          >
            <FileUp className="mr-2 h-4 w-4" />
            {importing
              ? "导入中..."
              : `确认导入${validRows.length > 0 ? `（${validRows.length} 条）` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
