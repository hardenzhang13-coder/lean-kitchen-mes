"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
import { SkeuSegmented } from "@/app/components/ui/skeu-segmented";
import { SkeuActionButton } from "@/app/components/ui/skeu-row-action";
import { SimpleListPage } from "@/app/components/ui/simple-list-page";
import { DeleteConfirmDialog, type DeleteErrorInfo } from "@/app/components/ui/delete-confirm-dialog";
import { CodeText } from "@/app/components/ui/code-text";
import { EmptyValue } from "@/app/components/ui/empty-value";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  RecordDialog,
  RecordView,
  SimpleForm,
  isRecordDirty,
} from "@/app/components/ui/record-dialog";
import { toast } from "sonner";

type Store = {
  id: number;
  code: string;
  name: string;
  manager: string | null;
  phone: string | null;
  address: string | null;
  isSystem: boolean;
  isActive: boolean;
};

const emptyForm = {
  name: "",
  manager: "",
  phone: "",
  address: "",
  isActive: "1",
};

export default function StoresPage() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"view" | "create" | "edit">("view");
  const [selected, setSelected] = useState<Store | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Store | null>(null);
  const [deleteError, setDeleteError] = useState<DeleteErrorInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const openEdit = (row: Store) => {
    const nextForm = {
      name: row.name,
      manager: row.manager || "",
      phone: row.phone || "",
      address: row.address || "",
      isActive: row.isActive ? "1" : "0",
    };
    setSelected(row);
    setRecordMode("edit");
    setForm(nextForm);
    setBaselineForm(nextForm);
    setRecordOpen(true);
  };

  const handleSubmit = async (refresh: () => void) => {
    if (!form.name.trim()) {
      toast.error("门店名称不能为空");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        manager: form.manager || null,
        phone: form.phone || null,
        address: form.address || null,
      };
      let res: Response;
      if (selected) {
        res = await fetch(`/api/stores/${selected.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, isActive: form.isActive === "1" }),
        });
      } else {
        res = await fetch("/api/stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
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

  const handleDelete = async (refresh: () => void) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stores/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError({ message: json.error || "删除失败" });
        return;
      }
      toast.success("删除成功");
      setDeleteTarget(null);
      refresh();
    } catch {
      setDeleteError({ message: "删除失败" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SimpleListPage<Store>
      title="门店管理"
      description="管理门店信息，排程按门店组织生产"
      entityLabel="门店"
      listUrl="/api/stores?page=1&pageSize=100"
      searchPlaceholder="搜索名称、编号或负责人..."
      searchIn={(row) => [row.name, row.code, row.manager]}
      createLabel="新增门店"
      onCreate={openCreate}
      actionsWidth="w-[180px]"
      columns={[
        {
          header: "编号",
          className: "w-[90px]",
          cell: (row) => <CodeText>{row.code}</CodeText>,
        },
        {
          header: "名称",
          className: "w-[160px]",
          cell: (row) => <span className="font-semibold">{row.name}</span>,
        },
        {
          header: "负责人",
          className: "w-[100px]",
          cell: (row) => row.manager || <EmptyValue />,
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
          header: "地址",
          cell: (row) =>
            row.address ? (
              <span className="whitespace-nowrap">{row.address}</span>
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
      rowActions={(row) => (
        <>
          <SkeuActionButton
            label="删除"
            tone="danger"
            icon={<Trash2 className="h-3.5 w-3.5" />}
            disabled={row.isSystem}
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
                ? "新增门店"
                : recordMode === "edit"
                  ? "编辑门店"
                  : selected?.name ?? "门店"
            }
            meta={
              recordMode === "view" && selected ? (
                <>
                  <span className="tabular-nums">{selected.code}</span>
                  <StatusBadge
                    status={selected.isActive ? "启用中" : "已停用"}
                    variant={selected.isActive ? "success" : "neutral"}
                  />
                </>
              ) : undefined
            }
            onEdit={recordMode === "view" && selected ? () => openEdit(selected) : undefined}
            onCancel={closeRecord}
            onSubmit={() => handleSubmit(refresh)}
            dirty={recordMode !== "view" && isRecordDirty(form, baselineForm)}
            submitting={submitting}
            entityLabel="门店"
          >
            {recordMode === "view" && selected ? (
              <RecordView
                items={[
                  { label: "负责人", value: selected.manager || "—" },
                  {
                    label: "电话",
                    value: selected.phone ? (
                      <span className="tabular-nums">{selected.phone}</span>
                    ) : (
                      "—"
                    ),
                  },
                  {
                    label: "地址",
                    value: selected.address || "—",
                    wide: true,
                  },
                ]}
              />
            ) : (
              <SimpleForm>
                <FormField id="name" label="门店名称" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如：新金食堂"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="manager" label="负责人">
                  <Input
                    value={form.manager}
                    onChange={(e) => setForm({ ...form, manager: e.target.value })}
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="phone" label="联系电话">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="address" label="地址">
                  <Input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="h-11 text-base px-4"
                  />
                </FormField>
                {selected && !selected.isSystem && (
                  <FormField label="状态" required>
                    <SkeuSegmented
                      ariaLabel="门店状态"
                      value={form.isActive}
                      onChange={(v) => setForm({ ...form, isActive: v })}
                      options={[
                        { value: "1", label: "启用中" },
                        { value: "0", label: "停用" },
                      ]}
                    />
                  </FormField>
                )}
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
                确定要删除门店「{deleteTarget?.name}」吗？已被排程引用的门店无法删除。
              </>
            }
            error={deleteError}
            errorHint="该门店已被排程引用，无法删除；如不再使用可在编辑中停用。"
            onConfirm={() => handleDelete(refresh)}
            confirming={deleting}
          />
        </>
      )}
    </SimpleListPage>
  );
}
