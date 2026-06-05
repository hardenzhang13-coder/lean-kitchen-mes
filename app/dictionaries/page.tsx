"use client";

import Link from "next/link";
import { Tags, FolderTree, Ruler, Truck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const dictItems = [
  {
    href: "/dictionaries/categories",
    label: "菜品类别",
    desc: "管理菜品分类，如猪肉类、牛肉类、蔬菜类等",
    icon: Tags,
    color: "text-rose-500",
    count: "19 项",
  },
  {
    href: "/dictionaries/classes",
    label: "食材分类",
    desc: "管理食材一级和二级分类体系",
    icon: FolderTree,
    color: "text-emerald-500",
    count: "8 + 25 项",
  },
  {
    href: "/dictionaries/units",
    label: "单位",
    desc: "管理重量、体积、计数等单位",
    icon: Ruler,
    color: "text-blue-500",
    count: "15 项",
  },
  {
    href: "/dictionaries/suppliers",
    label: "供应商",
    desc: "管理采购供应商信息",
    icon: Truck,
    color: "text-amber-500",
    count: "0 项",
  },
];

export default function DictionariesPage() {
  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">数据字典</h1>
        <p className="text-muted-foreground">管理系统基础数据</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {dictItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <Icon className={`h-8 w-8 ${item.color}`} />
                  <div className="flex-1">
                    <CardTitle className="text-lg">{item.label}</CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {item.count}
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
