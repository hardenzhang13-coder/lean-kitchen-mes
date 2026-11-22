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

type NetPackaging = {
  id: number;
  name: string;
  size: string;
  isActive: boolean;
};

const emptyForm = { name: "", size: "" };

export default function NetPackagingsPage() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"view" | "create" | "edit">("view");
  const [selected, setSelected] = useState<NetPackaging | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NetPackaging | null>(null);
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

  const openEdit = (row: NetPackaging) => {
    const nextForm = { name: row.name, size: row.size };
    setSelected(row);
    setRecordMode("edit");
    setForm(nextForm);
    setBaselineForm(nextForm);
    setRecordOpen(true);
  };

  const handleSubmit = async (refresh: () => void) => {
    if (!form.name.trim() || !form.size.trim()) {
      toast.error("包装名称和包装尺寸不能为空");
      return;
    }
    setSubmitting(true);
    try {
      const payload = { name: form.name.trim(), size: form.size.trim() };
      const res = selected
        ? await fetch(`/api/net-packagings/${selected.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/net-packagings", {
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

  const toggleActive = async (row: NetPackaging, refresh: () => void) => {
    try {
      const res = await fetch(`/api/net-packagings/${row.id}`, {
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
      const res = await fetch(`/api/net-packagings/${deleteTarget.id}`, {
        method: "DELETE",
      });
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
    <SimpleListPage<NetPackaging>
      title="净菜包装"
      description="管理净料封装使用的包装名称与尺寸；停用后新净料不可再选，历史档案保留原值"
      entityLabel="净菜包装"
      listUrl="/api/net-packagings?page=1&pageSize=100&includeInactive=1"
      searchPlaceholder="搜索包装名称或尺寸..."
      searchIn={(row) => [row.name, row.size]}
      statusFilter
      createLabel="新增包装"
      onCreate={openCreate}
      columns={[
        {
          header: "包装名称",
          className: "w-[180px]",
          cell: (row) => (
            <span className="font-semibold">{row.name}</span>
          ),
        },
        {
          header: "包装尺寸",
          className: "w-[180px]",
          cell: (row) => (
            <span className="whitespace-nowrap tabular-nums text-muted-foreground">
              {row.size}
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
            title={
              recordMode === "create"
                ? "新增净菜包装"
                : recordMode === "edit"
                  ? "编辑净菜包装"
                  : selected?.name ?? "净菜包装"
            }
            meta={
              recordMode === "view" && selected ? (
                <StatusBadge
                  status={selected.isActive ? "启用中" : "已停用"}
                  variant={selected.isActive ? "success" : "neutral"}
                />
              ) : undefined
            }
            onEdit={recordMode === "view" && selected ? () => openEdit(selected) : undefined}
            onCancel={closeRecord}
            onSubmit={() => handleSubmit(refresh)}
            dirty={recordMode !== "view" && isRecordDirty(form, baselineForm)}
            submitting={submitting}
            entityLabel="净菜包装"
          >
            {recordMode === "view" && selected ? (
              <RecordView
                items={[
                  { label: "包装名称", value: selected.name, emphasis: true },
                  {
                    label: "包装尺寸",
                    value: <span className="tabular-nums">{selected.size}</span>,
                    wide: true,
                  },
                ]}
              />
            ) : (
              <SimpleForm>
                <FormField id="name" label="包装名称" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如 密封袋"
                    maxLength={50}
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField
                  id="size"
                  label="包装尺寸"
                  required
                  hint="同一包装名称可配置多个尺寸；被净料引用后不可修改名称或尺寸，可停用。"
                >
                  <Input
                    value={form.size}
                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                    placeholder="如 50cm×40cm"
                    maxLength={100}
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
                确定要删除包装「{deleteTarget?.name} / {deleteTarget?.size}」吗？
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
