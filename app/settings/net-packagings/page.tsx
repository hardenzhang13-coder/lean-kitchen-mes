"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Ban, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/app/components/ui/form-controls";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { FormField } from "@/app/components/ui/form-field";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageHeader } from "@/app/components/ui/page-header";
import { DataTable } from "@/app/components/ui/data-table";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { SelectField } from "@/app/components/ui/select-field";
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

type NetPackaging = {
  id: number;
  name: string;
  size: string;
  isActive: boolean;
};

const statusFilters = [
  { value: "all", label: "全部" },
  { value: "active", label: "启用中" },
  { value: "inactive", label: "已停用" },
];

const emptyForm = { name: "", size: "" };

export default function NetPackagingsPage() {
  const [data, setData] = useState<NetPackaging[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"view" | "create" | "edit">("view");
  const [selected, setSelected] = useState<NetPackaging | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NetPackaging | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/net-packagings?page=1&pageSize=100&includeInactive=1");
        const json = await res.json();
        if (alive) setData(json.data || []);
      } catch {
        if (alive) toast.error("获取净菜包装失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((row) => {
      if (statusFilter === "active" && !row.isActive) return false;
      if (statusFilter === "inactive" && row.isActive) return false;
      if (!term) return true;
      return (
        row.name.toLowerCase().includes(term) ||
        row.size.toLowerCase().includes(term)
      );
    });
  }, [data, search, statusFilter]);

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

  const handleSubmit = async () => {
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

  const toggleActive = async (row: NetPackaging) => {
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

  const openDelete = (row: NetPackaging) => {
    setDeleteTarget(row);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/net-packagings/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        setDeleteError(json.error || "删除失败");
        return;
      }
      toast.success("删除成功");
      setDeleteTarget(null);
      refresh();
    } catch {
      setDeleteError("删除失败，请稍后重试");
    }
  };

  return (
    <PageShell variant="workspace">
      <PageHeader
        showBack
        title="净菜包装"
        description="管理净料封装使用的包装名称与尺寸；停用后新净料不可再选，历史档案保留原值"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增包装
          </Button>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0 pb-0">
          <ListToolbar
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            searchPlaceholder="搜索包装名称或尺寸..."
            onReset={() => {
              setSearch("");
              setStatusFilter("all");
              setCurrentPage(1);
            }}
            hasFilters={statusFilter !== "all"}
          >
            <SelectField
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              options={statusFilters}
              className="w-[160px]"
            />
          </ListToolbar>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <DataTable<NetPackaging>
            data={pageItems}
            loading={loading}
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
                header: "包装名称",
                className: "w-[180px]",
                cell: (row) => <span className="font-medium">{row.name}</span>,
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
            pagination={{
              currentPage,
              totalPages,
              totalItems,
              pageSize,
              onPageChange: setCurrentPage,
              totalLabel: formatPageSummary(currentPage, pageSize, totalItems, "净菜包装"),
              showPageSize: true,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{ title: "暂无数据" }}
            rowActions={(row) => (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={row.isActive ? `停用包装 ${row.name}` : `启用包装 ${row.name}`}
                  title={row.isActive ? "停用包装" : "启用包装"}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleActive(row);
                  }}
                >
                  {row.isActive ? (
                    <Ban className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`编辑包装 ${row.name}`}
                  title="编辑包装"
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
                  aria-label={`删除包装 ${row.name}`}
                  title="删除包装"
                  onClick={(event) => {
                    event.stopPropagation();
                    openDelete(row);
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
        onSubmit={handleSubmit}
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

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {deleteError ? "无法删除" : "确认删除"}
            </DialogTitle>
          </DialogHeader>
          {deleteError ? (
            <div className="grid gap-3">
              <p className="text-muted-foreground text-base">{deleteError}</p>
              <p className="text-sm text-muted-foreground">
                建议改用「停用」：停用后新净料不再可选，历史档案不受影响。
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-base">
              确定要删除包装「{deleteTarget?.name} / {deleteTarget?.size}」吗？
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="h-11 px-6">
              {deleteError ? "知道了" : "取消"}
            </Button>
            {!deleteError && (
              <Button variant="destructive" onClick={handleDelete} className="h-11 px-6">
                删除
              </Button>
            )}
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </PageShell>
  );
}
