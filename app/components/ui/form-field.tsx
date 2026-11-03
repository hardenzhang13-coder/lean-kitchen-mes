"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/shared/utils";

interface FormFieldProps {
  id?: string;
  label: string;
  required?: boolean;
  readOnly?: boolean;
  error?: string;
  /** 非必填字段是否显示「(可选)」提示；默认 true。必填字段已有 * 标记时可设 false */
  optionalHint?: boolean;
  /** 字段说明：以 ⓘ 图标悬浮展示（原生 title），不占表单空间 */
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  id,
  label,
  required,
  readOnly,
  error,
  optionalHint = true,
  hint,
  children,
  className,
}: FormFieldProps) {
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label
        htmlFor={id}
        className="text-base flex items-center gap-1"
      >
        {label}
        {required && !readOnly && <span className="text-destructive">*</span>}
        {optionalHint && !required && !readOnly && (
          <span className="text-muted-foreground text-sm font-normal">(可选)</span>
        )}
        {hint && (
          <span
            className="inline-flex cursor-help shrink-0"
            aria-label={hint}
            title={hint}
          >
            <Info className="h-3.5 w-3.5 text-muted-foreground/70" />
          </span>
        )}
      </Label>
      {React.isValidElement(children) && id
        ? React.cloneElement(children as React.ReactElement<{
            id?: string;
            "aria-invalid"?: boolean;
            "aria-describedby"?: string;
          }>, {
            id,
            "aria-invalid": !!error || undefined,
            "aria-describedby": error ? errorId : undefined,
          })
        : children}
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
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
      <div className={cn("grid", colClass, "gap-5")}>{children}</div>
    </div>
  );
}
