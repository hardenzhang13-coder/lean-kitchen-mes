"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: EmptyStateAction | React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const actionNode = (() => {
    if (!action) return null;
    if (typeof action !== "object" || !("label" in action)) return action;
    const { label, href, onClick } = action as EmptyStateAction;
    const classes = "mt-4";
    if (href) {
      return (
        <Link href={href} passHref legacyBehavior>
          <Button variant="outline" className={classes}>{label}</Button>
        </Link>
      );
    }
    return (
      <Button variant="outline" className={classes} onClick={onClick}>
        {label}
      </Button>
    );
  })();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-4",
        className
      )}
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {actionNode && <div className="mt-4">{actionNode}</div>}
    </div>
  );
}
