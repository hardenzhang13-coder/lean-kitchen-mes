"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/app/components/ui/empty-state";

export type PreviewColumn<T> = {
  header: string;
  accessorKey?: keyof T | string;
  cell?: (row: T, rowIndex: number) => React.ReactNode;
  className?: string;
};

interface TablePreviewDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** 副标题/统计说明，如「共 X 条」 */
  description?: string;
  columns: PreviewColumn<T>[];
  data: T[];
  emptyTitle?: string;
}

export function TablePreviewDialog<T extends object>({
  open,
  onOpenChange,
  title,
  description,
  columns,
  data,
  emptyTitle = "暂无数据",
}: TablePreviewDialogProps<T>) {
  const renderCell = (row: T, col: PreviewColumn<T>, rowIndex: number): React.ReactNode => {
    if (col.cell) return col.cell(row, rowIndex);
    if (!col.accessorKey) return null;
    const value = (row as Record<string, unknown>)[col.accessorKey as string];
    if (value == null) return "—";
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-w-[calc(100%-4rem)] max-h-[85vh] flex flex-col p-0 [&>button]:cursor-pointer">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
          {data.length === 0 ? (
            <EmptyState title={emptyTitle} />
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    {columns.map((col, idx) => (
                      <TableHead key={idx} className={col.className}>
                        {col.header}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      {columns.map((col, colIdx) => (
                        <TableCell key={colIdx} className={col.className}>
                          {renderCell(row, col, rowIdx)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
