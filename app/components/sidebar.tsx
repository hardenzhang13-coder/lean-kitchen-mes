"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ShoppingCart,
  Package,
  UtensilsCrossed,
  Carrot,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/schedules", label: "排程", icon: CalendarDays },
  { href: "/purchases", label: "采购", icon: ShoppingCart },
  { href: "/inventory", label: "库存", icon: Package },
  { href: "/dishes", label: "菜品", icon: UtensilsCrossed },
  { href: "/ingredients", label: "食材", icon: Carrot },
  { href: "/dictionaries", label: "字典", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-20 flex-col items-center border-r border-border bg-card py-4">
      <div className="mb-6 flex flex-col items-center gap-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-xs font-bold text-white">
          精
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">精益厨房</span>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-16 h-16 rounded-lg gap-1 transition-colors",
                isActive
                  ? "bg-indigo-50 text-indigo-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
