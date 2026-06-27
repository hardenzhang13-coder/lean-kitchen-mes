"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  href: string;
  active: boolean;
}

interface TabSwitcherProps {
  tabs: Tab[];
  className?: string;
}

export function TabSwitcher({ tabs, className }: TabSwitcherProps) {
  return (
    <div className={cn("flex items-center gap-1 bg-muted rounded-lg p-1", className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
            tab.active
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
