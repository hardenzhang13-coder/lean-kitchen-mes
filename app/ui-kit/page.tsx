"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Inbox,
  Layers3,
  PackageOpen,
  Plus,
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
  BusinessFieldInput,
  BusinessNumberInput,
  Input,
  ReadOnlyValue,
} from "@/app/components/ui/form-controls";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  FormField,
  FormLayout,
  FormSection,
} from "@/app/components/ui/form-field";
import { InfoTile } from "@/app/components/ui/info-tile";
import { LoadingState } from "@/app/components/ui/loading-state";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import {
  RecordActions,
  RecordSheet,
} from "@/app/components/ui/record-sheet";
import { SectionTabs } from "@/app/components/ui/section-tabs";
import { StatusBadge } from "@/app/components/ui/status-badge";

type KitTab = "patterns" | "forms" | "feedback";

const semanticColors = [
  { label: "主操作", className: "bg-primary" },
  { label: "成功", className: "bg-[var(--status-success)]" },
  { label: "警告", className: "bg-[var(--status-warning)]" },
  { label: "危险", className: "bg-[var(--status-danger)]" },
  { label: "信息", className: "bg-[var(--status-info)]" },
  { label: "中性", className: "bg-secondary" },
];

export default function UiKitPage() {
  const [tab, setTab] = useState<KitTab>("patterns");
  const [recordSheetOpen, setRecordSheetOpen] = useState(false);

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
              <FormSection title="价格信息" cols={1}>
                <FormField label="每斤单价">
                  <ReadOnlyValue value="18.50" numeric emphasis />
                </FormField>
              </FormSection>
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
        </div>
      )}
    </PageShell>
  );
}
