"use client";

import type * as React from "react";
import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/shared/utils";

export type AppDialogSize = "compact" | "form" | "wide" | "workbench";

const dialogSizeClasses: Record<AppDialogSize, string> = {
  compact: "sm:max-w-[400px]",
  form: "sm:max-w-[560px]",
  wide: "sm:max-w-[880px]",
  workbench: "sm:max-w-[1200px]",
};

export function AppDialogContent({
  size = "form",
  className,
  ...props
}: React.ComponentProps<typeof DialogContent> & {
  size?: AppDialogSize;
}) {
  return (
    <DialogContent
      className={cn(dialogSizeClasses[size], className)}
      {...props}
    />
  );
}
