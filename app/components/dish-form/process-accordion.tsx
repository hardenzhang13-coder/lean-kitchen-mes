"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ProcessStep, ProcessStage, VALID_STAGES, STAGE_COLORS } from "./types";
import { ProcessStepCard } from "./process-step-card";
import { cn } from "@/lib/shared/utils";

interface ProcessAccordionProps {
  processes: ProcessStep[];
}

export function ProcessAccordion({ processes }: ProcessAccordionProps) {
  const [expanded, setExpanded] = useState<Set<ProcessStage>>(
    () => new Set(VALID_STAGES)
  );

  const toggle = (stage: ProcessStage) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  };

  if (processes.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        暂无加工工艺
      </div>
    );
  }

  const stepsByStage = VALID_STAGES.map((stage) => ({
    stage,
    steps: processes
      .filter((p) => p.stage === stage)
      .sort((a, b) => a.stepNo - b.stepNo),
  }));

  return (
    <div className="space-y-3">
      {stepsByStage.map(({ stage, steps }) => {
        const isExpanded = expanded.has(stage);
        const colors = STAGE_COLORS[stage];
        return (
          <section key={stage} className="skeu-surface-muted overflow-hidden rounded-lg border border-skeu-border">
            <header className="border-b border-skeu-border px-3 py-2.5">
              <button
                type="button"
                onClick={() => toggle(stage)}
                className="flex items-center gap-2 w-full text-left"
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", colors.dot)} />
                <span className="text-sm font-semibold">{stage}</span>
                <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", colors.badge)}>
                  {steps.length} 步
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform ml-auto",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>
            </header>
            {isExpanded && (
              <div className="skeu-surface space-y-2 p-3 pt-2">
                {steps.length === 0 && (
                  <div className="text-sm text-muted-foreground py-2">该阶段暂无工序</div>
                )}
                {steps.map((step, idx) => (
                  <ProcessStepCard key={idx} step={step} stepNo={idx + 1} stage={stage} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
