"use client";

import { ProcessAccordion } from "./process-accordion";
import { ProcessStep } from "./types";

interface ProcessDisplayProps {
  processes: ProcessStep[];
}

/** 加工工艺只读展示（详情页 / 抽屉复用）：面板容器 + 阶段折叠手风琴。 */
export function ProcessDisplay({ processes }: ProcessDisplayProps) {
  return (
    <section className="skeu-panel">
      <header className="skeu-surface-muted border-b border-skeu-border px-5 py-3.5">
        <h3 className="text-sm font-semibold">加工工艺</h3>
      </header>
      <div className="p-4">
        <ProcessAccordion processes={processes} />
      </div>
    </section>
  );
}
