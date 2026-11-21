"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardList,
  Inbox,
  Layers3,
  PackageOpen,
  Pencil,
  Plus,
  PlusCircle,
  Power,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BusinessFieldInput,
  BusinessNumberInput,
  Input,
  ReadOnlyValue,
  Textarea,
} from "@/app/components/ui/form-controls";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  FormField,
  FormLayout,
  FormSection,
} from "@/app/components/ui/form-field";
import { InfoTile } from "@/app/components/ui/info-tile";
import { DetailSection, InfoCell } from "@/app/components/ui/detail-section";
import { DiscardChangesDialog } from "@/app/components/ui/discard-changes-dialog";
import {
  RecordDialog,
  RecordView,
  SimpleForm,
  isRecordDirty,
} from "@/app/components/ui/record-dialog";
import { PortionTag } from "@/app/components/ui/portion-tag";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import {
  RecordActions,
  RecordSheet,
} from "@/app/components/ui/record-sheet";
import { SectionTabs } from "@/app/components/ui/section-tabs";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { DishStatusTag } from "@/app/components/ui/dish-status-tag";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { ScheduleStatusTag } from "@/app/components/ui/schedule-status-tag";
import { SelectField } from "@/app/components/ui/select-field";
import { DatePicker } from "@/app/components/ui/date-picker";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuSearch } from "@/app/components/ui/skeu-search";
import { SkeuDotSelect, type SkeuDotOption } from "@/app/components/ui/skeu-dot-select";
import { SkeuToggle } from "@/app/components/ui/skeu-toggle";
import {
  SkeuActionButton,
  SkeuIconAction,
} from "@/app/components/ui/skeu-row-action";

type KitTab = "patterns" | "forms" | "feedback" | "materials";

const semanticColors = [
  { label: "主操作", className: "bg-primary" },
  { label: "成功", className: "bg-[var(--status-success)]" },
  { label: "警告", className: "bg-[var(--status-warning)]" },
  { label: "危险", className: "bg-[var(--status-danger)]" },
  { label: "信息", className: "bg-[var(--status-info)]" },
  { label: "中性", className: "bg-secondary" },
];

const MATERIAL_INDUSTRY_OPTIONS = [
  { value: "veg", label: "蔬菜" },
  { value: "meat", label: "畜肉" },
  { value: "aquatic", label: "水产" },
];

const MATERIAL_STATUS_OPTIONS: SkeuDotOption[] = [
  { value: "all", label: "全部", tone: "all" },
  { value: "active", label: "启用中", tone: "success" },
  { value: "inactive", label: "已停用", tone: "warning" },
];

const MATERIAL_SHADOWS = [
  { label: "1 级 · 贴合", className: "shadow-sk-1" },
  { label: "2 级 · 面板", className: "shadow-sk-2" },
  { label: "3 级 · 浮层", className: "shadow-sk-3" },
];

function MaterialKit() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const [industry, setIndustry] = useState("veg");
  const [date, setDate] = useState("2026-11-21");
  const [text, setText] = useState("");

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">三种表面</h2>
          <p className="text-sm text-muted-foreground">
            结构材质只做薄纸 + 压边；实体材质才允许投影；表格、表单字段和正文保持平面。
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-skeu-border bg-card p-4">
            <div className="text-sm font-semibold">平面</div>
            <p className="mt-1 text-xs text-muted-foreground">表格、表单字段、正文</p>
          </div>
          <div className="skeu-panel p-4">
            <div className="text-sm font-semibold">纸面</div>
            <p className="mt-1 text-xs text-muted-foreground">面板、工具条、分页条</p>
          </div>
          <div className="skeu-input p-4">
            <div className="text-sm font-semibold">内凹</div>
            <p className="mt-1 text-xs text-muted-foreground">输入框、搜索、轨道</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">阴影阶梯</h2>
          <p className="text-sm text-muted-foreground">
            一屏三影：每屏最多三个带投影的实体，浮层与弹窗不计。
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {MATERIAL_SHADOWS.map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border border-skeu-border bg-card p-4 ${item.className}`}
            >
              <div className="text-sm font-semibold">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">按钮族</h2>
        <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-4">
          <SkeuButton>主操作</SkeuButton>
          <SkeuButton variant="outline">描边</SkeuButton>
          <SkeuButton variant="secondary">次级</SkeuButton>
          <SkeuButton variant="ghost">幽灵</SkeuButton>
          <SkeuButton variant="danger">危险</SkeuButton>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">输入族</h2>
        <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-2">
          <Input placeholder="单行输入" />
          <Textarea
            placeholder="多行输入"
            rows={3}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <SelectField
            value={industry}
            onChange={setIndustry}
            options={MATERIAL_INDUSTRY_OPTIONS}
          />
          <DatePicker value={date} onChange={setDate} showWeekday />
          <SkeuSearch
            value={search}
            onChange={setSearch}
            placeholder="搜索编号或名称..."
          />
          <SkeuDotSelect
            value={status}
            onChange={setStatus}
            options={MATERIAL_STATUS_OPTIONS}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SkeuToggle
            checked={expanded}
            onCheckedChange={setExpanded}
            label={expanded ? "全部收起" : "全部展开"}
          />
          <span className="text-sm text-muted-foreground">
            用于列表的展开/收起，不用于业务状态。
          </span>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">标签族</h2>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4">
          <StatusBadge status="进行中" />
          <StatusBadge status="已完成" />
          <StatusBadge status="待生效" />
          <StatusBadge status="已作废" />
          <StatusBadge status="草稿" />
          <CategoryTag l1Code="VEG" name="蔬菜" />
          <PortionTag portion="社区·2份" />
          <ScheduleStatusTag status="进行中" />
          <DishStatusTag status="published" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">行操作</h2>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4">
          <SkeuIconAction
            label="上移"
            tip="上移"
            icon={<ArrowUp className="h-4 w-4" />}
          />
          <SkeuIconAction
            label="下移"
            tip="下移"
            icon={<ArrowDown className="h-4 w-4" />}
          />
          <SkeuActionButton
            label="删除"
            tone="danger"
            icon={<Trash2 className="h-3.5 w-3.5" />}
          />
          <SkeuActionButton
            label="停用"
            tone="warn"
            icon={<Power className="h-3.5 w-3.5" />}
          />
          <SkeuActionButton
            label="编辑"
            icon={<Pencil className="h-3.5 w-3.5" />}
          />
          <SkeuActionButton
            label="添加二级"
            tone="primary"
            icon={<PlusCircle className="h-3.5 w-3.5" />}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">清单模板</h2>
        <div className="skeu-panel overflow-hidden">
          <div className="skeu-panel-toolbar flex flex-wrap items-center gap-2 px-5 py-4">
            <SkeuSearch
              value={search}
              onChange={setSearch}
              placeholder="搜索编号或名称..."
            />
            <SkeuDotSelect
              value={status}
              onChange={setStatus}
              options={MATERIAL_STATUS_OPTIONS}
            />
            <SkeuToggle
              checked={expanded}
              onCheckedChange={setExpanded}
              label={expanded ? "全部收起" : "全部展开"}
            />
          </div>
          <div className="skeu-table-scroll skeu-scroll overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>编号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">VEG</TableCell>
                  <TableCell>蔬菜</TableCell>
                  <TableCell>
                    <StatusBadge status="正常" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <SkeuActionButton
                        label="编辑"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                      />
                      <SkeuActionButton
                        label="添加二级"
                        tone="primary"
                        icon={<PlusCircle className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow data-row-level="l2">
                  <TableCell className="text-muted-foreground">VEG-LEF</TableCell>
                  <TableCell>叶菜</TableCell>
                  <TableCell>
                    <StatusBadge status="已停用" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <SkeuActionButton
                        label="编辑"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="skeu-panel-foot flex items-center justify-between">
            <span className="text-[13px] text-muted-foreground">共 2 条</span>
            <span className="text-[13px] text-muted-foreground">
              上一页 · 1 · 下一页
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">材质原则</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>一屏三影：每屏最多三个带投影的元素，浮层与弹窗不计。</li>
          <li>表里无材质：表格、表单字段、正文不放阴影或渐变。</li>
          <li>光只从上：凸起 = 顶部高光 + 底部投影；凹陷 = 顶部内阴影；同一元素不可既凹又凸。</li>
          <li>色温一体：所有表面来自同一条暖中性 ramp，组件内不直写 hex。</li>
          <li>动效只做触感：只动 transform / shadow / opacity，80ms 按压、120ms hover、180ms 展开。</li>
        </ol>
      </section>
    </div>
  );
}

export default function UiKitPage() {
  const [tab, setTab] = useState<KitTab>("patterns");
  const [recordSheetOpen, setRecordSheetOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [recordDemoOpen, setRecordDemoOpen] = useState(false);
  const [recordDemoMode, setRecordDemoMode] = useState<
    "view" | "create" | "edit"
  >("view");
  const [recordDemoName, setRecordDemoName] = useState("斤");
  const [recordDemoBaseline, setRecordDemoBaseline] = useState("斤");

  return (
    <PageShell>
      <PageHeader
        title="交互视觉基线"
        description="页面骨架、组件状态和反馈方式的唯一可视样张。业务页面应优先复用这里的组合。"
        actions={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            主操作示例
          </Button>
        }
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">语义颜色</h2>
          <p className="text-sm text-muted-foreground">
            颜色表达状态，不表达装饰。分类色与状态色分开使用。
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {semanticColors.map((color) => (
            <div key={color.label} className="overflow-hidden rounded-lg border bg-card">
              <div className={`h-12 ${color.className}`} />
              <div className="px-3 py-2 text-sm">{color.label}</div>
            </div>
          ))}
        </div>
      </section>

      <SectionTabs
        ariaLabel="组件样张分类"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "patterns", label: "页面模式" },
          { value: "forms", label: "表单与操作" },
          { value: "feedback", label: "状态与反馈" },
          { value: "materials", label: "v2 材质" },
        ]}
      />

      {tab === "patterns" && (
        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">详情摘要</h2>
              <p className="text-sm text-muted-foreground">
                使用 1—4 个固定信息位承载日期、制单人、来源和汇总数据。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <InfoTile
                icon={ClipboardList}
                label="生产日期"
                value="2026年11月14日"
                helper="星期六"
              />
              <InfoTile
                icon={Layers3}
                label="汇总排程单"
                value="3 张"
                helper="SCH-001、SCH-002、SCH-003"
              />
              <InfoTile
                icon={CheckCircle2}
                label="完成进度"
                value="8 / 12 项"
                helper="4 项待确认"
              />
              <InfoTile
                icon={PackageOpen}
                label="计划份数"
                value="126 份"
                helper="切配 12 项 / 采购 8 项"
              />
            </div>
          </section>

        </div>
      )}

      {tab === "forms" && (
        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">操作层级</h2>
              <p className="text-sm text-muted-foreground">
                一个页面只保留一个主操作，危险操作与主操作分离。
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <RecordActions
                destructive={
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                  >
                    删除
                  </Button>
                }
                secondary={<Button variant="outline">编辑</Button>}
                primary={<Button>确认录入</Button>}
              />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">通用输入与只读值</h2>
              <p className="text-sm text-muted-foreground">
                数字字段禁止步进；业务输入可聚焦隐藏占位；只读值不复用禁用控件。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 rounded-lg border bg-card p-4 md:grid-cols-3">
              <FormField label="示例输入">
                <BusinessFieldInput
                  placeholder="聚焦后隐藏此提示"
                  hidePlaceholderOnFocus
                />
              </FormField>
              <FormField label="数字输入">
                <BusinessNumberInput
                  defaultValue="12.50"
                  step="0.01"
                />
              </FormField>
              <FormField label="只读值">
                <ReadOnlyValue value="18.50" numeric emphasis />
              </FormField>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">三列分组表单</h2>
              <p className="text-sm text-muted-foreground">
                工作台横向排列分组；抽屉场景可切换为纵向分组，组内仍保持三列。
              </p>
            </div>
            <FormLayout variant="workbench">
              <FormSection title="核心信息" cols={1}>
                <FormField label="采购日期" required>
                  <Input defaultValue="2026-11-14" />
                </FormField>
              </FormSection>
              <FormSection title="采购信息" cols={1}>
                <FormField label="采购单位" required>
                  <Input defaultValue="斤" />
                </FormField>
              </FormSection>
              <FormSection title="补充信息" cols={1}>
                <FormField label="采购摘要">
                  <Input placeholder="填写采购摘要..." />
                </FormField>
              </FormSection>
            </FormLayout>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">语义化弹窗</h2>
            <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
              {(["compact", "form", "wide", "workbench"] as const).map(
                (size) => (
                  <Dialog key={size}>
                    <DialogTrigger
                      render={<Button variant="outline">{size}</Button>}
                    />
                    <AppDialogContent size={size}>
                      <DialogHeader>
                        <DialogTitle>弹窗尺寸：{size}</DialogTitle>
                        <DialogDescription>
                          业务页面选择语义尺寸，不直接声明像素宽度。
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline">取消</Button>
                        <Button>确认</Button>
                      </DialogFooter>
                    </AppDialogContent>
                  </Dialog>
                )
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">简单记录三态弹窗</h2>
              <p className="text-sm text-muted-foreground">
                查看 / 新增 / 编辑共用一个外壳；删除放在列表操作列并二次确认，编辑态只保留取消与保存。
              </p>
            </div>
            <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-4">
              <Button
                variant="outline"
                onClick={() => {
                  setRecordDemoName("斤");
                  setRecordDemoBaseline("斤");
                  setRecordDemoMode("view");
                  setRecordDemoOpen(true);
                }}
              >
                查看示例
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setRecordDemoName("");
                  setRecordDemoBaseline("");
                  setRecordDemoMode("create");
                  setRecordDemoOpen(true);
                }}
              >
                新增示例
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setRecordDemoName("斤");
                  setRecordDemoBaseline("斤");
                  setRecordDemoMode("edit");
                  setRecordDemoOpen(true);
                }}
              >
                编辑示例
              </Button>
            </div>
            <RecordDialog
              open={recordDemoOpen}
              onOpenChange={setRecordDemoOpen}
              mode={recordDemoMode}
              title={
                recordDemoMode === "view"
                  ? recordDemoName
                  : recordDemoMode === "create"
                    ? "新增单位"
                    : "编辑单位"
              }
              meta={
                recordDemoMode === "view" ? (
                  <StatusBadge status="启用中" variant="success" />
                ) : undefined
              }
              onEdit={() => setRecordDemoMode("edit")}
              onCancel={() => {
                if (recordDemoMode === "create") setRecordDemoOpen(false);
                else {
                  setRecordDemoMode("view");
                  setRecordDemoName(recordDemoBaseline);
                }
              }}
              onSubmit={() => setRecordDemoOpen(false)}
              dirty={isRecordDirty(
                { name: recordDemoName },
                { name: recordDemoBaseline }
              )}
              entityLabel="单位"
            >
              {recordDemoMode === "view" ? (
                <RecordView
                  items={[
                    { label: "名称", value: recordDemoName, emphasis: true },
                    { label: "分类", value: "重量" },
                    { label: "换算值", value: "500 g/单位" },
                  ]}
                />
              ) : (
                <SimpleForm>
                  <FormField id="record-demo-name" label="名称" required>
                    <Input
                      value={recordDemoName}
                      onChange={(e) => setRecordDemoName(e.target.value)}
                      placeholder="如 斤"
                      className="h-11 text-base px-4"
                    />
                  </FormField>
                </SimpleForm>
              )}
            </RecordDialog>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">详情抽屉</h2>
              <p className="text-sm text-muted-foreground">
                标题、摘要、内容与操作槽位由统一外壳承载。
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setRecordSheetOpen(true)}
            >
              打开详情抽屉
            </Button>
            <RecordSheet
              open={recordSheetOpen}
              onOpenChange={setRecordSheetOpen}
              title="原料详情"
              meta={<span>ING-0011 · 肉类 · 猪肉</span>}
              footer={
                <RecordActions
                  destructive={
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                    >
                      删除
                    </Button>
                  }
                  secondary={<Button variant="outline">编辑</Button>}
                  primary={<Button>转净料</Button>}
                />
              }
            >
              <DetailSection title="价格信息">
                <InfoCell label="每斤单价" value="¥18.50/斤" emphasis />
                <InfoCell label="份量" value={<PortionTag portion="社区·2份" />} />
              </DetailSection>
            </RecordSheet>
          </section>
        </div>
      )}

      {tab === "feedback" && (
        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">状态标签</h2>
              <p className="text-sm text-muted-foreground">
                状态文字与语义色始终由同一个组件映射。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-4">
              <StatusBadge status="进行中" />
              <StatusBadge status="已完成" />
              <StatusBadge status="待生效" />
              <StatusBadge status="已作废" />
              <StatusBadge status="未匹配" />
              <StatusBadge status="正常" />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">菜品状态标签</h2>
              <p className="text-sm text-muted-foreground">
                菜品状态枚举的唯一渲染入口，取值与配色来自 lib/shared/dish-status.ts。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border bg-card p-4">
              <DishStatusTag status="draft" />
              <DishStatusTag status="published" />
              <DishStatusTag status="inactive" />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">空状态</h2>
            <EmptyState
              icon={Inbox}
              title="暂无采购单"
              description="上传第一张采购单后，识别结果会显示在这里。"
              action={{ label: "录入采购单" }}
              className="rounded-lg border bg-card"
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">加载状态</h2>
            <LoadingState type="list" rows={2} />
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">份量标签</h2>
              <p className="text-sm text-muted-foreground">
                份量枚举的唯一渲染入口，取值来自 lib/shared/portion-scale.ts。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4">
              <PortionTag portion="小碗菜" />
              <PortionTag portion="小碗菜·10份" />
              <PortionTag portion="社区·2份" />
              <PortionTag portion="社区·3份" />
              <PortionTag portion="社区·4份" />
              <PortionTag portion={null} />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">放弃未保存修改</h2>
              <p className="text-sm text-muted-foreground">
                关闭有未保存改动的详情时统一走这个确认弹窗。
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setDiscardOpen(true)}
            >
              打开确认弹窗
            </Button>
            <DiscardChangesDialog
              open={discardOpen}
              onOpenChange={setDiscardOpen}
              entityLabel="净料"
              onDiscard={() => setDiscardOpen(false)}
            />
          </section>
        </div>
      )}

      {tab === "materials" && <MaterialKit />}
    </PageShell>
  );
}
