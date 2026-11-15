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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectField } from "@/app/components/ui/select-field";
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
import { formatUnitValue } from "@/lib/shared/display-format";

type Unit = {
  id: number;
  name: string;
  category: string;
  gramsPerUnit: number | string | null;
  isActive: boolean;
};

/** 后端引用检查返回的引用明细 */
type UnitReferences = Record<string, number>;

const categories = [
  { value: "weight", label: "重量" },
  { value: "volume", label: "体积" },
  { value: "count", label: "计数" },
  { value: "other", label: "其他" },
];

const statusFilters = [
  { value: "all", label: "全部" },
  { value: "active", label: "启用中" },
  { value: "inactive", label: "已停用" },
];

const emptyForm = { name: "", category: "weight", gramsPerUnit: "" };

function categoryLabel(value: string) {
  return categories.find((c) => c.value === value)?.label || value;
}

export default function UnitsPage() {
  const [data, setData] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"view" | "create" | "edit">("view");
  const [selected, setSelected] = useState<Unit | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [deleteError, setDeleteError] = useState<{ message: string; references?: UnitReferences } | null>(null);

  const fetchData = async () => {
    try {
      // 设置页需要管理停用单位，拉取全量；业务端默认只返回启用中的
      const res = await fetch("/api/units?page=1&pageSize=100&includeInactive=1");
      const json = await res.json();
      setData(json.data || []);
    } catch {
      toast.error("获取数据失败");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setLoading(true);
    fetchData();
  };

  useEffect(() => {
    let alive = true;
    const fetchDataOnMount = async () => {
      try {
        // 设置页需要管理停用单位，拉取全量；业务端默认只返回启用中的
        const res = await fetch("/api/units?page=1&pageSize=100&includeInactive=1");
        const json = await res.json();
        if (alive) setData(json.data || []);
      } catch {
        if (alive) toast.error("获取数据失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchDataOnMount();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return data.filter((d) => {
      if (statusFilter === "active" && !d.isActive) return false;
      if (statusFilter === "inactive" && d.isActive) return false;
      if (!s) return true;
      return (
        d.name.toLowerCase().includes(s) ||
        d.category.toLowerCase().includes(s)
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

  const openView = (row: Unit) => {
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

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("名称不能为空");
      return;
    }
    if (form.category === "weight") {
      const grams = Number(form.gramsPerUnit);
      if (!form.gramsPerUnit.trim() || !Number.isFinite(grams) || grams <= 0) {
        toast.error("重量类单位必须填写换算克数（1 单位合多少克）");
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        gramsPerUnit:
          form.category === "weight" ? Number(form.gramsPerUnit) : null,
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

  const toggleActive = async (row: Unit) => {
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
      toast.success(row.isActive ? `已停用「${row.name}」` : `已启用「${row.name}」`);
      refresh();
    } catch {
      toast.error("操作失败");
    }
  };

  const openDelete = (row: Unit) => {
    setDeleteTarget(row);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/units/${deleteTarget.id}`, { method: "DELETE" });
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
    <PageShell variant="workspace">
      <PageHeader
        showBack
        title="单位"
        description="管理重量、体积、计数等单位字典；重量类单位的换算克数驱动全系统斤/克换算"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新增
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
            searchPlaceholder="搜索名称或分类..."
            onReset={() => {
              setSearch("");
              setStatusFilter("all");
              setCurrentPage(1);
            }}
            hasFilters={statusFilter !== "all"}
          >
            <SelectField
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
              options={statusFilters}
              className="w-[160px]"
            />
          </ListToolbar>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <DataTable<Unit>
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
                header: "名称",
                className: "w-[160px]",
                cell: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                header: "分类",
                className: "w-[100px]",
                cell: (row) => (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs">
                    {categoryLabel(row.category)}
                  </span>
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
                    <span className="text-muted-foreground">—</span>
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
              totalLabel: formatPageSummary(currentPage, pageSize, totalItems, "单位"),
              showPageSize: true,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{ title: "暂无数据" }}
            rowActions={(row) => (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={row.isActive ? `停用单位 ${row.name}` : `启用单位 ${row.name}`}
                  title={row.isActive ? "停用单位" : "启用单位"}
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
                  aria-label={`编辑单位 ${row.name}`}
                  title="编辑单位"
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
                  aria-label={`删除单位 ${row.name}`}
                  title="删除单位"
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
            ? "新增单位"
            : recordMode === "edit"
              ? "编辑单位"
              : selected?.name ?? "单位"
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
        entityLabel="单位"
      >
        {recordMode === "view" && selected ? (
          <RecordView
            items={[
              { label: "名称", value: selected.name, emphasis: true },
              { label: "分类", value: categoryLabel(selected.category) },
              {
                label: "换算值",
                value:
                  selected.category === "weight"
                    ? formatUnitValue(selected.gramsPerUnit, "g/单位", "未设置", " ")
                    : "—",
              },
            ]}
          />
        ) : (
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
              <Select
                value={form.category}
                onValueChange={(v) => v && setForm({ ...form, category: v })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue>{categoryLabel(form.category)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {form.category === "weight" && (
              <FormField
                id="gramsPerUnit"
                label="换算克数"
                required
                hint="驱动全系统斤/克换算（采购规格换算、每斤单价、切配展示）"
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
              <p className="text-muted-foreground text-base">{deleteError.message}</p>
              {deleteError.references && Object.keys(deleteError.references).length > 0 && (
                <ul className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground grid gap-1">
                  {Object.entries(deleteError.references).map(([entity, count]) => (
                    <li key={entity}>
                      {entity}：{count} 条
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm text-muted-foreground">
                建议改用「停用」：停用后新单据不再可选，历史数据不受影响。
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-base">
              确定要删除单位「{deleteTarget?.name}」吗？此操作不可撤销。
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
