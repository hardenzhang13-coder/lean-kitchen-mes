"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id?: string;
  label: string;
  required?: boolean;
  readOnly?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  id,
  label,
  required,
  readOnly,
  error,
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
        {!required && !readOnly && (
          <span className="text-muted-foreground text-sm font-normal">(可选)</span>
        )}
      </Label>
      {React.isValidElement(children) && id
        ? React.cloneElement(children as React.ReactElement<any>, {
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
