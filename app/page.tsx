"use client";

import Link from "next/link";
import {
  CalendarDays,
  ShoppingCart,
  UtensilsCrossed,
  Package,
  Carrot,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  { href: "/schedules", label: "排程管理", icon: CalendarDays, color: "text-blue-500" },
  { href: "/purchases", label: "采购管理", icon: ShoppingCart, color: "text-green-500" },
  { href: "/inventory", label: "库存管理", icon: Package, color: "text-amber-500" },
  { href: "/dishes", label: "菜品库", icon: UtensilsCrossed, color: "text-rose-500" },
  { href: "/ingredients", label: "食材库", icon: Carrot, color: "text-orange-500" },
  { href: "/dictionaries", label: "数据字典", icon: BookOpen, color: "text-purple-500" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">工作台</h1>
        <p className="text-muted-foreground">欢迎使用精益厨房管理系统</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.href} href={m.href}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <Icon className={`h-8 w-8 ${m.color}`} />
                  <CardTitle className="text-lg">{m.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">点击进入{m.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
