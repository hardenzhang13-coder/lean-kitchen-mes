import type { Metadata } from "next";
import { Geist_Mono, DM_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { LayoutWrapper } from "./components/layout-wrapper";
import { getCurrentUser } from "@/lib/session";
import "./globals.css";
import { cn } from "@/lib/utils";

const dmSans = DM_Sans({subsets:['latin'],variable:'--font-sans'});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      className={cn("h-full", "antialiased", geistMono.variable, "font-sans", dmSans.variable)}
    >
      <body className="min-h-full flex bg-background">
        <LayoutWrapper user={user}>
          {children}
        </LayoutWrapper>
        <Toaster />
      </body>
    </html>
  );
}
