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
import { CodeText } from "@/app/components/ui/code-text";
import { ListToolbar } from "@/app/components/ui/list-toolbar";
import { PageTabs } from "@/app/components/ui/page-tabs";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuDotSelect, type SkeuDotOption } from "@/app/components/ui/skeu-dot-select";
import {
  SkeuActionButton,
  SkeuIconAction,
} from "@/app/components/ui/skeu-row-action";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  RecordDialog,
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

type L3 = {
  id: number;
  code: string;
  name: string;
  parentCode: string;
  description: string | null;
  isActive: boolean;
};

type L2 = {
  id: number;
  code: string;
  name: string;
  parentCode: string;
  description: string | null;
  isActive: boolean;
  children: L3[];
};

type L1 = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  children: L2[];
};

type RecordType = "l1" | "l2" | "l3";
type CategoryDomain = "food" | "seasoning";

type SelectedRecord = { type: RecordType; record: L1 | L2 | L3 };

/** DataTable 逐行渲染：一级分类 + 展开后的二级、三级分类 */
type DisplayRow =
  | { kind: "l1"; l1: L1; l1Idx: number }
  | { kind: "l2"; l1: L1; l1Idx: number; l2: L2; l2Idx: number }
  | { kind: "l3"; l1: L1; l1Idx: number; l2: L2; l2Idx: number; l3: L3; l3Idx: number };

/** 后端引用检查返回的引用明细 */
type CategoryReferences = Record<string, number>;

const domainTabs: { value: CategoryDomain; label: string }[] = [
  { value: "food", label: "食材分类" },
  { value: "seasoning", label: "调味品分类" },
];

const statusFilters: SkeuDotOption[] = [
  { value: "all", label: "全部", tone: "all" },
  { value: "active", label: "启用中", tone: "success" },
  { value: "inactive", label: "已停用", tone: "warning" },
];

const emptyForm = { code: "", name: "", parentCode: "", description: "" };

function typeLabel(type: RecordType) {
  return type === "l1" ? "一级分类" : type === "l2" ? "二级分类" : "三级分类";
}

export default function ClassesPage() {
  const [domain, setDomain] = useState<CategoryDomain>("food");
  const [data, setData] = useState<L1[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedL1Id, setExpandedL1Id] = useState<number | null>(null);
  const [expandedL2Id, setExpandedL2Id] = useState<number | null>(null);

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"create" | "edit">("create");
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
      setLoading(true);
      try {
        // 设置页需要管理停用分类，拉取全量；业务端默认只返回启用中的
        const res = await fetch(
          `/api/ingredient-categories?includeInactive=1&domain=${domain}`
        );
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
  }, [reloadKey, domain]);

  const switchDomain = (next: string) => {
    if (next !== "food" && next !== "seasoning") return;
    setDomain(next);
    setSearch("");
    setStatusFilter("all");
    setExpandedL1Id(null);
    setExpandedL2Id(null);
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const statusOk = (isActive: boolean) =>
      statusFilter === "all" || (statusFilter === "active" ? isActive : !isActive);
    const textMatch = (row: { name: string; code: string }) =>
      !s ||
      row.name.toLowerCase().includes(s) ||
      row.code.toLowerCase().includes(s);

    return data
      .map((l1) => {
        const matchedChildren = l1.children
          .map((l2) => {
            if (!statusOk(l2.isActive)) return null;
            const matchedL3 = (l2.children ?? []).filter(
              (l3) => statusOk(l3.isActive) && textMatch(l3)
            );
            if (!s) return { ...l2, children: matchedL3 };
            if (textMatch(l2)) return { ...l2, children: matchedL3 };
            if (matchedL3.length) return { ...l2, children: matchedL3 };
            return null;
          })
          .filter(Boolean) as L2[];
        if (!statusOk(l1.isActive) && matchedChildren.length === 0) return null;
        if (s) {
          if (textMatch(l1) && statusOk(l1.isActive)) return l1;
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
      if (expandedL1Id === l1.id) {
        l1.children.forEach((l2, l2Idx) => {
          rows.push({ kind: "l2", l1, l1Idx, l2, l2Idx });
          if (expandedL2Id === l2.id) {
            (l2.children ?? []).forEach((l3, l3Idx) => {
              rows.push({ kind: "l3", l1, l1Idx, l2, l2Idx, l3, l3Idx });
            });
          }
        });
      }
    });
    return rows;
  }, [pageL1Items, expandedL1Id, expandedL2Id]);

  const l1Options = useMemo(
    () => data.map((d) => ({ value: d.code, label: d.name, description: d.code })),
    [data]
  );

  const l2Options = useMemo(
    () =>
      data.flatMap((d) =>
        d.children.map((c) => ({
          value: c.code,
          label: c.name,
          description: c.code,
        }))
      ),
    [data]
  );

  const toggleExpandL1 = (id: number) => {
    setExpandedL1Id((prev) => (prev === id ? null : id));
    setExpandedL2Id(null);
  };

  const toggleExpandL2 = (id: number) => {
    setExpandedL2Id((prev) => (prev === id ? null : id));
  };

  const closeRecord = () => {
    setRecordOpen(false);
    setRecordMode("create");
    setSelected(null);
    setDialogType("l1");
    setForm(emptyForm);
    setBaselineForm(emptyForm);
  };

  const openRecord = (
    type: RecordType,
    mode: "create" | "edit",
    nextForm: typeof emptyForm,
    record: L1 | L2 | L3 | null
  ) => {
    setDialogType(type);
    setSelected(record ? { type, record } : null);
    setRecordMode(mode);
    setForm(nextForm);
    setBaselineForm(nextForm);
    setRecordOpen(true);
  };

  const openCreateL1 = () => openRecord("l1", "create", emptyForm, null);
  const openCreateL2 = (parentCode: string) =>
    openRecord("l2", "create", { ...emptyForm, parentCode }, null);
  const openCreateL3 = (parentCode: string) =>
    openRecord("l3", "create", { ...emptyForm, parentCode, code: `${parentCode}-` }, null);

  const openEditL1 = (row: L1) =>
    openRecord(
      "l1",
      "edit",
      { code: row.code, name: row.name, parentCode: "", description: row.description || "" },
      row
    );
  const openEditL2 = (row: L2) =>
    openRecord(
      "l2",
      "edit",
      { code: row.code, name: row.name, parentCode: row.parentCode, description: row.description || "" },
      row
    );
  const openEditL3 = (row: L3) =>
    openRecord(
      "l3",
      "edit",
      { code: row.code, name: row.name, parentCode: row.parentCode, description: row.description || "" },
      row
    );

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("编号和名称不能为空");
      return;
    }
    if (dialogType === "l2" && !form.parentCode) {
      toast.error("请选择所属一级分类");
      return;
    }
    if (dialogType === "l3" && !form.parentCode) {
      toast.error("请选择所属二级分类");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        type: dialogType,
        code: form.code,
        name: form.name,
        parentCode: dialogType !== "l1" ? form.parentCode : undefined,
        description: form.description || null,
        // 仅新建一级分类时生效：归属当前页签的分类域
        ...(dialogType === "l1" && !selected ? { domain } : {}),
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

  const toggleActive = async (row: L1 | L2 | L3, type: RecordType) => {
    try {
      const payload =
        type === "l1"
          ? { type, code: row.code, name: row.name, isActive: !row.isActive }
          : {
              type,
              code: row.code,
              name: row.name,
              parentCode: (row as L2 | L3).parentCode,
              isActive: !row.isActive,
            };
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

  const moveChild = async (
    type: "l2" | "l3",
    row: L2 | L3,
    siblings: (L2 | L3)[],
    dir: -1 | 1
  ) => {
    const idx = siblings.findIndex((c) => c.id === row.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= siblings.length) return;
    const ids = siblings.map((c) => c.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setReordering(true);
    try {
      const res = await fetch("/api/ingredient-categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "调整顺序失败");
        return;
      }
      refresh();
      toast.success("顺序已调整");
    } catch {
      toast.error("调整顺序失败");
    } finally {
      setReordering(false);
    }
  };

  const openDelete = (row: L1 | L2 | L3, type: RecordType) => {
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

  const selectedType = selected?.type ?? dialogType;
  const domainLabel = domain === "seasoning" ? "调味品" : "食材";

  const renderRowActions = (row: DisplayRow) => {
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

    if (row.kind === "l2") {
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
              moveChild("l2", l2, row.l1.children, -1);
            }}
          />
          <SkeuIconAction
            label={`下移 ${l2.name}`}
            tip={sortDisabled ? sortHint : "下移"}
            disabled={sortDisabled || row.l2Idx === row.l1.children.length - 1}
            icon={<ChevronDown className="h-4 w-4" />}
            onClick={(event) => {
              event.stopPropagation();
              moveChild("l2", l2, row.l1.children, 1);
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
          <SkeuActionButton
            label="添加三级"
            tone="fill"
            icon={<CirclePlus className="h-3.5 w-3.5" />}
            onClick={(event) => {
              event.stopPropagation();
              openCreateL3(l2.code);
            }}
          />
        </>
      );
    }

    const l3 = row.l3;
    const siblings = row.l2.children ?? [];
    return (
      <>
        <SkeuIconAction
          label={`上移 ${l3.name}`}
          tip={sortDisabled ? sortHint : "上移"}
          disabled={sortDisabled || row.l3Idx === 0}
          icon={<ChevronUp className="h-4 w-4" />}
          onClick={(event) => {
            event.stopPropagation();
            moveChild("l3", l3, siblings, -1);
          }}
        />
        <SkeuIconAction
          label={`下移 ${l3.name}`}
          tip={sortDisabled ? sortHint : "下移"}
          disabled={sortDisabled || row.l3Idx === siblings.length - 1}
          icon={<ChevronDown className="h-4 w-4" />}
          onClick={(event) => {
            event.stopPropagation();
            moveChild("l3", l3, siblings, 1);
          }}
        />
        <SkeuActionButton
          label="删除"
          tone="danger"
          icon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={(event) => {
            event.stopPropagation();
            openDelete(l3, "l3");
          }}
        />
        <SkeuActionButton
          label={l3.isActive ? "停用" : "启用"}
          tone={l3.isActive ? "warn" : "ok"}
          icon={
            l3.isActive ? (
              <PowerOff className="h-3.5 w-3.5" />
            ) : (
              <Power className="h-3.5 w-3.5" />
            )
          }
          onClick={(event) => {
            event.stopPropagation();
            toggleActive(l3, "l3");
          }}
        />
        <SkeuActionButton
          label="编辑"
          icon={<Pencil className="h-3.5 w-3.5" />}
          onClick={(event) => {
            event.stopPropagation();
            openEditL3(l3);
          }}
        />
      </>
    );
  };

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          showBack
          title="原料分类"
          description={`管理${domainLabel}一级、二级、三级分类体系；三级为可选层不做强限制。被引用的分类不可删除/改编号，可停用使新单据不再可选`}
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
        <CardHeader className="skeu-panel-toolbar shrink-0 px-5 py-4 space-y-3">
          <PageTabs
            tabs={domainTabs}
            value={domain}
            onChange={switchDomain}
            ariaLabel="分类域"
          />
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
            onRowClick={(row) => {
              if (row.kind === "l1") toggleExpandL1(row.l1.id);
              if (row.kind === "l2") toggleExpandL2(row.l2.id);
            }}
            fillHeight
            variant="skeu"
            actionsWidth="w-[420px]"
            getRowLevel={(row) => (row.kind === "l1" ? "l1" : "l2")}
            tableClassName="min-w-max"
            columns={[
              {
                header: "序号",
                className: "w-[72px]",
                cell: (row) => {
                  const l1No = (currentPage - 1) * pageSize + row.l1Idx + 1;
                  return (
                    <span className="text-muted-foreground">
                      {row.kind === "l1"
                        ? l1No
                        : row.kind === "l2"
                          ? `${l1No}.${row.l2Idx + 1}`
                          : `${l1No}.${row.l2Idx + 1}.${row.l3Idx + 1}`}
                    </span>
                  );
                },
              },
              {
                header: "编号",
                className: "w-[170px]",
                cell: (row) => {
                  if (row.kind === "l1") {
                    return (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={
                            expandedL1Id === row.l1.id
                              ? `收起 ${row.l1.name}`
                              : `展开 ${row.l1.name}`
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpandL1(row.l1.id);
                          }}
                          className="grid size-[26px] shrink-0 place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted"
                        >
                          {expandedL1Id === row.l1.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <CodeText>{row.l1.code}</CodeText>
                      </span>
                    );
                  }
                  if (row.kind === "l2") {
                    return (
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-[26px] shrink-0" />
                        <button
                          type="button"
                          aria-label={
                            expandedL2Id === row.l2.id
                              ? `收起 ${row.l2.name}`
                              : `展开 ${row.l2.name}`
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleExpandL2(row.l2.id);
                          }}
                          className="grid size-[26px] shrink-0 place-items-center rounded-[7px] text-muted-foreground transition-colors hover:bg-muted"
                        >
                          {expandedL2Id === row.l2.id ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <CodeText>{row.l2.code}</CodeText>
                      </span>
                    );
                  }
                  return (
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-[52px] shrink-0" />
                      <CodeText>{row.l3.code}</CodeText>
                    </span>
                  );
                },
              },
              {
                header: "名称",
                className: "w-[160px]",
                cell: (row) =>
                  row.kind === "l1" ? (
                    <span className="font-semibold">{row.l1.name}</span>
                  ) : row.kind === "l2" ? (
                    <span className="inline-block pl-[26px]">{row.l2.name}</span>
                  ) : (
                    <span className="inline-block pl-[52px]">{row.l3.name}</span>
                  ),
              },
              {
                header: "说明",
                className: "w-[220px]",
                cell: (row) => {
                  const description =
                    row.kind === "l1"
                      ? row.l1.description
                      : row.kind === "l2"
                        ? row.l2.description
                        : row.l3.description;
                  return (
                    <span
                      className={`block max-w-[220px] truncate whitespace-nowrap ${
                        description
                          ? "text-muted-foreground"
                          : "select-none text-muted-foreground/40"
                      }`}
                      title={description || ""}
                    >
                      {description || "–"}
                    </span>
                  );
                },
              },
              {
                header: "状态",
                className: "w-[110px]",
                cell: (row) => {
                  const record =
                    row.kind === "l1" ? row.l1 : row.kind === "l2" ? row.l2 : row.l3;
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
              totalLabel: formatPageSummary(totalItems),
              showPageSize: true,
              onPageSizeChange: setPageSize,
            }}
            emptyState={{ title: "暂无数据" }}
            rowActions={renderRowActions}
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
            : `编辑${typeLabel(dialogType)}`
        }
        onCancel={closeRecord}
        onSubmit={handleSubmit}
        dirty={isRecordDirty(form, baselineForm)}
        submitting={submitting}
        entityLabel={typeLabel(selectedType)}
      >
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
            {dialogType === "l3" && (
              <FormField label="所属二级分类" required>
                <SelectTileMode
                  options={l2Options}
                  value={form.parentCode}
                  onChange={(v) => setForm({ ...form, parentCode: v })}
                  placeholder="请选择二级分类"
                  title="选择所属二级分类"
                  searchPlaceholder="搜索二级分类..."
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
                    : "被引用后不可修改编号；如不再使用请停用"
                  : undefined
              }
            >
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder={
                  dialogType === "l1"
                    ? domain === "seasoning"
                      ? "如 SEA"
                      : "如 VEG"
                    : dialogType === "l2"
                      ? domain === "seasoning"
                        ? "如 SEA-SPC"
                        : "如 VEG-LEF"
                      : "如 VEG-LEF-SHQ"
                }
                className="h-11 text-base px-4"
              />
            </FormField>
            <FormField id="name" label="名称" required>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={
                  dialogType === "l1"
                    ? "如 蔬菜"
                    : dialogType === "l2"
                      ? "如 叶菜"
                      : "如 上海青"
                }
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
              确定要删除这条{typeLabel(deleteTarget?.type ?? "l1")}吗？
              {deleteTarget?.type === "l1" && " 将同时删除其下的所有二级、三级分类。"}
              {deleteTarget?.type === "l2" && " 将同时删除其下的所有三级分类。"}
            </p>
          )}
          <DialogFooter>
            <SkeuButton variant="outline" onClick={() => setDeleteTarget(null)}>
              {deleteError ? "知道了" : "取消"}
            </SkeuButton>
            {!deleteError && (
              <SkeuButton variant="danger" onClick={handleDelete}>
                删除
              </SkeuButton>
            )}
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </PageShell>
  );
}
