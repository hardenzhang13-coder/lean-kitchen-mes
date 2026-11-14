"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { BusinessNumberInput } from "@/app/components/ui/form-controls";

export type NetLabelTarget = {
  id: number;
  name: string;
  packageSpec: number | null;
};

export function NetLabelPrintDialog({
  target,
  onOpenChange,
}: {
  target: NetLabelTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="text-lg">打印净菜标签</DialogTitle>
        </DialogHeader>
        {target && (
          <NetLabelPrintForm
            key={target.id}
            target={target}
            onOpenChange={onOpenChange}
          />
        )}
      </AppDialogContent>
    </Dialog>
  );
}

function NetLabelPrintForm({
  target,
  onOpenChange,
}: {
  target: NetLabelTarget;
  onOpenChange: (open: boolean) => void;
}) {
  const [copies, setCopies] = useState("1");
  const [error, setError] = useState("");

  const confirm = () => {
    const count = Number(copies);
    if (!Number.isInteger(count) || count <= 0) {
      setError("请输入大于 0 的整数");
      return;
    }

    const query = new URLSearchParams({ copies: String(count) });
    window.open(
      `/ingredients/net/${target.id}/labels?${query.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
    onOpenChange(false);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="font-semibold">{target.name}</p>
          <p className="mt-1 text-muted-foreground">
            包装规格：
            {target.packageSpec != null
              ? `${target.packageSpec}g`
              : "未设置"}
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="net-label-copies" className="text-sm font-medium">
            本次打印数量
          </label>
          <BusinessNumberInput
            id="net-label-copies"
            min={1}
            step={1}
            value={copies}
            onChange={(event) => {
              setCopies(event.target.value);
              setError("");
            }}
            className="h-11 text-base"
          />
          {error ? (
            <p className="text-xs text-destructive">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">默认打印 1 张</p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button onClick={confirm}>
          <Printer className="mr-2 h-4 w-4" />
          进入打印
        </Button>
      </DialogFooter>
    </>
  );
}
