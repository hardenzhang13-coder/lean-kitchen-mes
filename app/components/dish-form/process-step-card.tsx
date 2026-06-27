"use client";

import { ProcessStep, ProcessStage, STAGE_COLORS } from "./types";
import { cn } from "@/lib/utils";

interface ProcessStepCardProps {
  step: ProcessStep;
  stepNo: number;
  stage: ProcessStage;
  actions?: React.ReactNode;
}

export function ProcessStepCard({ step, stepNo, stage, actions }: ProcessStepCardProps) {
  const colors = STAGE_COLORS[stage];
  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br text-[10px] font-bold text-white shrink-0",
            colors.step
          )}
        >
          {stepNo}
        </span>
        <span className="text-sm font-semibold">{step.action}</span>
        {actions && <div className="ml-auto flex items-center gap-0.5">{actions}</div>}
        {!actions && step.object && (
          <span className="text-xs text-muted-foreground ml-auto">{step.object}</span>
        )}
      </div>
      {step.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
      )}
      {step.standard && (
        <div className="flex items-center gap-2 text-xs font-medium text-green-600">
          <span className="h-4 w-4 rounded-full bg-green-100 flex items-center justify-center text-green-600">✓</span>
          {step.standard}
        </div>
      )}
      {step.tool && (
        <div className="text-xs text-muted-foreground">工具：{step.tool}</div>
      )}
      {actions && step.object && (
        <div className="text-xs text-muted-foreground">加工对象：{step.object}</div>
      )}
    </div>
  );
}
