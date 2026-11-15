"use client";

import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, getInitials } from "@/lib/shared/utils";

interface UserMenuUser {
  username: string;
  name?: string | null;
  role?: string | null;
}

/** 个人菜单：个人信息入口 + 退出登录。当前仅工作台右上角使用。 */
export function UserMenu({
  user,
  className,
}: {
  user: UserMenuUser | null;
  className?: string;
}) {
  const router = useRouter();
  const displayName = user?.name || user?.username || "用户";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("已退出");
    } catch {
      toast.error("退出请求失败");
    }
    window.location.href = "/login";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              className
            )}
            title={user?.role ? `${displayName} · ${user.role}` : displayName}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {user ? getInitials(displayName) : <UserRound className="h-4 w-4" />}
            </span>
            <span className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="max-w-[10rem] truncate text-sm font-medium text-foreground">
                {displayName}
              </span>
              {user?.role && (
                <span className="truncate text-xs text-muted-foreground">
                  {user.role}
                </span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2" onClick={() => router.push("/settings/profile")}>
          <UserRound className="h-4 w-4" />
          个人信息
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="gap-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
