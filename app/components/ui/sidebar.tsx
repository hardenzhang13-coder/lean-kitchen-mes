"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  ShoppingCart,
  Package,
  UtensilsCrossed,
  Carrot,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/shared/utils";
import { Logo } from "@/app/components/ui/logo";
import { TRIAL_FEATURES } from "@/lib/shared/features";
import { canAccessPage } from "@/lib/shared/access-control";

const navItems = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/schedules", label: "排菜", icon: CalendarDays },
  { href: "/production-plans", label: "生产", icon: ClipboardList },
  {
    href: "/purchases",
    label: "采购",
    icon: ShoppingCart,
    unavailable: !TRIAL_FEATURES.purchases,
  },
  { href: "/inventory", label: "库存", icon: Package },
  { href: "/dishes", label: "菜品", icon: UtensilsCrossed },
  { href: "/ingredients", label: "食材", icon: Carrot },
  { href: "/settings", label: "设置", icon: Settings },
];

export function Sidebar({ user }: { user: { username: string; name?: string | null; role?: string | null } | null }) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-20 flex-col items-center border-r border-skeu-border skeu-surface py-4 shadow-sk-raised">
      <div className="mb-6 flex flex-col items-center gap-1">
        <div className="flex h-10 w-10 items-center justify-center transition-all hover:brightness-105">
          <Logo className="h-10 w-10" />
        </div>
        <span className="text-xs font-medium tracking-tight text-muted-foreground">精益厨房</span>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.filter((item) => canAccessPage(item.href, user?.role)).map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-[10px] transition-[background-color,color,box-shadow,transform] duration-150",
                isActive
                  ? "skeu-nav-active"
                  : "text-muted-foreground hover:-translate-y-px hover:bg-muted hover:text-foreground"
              )}
              title={item.unavailable ? `${item.label}（试运行暂未开放）` : item.label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-bold">{item.label}</span>
              {item.unavailable && (
                <span
                  className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500"
                  aria-label="试运行暂未开放"
                />
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
