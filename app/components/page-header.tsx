"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  title,
  description,
  showBack = false,
}: {
  title: string;
  description?: string;
  showBack?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex items-start gap-3">
      {showBack && (
        <Button
          variant="ghost"
          size="icon"
          className="mt-1 shrink-0"
          onClick={() => router.back()}
          title="返回上一级"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
