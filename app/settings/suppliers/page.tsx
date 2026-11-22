"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
import { SkeuActionButton } from "@/app/components/ui/skeu-row-action";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { SimpleListPage } from "@/app/components/ui/simple-list-page";
import { DeleteConfirmDialog, type DeleteErrorInfo } from "@/app/components/ui/delete-confirm-dialog";
import {
  RecordDialog,
  RecordView,
  SimpleForm,
  isRecordDirty,
} from "@/app/components/ui/record-dialog";
import { toast } from "sonner";

type Supplier = {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  remark: string | null;
};

const emptyForm = { name: "", contact: "", phone: "", remark: "" };

export default function SuppliersPage() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"view" | "create" | "edit">("view");
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
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

  const openEdit = (row: Supplier) => {
    const nextForm = {
      name: row.name,
      contact: row.contact || "",
      phone: row.phone || "",
      remark: row.remark || "",
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
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        contact: form.contact || null,
        phone: form.phone || null,
        remark: form.remark || null,
      };
      if (selected) {
        await fetch(`/api/suppliers/${selected.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("更新成功");
      } else {
        await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("创建成功");
      }
      closeRecord();
      refresh();
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (refresh: () => void) => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/suppliers/${deleteTarget.id}`, { method: "DELETE" });
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
    <SimpleListPage<Supplier>
      title="供应商"
      description="管理采购供应商信息"
      entityLabel="供应商"
      listUrl="/api/suppliers?page=1&pageSize=100"
      searchPlaceholder="搜索名称、联系人或电话..."
      searchIn={(row) => [row.name, row.contact, row.phone]}
      createLabel="新增"
      onCreate={openCreate}
      actionsWidth="w-[180px]"
      columns={[
        {
          header: "名称",
          className: "w-[180px]",
          cell: (row) => (
            <span className="font-semibold">{row.name}</span>
          ),
        },
        {
          header: "联系人",
          className: "w-[100px]",
          cell: (row) => row.contact || <EmptyValue />,
        },
        {
          header: "电话",
          className: "w-[130px]",
          cell: (row) =>
            row.phone ? (
              <span className="tabular-nums">{row.phone}</span>
            ) : (
              <EmptyValue />
            ),
        },
        {
          header: "备注",
          cell: (row) =>
            row.remark ? (
              <span className="whitespace-nowrap">{row.remark}</span>
            ) : (
              <EmptyValue />
            ),
        },
      ]}
      rowActions={(row) => (
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
            title={
              recordMode === "create"
                ? "新增供应商"
                : recordMode === "edit"
                  ? "编辑供应商"
                  : selected?.name ?? "供应商"
            }
            onEdit={recordMode === "view" && selected ? () => openEdit(selected) : undefined}
            onCancel={closeRecord}
            onSubmit={() => handleSubmit(refresh)}
            dirty={recordMode !== "view" && isRecordDirty(form, baselineForm)}
            submitting={submitting}
            entityLabel="供应商"
          >
            {recordMode === "view" && selected ? (
              <RecordView
                items={[
                  { label: "名称", value: selected.name, emphasis: true },
                  { label: "联系人", value: selected.contact || "—" },
                  {
                    label: "电话",
                    value: selected.phone ? (
                      <span className="tabular-nums">{selected.phone}</span>
                    ) : (
                      "—"
                    ),
                  },
                  { label: "备注", value: selected.remark || "—", wide: true },
                ]}
              />
            ) : (
              <SimpleForm>
                <FormField id="name" label="名称" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="供应商名称"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="contact" label="联系人">
                  <Input
                    value={form.contact}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="phone" label="电话">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="remark" label="备注">
                  <Input
                    value={form.remark}
                    onChange={(e) => setForm({ ...form, remark: e.target.value })}
                    className="h-11 text-base px-4"
                  />
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
                确定要删除供应商「{deleteTarget?.name}」吗？此操作不可撤销。
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
