"use client";

import { usePathname } from "next/navigation";
import { TabSwitcher } from "@/app/components/ui/tab-switcher";

/** 生产模块内的页面切换：生产计划单 / 内部生产单。 */
export function ProductionModuleSwitcher() {
  const pathname = usePathname();
  const isSelfProduction = pathname.startsWith("/self-production-orders");

  return (
    <TabSwitcher
      tabs={[
        {
          label: "生产计划单",
          href: "/production-plans",
          active: !isSelfProduction,
        },
        {
          label: "内部生产单",
          href: "/self-production-orders",
          active: isSelfProduction,
        },
      ]}
    />
  );
}
