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
import {
  usePagination,
  DEFAULT_PAGE_SIZE,
  formatPageSummary,
} from "@/lib/client/use-pagination";
import { toast } from "sonner";

type Supplier = {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  remark: string | null;
};

function EmptyValue() {
  return <span className="text-muted-foreground">—</span>;
}

export default function SuppliersPage() {
  const [data, setData] = useState<Supplier[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", phone: "", remark: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const refresh = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/suppliers?page=1&pageSize=100");
        const json = await res.json();
        if (alive) setData(json.data || []);
      } catch {
        if (alive) toast.error("获取数据失败");
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
        (d.contact && d.contact.toLowerCase().includes(s)) ||
        (d.phone && d.phone.toLowerCase().includes(s))
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
    setForm({ name: "", contact: "", phone: "", remark: "" });
    setDialogOpen(true);
  };

  const openEdit = (row: Supplier) => {
    setEditing(row);
    setForm({
      name: row.name,
      contact: row.contact || "",
      phone: row.phone || "",
      remark: row.remark || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
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
      if (editing) {
        await fetch(`/api/suppliers/${editing.id}`, {
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
      setDialogOpen(false);
      refresh();
    } catch {
      toast.error("操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      toast.success("删除成功");
      setDeleteId(null);
      refresh();
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <PageShell variant="workspace">
      <PageHeader
        showBack
        title="供应商"
        description="管理采购供应商信息"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增
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
            searchPlaceholder="搜索名称、联系人或电话..."
            onReset={() => {
              setSearch("");
              setCurrentPage(1);
            }}
          />
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col p-4">
          <DataTable<Supplier>
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
                header: "名称",
                className: "w-[180px]",
                cell: (row) => <span className="font-medium">{row.name}</span>,
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
                className: "w-[220px]",
                cell: (row) =>
                  row.remark ? (
                    <span className="whitespace-nowrap">{row.remark}</span>
                  ) : (
                    <EmptyValue />
                  ),
              },
            ]}
            pagination={{
              currentPage,
              totalPages,
              totalItems,
              pageSize,
              onPageChange: setCurrentPage,
              totalLabel: formatPageSummary(currentPage, pageSize, totalItems, "供应商"),
              showPageSize: true,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{ title: "暂无数据" }}
            rowActions={(row) => (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`编辑供应商 ${row.name}`}
                title="编辑供应商"
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
            <DialogTitle className="text-lg">{editing ? "编辑供应商" : "新增供应商"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-5">
            <div className="grid gap-2.5">
              <Label htmlFor="name" className="text-base">名称</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="供应商名称"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="contact" className="text-base">联系人</Label>
              <Input
                id="contact"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="可选"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="phone" className="text-base">电话</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="可选"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="remark" className="text-base">备注</Label>
              <Input
                id="remark"
                value={form.remark}
                onChange={(e) => setForm({ ...form, remark: e.target.value })}
                placeholder="可选"
                className="h-11 text-base px-4"
              />
            </div>
          </div>
          <DialogFooter>
            {editing && (
              <Button
                variant="destructive"
                className="h-11 px-6 sm:mr-auto"
                onClick={() => {
                  setDialogOpen(false);
                  setDeleteId(editing.id);
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

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-base">确定要删除这条记录吗？此操作不可撤销。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="h-11 px-6">
              取消
            </Button>
            <Button variant="destructive" onClick={() => deleteId && handleDelete(deleteId)} className="h-11 px-6">
              删除
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </PageShell>
  );
}
