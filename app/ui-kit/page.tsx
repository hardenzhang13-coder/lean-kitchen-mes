"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  History,
  Inbox,
  Layers3,
  Minus,
  PackageOpen,
  Pencil,
  Plus,
  PlusCircle,
  Power,
  PowerOff,
  Trash2,
  X,
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
import { DataTable } from "@/app/components/ui/data-table";
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
import { MeatTypeTag } from "@/app/components/ui/meat-type-tag";
import {
  SkeuChipSelect,
  SkeuChipTag,
  type ChipOption,
} from "@/app/components/ui/skeu-chip";
import { ROLE_OPTIONS } from "@/lib/shared/roles";
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
import { SeasoningTypeTag } from "@/app/components/ui/seasoning-type-tag";
import { SelectField } from "@/app/components/ui/select-field";
import { DatePicker } from "@/app/components/ui/date-picker";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { SkeuSearch } from "@/app/components/ui/skeu-search";
import { SkeuDotSelect, type SkeuDotOption } from "@/app/components/ui/skeu-dot-select";
import {
  SkeuListSelect,
  type SkeuListSelectOption,
} from "@/app/components/ui/skeu-list-select";
import { SkeuToggle } from "@/app/components/ui/skeu-toggle";
import { PageTabs } from "@/app/components/ui/page-tabs";
import { SkeuSegmented } from "@/app/components/ui/skeu-segmented";
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

const MEAT_FILTER_OPTIONS: SkeuDotOption[] = [
  { value: "", label: "全部", tone: "all" },
  { value: "荤菜", label: "荤菜", tone: "danger" },
  { value: "小荤菜", label: "小荤菜", tone: "rose" },
  { value: "素菜", label: "素菜", tone: "green" },
];

const DISH_CATEGORY_OPTIONS: SkeuListSelectOption[] = [
  { value: "1", label: "猪肉类" },
  { value: "2", label: "牛肉类" },
  { value: "3", label: "禽蛋类" },
  { value: "4", label: "水产类" },
  { value: "5", label: "蔬菜类" },
  { value: "6", label: "豆制品类" },
  { value: "7", label: "菌菇类" },
  { value: "8", label: "汤品类" },
];

const UNIT_CHIP_OPTIONS: ChipOption[] = [
  { value: "weight", label: "重量", tone: "orange" },
  { value: "volume", label: "体积", tone: "blue" },
  { value: "count", label: "计数", tone: "violet" },
  { value: "other", label: "其他", tone: "slate" },
];

const MATERIAL_SHADOWS = [
  { label: "1 级 · 贴合", className: "shadow-sk-1" },
  { label: "2 级 · 面板", className: "shadow-sk-2" },
  { label: "3 级 · 浮层", className: "shadow-sk-3" },
];

function MaterialKit() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [meatFilter, setMeatFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [unitCategory, setUnitCategory] = useState("weight");
  const [industry, setIndustry] = useState("veg");
  const [date, setDate] = useState("2026-11-21");
  const [text, setText] = useState("");
  const [pageTab, setPageTab] = useState("stock");
  const [segment, setSegment] = useState("all");

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
          <SkeuButton variant="warn">警示</SkeuButton>
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
          <SkeuListSelect
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={DISH_CATEGORY_OPTIONS}
            ariaLabel="类别筛选"
            allLabel="全部类别"
            searchable
            searchPlaceholder="搜索类别..."
            className="w-[160px]"
          />
          <SkeuDotSelect
            value={meatFilter}
            onChange={setMeatFilter}
            options={MEAT_FILTER_OPTIONS}
            aria-label="荤素筛选"
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
          <MeatTypeTag type="荤菜" />
          <MeatTypeTag type="小荤菜" />
          <MeatTypeTag type="素菜" />
          <ScheduleStatusTag status="进行中" />
          <DishStatusTag status="published" />
          <SeasoningTypeTag type="单品调料" />
          <SeasoningTypeTag type="复合调料" />
          <SeasoningTypeTag type="成品酱料" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">有色枚举</h2>
        <p className="text-sm text-muted-foreground">
          取值自带识别色时（单位分类等）：列表只读用 `SkeuChipTag`，表单选择用
          `SkeuChipSelect`，两者共用同一色板。
        </p>
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            {UNIT_CHIP_OPTIONS.map((option) => (
              <SkeuChipTag key={option.value} tone={option.tone}>
                {option.label}
              </SkeuChipTag>
            ))}
            {ROLE_OPTIONS.map((role) => (
              <SkeuChipTag key={role.value} tone={role.tone}>
                {role.label}
              </SkeuChipTag>
            ))}
          </div>
          <SkeuChipSelect
            ariaLabel="有色枚举示例"
            value={unitCategory}
            onChange={setUnitCategory}
            options={UNIT_CHIP_OPTIONS}
          />
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
        <div>
          <h2 className="text-lg font-semibold">一级页签 / 二级分段</h2>
          <p className="text-sm text-muted-foreground">
            一级页签切换整份列表；二级分段只做状态 / 类型 / 范围筛选，放在工具条内。
          </p>
        </div>
        <PageTabs
          tabs={[
            { value: "stock", label: "当前库存", icon: Boxes },
            { value: "outbound", label: "出库单", icon: ClipboardList },
            { value: "ledger", label: "出入库流水", icon: History },
          ]}
          value={pageTab}
          onChange={setPageTab}
        />
        <SkeuSegmented
          value={segment}
          onChange={setSegment}
          options={[
            { value: "all", label: "全部" },
            { value: "net", label: "净料" },
            { value: "minor", label: "小料" },
          ]}
          ariaLabel="净菜类型"
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">缺省态</h2>
          <p className="text-sm text-muted-foreground">
            浮雕图标盘 + 同心环 + 说明 + 主操作；列表空态直接占满列表区。
          </p>
        </div>
        <div className="rounded-xl border border-skeu-border bg-card">
          <EmptyState
            title="暂无原料"
            description="录入第一条原料后，它会出现在这里；也可以先批量导入。"
            action={<SkeuButton variant="primary">新增原料</SkeuButton>}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">标准简单表（SimpleListPage）</h2>
          <p className="text-sm text-muted-foreground">
            设置类简单 CRUD 清单的唯一模板：搜索 + 状态圆点筛选；设置模块主字段只加粗
            （业务列表才上主题色），空值统一 <code className="text-xs">EmptyValue</code>；行操作统一
            带文字幽灵态，从左到右 排序（纯图标）→ 删除（红）→ 启停（琥珀/绿）→ 编辑，
            主操作最右；删除确认走 DeleteConfirmDialog。开 <code className="text-xs">sortable</code>{" "}
            即在操作列最左插入上移 / 下移纯图标按钮，首行禁用上移、末行禁用下移，
            搜索或状态筛选生效时整体禁用并提示「搜索时不可排序」。新页面直接复用
            <code className="mx-1 text-xs">SimpleListPage</code>，不再手工拼骨架。
          </p>
        </div>
        <div className="skeu-panel overflow-hidden">
          <div className="skeu-panel-toolbar flex flex-wrap items-center gap-2 px-5 py-4">
            <SkeuSearch
              value={search}
              onChange={setSearch}
              placeholder="搜索名称或分类..."
            />
            <SkeuDotSelect
              value={status}
              onChange={setStatus}
              options={MATERIAL_STATUS_OPTIONS}
            />
          </div>
          <div className="skeu-table-scroll skeu-scroll overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[48px]">序号</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-muted-foreground">1</TableCell>
                  <TableCell className="font-semibold">斤</TableCell>
                  <TableCell className="text-muted-foreground">重量类基准单位</TableCell>
                  <TableCell>
                    <StatusBadge status="启用中" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <SkeuIconAction
                        label="上移 斤"
                        tip="上移"
                        disabled
                        icon={<ChevronUp className="h-4 w-4" />}
                      />
                      <SkeuIconAction
                        label="下移 斤"
                        tip="下移"
                        icon={<ChevronDown className="h-4 w-4" />}
                      />
                      <SkeuActionButton
                        label="删除"
                        tone="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                      />
                      <SkeuActionButton
                        label="停用"
                        tone="warn"
                        icon={<PowerOff className="h-3.5 w-3.5" />}
                      />
                      <SkeuActionButton
                        label="编辑"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                      />
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">2</TableCell>
                  <TableCell className="font-semibold">克</TableCell>
                  <TableCell className="text-muted-foreground">—</TableCell>
                  <TableCell>
                    <StatusBadge status="已停用" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <SkeuIconAction
                        label="上移 克"
                        tip="上移"
                        icon={<ChevronUp className="h-4 w-4" />}
                      />
                      <SkeuIconAction
                        label="下移 克"
                        tip="下移"
                        disabled
                        icon={<ChevronDown className="h-4 w-4" />}
                      />
                      <SkeuActionButton
                        label="删除"
                        tone="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                      />
                      <SkeuActionButton
                        label="启用"
                        tone="ok"
                        icon={<Power className="h-3.5 w-3.5" />}
                      />
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
            <span className="text-[13px] font-semibold text-primary">共 2 条</span>
            <span className="text-[13px] text-muted-foreground">
              上一页 · 1 · 下一页
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">排程拟物件（2026-11-22）</h2>
          <p className="text-sm text-muted-foreground">
            去排菜弹窗与排程看板卡片的专用件：菜品选择卡、已选卡、筛选片、索引卡。
            三态着色只落在索引卡舌片与头部，卡身保持中性纸面；
            待生效带活页本装订条（.skeu-index-binding），已完成带撕边便签底（.skeu-index-tear）。
            卡中部明细区左右与头部框内文字对齐（.skeu-index-list）；「查看更多」唤起弹窗看全量清单。
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div className="text-sm font-semibold">菜品选择卡 · skeu-dish-card</div>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" data-on="true" className="skeu-dish-card p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-[22px] items-center rounded-full bg-[#f4f1eb] px-1.5 text-xs font-bold text-[#6d675f]">
                    猪肉类
                  </span>
                  <span className="skeu-pick-dot">
                    <Check strokeWidth={3} />
                  </span>
                </div>
                <div className="mt-2 truncate pr-5 text-sm font-bold text-[#36312a]">红烧肉</div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">DSH-PORK-0001</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <PortionTag portion="单人份" className="h-[22px] px-1.5 text-xs" />
                  <span className="font-mono text-[13px] font-bold text-[#7a4a2a] tabular-nums">
                    ¥16.00
                  </span>
                </div>
              </button>
              <button type="button" data-on="false" className="skeu-dish-card p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-[22px] items-center rounded-full bg-[#f4f1eb] px-1.5 text-xs font-bold text-[#6d675f]">
                    蔬菜类
                  </span>
                  <span className="skeu-pick-dot">
                    <Check strokeWidth={3} />
                  </span>
                </div>
                <div className="mt-2 truncate pr-5 text-sm font-bold text-[#36312a]">清炒时蔬</div>
                <div className="mt-0.5 font-mono text-xs text-muted-foreground">DSH-VEG-0003</div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <PortionTag portion="社区·2份" className="h-[22px] px-1.5 text-xs" />
                  <span className="font-mono text-[13px] font-bold text-[#7a4a2a] tabular-nums">
                    ¥8.00
                  </span>
                </div>
              </button>
            </div>
            <div className="text-sm font-semibold">已选卡 · skeu-picked-card（最新选中在前）</div>
            <div className="skeu-picked-card grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 px-3 py-2.5 pl-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-[#2f4237]">红烧肉</div>
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-[#687a70]">
                  <span className="inline-flex h-5 items-center rounded-full border border-[#d4e3d9] bg-white/75 px-1.5 text-xs font-bold text-[#5d7265]">
                    猪肉类
                  </span>
                  <PortionTag portion="单人份" className="h-5 text-xs" />
                  <span className="font-mono font-bold">¥16.00</span>
                </div>
              </div>
              <button
                type="button"
                aria-label="移除示例"
                className="skeu-icon-btn size-7 shrink-0 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="col-span-2 mt-1.5 flex items-center justify-end gap-1.5">
                <SkeuButton size="icon-sm" variant="outline" aria-label="减少份数">
                  <Minus className="h-3 w-3" />
                </SkeuButton>
                <span className="skeu-input grid h-7 w-14 place-items-center font-mono text-sm font-bold">
                  12
                </span>
                <SkeuButton size="icon-sm" variant="outline" aria-label="增加份数">
                  <Plus className="h-3 w-3" />
                </SkeuButton>
                <span className="ml-1 text-xs text-muted-foreground">份</span>
              </div>
            </div>
            <div className="text-sm font-semibold">筛选片 · skeu-fchip</div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" data-on="true" className="skeu-fchip">全部</button>
              <button type="button" data-on="false" className="skeu-fchip">猪肉类</button>
              <button type="button" data-on="false" className="skeu-fchip">¥10 - ¥20</button>
            </div>
          </div>
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <div className="text-sm font-semibold">排程索引卡 · skeu-index-card</div>
            {(["待生效", "进行中", "已完成"] as const).map((status) => (
              <article key={status} className="skeu-index-card" data-status={status}>
                <span className="skeu-index-tab" aria-hidden />
                <span className="skeu-index-binding" aria-hidden>
                  <span className="skeu-index-rings">
                    {[0, 1, 2, 3, 4].map((ring) => (
                      <span key={ring} className="skeu-index-ring" />
                    ))}
                  </span>
                </span>
                <div className="skeu-index-body flex min-h-0 flex-1 flex-col">
                  <div className="skeu-index-head">
                    <div className="grid grid-cols-[minmax(0,1fr)_68px] items-center gap-3">
                      <div className="min-w-0">
                        <span className="block text-xs font-bold tracking-[0.12em] text-muted-foreground">
                          门店
                        </span>
                        <h3 className="mt-0.5 truncate text-xl leading-tight font-bold text-[color:var(--ic-head)]">
                          新金食堂
                        </h3>
                      </div>
                      <div className="skeu-datebox">
                        <b className="text-[22px] leading-none font-bold tabular-nums">24</b>
                        <span className="mt-1 text-xs font-bold">11月 · 周二</span>
                      </div>
                    </div>
                  </div>
                  <div className="skeu-index-list mt-2.5">
                    <div className="grid h-[31px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--ic-row)]">
                      <span className="truncate text-[13px] font-semibold text-[color:var(--ic-body)]">
                        红烧肉
                      </span>
                      <span className="text-[13px] font-bold text-[color:var(--ic-head)] tabular-nums">
                        20<small className="ml-0.5 text-xs font-normal text-muted-foreground">份</small>
                      </span>
                    </div>
                    <div className="grid h-[31px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--ic-row)]">
                      <span className="truncate text-[13px] font-semibold text-[color:var(--ic-body)]">
                        番茄炒蛋
                      </span>
                      <span className="text-[13px] font-bold text-[color:var(--ic-head)] tabular-nums">
                        16<small className="ml-0.5 text-xs font-normal text-muted-foreground">份</small>
                      </span>
                    </div>
                    <div className="grid h-[31px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[color:var(--ic-row)]">
                      <span className="truncate text-[13px] font-semibold text-[color:var(--ic-body)]">
                        清炒时蔬
                      </span>
                      <span className="text-[13px] font-bold text-[color:var(--ic-head)] tabular-nums">
                        12<small className="ml-0.5 text-xs font-normal text-muted-foreground">份</small>
                      </span>
                    </div>
                    <div className="flex h-[30px] items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        还有 5 道
                      </span>
                      <span className="h-6 rounded-md px-1.5 text-xs font-bold text-[#77695a]">
                        查看更多
                      </span>
                    </div>
                  </div>
                </div>
                <footer className="skeu-index-foot mt-2 flex min-h-[52px] items-center justify-between gap-2 border-t border-[color:var(--ic-row)] bg-white/55 py-2">
                  <span className="text-xs font-bold text-muted-foreground tabular-nums">
                    <b className="text-base text-[color:var(--ic-head)]">8</b> 菜 /{" "}
                    <b className="text-base text-[color:var(--ic-head)]">56</b> 份
                  </span>
                  <span className="flex items-center gap-1.5">
                    <SkeuButton variant="outline" size="sm">
                      {status === "待生效" ? "改菜单" : "查看详情"}
                    </SkeuButton>
                    {status === "待生效" && <SkeuButton size="sm">确认生产</SkeuButton>}
                  </span>
                </footer>
                <span className="skeu-index-tear" aria-hidden />
              </article>
            ))}
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
            <div>
              <h2 className="text-lg font-semibold">空态表格</h2>
              <p className="text-sm text-muted-foreground">
                表格空数据保留表头，空态收进表体单元格（DataTable 内置，与
                loading 态同构）。
              </p>
            </div>
            <DataTable
              data={[]}
              columns={[
                { header: "编号", className: "w-[120px]" },
                { header: "名称", className: "w-[200px]" },
                { header: "规格", className: "w-[120px]" },
              ]}
              emptyState={{
                title: "暂无调料",
                description: "在「调味品」页签的原料行点「转化」生成调料档案",
              }}
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
                份量的唯一渲染入口，取值来自份量档案（设置模块「份量」）。
                色板按档案场景映射：单人份 / 社区 / 团餐食堂，未知场景 muted 兜底。
                文字统一深墨（--capsule-ink），色相识别靠底色 + 圆点，避免与主色橙冲突。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4">
              <PortionTag portion="单人份" />
              <PortionTag portion="社区·2份" />
              <PortionTag portion="小碗菜·10份" />
              <PortionTag portion="未知场景·5份" />
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
