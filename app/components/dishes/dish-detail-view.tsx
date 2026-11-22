"use client";

import { useRouter } from "next/navigation";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageHeader } from "@/app/components/ui/page-header";
import { CodeText } from "@/app/components/ui/code-text";
import { DishStatusTag } from "@/app/components/ui/dish-status-tag";
import type { DishDetail } from "@/app/components/dish-form/types";
import { DishDetailActions } from "./dish-detail-actions";
import { DishDetailBody, formatDishDateTime } from "./dish-detail-body";

/**
 * 菜品展示型详情页（路由 /dishes/[id]）：与列表正面弹窗共用同一预览内容体，
 * 标题区挂编号 + 创建时间，操作簇在页头。
 */
export function DishDetailView({
  dish,
  onRefresh,
}: {
  dish: DishDetail;
  onRefresh: () => void;
}) {
  const router = useRouter();

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          showBack
          backHref="/dishes"
          backLabel="返回菜品库"
          title={dish.name}
          meta={<DishStatusTag status={dish.status} />}
          description={
            <div className="flex items-center gap-3">
              <CodeText>{dish.code}</CodeText>
              <span className="text-sm text-muted-foreground">
                创建于 {formatDishDateTime(dish.createdAt)}
              </span>
            </div>
          }
          actions={
            <DishDetailActions
              dish={dish}
              onChanged={onRefresh}
              onDeleted={() => router.push("/dishes")}
            />
          }
        />
      }
    >
      <DishDetailBody dish={dish} />
    </PageShell>
  );
}
