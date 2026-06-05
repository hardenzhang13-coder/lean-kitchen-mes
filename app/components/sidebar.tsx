"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  ShoppingCart,
  Package,
  UtensilsCrossed,
  Carrot,
  BookOpen,
  LogOut,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/schedules", label: "排程", icon: CalendarDays },
  { href: "/purchases", label: "采购", icon: ShoppingCart },
  { href: "/inventory", label: "库存", icon: Package },
  { href: "/dishes", label: "菜品", icon: UtensilsCrossed },
  { href: "/ingredients", label: "食材", icon: Carrot },
  { href: "/dictionaries", label: "字典", icon: BookOpen },
];

export function Sidebar({ user }: { user: { username: string; name?: string | null } | null }) {
  const pathname = usePathname();
  const router = useRouter();

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

      <div className="mt-auto flex flex-col items-center gap-2 border-t border-border pt-3">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground">
            {user?.name || user?.username || "用户"}
          </span>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            toast.success("已登出");
            router.push("/login");
            router.refresh();
          }}
          className="flex flex-col items-center justify-center w-16 h-14 rounded-lg gap-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="登出"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-[10px]">登出</span>
        </button>
      </div>
    </aside>
  );
}
