"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/app/components/ui/form-controls";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/app/components/ui/form-field";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageHeader } from "@/app/components/ui/page-header";
import { DataTable } from "@/app/components/ui/data-table";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  RecordDialog,
  RecordView,
  SimpleForm,
  isRecordDirty,
} from "@/app/components/ui/record-dialog";
import {
  usePagination,
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
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

export default function UsersPage() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"view" | "create" | "edit">("view");
  const [selected, setSelected] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [usersRes, meRes] = await Promise.all([
          fetch("/api/users?page=1&pageSize=100"),
          fetch("/api/auth/me"),
        ]);
        if (!usersRes.ok) throw new Error("获取用户列表失败");
        const usersJson = await usersRes.json();
        setData(usersJson.data || []);
        if (meRes.ok) {
          const meJson = await meRes.json();
          setCurrentUser(meJson.data?.user);
        }
      } catch {
        toast.error("获取数据失败");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter(
      (d) =>
        d.username.toLowerCase().includes(s) ||
        d.name.toLowerCase().includes(s) ||
        d.role.toLowerCase().includes(s)
    );
  }, [data, search]);

  const {
    currentPage,
    setCurrentPage,
    pageItems,
    totalPages,
    totalItems,
    pageSize,
    setPageSize,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

  const closeRecord = () => {
    setRecordOpen(false);
    setRecordMode("view");
    setSelected(null);
    setForm(emptyForm);
    setBaselineForm(emptyForm);
  };

  const openView = (row: User) => {
    setSelected(row);
    setRecordMode("view");
    setRecordOpen(true);
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

  const handleSubmit = async () => {
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
      // 重新加载用户列表和当前用户
      const usersRes = await fetch("/api/users?page=1&pageSize=100");
      if (usersRes.ok) {
        const json = await usersRes.json();
        setData(json.data || []);
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (id === currentUser?.id) {
      toast.error("不能删除当前登录用户");
      setDeleteId(null);
      return;
    }
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "删除失败");
        return;
      }
      toast.success("用户已停用并移出列表");
      setDeleteId(null);
      const usersRes = await fetch("/api/users?page=1&pageSize=100");
      if (usersRes.ok) {
        const json = await usersRes.json();
        setData(json.data || []);
      }
    } catch {
      toast.error("删除失败");
    }
  };

  const handleToggleActive = async (row: User) => {
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
      toast.success(row.isActive ? "账号已停用" : "账号已启用");
      const usersRes = await fetch("/api/users?page=1&pageSize=100");
      if (usersRes.ok) {
        const json = await usersRes.json();
        setData(json.data || []);
      }
    } catch {
      toast.error("更新账号状态失败");
    }
  };

  const formatDate = (value: string) => {
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <PageShell variant="workspace">
      <PageHeader
        showBack
        title="用户管理"
        description="管理系统用户账号与角色权限"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增用户
          </Button>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0 pb-0">
          <ListToolbar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setCurrentPage(1);
            }}
            searchPlaceholder="搜索账号、姓名或角色..."
            onReset={() => {
              setSearch("");
              setCurrentPage(1);
            }}
          />
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <DataTable<User>
            data={pageItems}
            loading={loading}
            onRowClick={openView}
            fillHeight
            density="dense"
            tableClassName="min-w-max"
            columns={[
              {
                header: "序号",
                className: "w-[48px]",
                cell: (_, rowIdx) => (
                  <span className="text-muted-foreground">
                    {(currentPage - 1) * pageSize + rowIdx + 1}
                  </span>
                ),
              },
              {
                header: "账号",
                className: "w-[140px]",
                cell: (row) => <span className="font-medium">{row.username}</span>,
              },
              {
                header: "姓名",
                className: "w-[120px]",
                cell: (row) => row.name,
              },
              {
                header: "角色",
                className: "w-[120px]",
                cell: (row) => (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs">
                    {row.role}
                  </span>
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
            pagination={{
              currentPage,
              totalPages,
              totalItems,
              pageSize,
              onPageChange: setCurrentPage,
              totalLabel: formatPageSummary(currentPage, pageSize, totalItems, "用户"),
              showPageSize: true,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{ title: "暂无数据" }}
            rowActions={(row) => (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={row.isActive ? `停用用户 ${row.username}` : `启用用户 ${row.username}`}
                  title={row.isActive ? "停用用户" : "启用用户"}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleToggleActive(row);
                  }}
                  disabled={row.id === currentUser?.id}
                >
                  <Power
                    className={row.isActive ? "h-4 w-4" : "h-4 w-4 text-muted-foreground"}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`编辑用户 ${row.username}`}
                  title="编辑用户"
                  onClick={(event) => {
                    event.stopPropagation();
                    openEdit(row);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`删除用户 ${row.username}`}
                  title={
                    row.id === currentUser?.id
                      ? "不能删除当前登录用户"
                      : "停用并移出列表"
                  }
                  disabled={row.id === currentUser?.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteId(row.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          />
        </CardContent>
      </Card>

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
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs text-foreground">
                {selected.role}
              </span>
              <StatusBadge
                status={selected.isActive ? "启用" : "停用"}
                variant={selected.isActive ? "success" : "danger"}
              />
            </>
          ) : undefined
        }
        onEdit={recordMode === "view" && selected ? () => openEdit(selected) : undefined}
        onCancel={() => {
          if (recordMode === "create") closeRecord();
          else {
            setRecordMode("view");
            setForm(baselineForm);
          }
        }}
        onSubmit={handleSubmit}
        dirty={recordMode !== "view" && isRecordDirty(form, baselineForm)}
        submitting={submitting}
        entityLabel="用户"
      >
        {recordMode === "view" && selected ? (
          <RecordView
            items={[
              { label: "账号", value: selected.username, emphasis: true },
              { label: "姓名", value: selected.name },
              { label: "角色", value: selected.role },
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
              <Select value={form.role} onValueChange={(v) => v && setForm({ ...form, role: v })}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="请选择角色" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认停用并移出列表</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要停用该用户并移出列表吗？历史审计记录会保留。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="h-11 px-6">
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
              className="h-11 px-6"
            >
              删除
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </PageShell>
  );
}
