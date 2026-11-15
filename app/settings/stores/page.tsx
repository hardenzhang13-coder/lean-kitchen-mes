"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/app/components/ui/form-controls";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageHeader } from "@/app/components/ui/page-header";
import { DataTable } from "@/app/components/ui/data-table";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { SelectField } from "@/app/components/ui/select-field";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  usePagination,
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
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
  _count?: { schedules: number };
};

function EmptyValue() {
  return <span className="text-muted-foreground">—</span>;
}

export default function StoresPage() {
  const [data, setData] = useState<Store[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState({ name: "", manager: "", phone: "", address: "", isActive: "1" });
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Store | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/stores?page=1&pageSize=100");
        const json = await res.json();
        if (alive) setData(json.data || []);
      } catch {
        if (alive) toast.error("获取门店失败");
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
    const s = search.trim().toLowerCase();
    if (!s) return data;
    return data.filter(
      (d) =>
        d.name.toLowerCase().includes(s) ||
        d.code.toLowerCase().includes(s) ||
        (d.manager && d.manager.toLowerCase().includes(s))
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

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", manager: "", phone: "", address: "", isActive: "1" });
    setDialogOpen(true);
  };

  const openEdit = (row: Store) => {
    setEditing(row);
    setForm({
      name: row.name,
      manager: row.manager || "",
      phone: row.phone || "",
      address: row.address || "",
      isActive: row.isActive ? "1" : "0",
    });
    setDialogOpen(true);
  };
  const handleSubmit = async () => {
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
      if (editing) {
        res = await fetch(`/api/stores/${editing.id}`, {
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
      toast.success(editing ? "更新成功" : "创建成功");
      setDialogOpen(false);
      refresh();
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stores/${deleteTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "删除失败");
        return;
      }
      toast.success("删除成功");
      setDeleteTarget(null);
      refresh();
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <PageShell variant="workspace">
      <PageHeader
        showBack
        title="门店管理"
        description="管理门店信息，排程按门店组织生产"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增门店
          </Button>
        }
      />

      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0 pb-3">
          <ListToolbar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setCurrentPage(1);
            }}
            searchPlaceholder="搜索名称、编号或负责人..."
            onReset={() => {
              setSearch("");
              setCurrentPage(1);
            }}
          />
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-4">
          <DataTable<Store>
            data={pageItems}
            loading={loading}
            onRowClick={openEdit}
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
                header: "编号",
                className: "w-[90px]",
                cell: (row) => (
                  <span className="font-medium text-muted-foreground">{row.code}</span>
                ),
              },
              {
                header: "名称",
                className: "w-[160px]",
                cell: (row) => <span className="font-medium">{row.name}</span>,
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
                className: "w-[220px]",
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
            pagination={{
              currentPage,
              totalPages,
              totalItems,
              pageSize,
              onPageChange: setCurrentPage,
              totalLabel: formatPageSummary(currentPage, pageSize, totalItems, "门店"),
              showPageSize: true,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{ title: "暂无数据" }}
            rowActions={(row) => (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`编辑门店 ${row.name}`}
                title="编辑门店"
                onClick={(event) => {
                  event.stopPropagation();
                  openEdit(row);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AppDialogContent size="form" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">{editing ? "编辑门店" : "新增门店"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <div className="grid gap-2.5">
              <Label htmlFor="name" className="text-base">门店名称</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如：新金食堂"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="manager" className="text-base">负责人</Label>
              <Input
                id="manager"
                value={form.manager}
                onChange={(e) => setForm({ ...form, manager: e.target.value })}
                placeholder="可选"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="phone" className="text-base">联系电话</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="可选"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="address" className="text-base">地址</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="可选"
                className="h-11 text-base px-4"
              />
            </div>
            {editing && !editing.isSystem && (
              <div className="grid gap-2.5">
                <Label className="text-base">状态</Label>
                <SelectField
                  value={form.isActive}
                  onChange={(v) => setForm({ ...form, isActive: v })}
                  options={[
                    { value: "1", label: "启用中" },
                    { value: "0", label: "停用" },
                  ]}
                  className="h-11"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            {editing && (
              <Button
                variant="destructive"
                className="h-11 px-6 sm:mr-auto"
                disabled={editing.isSystem}
                title={editing.isSystem ? "系统门店不可删除" : "删除门店"}
                onClick={() => {
                  setDialogOpen(false);
                  setDeleteTarget(editing);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-11 px-6">
              取消
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="h-11 px-6">
              <span aria-live="polite" className="inline-flex items-center">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </span>
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">
            确定要删除门店「{deleteTarget?.name}」吗？已被排程引用的门店无法删除。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="h-11 px-6">
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="h-11 px-6">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </PageShell>
  );
}
