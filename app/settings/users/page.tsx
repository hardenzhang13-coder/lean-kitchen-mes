"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { Input } from "@/app/components/ui/form-controls";
import { FormField } from "@/app/components/ui/form-field";
import { SkeuChipSelect, SkeuChipTag, type ChipOption } from "@/app/components/ui/skeu-chip";
import { SkeuActionButton } from "@/app/components/ui/skeu-row-action";
import { SimpleListPage } from "@/app/components/ui/simple-list-page";
import { DeleteConfirmDialog } from "@/app/components/ui/delete-confirm-dialog";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  RecordDialog,
  RecordView,
  SimpleForm,
  isRecordDirty,
} from "@/app/components/ui/record-dialog";
import { toast } from "sonner";
import { ROLE_OPTIONS } from "@/lib/shared/roles";

type User = {
  id: number;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CurrentUser = {
  id: number;
  username: string;
  name?: string | null;
  role?: string | null;
};

const emptyForm = { username: "", password: "", name: "", role: "" };

const roleOptions: ChipOption[] = ROLE_OPTIONS.map((r) => ({
  value: r.value,
  label: r.label,
  tone: r.tone,
}));

function roleLabel(value: string) {
  return roleOptions.find((r) => r.value === value)?.label || value;
}

function roleOption(value: string) {
  return roleOptions.find((r) => r.value === value);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UsersPage() {
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"view" | "create" | "edit">("view");
  const [selected, setSelected] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadUsers = useCallback(async (): Promise<User[]> => {
    const res = await fetch("/api/users?page=1&pageSize=100");
    const json = await res.json();
    return json.data || [];
  }, []);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const json = await res.json();
          setCurrentUser(json.data?.user);
        }
      } catch {
        // 当前用户信息失败不阻塞列表
      }
    };
    loadMe();
  }, []);

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

  const openEdit = (row: User) => {
    const nextForm = {
      username: row.username,
      password: "",
      name: row.name,
      role: row.role,
    };
    setSelected(row);
    setRecordMode("edit");
    setForm(nextForm);
    setBaselineForm(nextForm);
    setRecordOpen(true);
  };

  const handleSubmit = async (refresh: () => void) => {
    if (!form.username.trim() || !form.name.trim() || !form.role) {
      toast.error("账号、姓名和角色不能为空");
      return;
    }
    if (!selected && !form.password.trim()) {
      toast.error("创建用户时必须设置密码");
      return;
    }
    if (form.password.trim() && form.password.trim().length < 10) {
      toast.error("密码至少需要 10 位");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        username: form.username.trim(),
        name: form.name.trim(),
        role: form.role,
        password: form.password.trim() || undefined,
      };

      if (selected) {
        const res = await fetch(`/api/users/${selected.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "更新失败");
          return;
        }
        toast.success("更新成功");
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "创建失败");
          return;
        }
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
    if (deleteTarget.id === currentUser?.id) {
      toast.error("不能删除当前登录用户");
      setDeleteTarget(null);
      return;
    }
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "删除失败");
        return;
      }
      toast.warning("用户已停用并移出列表");
      setDeleteTarget(null);
      refresh();
    } catch {
      toast.error("删除失败");
    }
  };

  const handleToggleActive = async (row: User, refresh: () => void) => {
    if (row.id === currentUser?.id) {
      toast.error("不能停用当前登录用户");
      return;
    }
    try {
      const res = await fetch(`/api/users/${row.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "更新账号状态失败");
        return;
      }
      if (row.isActive) {
        toast.warning("账号已停用");
      } else {
        toast.success("账号已启用");
      }
      refresh();
    } catch {
      toast.error("更新账号状态失败");
    }
  };

  return (
    <SimpleListPage<User>
      title="用户管理"
      description="管理系统用户账号与角色权限"
      entityLabel="用户"
      loader={loadUsers}
      searchPlaceholder="搜索账号、姓名或角色..."
      searchIn={(row) => [row.username, row.name, row.role, roleLabel(row.role)]}
      createLabel="新增用户"
      onCreate={openCreate}
      columns={[
        {
          header: "账号",
          className: "w-[140px]",
          cell: (row) => <span className="font-medium">{row.username}</span>,
        },
        {
          header: "姓名",
          className: "w-[120px]",
          cell: (row) => (
            <span className="font-semibold">{row.name}</span>
          ),
        },
        {
          header: "角色",
          className: "w-[120px]",
          cell: (row) => (
            <SkeuChipTag tone={roleOption(row.role)?.tone ?? "slate"}>
              {roleLabel(row.role)}
            </SkeuChipTag>
          ),
        },
        {
          header: "状态",
          className: "w-[100px]",
          cell: (row) => (
            <StatusBadge
              status={row.isActive ? "启用" : "停用"}
              variant={row.isActive ? "success" : "danger"}
            />
          ),
        },
        {
          header: "创建时间",
          className: "w-[160px]",
          cell: (row) => (
            <span className="whitespace-nowrap tabular-nums text-muted-foreground">
              {formatDate(row.createdAt)}
            </span>
          ),
        },
      ]}
      rowActions={(row, { refresh }) => {
        const isSelf = row.id === currentUser?.id;
        return (
          <>
            <SkeuActionButton
              label="删除"
              tone="danger"
              icon={<Trash2 className="h-3.5 w-3.5" />}
              disabled={isSelf}
              onClick={(event) => {
                event.stopPropagation();
                setDeleteTarget(row);
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
              disabled={isSelf}
              onClick={(event) => {
                event.stopPropagation();
                handleToggleActive(row, refresh);
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
        );
      }}
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
                ? "新增用户"
                : recordMode === "edit"
                  ? "编辑用户"
                  : selected?.name ?? "用户"
            }
            meta={
              recordMode === "view" && selected ? (
                <>
                  <span>{selected.username}</span>
                  <SkeuChipTag tone={roleOption(selected.role)?.tone ?? "slate"}>
                    {roleLabel(selected.role)}
                  </SkeuChipTag>
                  <StatusBadge
                    status={selected.isActive ? "启用" : "停用"}
                    variant={selected.isActive ? "success" : "danger"}
                  />
                </>
              ) : undefined
            }
            onEdit={recordMode === "view" && selected ? () => openEdit(selected) : undefined}
            onCancel={closeRecord}
            onSubmit={() => handleSubmit(refresh)}
            dirty={recordMode !== "view" && isRecordDirty(form, baselineForm)}
            submitting={submitting}
            entityLabel="用户"
          >
            {recordMode === "view" && selected ? (
              <RecordView
                items={[
                  { label: "账号", value: selected.username, emphasis: true },
                  { label: "姓名", value: selected.name },
                  { label: "角色", value: roleLabel(selected.role) },
                  {
                    label: "创建时间",
                    value: formatDate(selected.createdAt),
                  },
                ]}
              />
            ) : (
              <SimpleForm>
                <FormField id="username" label="账号" required>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="登录账号"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField id="name" label="姓名" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="用户姓名"
                    className="h-11 text-base px-4"
                  />
                </FormField>
                <FormField label="角色" required>
                  <SkeuChipSelect
                    ariaLabel="用户角色"
                    value={form.role}
                    onChange={(v) => setForm({ ...form, role: v })}
                    options={roleOptions}
                  />
                </FormField>
                <FormField
                  id="password"
                  label="密码"
                  required={!selected}
                  hint={selected ? "留空则不修改" : "至少 10 位"}
                >
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={selected ? "留空则不修改" : "初始密码"}
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
            title="确认停用并移出列表"
            message={<>确定要停用用户「{deleteTarget?.name}」并移出列表吗？历史审计记录会保留。</>}
            onConfirm={() => handleDelete(refresh)}
          />
        </>
      )}
    </SimpleListPage>
  );
}
