"use client";

import { useState } from "react";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
import { SkeuActionButton } from "@/app/components/ui/skeu-row-action";
import { SimpleListPage } from "@/app/components/ui/simple-list-page";
import { DeleteConfirmDialog, type DeleteErrorInfo } from "@/app/components/ui/delete-confirm-dialog";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  RecordDialog,
  RecordView,
  SimpleForm,
  isRecordDirty,
} from "@/app/components/ui/record-dialog";
import { toast } from "sonner";

type PortionProfile = {
  id: number;
  portion: string;
  scenario: string;
  multiplier: number;
  isBase: boolean;
  isActive: boolean;
  sortOrder: number;
};

const emptyForm = { scenario: "", portion: "", multiplier: "1" };

/** 计算规则列：基本单元显示固定文案，其余按「单人份 × N」公式展示 */
function multiplierText(row: PortionProfile) {
  return row.isBase ? "基本单元" : `单人份 × ${row.multiplier}`;
}

export default function PortionsPage() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"view" | "create" | "edit">("view");
  const [selected, setSelected] = useState<PortionProfile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PortionProfile | null>(null);
  const [deleteError, setDeleteError] = useState<DeleteErrorInfo | null>(null);

  const closeRecord = () => {
    setRecordOpen(false);
    setRecordMode("view");
    setSelected(null);
    setForm(emptyForm);
    setBaselineForm(emptyForm);
  };

  const openCreate = () => {
    setSelected(null);
    setRecordMode("create");
    setForm(emptyForm);
    setBaselineForm(emptyForm);
    setRecordOpen(true);
  };

  const openEdit = (row: PortionProfile) => {
    const nextForm = {
      scenario: row.scenario,
      portion: row.portion,
      multiplier: String(row.multiplier),
    };
    setSelected(row);
    setRecordMode("edit");
    setForm(nextForm);
    setBaselineForm(nextForm);
    setRecordOpen(true);
  };

  const parseMultiplier = (): number | null => {
    const n = Number(form.multiplier);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
  };

  const handleSubmit = async (refresh: () => void) => {
    if (!form.scenario.trim() || !form.portion.trim()) {
      toast.error("场景和份量不能为空");
      return;
    }
    const multiplier = parseMultiplier();
    if (multiplier === null) {
      toast.error("倍率须为正整数");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        scenario: form.scenario.trim(),
        portion: form.portion.trim(),
        multiplier,
      };
      const res = selected
        ? await fetch(`/api/portion-profiles/${selected.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/portion-profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "操作失败");
        return;
      }
      toast.success(selected ? "更新成功" : "创建成功");
      closeRecord();
      refresh();
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row: PortionProfile, refresh: () => void) => {
    try {
      const res = await fetch(`/api/portion-profiles/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "操作失败");
        return;
      }
      if (row.isActive) {
        toast.warning(`已停用「${row.portion}」`);
      } else {
        toast.success(`已启用「${row.portion}」`);
      }
      refresh();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleDelete = async (refresh: () => void) => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/portion-profiles/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError({ message: json.error || "删除失败" });
        return;
      }
      toast.success("删除成功");
      setDeleteTarget(null);
      refresh();
    } catch {
      setDeleteError({ message: "删除失败，请稍后重试" });
    }
  };

  return (
    <SimpleListPage<PortionProfile>
      title="份量"
      description="管理份量档案：场景、份量标签与计算倍率；单人份为基本单元，系统自动维护"
      entityLabel="份量"
      listUrl="/api/portion-profiles?page=1&pageSize=100&includeInactive=1"
      searchPlaceholder="搜索场景或份量..."
      searchIn={(row) => [row.scenario, row.portion]}
      statusFilter
      createLabel="新增"
      onCreate={openCreate}
      columns={[
        {
          header: "场景",
          className: "w-[150px]",
          cell: (row) => <span className="text-primary font-semibold">{row.scenario}</span>,
        },
        {
          header: "份量",
          className: "w-[180px]",
          cell: (row) => <span className="font-semibold">{row.portion}</span>,
        },
        {
          header: "计算规则",
          cell: (row) => (
            <span className="whitespace-nowrap text-muted-foreground">
              {multiplierText(row)}
            </span>
          ),
        },
        {
          header: "状态",
          className: "w-[100px]",
          cell: (row) => (
            <StatusBadge
              status={row.isActive ? "启用中" : "已停用"}
              variant={row.isActive ? "success" : "neutral"}
            />
          ),
        },
      ]}
      rowActions={(row, { refresh }) =>
        row.isBase ? null : (
          <>
            <SkeuActionButton
              label="删除"
              tone="danger"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              onClick={(event) => {
                event.stopPropagation();
                setDeleteTarget(row);
                setDeleteError(null);
              }}
            />
            <SkeuActionButton
              label={row.isActive ? "停用" : "启用"}
              tone={row.isActive ? "warn" : "ok"}
              icon={
                row.isActive ? (
                  <PowerOff className="h-3.5 w-3.5" />
                ) : (
                  <Power className="h-3.5 w-3.5" />
                )
              }
              onClick={(event) => {
                event.stopPropagation();
                toggleActive(row, refresh);
              }}
            />
            <SkeuActionButton
              label="编辑"
              icon={<Pencil className="h-3.5 w-3.5" />}
              onClick={(event) => {
                event.stopPropagation();
                openEdit(row);
              }}
            />
          </>
        )
      }
    >
      {({ refresh }) => (
        <>
          <RecordDialog
            open={recordOpen}
            onOpenChange={(open) => {
              if (!open) closeRecord();
            }}
            mode={recordMode}
            title={
              recordMode === "create"
                ? "新增份量"
                : recordMode === "edit"
                  ? "编辑份量"
                  : selected?.portion ?? "份量"
            }
            meta={
              recordMode === "view" && selected ? (
                <StatusBadge
                  status={selected.isActive ? "启用中" : "已停用"}
                  variant={selected.isActive ? "success" : "neutral"}
                />
              ) : undefined
            }
            onEdit={recordMode === "view" && selected && !selected.isBase ? () => openEdit(selected) : undefined}
            onCancel={closeRecord}
            onSubmit={() => handleSubmit(refresh)}
            dirty={recordMode !== "view" && isRecordDirty(form, baselineForm)}
            submitting={submitting}
            entityLabel="份量"
          >
            {recordMode === "view" && selected ? (
              <RecordView
                items={[
                  { label: "场景", value: selected.scenario, emphasis: true },
                  { label: "份量", value: selected.portion },
                  { label: "计算规则", value: multiplierText(selected) },
                ]}
              />
            ) : (
              <SimpleForm>
                {recordMode === "create" && (
                  <p className="text-xs text-muted-foreground">
                    单人份为基本单元，由系统自动维护，无需新建；场景份量 = 单人份 × 倍率
                  </p>
                )}
                <FormField id="scenario" label="场景" required hint="同一场景可维护多行（不同倍率），如 社区">
                  <Input
                    value={form.scenario}
                    onChange={(e) => setForm({ ...form, scenario: e.target.value })}
                    placeholder="如 社区"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="portion" label="份量" required hint="全表唯一，如 社区·2份">
                  <Input
                    value={form.portion}
                    onChange={(e) => setForm({ ...form, portion: e.target.value })}
                    placeholder="如 社区·2份"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="multiplier" label="计算规则" required hint="输入正整数倍率：该份量 = 单人份 × 倍率">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={form.multiplier}
                    onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
                    className="h-11 text-base px-4"
                  />
                  <p className="text-xs text-muted-foreground">
                    {parseMultiplier() !== null
                      ? `单人份 × ${parseMultiplier()}`
                      : "倍率须为正整数"}
                  </p>
                </FormField>
              </SimpleForm>
            )}
          </RecordDialog>

          <DeleteConfirmDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
            message={
              <>
                确定要删除份量「{deleteTarget?.portion}」吗？此操作不可撤销。
              </>
            }
            error={deleteError}
            onConfirm={() => handleDelete(refresh)}
          />
        </>
      )}
    </SimpleListPage>
  );
}
