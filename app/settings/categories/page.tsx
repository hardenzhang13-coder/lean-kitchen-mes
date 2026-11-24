"use client";

import { useState } from "react";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
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

type Category = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

/** 后端引用检查返回的引用明细 */
type CategoryReferences = Record<string, number>;

const emptyForm = { code: "", name: "", description: "" };

export default function CategoriesPage() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"view" | "create" | "edit">("view");
  const [selected, setSelected] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<(DeleteErrorInfo & { references?: CategoryReferences }) | null>(null);

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

  const openEdit = (row: Category) => {
    const nextForm = {
      code: row.code,
      name: row.name,
      description: row.description || "",
    };
    setSelected(row);
    setRecordMode("edit");
    setForm(nextForm);
    setBaselineForm(nextForm);
    setRecordOpen(true);
  };

  const handleSubmit = async (refresh: () => void) => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("编号和名称不能为空");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description || null,
      };
      const res = selected
        ? await fetch(`/api/dish-categories/${selected.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/dish-categories", {
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

  const toggleActive = async (row: Category, refresh: () => void) => {
    try {
      const res = await fetch(`/api/dish-categories/${row.id}`, {
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
      const res = await fetch(`/api/dish-categories/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        // 被引用时展示后端返回的引用明细，引导用户改停用
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
    <SimpleListPage<Category>
      title="菜品类别"
      description="管理菜品分类字典；被菜品引用的类别不可删除/改编号，可停用使新单据不再可选"
      entityLabel="菜品类别"
      listUrl="/api/dish-categories?page=1&pageSize=100&includeInactive=1"
      searchPlaceholder="搜索编号或名称..."
      searchIn={(row) => [row.name, row.code]}
      statusFilter
      sortable={{
        endpoint: "/api/dish-categories/reorder",
        getId: (row) => row.id,
        getLabel: (row) => row.name,
      }}
      createLabel="新增"
      onCreate={openCreate}
      columns={[
        {
          header: "编号",
          className: "w-[110px]",
          cell: (row) => <CodeText>{row.code}</CodeText>,
        },
        {
          header: "名称",
          className: "w-[150px]",
          cell: (row) => <span className="font-semibold">{row.name}</span>,
        },
        {
          header: "说明",
          cell: (row) =>
            row.description ? (
              <span className="whitespace-nowrap text-muted-foreground">
                {row.description}
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
            title={
              recordMode === "create"
                ? "新增菜品类别"
                : recordMode === "edit"
                  ? "编辑菜品类别"
                  : selected?.name ?? "菜品类别"
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
            entityLabel="菜品类别"
          >
            {recordMode === "view" && selected ? (
              <RecordView
                items={[
                  { label: "编号", value: selected.code, emphasis: true },
                  { label: "名称", value: selected.name },
                  { label: "说明", value: selected.description || "—", wide: true },
                ]}
              />
            ) : (
              <SimpleForm>
                <FormField id="code" label="编号" required hint="被菜品引用后不可修改编号；如不再使用请停用">
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="如 PORK"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="name" label="名称" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如 猪肉类"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="description" label="说明">
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                确定要删除菜品类别「{deleteTarget?.name}」吗？此操作不可撤销。
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
