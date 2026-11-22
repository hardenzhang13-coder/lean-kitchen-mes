"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, ClipboardList, History, Plus } from "lucide-react";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageTabs } from "@/app/components/ui/page-tabs";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { WorkbenchDialog } from "@/app/components/ui/workbench-dialog";
import { StockTab } from "@/app/components/inventory/stock-tab";
import { OutboundTab } from "@/app/components/inventory/outbound-tab";
import { LedgerTab } from "@/app/components/inventory/ledger-tab";
import NewOutboundPage from "@/app/inventory/outbound/new/page";

type TabKey = "stock" | "outbound" | "ledger";

const TABS = [
  { value: "stock", label: "当前库存", icon: Boxes },
  { value: "outbound", label: "出库单", icon: ClipboardList },
  { value: "ledger", label: "出入库流水", icon: History },
] as const;

function getTab(value: string | null): TabKey {
  return value === "outbound" || value === "ledger" ? value : "stock";
}

function InventoryTabs({ refreshToken }: { refreshToken: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = getTab(searchParams.get("tab"));

  return (
    <div className="skeu-panel flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageTabs
        tabs={[...TABS]}
        value={tab}
        onChange={(next) => router.replace(`/inventory?tab=${next}`)}
        ariaLabel="库存视图"
      />
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === "stock" && <StockTab />}
        {tab === "outbound" && <OutboundTab key={refreshToken} />}
        {tab === "ledger" && <LedgerTab />}
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [outboundVersion, setOutboundVersion] = useState(0);

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          title="库存管理"
          description="只管理切配中心加工完成的净菜（净料 + 小料），按份出入库"
          actions={
            <SkeuButton onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              创建出库单
            </SkeuButton>
          }
        />
      }
    >
      <Suspense
        fallback={
          <div
            className="flex min-h-0 flex-1 flex-col gap-4"
            aria-label="正在加载库存模块"
          >
            <div className="h-14 rounded-[12px] bg-muted animate-pulse" />
            <div className="flex-1 rounded-[12px] bg-muted animate-pulse" />
          </div>
        }
      >
        <InventoryTabs refreshToken={outboundVersion} />
      </Suspense>

      <WorkbenchDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="创建出库单"
        description="按门店排程单或切配中心内部生产单生成，按份出库，金额按净菜档案出库价自动核算"
      >
        {createOpen ? (
          <NewOutboundPage
            embedded
            onCancel={() => setCreateOpen(false)}
            onDone={() => {
              setCreateOpen(false);
              setOutboundVersion((value) => value + 1);
              router.replace("/inventory?tab=outbound");
            }}
          />
        ) : null}
      </WorkbenchDialog>
    </PageShell>
  );
}
