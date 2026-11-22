"use client";

import Link from "next/link";
import { cn } from "@/lib/shared/utils";

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
    <div className={cn("skeu-segmented", className)}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "skeu-segmented-btn",
            tab.active && "skeu-segmented-btn-active"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
