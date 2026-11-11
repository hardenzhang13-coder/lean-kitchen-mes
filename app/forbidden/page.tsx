import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ShieldX className="h-5 w-5 text-destructive" />
            无访问权限
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-muted-foreground">
            当前账号的角色无权访问此页面。如需调整权限，请联系系统管理员。
          </p>
          <Link href="/" className={buttonVariants()}>
            返回工作台
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
