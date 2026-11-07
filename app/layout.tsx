import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LayoutWrapper } from "@/app/components/ui/layout-wrapper";
import { getCurrentUser } from "@/lib/server/session";
import "./globals.css";
import { cn } from "@/lib/shared/utils";

// 字体：next/font/google 在离线/墙内环境不可达（dev 冷缓存即 500），
// 改用系统字体栈经 CSS 变量注入（--font-sans / --font-geist-mono），globals.css 的 @theme 引用不变
const FONT_SANS = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, -apple-system, sans-serif';
const FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const metadata: Metadata = {
  title: "精益厨房 V3",
  description: "厨房管理系统",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <html
      lang="zh-CN"
      className={cn("h-full", "antialiased", "font-sans")}
      style={{ "--font-sans": FONT_SANS, "--font-geist-mono": FONT_MONO } as React.CSSProperties}
    >
      <body className="min-h-full flex bg-background">
        <TooltipProvider>
          <LayoutWrapper user={user}>
            {children}
          </LayoutWrapper>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
