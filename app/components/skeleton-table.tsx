"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function SkeletonTable({ cols = 4, rows = 20 }: { cols?: number; rows?: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {Array.from({ length: cols }).map((_, i) => (
            <TableHead key={i}>
              <div className="h-4 w-16 animate-pulse rounded bg-muted" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, r) => (
          <TableRow key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <TableCell key={c}>
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
