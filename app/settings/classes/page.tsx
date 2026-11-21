"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CirclePlus,
  Power,
  PowerOff,
} from "lucide-react";
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
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuDotSelect, type SkeuDotOption } from "@/app/components/ui/skeu-dot-select";
import { SkeuToggle } from "@/app/components/ui/skeu-toggle";
import {
  SkeuActionButton,
  SkeuIconAction,
} from "@/app/components/ui/skeu-row-action";
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
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { toast } from "sonner";

type L1 = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  children: L2[];
};

type L2 = {
  id: number;
  code: string;
  name: string;
  parentCode: string;
  description: string | null;
  isActive: boolean;
};

type RecordType = "l1" | "l2";

type SelectedRecord = { type: RecordType; record: L1 | L2 };

/** DataTable 逐行渲染：一级分类 + 展开后的二级分类 */
type DisplayRow =
  | { kind: "l1"; l1: L1; l1Idx: number }
  | { kind: "l2"; l1: L1; l1Idx: number; l2: L2; l2Idx: number };

/** 后端引用检查返回的引用明细 */
type CategoryReferences = Record<string, number>;

const statusFilters: SkeuDotOption[] = [
  { value: "all", label: "全部", tone: "all" },
  { value: "active", label: "启用中", tone: "success" },
  { value: "inactive", label: "已停用", tone: "warning" },
];

const emptyForm = { code: "", name: "", parentCode: "", description: "" };

function typeLabel(type: RecordType) {
  return type === "l1" ? "一级分类" : "二级分类";
}

export default function ClassesPage() {
  const [data, setData] = useState<L1[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"view" | "create" | "edit">("view");
  const [dialogType, setDialogType] = useState<RecordType>("l1");
  const [selected, setSelected] = useState<SelectedRecord | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [baselineForm, setBaselineForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ id: number; type: RecordType; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<{ message: string; references?: CategoryReferences } | null>(null);
  const [reordering, setReordering] = useState(false);

  // 排序仅在未搜索时可用（搜索会隐藏部分行，上下移动语义不明确）
  const sortDisabled = !!search.trim() || reordering;

  // 刷新时保留当前列表数据，避免整表清空后重新渲染造成的列表抖动
  const sortHint = "搜索时不可排序";

  const refresh = () => {
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        // 设置页需要管理停用分类，拉取全量；业务端默认只返回启用中的
        const res = await fetch("/api/ingredient-categories?includeInactive=1");
        const json = await res.json();
        if (alive) setData(json.data?.items || json.data || []);
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
    return data
      .map((l1) => {
        const l1StatusOk =
          statusFilter === "all" ||
          (statusFilter === "active" ? l1.isActive : !l1.isActive);
        const matchedChildren = l1.children.filter((c) => {
          const cStatusOk =
            statusFilter === "all" ||
            (statusFilter === "active" ? c.isActive : !c.isActive);
          if (!cStatusOk) return false;
          if (!s) return true;
          return c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s);
        });
        const l1Match =
          l1.name.toLowerCase().includes(s) || l1.code.toLowerCase().includes(s);
        if (!l1StatusOk && matchedChildren.length === 0) return null;
        if (s) {
          if (l1Match && l1StatusOk) return l1;
          if (matchedChildren.length) return { ...l1, children: matchedChildren };
          return null;
        }
        return { ...l1, children: matchedChildren };
      })
      .filter(Boolean) as L1[];
  }, [data, search, statusFilter]);

  const {
    currentPage,
    setCurrentPage,
    pageItems: pageL1Items,
    totalPages,
    totalItems,
    pageSize,
    setPageSize,
  } = usePagination(filtered, DEFAULT_PAGE_SIZE);

  const displayRows = useMemo(() => {
    const rows: DisplayRow[] = [];
    pageL1Items.forEach((l1, l1Idx) => {
      rows.push({ kind: "l1", l1, l1Idx });
      if (expanded.has(l1.id)) {
        l1.children.forEach((l2, l2Idx) => {
          rows.push({ kind: "l2", l1, l1Idx, l2, l2Idx });
        });
      }
    });
    return rows;
  }, [pageL1Items, expanded]);

  const l1Options = useMemo(
    () => data.map((d) => ({ value: d.code, label: d.name, description: d.code })),
    [data]
  );

  const parentName = useMemo(() => {
    if (!selected || selected.type !== "l2") return "";
    const l2 = selected.record as L2;
    return data.find((d) => d.code === l2.parentCode)?.name || l2.parentCode;
  }, [data, selected]);

  const toggleExpand = (id: number) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  // 全部展开 / 全部收起：拨动开关统一控制树形展开状态，默认收起
  const allExpanded = data.length > 0 && expanded.size >= data.length;
  const handleExpandAll = (next: boolean) => {
    setExpanded(next ? new Set(data.map((d) => d.id)) : new Set<number>());
  };

  const closeRecord = () => {
    setRecordOpen(false);
    setRecordMode("view");
    setSelected(null);
    setDialogType("l1");
    setForm(emptyForm);
    setBaselineForm(emptyForm);
  };

  const openView = (row: DisplayRow) => {
    setSelected(
      row.kind === "l1"
        ? { type: "l1", record: row.l1 }
        : { type: "l2", record: row.l2 }
    );
    setDialogType(row.kind);
    setRecordMode("view");
    setRecordOpen(true);
  };

  const openCreateL1 = () => {
    setDialogType("l1");
    setSelected(null);
    setRecordMode("create");
    setForm(emptyForm);
    setBaselineForm(emptyForm);
    setRecordOpen(true);
  };

  const openCreateL2 = (parentCode: string) => {
    const nextForm = { ...emptyForm, parentCode };
    setDialogType("l2");
    setSelected(null);
    setRecordMode("create");
    setForm(nextForm);
    setBaselineForm(nextForm);
    setRecordOpen(true);
  };

  const openEditL1 = (row: L1) => {
    const nextForm = {
      code: row.code,
      name: row.name,
      parentCode: "",
      description: row.description || "",
    };
    setDialogType("l1");
    setSelected({ type: "l1", record: row });
    setRecordMode("edit");
    setForm(nextForm);
    setBaselineForm(nextForm);
    setRecordOpen(true);
  };

  const openEditL2 = (row: L2) => {
    const nextForm = {
      code: row.code,
      name: row.name,
      parentCode: row.parentCode,
      description: row.description || "",
    };
    setDialogType("l2");
    setSelected({ type: "l2", record: row });
    setRecordMode("edit");
    setForm(nextForm);
    setBaselineForm(nextForm);
    setRecordOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("编号和名称不能为空");
      return;
    }
    if (dialogType === "l2" && !form.parentCode) {
      toast.error("请选择所属一级分类");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        type: dialogType,
        code: form.code,
        name: form.name,
        parentCode: dialogType === "l2" ? form.parentCode : undefined,
        description: form.description || null,
      };
      const res = selected
        ? await fetch(`/api/ingredient-categories/${selected.record.id}?type=${dialogType}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/ingredient-categories", {
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

  const toggleActive = async (row: L1 | L2, type: RecordType) => {
    try {
      const payload =
        type === "l2"
          ? { type, code: row.code, name: row.name, parentCode: (row as L2).parentCode, isActive: !row.isActive }
          : { type, code: row.code, name: row.name, isActive: !row.isActive };
      const res = await fetch(`/api/ingredient-categories/${row.id}?type=${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const moveL1 = async (l1: L1, dir: -1 | 1) => {
    const idx = data.findIndex((d) => d.code === l1.code);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= data.length) return;
    const ids = data.map((d) => d.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setReordering(true);
    try {
      const res = await fetch("/api/ingredient-categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "l1", ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "调整顺序失败");
        return;
      }
      const newData = [...data];
      [newData[idx], newData[target]] = [newData[target], newData[idx]];
      setData(newData);
      toast.success("顺序已调整");
    } catch {
      toast.error("调整顺序失败");
    } finally {
      setReordering(false);
    }
  };

  const moveL2 = async (l2: L2, dir: -1 | 1) => {
    const parent = data.find((d) => d.code === l2.parentCode);
    if (!parent) return;
    const children = parent.children;
    const idx = children.findIndex((c) => c.id === l2.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= children.length) return;
    const ids = children.map((c) => c.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setReordering(true);
    try {
      const res = await fetch("/api/ingredient-categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "l2", ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "调整顺序失败");
        return;
      }
      const newChildren = [...children];
      [newChildren[idx], newChildren[target]] = [newChildren[target], newChildren[idx]];
      setData(data.map((d) => (d.code === l2.parentCode ? { ...d, children: newChildren } : d)));
      toast.success("顺序已调整");
    } catch {
      toast.error("调整顺序失败");
    } finally {
      setReordering(false);
    }
  };

  const openDelete = (row: L1 | L2, type: RecordType) => {
    setDeleteTarget({ id: row.id, type, name: row.name });
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/ingredient-categories/${deleteTarget.id}?type=${deleteTarget.type}`, {
        method: "DELETE",
      });
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

  const selectedRecord = selected?.record;
  const selectedType = selected?.type ?? dialogType;

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          showBack
          title="食材分类"
          description="管理食材一级和二级分类体系；被食材引用的分类不可删除/改编号，可停用使新单据不再可选"
          actions={
            <SkeuButton onClick={openCreateL1}>
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              新增一级分类
            </SkeuButton>
          }
        />
      }
    >
      <Card className="skeu-panel flex min-h-0 flex-1 flex-col gap-0 overflow-hidden py-0 ring-0">
        <CardHeader className="skeu-panel-toolbar shrink-0 px-5 py-4">
          <ListToolbar
            searchValue={search}
            onSearchChange={(v) => {
              setSearch(v);
              setCurrentPage(1);
            }}
            searchPlaceholder="搜索编号或名称..."
            onReset={() => {
              setSearch("");
              setStatusFilter("all");
              setCurrentPage(1);
            }}
            hasFilters={statusFilter !== "all"}
            trailing={
              <SkeuToggle
                checked={allExpanded}
                onCheckedChange={handleExpandAll}
                label={allExpanded ? "全部收起" : "全部展开"}
                aria-label="展开或收起全部二级分类"
              />
            }
          >
            <SkeuDotSelect
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
              options={statusFilters}
            />
          </ListToolbar>
        </CardHeader>
        <CardContent className="skeu-panel-body flex min-h-0 flex-1 flex-col px-0 pb-0">
          <DataTable<DisplayRow>
            data={displayRows}
            loading={loading}
            onRowClick={openView}
            fillHeight
            variant="skeu"
            actionsWidth="w-[380px]"
            getRowLevel={(row) => (row.kind === "l2" ? "l2" : "l1")}
            tableClassName="min-w-max"
            columns={[
              {
                header: "序号",
                className: "w-[64px]",
                cell: (row) => (
                  <span className="text-muted-foreground">
                    {row.kind === "l1"
                      ? (currentPage - 1) * pageSize + row.l1Idx + 1
                      : `${(currentPage - 1) * pageSize + row.l1Idx + 1}.${row.l2Idx + 1}`}
                  </span>
                ),
              },
              {
                header: "编号",
                className: "w-[150px]",
                cell: (row) =>
                  row.kind === "l1" ? (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <button
                        type="button"
                        aria-label={
                          expanded.has(row.l1.id)
                            ? `收起 ${row.l1.name}`
                            : `展开 ${row.l1.name}`
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleExpand(row.l1.id);
                        }}
                        className="grid size-[26px] shrink-0 place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted"
                      >
                        {expanded.has(row.l1.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      {row.l1.code}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-medium">
                      <span className="inline-block w-[26px] shrink-0" />
                      <span className="text-muted-foreground">{row.l2.code}</span>
                    </span>
                  ),
              },
              {
                header: "名称",
                className: "w-[160px]",
                cell: (row) =>
                  row.kind === "l1" ? (
                    <span className="font-semibold">{row.l1.name}</span>
                  ) : (
                    <span className="inline-block pl-[26px]">{row.l2.name}</span>
                  ),
              },
              {
                header: "说明",
                className: "w-[220px]",
                cell: (row) => {
                  const description =
                    row.kind === "l1" ? row.l1.description : row.l2.description;
                  return (
                    <span
                      className="block max-w-[220px] truncate whitespace-nowrap text-muted-foreground"
                      title={description || "—"}
                    >
                      {description || "—"}
                    </span>
                  );
                },
              },
              {
                header: "状态",
                className: "w-[110px]",
                cell: (row) => {
                  const record = row.kind === "l1" ? row.l1 : row.l2;
                  return (
                    <StatusBadge
                      status={record.isActive ? "启用中" : "已停用"}
                      variant={record.isActive ? "success" : "neutral"}
                    />
                  );
                },
              },
            ]}
            pagination={{
              currentPage,
              totalPages,
              totalItems,
              pageSize,
              onPageChange: setCurrentPage,
              totalLabel: formatPageSummary(currentPage, pageSize, totalItems),
              showPageSize: true,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{ title: "暂无数据" }}
            rowActions={(row) => {
              if (row.kind === "l1") {
                const l1 = row.l1;
                const dataIdx = data.findIndex((d) => d.code === l1.code);
                return (
                  <>
                    <SkeuIconAction
                      label={`上移 ${l1.name}`}
                      tip={sortDisabled ? sortHint : "上移"}
                      disabled={sortDisabled || dataIdx <= 0}
                      icon={<ChevronUp className="h-4 w-4" />}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveL1(l1, -1);
                      }}
                    />
                    <SkeuIconAction
                      label={`下移 ${l1.name}`}
                      tip={sortDisabled ? sortHint : "下移"}
                      disabled={sortDisabled || dataIdx >= data.length - 1 || dataIdx < 0}
                      icon={<ChevronDown className="h-4 w-4" />}
                      onClick={(event) => {
                        event.stopPropagation();
                        moveL1(l1, 1);
                      }}
                    />
                    <SkeuActionButton
                      label="删除"
                      tone="danger"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={(event) => {
                        event.stopPropagation();
                        openDelete(l1, "l1");
                      }}
                    />
                    <SkeuActionButton
                      label={l1.isActive ? "停用" : "启用"}
                      tone={l1.isActive ? "warn" : "ok"}
                      icon={
                        l1.isActive ? (
                          <PowerOff className="h-3.5 w-3.5" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleActive(l1, "l1");
                      }}
                    />
                    <SkeuActionButton
                      label="编辑"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditL1(l1);
                      }}
                    />
                    <SkeuActionButton
                      label="添加二级"
                      tone="fill"
                      icon={<CirclePlus className="h-3.5 w-3.5" />}
                      onClick={(event) => {
                        event.stopPropagation();
                        openCreateL2(l1.code);
                      }}
                    />
                  </>
                );
              }

              const l2 = row.l2;
              return (
                <>
                  <SkeuIconAction
                    label={`上移 ${l2.name}`}
                    tip={sortDisabled ? sortHint : "上移"}
                    disabled={sortDisabled || row.l2Idx === 0}
                    icon={<ChevronUp className="h-4 w-4" />}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveL2(l2, -1);
                    }}
                  />
                  <SkeuIconAction
                    label={`下移 ${l2.name}`}
                    tip={sortDisabled ? sortHint : "下移"}
                    disabled={sortDisabled || row.l2Idx === row.l1.children.length - 1}
                    icon={<ChevronDown className="h-4 w-4" />}
                    onClick={(event) => {
                      event.stopPropagation();
                      moveL2(l2, 1);
                    }}
                  />
                  <SkeuActionButton
                    label="删除"
                    tone="danger"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={(event) => {
                      event.stopPropagation();
                      openDelete(l2, "l2");
                    }}
                  />
                  <SkeuActionButton
                    label={l2.isActive ? "停用" : "启用"}
                    tone={l2.isActive ? "warn" : "ok"}
                    icon={
                      l2.isActive ? (
                        <PowerOff className="h-3.5 w-3.5" />
                      ) : (
                        <Power className="h-3.5 w-3.5" />
                      )
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleActive(l2, "l2");
                    }}
                  />
                  <SkeuActionButton
                    label="编辑"
                    icon={<Pencil className="h-3.5 w-3.5" />}
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditL2(l2);
                    }}
                  />
                </>
              );
            }}
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
            ? `新增${typeLabel(dialogType)}`
            : recordMode === "edit"
              ? `编辑${typeLabel(dialogType)}`
              : selectedRecord?.name ?? typeLabel(selectedType)
        }
        meta={
          recordMode === "view" && selectedRecord ? (
            <>
              <span className="tabular-nums">{selectedRecord.code}</span>
              {selectedType === "l2" && <span>所属：{parentName}</span>}
              <StatusBadge
                status={selectedRecord.isActive ? "启用中" : "已停用"}
                variant={selectedRecord.isActive ? "success" : "neutral"}
              />
            </>
          ) : undefined
        }
        onEdit={
          recordMode === "view" && selectedRecord
            ? () =>
                selectedType === "l1"
                  ? openEditL1(selectedRecord as L1)
                  : openEditL2(selectedRecord as L2)
            : undefined
        }
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
        entityLabel={typeLabel(selectedType)}
      >
        {recordMode === "view" && selectedRecord ? (
          <RecordView
            items={[
              { label: "编号", value: selectedRecord.code, emphasis: true },
              { label: "名称", value: selectedRecord.name },
              ...(selectedType === "l2"
                ? [{ label: "所属一级分类", value: parentName }]
                : []),
              {
                label: "说明",
                value: selectedRecord.description || "—",
                wide: true,
              },
            ]}
          />
        ) : (
          <SimpleForm>
            {dialogType === "l2" && (
              <FormField label="所属一级分类" required>
                <SelectTileMode
                  options={l1Options}
                  value={form.parentCode}
                  onChange={(v) => setForm({ ...form, parentCode: v })}
                  placeholder="请选择一级分类"
                  title="选择所属一级分类"
                  searchPlaceholder="搜索一级分类..."
                  required
                />
              </FormField>
            )}
            <FormField
              id="code"
              label="编号"
              required
              hint={
                selected
                  ? dialogType === "l1"
                    ? "修改编号将同步更新其下二级分类的归属"
                    : "被食材引用后不可修改编号；如不再使用请停用"
                  : undefined
              }
            >
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={dialogType === "l1" ? "如 VEG" : "如 VEG-LEF"}
                className="h-11 text-base px-4"
              />
            </FormField>
            <FormField id="name" label="名称" required>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={dialogType === "l1" ? "如 蔬菜" : "如 叶菜"}
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
              确定要删除这条{deleteTarget?.type === "l1" ? "一级" : "二级"}分类吗？
              {deleteTarget?.type === "l1" && " 将同时删除其下的所有二级分类。"}
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