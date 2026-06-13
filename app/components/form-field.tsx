"use client";

import { Label } from "@/components/ui/label";

export function FormField({
  label,
  required,
  readOnly,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  readOnly?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className || ""}`}>
      <Label className="text-base flex items-center gap-1">
        {label}
        {required && !readOnly && <span className="text-red-500">*</span>}
        {!required && !readOnly && (
          <span className="text-muted-foreground text-sm font-normal">(可选)</span>
        )}
      </Label>
      {children}
    </div>
  );
}

export function FormSection({
  title,
  cols = 2,
  children,
}: {
  title: string;
  cols?: 1 | 2 | 3 | 4;
  children: React.ReactNode;
}) {
  const colClass = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  }[cols];

  return (
    <div className="rounded-lg border bg-muted/20 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <div className={`grid ${colClass} gap-5`}>{children}</div>
    </div>
  );
}
