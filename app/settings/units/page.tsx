"use client";

import { useState } from "react";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
import { SkeuChipSelect, SkeuChipTag, type ChipOption } from "@/app/components/ui/skeu-chip";
import { SkeuActionButton } from "@/app/components/ui/skeu-row-action";
import { SimpleListPage } from "@/app/components/ui/simple-list-page";
import { DeleteConfirmDialog, type DeleteErrorInfo } from "@/app/components/ui/delete-confirm-dialog";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyValue } from "@/app/components/ui/empty-value";
import {
  RecordDialog,
  SimpleForm,
  isRecordDirty,
} from "@/app/components/ui/record-dialog";
import { toast } from "sonner";
import { formatUnitValue } from "@/lib/shared/display-format";

type Unit = {
  id: number;
  name: string;
  category: string;
  gramsPerUnit: number | string | null;
  isActive: boolean;
};

const categories: ChipOption[] = [
  { value: "weight", label: "重量", tone: "orange" },
  { value: "volume", label: "体积", tone: "blue" },
  { value: "count", label: "计数", tone: "violet" },
  { value: "other", label: "其他", tone: "slate" },
];

function categoryOption(value: string) {
  return categories.find((c) => c.value === value);
}

const emptyForm = { name: "", category: "", gramsPerUnit: "" };

function categoryLabel(value: string) {
  return categoryOption(value)?.label || value;
}

export default function UnitsPage() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<Unit | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deleteError, setDeleteError] = useState<DeleteErrorInfo | null>(null);

  const closeRecord = () => {
    setRecordOpen(false);
    setRecordMode("create");
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

  const openEdit = (row: Unit) => {
    const nextForm = {
      name: row.name,
      category: row.category,
      gramsPerUnit: row.gramsPerUnit != null ? String(Number(row.gramsPerUnit)) : "",
    };
    setSelected(row);
    setRecordMode("edit");
    setForm(nextForm);
    setBaselineForm(nextForm);
    setRecordOpen(true);
  };

  const handleSubmit = async (refresh: () => void) => {
    if (!form.name.trim()) {
      toast.error("名称不能为空");
      return;
    }
    if (!categoryOption(form.category)) {
      toast.error("请选择分类");
      return;
    }
    const gramsRaw = form.gramsPerUnit.trim();
    if (gramsRaw && (!Number.isFinite(Number(gramsRaw)) || Number(gramsRaw) <= 0)) {
      toast.error("换算克数必须大于 0");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        gramsPerUnit:
          form.category === "weight" && gramsRaw ? Number(gramsRaw) : null,
      };
      const res = selected
        ? await fetch(`/api/units/${selected.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/units", {
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

  const toggleActive = async (row: Unit, refresh: () => void) => {
    try {
      const res = await fetch(`/api/units/${row.id}`, {
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
        toast.warning(`已停用「${row.name}」`);
      } else {
        toast.success(`已启用「${row.name}」`);
      }
      refresh();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleDelete = async (refresh: () => void) => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/units/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError({ message: json.error || "删除失败", references: json.references });
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
    <SimpleListPage<Unit>
      title="单位"
      description="管理重量、体积、计数等单位字典；重量类单位的换算克数驱动全系统斤/克换算"
      entityLabel="单位"
      listUrl="/api/units?page=1&pageSize=100&includeInactive=1"
      searchPlaceholder="搜索名称或分类..."
      searchIn={(row) => [row.name, categoryLabel(row.category)]}
      statusFilter
      createLabel="新增"
      onCreate={openCreate}
      columns={[
        {
          header: "名称",
          className: "w-[160px]",
          cell: (row) => (
            <span className="font-semibold">{row.name}</span>
          ),
        },
        {
          header: "分类",
          className: "w-[100px]",
          cell: (row) => (
            <SkeuChipTag tone={categoryOption(row.category)?.tone ?? "slate"}>
              {categoryLabel(row.category)}
            </SkeuChipTag>
          ),
        },
        {
          header: "换算值",
          className: "w-[130px]",
          cell: (row) =>
            row.category === "weight" ? (
              <span className="tabular-nums">
                {formatUnitValue(row.gramsPerUnit, "g/单位", "未设置", " ")}
              </span>
            ) : (
              <EmptyValue />
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
      rowActions={(row, { refresh }) => (
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
      )}
    >
      {({ refresh }) => (
        <>
          <RecordDialog
            open={recordOpen}
            onOpenChange={(open) => {
              if (!open) closeRecord();
            }}
            mode={recordMode}
            title={recordMode === "create" ? "新增单位" : "编辑单位"}
            onCancel={closeRecord}
            onSubmit={() => handleSubmit(refresh)}
            dirty={isRecordDirty(form, baselineForm)}
            submitting={submitting}
            entityLabel="单位"
          >
            <SimpleForm>
              <FormField id="name" label="名称" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如 斤"
                  className="h-11 text-base px-4"
                />
              </FormField>
              <FormField label="分类" required>
                <SkeuChipSelect
                  ariaLabel="单位分类"
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  options={categories}
                />
              </FormField>
              {form.category === "weight" && (
                <FormField
                  id="gramsPerUnit"
                  label="换算克数"
                  hint="选填；填写后驱动全系统斤/克换算（采购规格换算、每斤单价、切配展示）"
                >
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.gramsPerUnit}
                    onChange={(e) => setForm({ ...form, gramsPerUnit: e.target.value })}
                    placeholder="1 单位合多少克，如 斤 = 500"
                    className="h-11 text-base px-4"
                  />
                </FormField>
              )}
            </SimpleForm>
          </RecordDialog>

          <DeleteConfirmDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
            message={
              <>
                确定要删除单位「{deleteTarget?.name}」吗？此操作不可撤销。
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
