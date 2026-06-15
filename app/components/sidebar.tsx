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
  Settings,
  LogOut,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/schedules", label: "排程", icon: CalendarDays },
  { href: "/purchases", label: "采购", icon: ShoppingCart },
  { href: "/inventory", label: "库存", icon: Package },
  { href: "/dishes", label: "菜品", icon: UtensilsCrossed },
  { href: "/ingredients", label: "食材", icon: Carrot },
  { href: "/settings", label: "设置", icon: Settings },
];

export function Sidebar({ user }: { user: { username: string; name?: string | null; role?: string | null } | null }) {
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
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              <span className="text-xs font-bold">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-2 border-t border-border pt-3">
        <button
          onClick={() => router.push("/settings/profile")}
          className="flex flex-col items-center gap-1 w-full group"
          title="个人设置"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted group-hover:bg-muted/80">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-[10px] font-medium text-foreground">
            {user?.name || user?.username || "用户"}
          </span>
          {user?.role && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
              {user.role}
            </Badge>
          )}
        </button>
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
