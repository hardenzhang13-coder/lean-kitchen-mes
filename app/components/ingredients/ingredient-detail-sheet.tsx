"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Loader2,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { EmptyState } from "@/app/components/ui/empty-state";
import { LoadingState } from "@/app/components/ui/loading-state";
import {
  RecordActions,
  RecordSheet,
} from "@/app/components/ui/record-sheet";
import {
  CategoryL1,
  IngredientFormFields,
  Unit,
} from "@/app/components/ingredients/ingredient-form-fields";
import { useIngredientForm } from "@/app/components/ingredients/use-ingredient-form";
import {
  NetIngredientFormFields,
  RawIngredientOption,
} from "@/app/components/ingredients/net-ingredient-form-fields";
import { useNetIngredientForm } from "@/app/components/ingredients/use-net-ingredient-form";
import { formatPercent } from "@/lib/shared/display-format";

export type IngredientDetailKind = "raw" | "net" | "minor";

type RawDetail = {
  id: number;
  code: string;
  name: string;
  alias: string | null;
  l2Code: string;
  purchaseSpec: string | null;
  purchaseUnit: string | null;
  stockUnit: string | null;
  defaultSupplierId: number | null;
  defaultSupplier?: { id: number; name: string } | null;
  latestRefPrice: number | null;
  pricePerJin: number | null;
};

type NetDetail = {
  id: number;
  code: string;
  name: string;
  l2Code: string;
  sourceIngredientId: number | null;
  sourceIngredient?: {
    id: number;
    name: string;
    pricePerJin?: number | null;
  } | null;
  packageSpec: number | null;
  packageMaterial: string | null;
  packageSize: string | null;
  processingFeePerJin: number | null;
  yieldRate: number | null;
  unitPrice: number | null;
  grossMarginRate: number | null;
  costPricePerJin?: number | null;
  outPricePerJin?: number | null;
  standardPackagePrice?: number | null;
};

interface IngredientDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: IngredientDetailKind;
  ingredientId: number | null;
  categoryName?: string;
  categories?: CategoryL1[];
  units?: Unit[];
  rawIngredients?: RawIngredientOption[];
  /** 原料详情在抽屉内原位切换只读/编辑 */
  inlineEdit?: boolean;
  /** 从列表“编辑”入口打开时直接进入编辑态 */
  startInEditMode?: boolean;
  onUpdated?: () => void;
  onEdit?: (id: number) => void;
  onConvert?: (id: number) => void;
  onPrintLabel?: (id: number) => void;
  onDelete?: (id: number) => void;
}

function formatMoney(value: number | null | undefined) {
  return value != null ? `¥${Number(value).toFixed(2)}` : "—";
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <h3 className="border-b bg-muted/40 px-4 py-3 text-sm font-semibold">
        {title}
      </h3>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 p-4">
        {children}
      </dl>
    </section>
  );
}

function InfoCell({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          "mt-1 break-words text-sm leading-6 " +
          (emphasis
            ? "font-semibold text-primary"
            : "font-medium text-foreground")
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function IngredientDetailSheet({
  open,
  onOpenChange,
  kind,
  ingredientId,
  categoryName,
  categories = [],
  units = [],
  rawIngredients = [],
  inlineEdit = false,
  startInEditMode = false,
  onUpdated,
  onEdit,
  onConvert,
  onPrintLabel,
  onDelete,
}: IngredientDetailSheetProps) {
  const [raw, setRaw] = useState<RawDetail | null>(null);
  const [net, setNet] = useState<NetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const rawInitialData = useMemo(
    () =>
      raw
        ? {
            id: raw.id,
            code: raw.code,
            name: raw.name,
            l2Code: raw.l2Code,
            alias: raw.alias,
            purchaseSpec: raw.purchaseSpec,
            purchaseUnit: raw.purchaseUnit,
            stockUnit: raw.stockUnit,
            latestRefPrice: raw.latestRefPrice,
            pricePerJin: raw.pricePerJin,
            defaultSupplierId: raw.defaultSupplierId,
          }
        : undefined,
    [raw]
  );

  const {
    form: rawForm,
    errors: rawErrors,
    l2Open,
    setL2Open,
    submitting: rawSubmitting,
    isDirty: rawIsDirty,
    handleChange: handleRawChange,
    submit: submitRaw,
    resetForm: resetRawForm,
  } = useIngredientForm({
    active: open && inlineEdit && kind === "raw" && raw != null,
    autoCalculate: editing,
    initialData: rawInitialData,
    categories,
    units,
    mode: "ingredient",
    onSaved: () => {
      setEditing(false);
      setRefreshKey((value) => value + 1);
      onUpdated?.();
    },
  });

  const {
    form: netForm,
    errors: netErrors,
    submitting: netSubmitting,
    isDirty: netIsDirty,
    handleChange: handleNetChange,
    submit: submitNet,
    resetForm: resetNetForm,
  } = useNetIngredientForm({
    active: open && inlineEdit && kind === "net" && net != null,
    initialData: net,
    categories,
    rawIngredients,
    sourcePricePerJin: net?.sourceIngredient?.pricePerJin,
    mode: "net",
    onSaved: () => {
      setEditing(false);
      setRefreshKey((value) => value + 1);
      onUpdated?.();
    },
  });

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      setEditing(false);
      setDiscardOpen(false);
      return;
    }
    setEditing(inlineEdit && startInEditMode);
    setDiscardOpen(false);
  }, [open, ingredientId, inlineEdit, startInEditMode]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open || !ingredientId) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setFailed(false);
      setRaw(null);
      setNet(null);
      try {
        const url =
          kind === "raw"
            ? `/api/ingredients/${ingredientId}`
            : `/api/net-ingredients/${ingredientId}`;
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("加载详情失败");
        const json: unknown = await response.json();
        const data =
          typeof json === "object" &&
          json !== null &&
          "data" in json &&
          typeof json.data === "object" &&
          json.data !== null
            ? json.data
            : json;
        if (kind === "raw") setRaw(data as RawDetail);
        else setNet(data as NetDetail);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [open, ingredientId, kind, refreshKey]);

  const title =
    kind === "raw" ? "原料详情" : kind === "minor" ? "小料详情" : "净料详情";
  const data = kind === "raw" ? raw : net;
  const canInlineEdit = inlineEdit && (kind === "raw" || kind === "net");
  const parentCategory = data
    ? categories.find((category) =>
        category.children.some((child) => child.code === data.l2Code)
      )
    : undefined;
  const childCategory = parentCategory?.children.find(
    (child) => child.code === data?.l2Code
  );
  const headerCode = data?.code || "";
  const headerL1 = parentCategory?.name || "";
  const headerL2 = childCategory?.name || categoryName || "";
  const headerSource =
    kind === "net" ? net?.sourceIngredient?.name || "" : "";
  const sheetTitle = canInlineEdit
    ? editing
      ? kind === "raw"
        ? "编辑原料"
        : "编辑净料"
      : kind === "raw"
        ? "原料详情"
        : "净料详情"
    : data?.name || title;
  const headerMeta = canInlineEdit ? (
    <>
      {headerCode && (
        <span className="font-mono font-medium tabular-nums text-muted-foreground">
          {headerCode}
        </span>
      )}
      {headerCode && (headerL1 || headerL2 || headerSource) && (
        <span aria-hidden="true">·</span>
      )}
      {headerL1 && (
        <span className="font-medium text-foreground">{headerL1}</span>
      )}
      {headerL1 && headerL2 && <span aria-hidden="true">·</span>}
      {headerL2 && <CategoryTag l2Code={data?.l2Code} name={headerL2} />}
      {headerL2 && headerSource && <span aria-hidden="true">·</span>}
      {headerSource && (
        <span className="font-medium text-foreground">{headerSource}</span>
      )}
    </>
  ) : (
    <>
      <span>{data?.code || "—"}</span>
      <span>·</span>
      <CategoryTag
        l2Code={data?.l2Code}
        name={categoryName || data?.l2Code || "—"}
      />
    </>
  );

  const activeSubmitting =
    kind === "raw" ? rawSubmitting : netSubmitting;
  const activeIsDirty = kind === "raw" ? rawIsDirty : netIsDirty;
  const activeSubmit = kind === "raw" ? submitRaw : submitNet;
  const activeResetForm = kind === "raw" ? resetRawForm : resetNetForm;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && canInlineEdit && editing && activeIsDirty) {
      setDiscardOpen(true);
      return;
    }
    if (!nextOpen) setEditing(false);
    onOpenChange(nextOpen);
  };

  const cancelEdit = () => {
    activeResetForm();
    setEditing(false);
  };

  const discardAndClose = () => {
    setDiscardOpen(false);
    setEditing(false);
    activeResetForm();
    onOpenChange(false);
  };

  return (
    <>
      <RecordSheet
        open={open}
        onOpenChange={handleOpenChange}
        title={sheetTitle}
        meta={headerMeta}
        footer={
          data ? (
            canInlineEdit ? (
              editing ? (
                <RecordActions
                  secondary={
                    <Button
                      variant="outline"
                      onClick={cancelEdit}
                      disabled={activeSubmitting}
                    >
                      取消
                    </Button>
                  }
                  primary={
                    <Button
                      onClick={() => {
                        void activeSubmit();
                      }}
                      disabled={activeSubmitting}
                    >
                      {activeSubmitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      保存
                    </Button>
                  }
                />
              ) : (
                <RecordActions
                  destructive={
                    onDelete ? (
                      <Button
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDelete(data.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </Button>
                    ) : undefined
                  }
                  secondary={
                    kind === "raw" ? (
                      <Button
                        variant="outline"
                        onClick={() => setEditing(true)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </Button>
                    ) : kind === "net" && onPrintLabel ? (
                      <Button
                        variant="outline"
                        onClick={() => setEditing(true)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </Button>
                    ) : undefined
                  }
                  primary={
                    onConvert ? (
                      <Button onClick={() => onConvert(data.id)}>
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        转净料
                      </Button>
                    ) : kind === "net" && onPrintLabel ? (
                      <Button
                        onClick={() => onPrintLabel(data.id)}
                        disabled={
                          net?.packageSpec == null ||
                          net.packageSpec <= 0
                        }
                        title={
                          net?.packageSpec != null && net.packageSpec > 0
                            ? "打印净菜标签"
                            : "缺少包装规格，无法打印标签"
                        }
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        打印标签
                      </Button>
                    ) : kind === "net" ? (
                      <Button onClick={() => setEditing(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </Button>
                    ) : undefined
                  }
                />
              )
            ) : (
              <RecordActions
                destructive={
                  onDelete ? (
                    <Button
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(data.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除
                    </Button>
                  ) : undefined
                }
                secondary={
                  onEdit ? (
                    <Button
                      variant="outline"
                      onClick={() => onEdit(data.id)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      编辑
                    </Button>
                  ) : undefined
                }
                primary={
                  kind === "raw" && onConvert ? (
                    <Button onClick={() => onConvert(data.id)}>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      转净料
                    </Button>
                  ) : !onEdit ? (
                    <Button
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                    >
                      关闭
                    </Button>
                  ) : undefined
                }
              />
            )
          ) : undefined
        }
      >
        {loading ? (
          <LoadingState type="page" />
        ) : failed || !data ? (
          <EmptyState
            title="详情加载失败"
            description="请关闭后重试，或检查该食材是否已被删除"
          />
        ) : canInlineEdit && kind === "raw" ? (
          <IngredientFormFields
            form={rawForm}
            onChange={handleRawChange}
            errors={rawErrors}
            categories={categories}
            units={units}
            mode="ingredient"
            l2Open={l2Open}
            onL2OpenChange={setL2Open}
            viewMode={!editing}
            layout="sheet"
            supplierName={raw?.defaultSupplier?.name}
          />
        ) : canInlineEdit && kind === "net" ? (
          <NetIngredientFormFields
            form={netForm}
            onChange={handleNetChange}
            errors={netErrors}
            categories={categories}
            rawIngredients={rawIngredients}
            sourcePricePerJin={net?.sourceIngredient?.pricePerJin}
            mode="net"
            viewMode={!editing}
            readOnly={{
              l1Code: true,
              l2Code: true,
              sourceIngredientId: true,
            }}
            layout="sheet"
          />
        ) : kind === "raw" ? (
          <RawDetailContent
            data={raw as RawDetail}
            categoryName={categoryName}
          />
        ) : (
          <NetDetailContent
            data={net as NetDetail}
            kind={kind}
            categoryName={categoryName}
          />
        )}
      </RecordSheet>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AppDialogContent size="compact" className="[&>button]:cursor-pointer">
          <DialogHeader>
            <DialogTitle className="text-lg">放弃未保存的修改？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            当前{kind === "raw" ? "原料" : "净料"}
            有尚未保存的修改，关闭后这些内容将丢失。
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDiscardOpen(false)}
            >
              继续编辑
            </Button>
            <Button variant="destructive" onClick={discardAndClose}>
              放弃并关闭
            </Button>
          </DialogFooter>
        </AppDialogContent>
      </Dialog>
    </>
  );
}

function RawDetailContent({
  data,
  categoryName,
}: {
  data: RawDetail;
  categoryName?: string;
}) {
  return (
    <div className="space-y-4">
      <DetailSection title="基础信息">
        <InfoCell label="编号" value={data.code} />
        <InfoCell label="名称" value={data.name} emphasis />
        <InfoCell label="品牌名称" value={data.alias || "—"} />
        <InfoCell label="分类" value={categoryName || data.l2Code} />
      </DetailSection>
      <DetailSection title="采购与计量">
        <InfoCell label="采购规格" value={data.purchaseSpec || "—"} />
        <InfoCell label="采购单位" value={data.purchaseUnit || "—"} />
        <InfoCell label="入库单位" value={data.stockUnit || "—"} />
        <InfoCell label="最新参照单价" value={formatMoney(data.latestRefPrice)} />
        <InfoCell
          label="每斤单价"
          value={
            data.pricePerJin != null
              ? `${formatMoney(data.pricePerJin)}/斤`
              : "—"
          }
          emphasis
        />
        <InfoCell
          label="供应商名称"
          value={data.defaultSupplier?.name || "—"}
        />
      </DetailSection>
    </div>
  );
}

function NetDetailContent({
  data,
  kind,
  categoryName,
}: {
  data: NetDetail;
  kind: IngredientDetailKind;
  categoryName?: string;
}) {
  return (
    <div className="space-y-4">
      <DetailSection title="基础信息">
        <InfoCell label="编号" value={data.code} />
        <InfoCell label="名称" value={data.name} emphasis />
        <InfoCell label="分类" value={categoryName || data.l2Code} />
        <InfoCell
          label="来源原料"
          value={data.sourceIngredient?.name || "—"}
        />
      </DetailSection>
      <DetailSection title="包装与规格">
        <InfoCell
          label="包装规格"
          value={data.packageSpec != null ? `${data.packageSpec}g` : "—"}
        />
        <InfoCell label="包装物料" value={data.packageMaterial || "—"} />
        <InfoCell label="包装尺寸" value={data.packageSize || "—"} />
        <InfoCell
          label="出成率"
          value={data.yieldRate != null ? `${data.yieldRate}%` : "—"}
        />
      </DetailSection>
      <DetailSection title="价格与成本">
        <InfoCell
          label={kind === "minor" ? "小料单价" : "净料单价"}
          value={`${formatMoney(data.unitPrice)}/斤`}
        />
        {kind !== "net" && (
          <InfoCell
            label="封装加工费"
            value={
              data.processingFeePerJin != null
                ? `${formatMoney(data.processingFeePerJin)}/斤`
                : "—"
            }
          />
        )}
        <InfoCell
          label="成本价"
          value={`${formatMoney(data.costPricePerJin)}/斤`}
        />
        <InfoCell
          label="毛利率"
          value={formatPercent(data.grossMarginRate)}
        />
        {kind !== "net" && (
          <InfoCell
            label="出库价"
            value={`${formatMoney(data.outPricePerJin)}/斤`}
          />
        )}
        <InfoCell
          label="标准规格价"
          value={`${formatMoney(data.standardPackagePrice)}/份`}
          emphasis
        />
      </DetailSection>
    </div>
  );
}
