"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/app/components/ui/page-header";
import { TabSwitcher } from "@/app/components/ui/tab-switcher";
import { StockTab } from "@/app/components/inventory/stock-tab";
import { OutboundTab } from "@/app/components/inventory/outbound-tab";
import { LedgerTab } from "@/app/components/inventory/ledger-tab";

type TabKey = "stock" | "outbound" | "ledger";

const TABS: { key: TabKey; label: string }[] = [
  { key: "stock", label: "当前库存" },
  { key: "outbound", label: "出库单" },
  { key: "ledger", label: "出入库流水" },
];

function getTab(value: string | null): TabKey {
  return value === "outbound" || value === "ledger" ? value : "stock";
}

function InventoryTabs() {
  const searchParams = useSearchParams();
  const tab = getTab(searchParams.get("tab"));

  return (
    <div>
      <TabSwitcher
        tabs={TABS.map((item) => ({
          label: item.label,
          href: `/inventory?tab=${item.key}`,
          active: tab === item.key,
        }))}
      />
      <div className="pt-4">
        {tab === "stock" && <StockTab />}
        {tab === "outbound" && <OutboundTab />}
        {tab === "ledger" && <LedgerTab />}
      </div>
    </div>
  );
}

/** 库存管理：净菜（净料+小料）按份出入库 */
export default function InventoryPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <PageHeader
          title="库存管理"
          description="只管理切配中心加工完成的净菜（净料 + 小料），按份出入库"
        />
        <Button onClick={() => router.push("/inventory/outbound/new")}>
          <Plus className="mr-2 h-4 w-4" />
          创建出库单
        </Button>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4" aria-label="正在加载库存模块">
            <div className="h-10 w-80 rounded-lg bg-muted animate-pulse" />
            <div className="h-[300px] rounded-lg bg-muted animate-pulse" />
          </div>
        }
      >
        <InventoryTabs />
      </Suspense>
    </div>
  );
}
