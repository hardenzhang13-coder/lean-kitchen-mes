"use client";

import { Label } from "@/components/ui/label";

export function FormField({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className || ""}`}>
      <Label className="text-base flex items-center gap-1">
        {label}
        {required && <span className="text-red-500">*</span>}
        {!required && (
          <span className="text-muted-foreground text-sm font-normal">(可选)</span>
        )}
      </Label>
      {children}
    </div>
  );
}

export function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-5">{children}</div>
    </div>
  );
}
