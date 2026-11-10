"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/app/components/ui/page-header";
import { StockTab } from "@/app/components/inventory/stock-tab";
import { OutboundTab } from "@/app/components/inventory/outbound-tab";
import { LedgerTab } from "@/app/components/inventory/ledger-tab";

type TabKey = "stock" | "outbound" | "ledger";

const TABS: { key: TabKey; label: string }[] = [
  { key: "stock", label: "当前库存" },
  { key: "outbound", label: "出库单" },
  { key: "ledger", label: "出入库流水" },
];

/** 库存管理：净菜（净料+小料）按份出入库 */
export default function InventoryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("stock");

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

      <div>
        <div className="flex items-center gap-1 border-b">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
                (tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="pt-4">
          {tab === "stock" && <StockTab />}
          {tab === "outbound" && <OutboundTab />}
          {tab === "ledger" && <LedgerTab />}
        </div>
      </div>
    </div>
  );
}