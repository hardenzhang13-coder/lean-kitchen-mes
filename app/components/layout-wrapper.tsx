"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";

export function LayoutWrapper({
  children,
  user,
}: {
  children: React.ReactNode;
  user: { username: string; name?: string | null; role?: string | null } | null;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <>
      {!isLogin && <Sidebar user={user} />}
      <main
        className={cn(
          "flex-1 flex flex-col min-h-screen",
          !isLogin && "ml-20"
        )}
      >
        {children}
      </main>
    </>
  );
}
