"use client";

import { X, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/app/components/form-field";
import { SelectTileMode } from "@/app/components/select-tile-mode";
import { ProcessStep, TOOL_OPTIONS } from "./types";

interface ProcessStepFormProps {
  step: ProcessStep;
  objectOptions: string[];
  onChange: (step: ProcessStep) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  readOnly?: boolean;
}

export function ProcessStepForm({
  step,
  objectOptions,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  readOnly,
}: ProcessStepFormProps) {
  const objectSelectOptions = objectOptions.map((o) => ({ value: o, label: o }));

  return (
    <div className="bg-muted/30 rounded-lg p-4 space-y-4">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="加工环节" required>
            <SelectTileMode
              options={[
                { value: "初加工", label: "初加工" },
                { value: "预处理", label: "预处理" },
                { value: "上灶加工", label: "上灶加工" },
                { value: "出锅成品", label: "出锅成品" },
              ]}
              value={step.stage}
              onChange={(v) => onChange({ ...step, stage: v as ProcessStep["stage"] })}
              placeholder="请选择加工环节"
              title="选择加工环节"
              searchable={false}
              disabled={readOnly}
            />
          </FormField>

          <FormField label="加工对象" required>
            {objectOptions.length > 0 ? (
              <SelectTileMode
                options={objectSelectOptions}
                value={step.object}
                onChange={(v) => onChange({ ...step, object: v })}
                placeholder="请选择加工对象"
                title="选择加工对象"
                searchable={objectOptions.length >= 5}
                disabled={readOnly}
              />
            ) : (
              <Input
                value={step.object}
                onChange={(e) => onChange({ ...step, object: e.target.value })}
                placeholder="暂无主料/辅料，请输入加工对象"
                disabled={readOnly}
                className="h-11 text-base px-4"
              />
            )}
          </FormField>
        </div>

        <FormField label="操作动作" required>
          <Input
            value={step.action}
            onChange={(e) => onChange({ ...step, action: e.target.value })}
            placeholder="请输入操作动作"
            disabled={readOnly}
            className="h-11 text-base px-4"
          />
        </FormField>

        <FormField label="详细操作描述">
          <Textarea
            value={step.description || ""}
            onChange={(e) => onChange({ ...step, description: e.target.value })}
            placeholder="请输入详细操作描述"
            disabled={readOnly}
            rows={2}
            className="text-base px-4 py-3 resize-none"
          />
        </FormField>

        <FormField label="工具">
          <SelectTileMode
            options={TOOL_OPTIONS}
            value={step.tool || "人工"}
            onChange={(v) => onChange({ ...step, tool: v })}
            placeholder="请选择工具"
            title="选择工具"
            searchable={false}
            disabled={readOnly}
          />
        </FormField>
      </div>

      {!readOnly && (
        <div className="flex items-center justify-end gap-1">
          {onMoveUp && (
            <Button type="button" variant="ghost" size="icon" onClick={onMoveUp} className="h-7 w-7">
              <GripVertical className="h-4 w-4 rotate-180" />
            </Button>
          )}
          {onMoveDown && (
            <Button type="button" variant="ghost" size="icon" onClick={onMoveDown} className="h-7 w-7">
              <GripVertical className="h-4 w-4" />
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} className="h-7 w-7 text-destructive">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
