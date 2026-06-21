"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/app/components/select-field";

export type ProcessStep = {
  id?: number;
  stage: string;
  stepNo: number;
  object: string;
  action: string;
  description?: string | null;
  tool?: string | null;
  standard?: string | null;
};

const STAGE_OPTIONS = [
  { value: "初加工", label: "初加工" },
  { value: "预处理", label: "预处理" },
  { value: "上灶加工", label: "上灶加工" },
  { value: "出锅成品", label: "出锅成品" },
];

interface ProcessTimelineProps {
  steps: ProcessStep[];
  onChange: (steps: ProcessStep[]) => void;
  readOnly?: boolean;
}

export function ProcessTimeline({ steps, onChange, readOnly = false }: ProcessTimelineProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProcessStep[]>(steps);

  const stages = Array.from(new Set(steps.map((s) => s.stage)));
  const stageOrder = ["初加工", "预处理", "上灶加工", "出锅成品"];
  const sortedStages = stageOrder.filter((s) => stages.includes(s));

  const startEdit = () => {
    setDraft([...steps]);
    setEditing(true);
  };

  const save = () => {
    // Reassign stepNo within each stage
    const byStage: Record<string, ProcessStep[]> = {};
    draft.forEach((s) => {
      if (!byStage[s.stage]) byStage[s.stage] = [];
      byStage[s.stage].push(s);
    });
    const reordered: ProcessStep[] = [];
    stageOrder.forEach((stage) => {
      const list = byStage[stage] || [];
      list.forEach((s, idx) => {
        reordered.push({ ...s, stepNo: idx + 1 });
      });
    });
    onChange(reordered);
    setEditing(false);
  };

  const addStep = (stage: string) => {
    const stageSteps = draft.filter((s) => s.stage === stage);
    const nextNo = stageSteps.length + 1;
    setDraft([
      ...draft,
      { stage, stepNo: nextNo, object: "", action: "", description: "", tool: "", standard: "" },
    ]);
  };

  const removeStep = (index: number) => {
    setDraft(draft.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const newDraft = [...draft];
    const target = index + direction;
    if (target < 0 || target >= newDraft.length) return;
    [newDraft[index], newDraft[target]] = [newDraft[target], newDraft[index]];
    setDraft(newDraft);
  };

  const updateStep = (index: number, field: keyof ProcessStep, value: string) => {
    const newDraft = [...draft];
    newDraft[index] = { ...newDraft[index], [field]: value };
    setDraft(newDraft);
  };

  if (!editing) {
    return (
      <div className="space-y-4">
        {!readOnly && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={startEdit}>
              编辑工艺
            </Button>
          </div>
        )}
        {sortedStages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">暂无加工工艺</div>
        ) : (
          sortedStages.map((stage) => (
            <div key={stage} className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {stage}
              </h4>
              <div className="space-y-2">
                {steps
                  .filter((s) => s.stage === stage)
                  .sort((a, b) => a.stepNo - b.stepNo)
                  .map((step) => (
                    <div
                      key={`${stage}-${step.stepNo}`}
                      className="rounded-lg border bg-muted/20 p-3 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium w-5 h-5 shrink-0">
                          {step.stepNo}
                        </span>
                        <span className="font-medium text-sm">
                          {step.object} → {step.action}
                        </span>
                      </div>
                      {step.description && (
                        <p className="text-xs text-muted-foreground pl-7">{step.description}</p>
                      )}
                      <div className="flex items-center gap-3 pl-7 text-xs text-muted-foreground">
                        {step.tool && <span>工具: {step.tool}</span>}
                        {step.standard && <span>标准: {step.standard}</span>}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stageOrder.map((stage) => {
        const stageSteps = draft.filter((s) => s.stage === stage);
        return (
          <div key={stage} className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {stage}
              </h4>
              <Button type="button" variant="ghost" size="sm" onClick={() => addStep(stage)}>
                <Plus className="h-4 w-4 mr-1" />
                添加步骤
              </Button>
            </div>
            <div className="space-y-2">
              {stageSteps.map((step, idx) => {
                const globalIndex = draft.indexOf(step);
                return (
                  <div key={globalIndex} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium w-5 h-5 shrink-0">
                        {step.stepNo}
                      </span>
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Input
                          value={step.object}
                          onChange={(e) => updateStep(globalIndex, "object", e.target.value)}
                          placeholder="对象"
                          className="h-9 text-sm"
                        />
                        <Input
                          value={step.action}
                          onChange={(e) => updateStep(globalIndex, "action", e.target.value)}
                          placeholder="动作"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="上移步骤"
                          onClick={() => moveStep(globalIndex, -1)}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label="下移步骤"
                          onClick={() => moveStep(globalIndex, 1)}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          aria-label="删除步骤"
                          onClick={() => removeStep(globalIndex)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pl-6">
                      <Input
                        value={step.description || ""}
                        onChange={(e) => updateStep(globalIndex, "description", e.target.value)}
                        placeholder="描述（可选）"
                        className="h-9 text-sm"
                      />
                      <Input
                        value={step.tool || ""}
                        onChange={(e) => updateStep(globalIndex, "tool", e.target.value)}
                        placeholder="工具（可选）"
                        className="h-9 text-sm"
                      />
                      <Input
                        value={step.standard || ""}
                        onChange={(e) => updateStep(globalIndex, "standard", e.target.value)}
                        placeholder="标准（可选）"
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => setEditing(false)}>
          取消
        </Button>
        <Button onClick={save}>保存工艺</Button>
      </div>
    </div>
  );
}
