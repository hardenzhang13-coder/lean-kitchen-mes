import Link from "next/link";
import { Clock3, ShieldCheck, ShoppingCart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/app/components/ui/page-header";
import { TRIAL_FEATURES } from "@/lib/shared/features";
import PurchasesView from "./purchases-view";

export default function PurchasesPage() {
  if (TRIAL_FEATURES.purchases) {
    return <PurchasesView />;
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <PageHeader title="采购管理" description="采购单、报销与采购单图片识别" />

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShoppingCart className="h-5 w-5 text-primary" />
            采购功能试运行期间暂未开放
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            当前已保留采购模块入口、历史数据和功能代码。试运行结束后，将根据业务安排重新开放采购录入、报销及 AI 识别能力。
          </p>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              采购数据仅保留，不允许通过页面或接口访问
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <Clock3 className="h-4 w-4 text-amber-600" />
              开放时间以试运行通知为准
            </div>
          </div>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            返回工作台
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
