"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/app/components/form-field";
import { SelectTileMode } from "@/app/components/select-tile-mode";
import { ProcessStep, ProcessStage, VALID_STAGES, STAGE_ORDER, STAGE_COLORS, TOOL_OPTIONS } from "./types";
import { ProcessStepForm } from "./process-step-form";
import { ProcessStepCard } from "./process-step-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProcessEditorProps {
  processes: ProcessStep[];
  objectOptions: string[];
  onChange: (processes: ProcessStep[]) => void;
  readOnly?: boolean;
}

const stageOptions = VALID_STAGES.map((s) => ({ value: s, label: s }));

export function ProcessEditor({ processes, objectOptions, onChange, readOnly }: ProcessEditorProps) {
  const [expandedStages, setExpandedStages] = useState<Set<ProcessStage>>(
    () => new Set(VALID_STAGES)
  );
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newStep, setNewStep] = useState<Partial<ProcessStep>>({
    stage: "初加工",
    object: "",
    action: "",
    description: "",
    tool: "人工",
  });

  const stepsByStage = useMemo(() => {
    const map: Record<ProcessStage, (ProcessStep & { _id: string })[]> = {
      "初加工": [],
      "预处理": [],
      "上灶加工": [],
      "出锅成品": [],
    };
    processes
      .slice()
      .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.stepNo - b.stepNo)
      .forEach((step, idx) => {
        map[step.stage].push({ ...step, _id: `step-${idx}` });
      });
    return map;
  }, [processes]);

  const toggleStage = (stage: ProcessStage) => {
    const next = new Set(expandedStages);
    if (next.has(stage)) next.delete(stage);
    else next.add(stage);
    setExpandedStages(next);
  };

  const updateStep = (id: string, nextStep: ProcessStep) => {
    const idx = processes.findIndex((_, i) => `step-${i}` === id);
    if (idx === -1) return;
    const next = [...processes];
    next[idx] = nextStep;
    onChange(next);
  };

  const removeStep = (id: string) => {
    const idx = processes.findIndex((_, i) => `step-${i}` === id);
    if (idx === -1) return;
    const next = [...processes];
    next.splice(idx, 1);
    onChange(next);
    if (editingStepId === id) setEditingStepId(null);
  };

  const moveStep = (id: string, direction: -1 | 1) => {
    const stageSteps = stepsByStage[idToStep(id)?.stage ?? "初加工"];
    const stageIndex = stageSteps.findIndex((s) => s._id === id);
    if (stageIndex === -1) return;
    const targetIndex = stageIndex + direction;
    if (targetIndex < 0 || targetIndex >= stageSteps.length) return;

    const next: ProcessStep[] = [];
    VALID_STAGES.forEach((stage) => {
      const list = stepsByStage[stage].map((s) => {
        const rest: ProcessStep & { _id?: string } = { ...s };
        delete rest._id;
        return rest;
      });
      if (stage === idToStep(id)?.stage) {
        const [a, b] = [list[stageIndex], list[targetIndex]];
        list[targetIndex] = a;
        list[stageIndex] = b;
      }
      next.push(...list);
    });
    onChange(next);
  };

  const handleAddConfirm = () => {
    const stage = newStep.stage as ProcessStage;
    if (!stage || !newStep.object || !newStep.action) {
      toast.error("请填写加工环节、加工对象和操作动作");
      return;
    }
    const stageList = stepsByStage[stage];
    const step: ProcessStep = {
      stage,
      stepNo: stageList.length + 1,
      object: newStep.object,
      action: newStep.action,
      description: newStep.description || null,
      tool: newStep.tool || "人工",
    };
    onChange([...processes, step]);
    setAddDialogOpen(false);
    setNewStep({
      stage: "初加工",
      object: "",
      action: "",
      description: "",
      tool: "人工",
    });
    setExpandedStages(new Set(VALID_STAGES));
  };

  const idToStep = (id: string): (ProcessStep & { _id: string }) | undefined => {
    return Object.values(stepsByStage)
      .flat()
      .find((s) => s._id === id);
  };

  const openAddDialog = (stage: ProcessStage) => {
    setNewStep((prev) => ({ ...prev, stage }));
    setAddDialogOpen(true);
  };

  const objectSelectOptions = objectOptions.map((o) => ({ value: o, label: o }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-heading font-medium">加工工艺</CardTitle>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              className="h-8 text-sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              添加步骤
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {VALID_STAGES.map((stage) => {
          const isEditingStage = editingStepId
            ? idToStep(editingStepId)?.stage === stage
            : false;
          const isExpanded = expandedStages.has(stage) || isEditingStage;
          const stageSteps = stepsByStage[stage];
          const colors = STAGE_COLORS[stage];

          return (
            <Card key={stage} className="overflow-hidden">
              <CardHeader className="py-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleStage(stage)}
                    className="flex items-center gap-2 flex-1 text-left min-w-0"
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", colors.dot)} />
                    <span className="text-sm font-semibold">{stage}</span>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full shrink-0", colors.badge)}>
                      {stageSteps.length} 步
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform ml-auto shrink-0",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>
                  {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openAddDialog(stage)}
                      className="h-7 text-xs shrink-0"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      添加步骤
                    </Button>
                  )}
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0 pb-3 space-y-2">
                  {stageSteps.length === 0 && !readOnly && (
                    <div className="text-sm text-muted-foreground py-2">该阶段暂无工序，点击上方“添加步骤”</div>
                  )}
                  {stageSteps.length === 0 && readOnly && (
                    <div className="text-sm text-muted-foreground py-2">该阶段暂无工序</div>
                  )}
                  {stageSteps.map((step, idx) => {
                    if (editingStepId === step._id) {
                      return (
                        <ProcessStepForm
                          key={step._id}
                          step={step}
                          objectOptions={objectOptions}
                          onChange={(next) => updateStep(step._id, next)}
                          onRemove={() => removeStep(step._id)}
                          onMoveUp={idx > 0 ? () => moveStep(step._id, -1) : undefined}
                          onMoveDown={idx < stageSteps.length - 1 ? () => moveStep(step._id, 1) : undefined}
                          readOnly={readOnly}
                        />
                      );
                    }
                    return (
                      <ProcessStepCard
                        key={step._id}
                        step={step}
                        stepNo={idx + 1}
                        stage={stage}
                        actions={
                          !readOnly
                            ? [
                                idx > 0 && (
                                  <Button
                                    key="up"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => moveStep(step._id, -1)}
                                    className="h-7 w-7"
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </Button>
                                ),
                                idx < stageSteps.length - 1 && (
                                  <Button
                                    key="down"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => moveStep(step._id, 1)}
                                    className="h-7 w-7"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                ),
                                <Button
                                  key="edit"
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingStepId(step._id);
                                    setExpandedStages(new Set(VALID_STAGES));
                                  }}
                                  className="h-7 w-7"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>,
                                <Button
                                  key="remove"
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeStep(step._id)}
                                  className="h-7 w-7 text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>,
                              ].filter(Boolean)
                            : undefined
                        }
                      />
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </CardContent>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-lg">添加加工步骤</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="加工环节" required>
                <SelectTileMode
                  options={stageOptions}
                  value={newStep.stage || ""}
                  onChange={(v) => setNewStep({ ...newStep, stage: v as ProcessStage })}
                  placeholder="请选择加工环节"
                  title="选择加工环节"
                  searchable={false}
                />
              </FormField>

              <FormField label="加工对象" required>
                {objectOptions.length > 0 ? (
                  <SelectTileMode
                    options={objectSelectOptions}
                    value={newStep.object || ""}
                    onChange={(v) => setNewStep({ ...newStep, object: v })}
                    placeholder="请选择加工对象"
                    title="选择加工对象"
                    searchable={objectOptions.length >= 5}
                  />
                ) : (
                  <Input
                    value={newStep.object || ""}
                    onChange={(e) => setNewStep({ ...newStep, object: e.target.value })}
                    placeholder="暂无主料/辅料，请输入加工对象"
                    className="h-11 text-base px-4"
                  />
                )}
              </FormField>
            </div>

            <FormField label="操作动作" required>
              <Input
                value={newStep.action || ""}
                onChange={(e) => setNewStep({ ...newStep, action: e.target.value })}
                placeholder="请输入操作动作"
                className="h-11 text-base px-4"
              />
            </FormField>

            <FormField label="详细操作描述">
              <Textarea
                value={newStep.description || ""}
                onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                placeholder="请输入详细操作描述"
                rows={2}
                className="text-base px-4 py-3 resize-none"
              />
            </FormField>

            <FormField label="工具">
              <SelectTileMode
                options={TOOL_OPTIONS}
                value={newStep.tool || "人工"}
                onChange={(v) => setNewStep({ ...newStep, tool: v })}
                placeholder="请选择工具"
                title="选择工具"
                searchable={false}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="h-11 px-6">
              取消
            </Button>
            <Button onClick={handleAddConfirm} className="h-11 px-6">
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
