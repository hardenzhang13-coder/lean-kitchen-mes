"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Copy,
  Link2,
  Loader2,
  PackageOpen,
  Pencil,
  Printer,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryTag } from "@/app/components/ui/category-tag";
import { DetailSection, InfoCell } from "@/app/components/ui/detail-section";
import { EmptyState } from "@/app/components/ui/empty-state";
import { LoadingState } from "@/app/components/ui/loading-state";
import {
  RecordActions,
  RecordSheet,
} from "@/app/components/ui/record-sheet";
import { DiscardChangesDialog } from "@/app/components/ui/discard-changes-dialog";
import { useRecordGuard } from "@/app/components/ui/use-record-guard";
import { NetIngredientDishesDialog } from "@/app/components/ingredients/net-ingredient-dishes-dialog";
import { StandardSeasoningListSheet } from "@/app/components/ingredients/standard-seasoning-list-sheet";
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
import { formatPercent, formatDateTime } from "@/lib/shared/display-format";

export type IngredientDetailKind = "raw" | "seasoning" | "net" | "minor";

export type RawDetail = {
  id: number;
  code: string;
  name: string;
  alias: string | null;
  l2Code: string;
  purchaseSpec: string | null;
  purchaseUnit: string | null;
  stockUnit: string | null;
  unitsPerPurchase?: number | null;
  defaultSupplierId: number | null;
  defaultSupplier?: { id: number; name: string } | null;
  latestRefPrice: number | null;
  pricePerJin: number | null;
  /** 建档时间 */
  createdAt?: string | null;
};

export type NetDetail = {
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
  /** 份量（小碗菜 / 社区口径） */
  portion?: string | null;
  /** 建档时间 */
  createdAt?: string | null;
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
  /** 复制：以当前记录为模板新建一条数据 */
  onCopy?: (record: RawDetail | NetDetail) => void;
}

function formatMoney(value: number | null | undefined) {
  return value != null ? `¥${Number(value).toFixed(2)}` : "—";
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
  onCopy,
}: IngredientDetailSheetProps) {
  const [raw, setRaw] = useState<RawDetail | null>(null);
  // 调料的「封装调料」查看弹窗
  const [packagedOpen, setPackagedOpen] = useState(false);
  const [net, setNet] = useState<NetDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [relatedDishesOpen, setRelatedDishesOpen] = useState(false);
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
    active:
      open &&
      inlineEdit &&
      (kind === "raw" || kind === "seasoning") &&
      raw != null,
    autoCalculate: editing,
    initialData: rawInitialData,
    categories,
    units,
    mode: kind === "seasoning" ? "seasoning" : "ingredient",
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
    active:
      open &&
      inlineEdit &&
      (kind === "net" || kind === "minor") &&
      net != null,
    initialData: net,
    categories,
    rawIngredients,
    sourcePricePerJin: net?.sourceIngredient?.pricePerJin,
    mode: kind === "minor" ? "minor" : "net",
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
      return;
    }
    setEditing(inlineEdit && startInEditMode);
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
          kind === "raw" || kind === "seasoning"
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
        if (kind === "raw" || kind === "seasoning") setRaw(data as RawDetail);
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
    kind === "raw"
      ? "原料详情"
      : kind === "seasoning"
        ? "调料详情"
        : kind === "minor"
          ? "小料详情"
          : "净料详情";
  const data = kind === "raw" || kind === "seasoning" ? raw : net;
  const canInlineEdit = inlineEdit;
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
    kind === "net" || kind === "minor"
      ? net?.sourceIngredient?.name || ""
      : "";
  const sheetTitle = canInlineEdit
    ? editing
      ? kind === "raw"
        ? "编辑原料"
          : kind === "seasoning"
            ? "编辑调料"
            : kind === "minor"
              ? "编辑小料"
              : "编辑净料"
      : kind === "raw"
        ? "原料详情"
        : kind === "seasoning"
          ? "调料详情"
          : kind === "minor"
            ? "小料详情"
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
    kind === "raw" || kind === "seasoning" ? rawSubmitting : netSubmitting;
  const activeIsDirty =
    kind === "raw" || kind === "seasoning" ? rawIsDirty : netIsDirty;
  const activeSubmit =
    kind === "raw" || kind === "seasoning" ? submitRaw : submitNet;
  const activeResetForm =
    kind === "raw" || kind === "seasoning" ? resetRawForm : resetNetForm;

  const cancelEdit = () => {
    activeResetForm();
    setEditing(false);
  };

  const {
    discardOpen,
    requestClose,
    cancelDiscard,
    discardAndClose,
  } = useRecordGuard({
    open,
    isDirty: canInlineEdit && editing && activeIsDirty,
    onDiscard: () => {
      setEditing(false);
      activeResetForm();
    },
    onClose: onOpenChange,
  });

  return (
    <>
      <RecordSheet
        open={open}
        onOpenChange={requestClose}
        title={sheetTitle}
        meta={headerMeta}
        headerAside={
          data?.createdAt ? (
            <span>建档 {formatDateTime(data.createdAt)}</span>
          ) : null
        }
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
                    <>
                      {kind === "net" || kind === "minor" ? (
                        <Button
                          variant="outline"
                          onClick={() => setRelatedDishesOpen(true)}
                        >
                          <Link2 className="mr-2 h-4 w-4" />
                          关联菜品
                        </Button>
                      ) : null}
                      {kind === "seasoning" ? (
                        <Button
                          variant="outline"
                          onClick={() => setPackagedOpen(true)}
                        >
                          <PackageOpen className="mr-2 h-4 w-4" />
                          查看封装调料
                        </Button>
                      ) : null}
                      {onCopy ? (
                        <Button
                          variant="outline"
                          onClick={() => onCopy(data)}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          复制
                        </Button>
                      ) : null}
                      {kind === "raw" || kind === "seasoning" ? (
                        <Button
                          variant="outline"
                          onClick={() => setEditing(true)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          编辑
                        </Button>
                      ) : (kind === "net" || kind === "minor") &&
                        onPrintLabel ? (
                        <Button
                          variant="outline"
                          onClick={() => setEditing(true)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          编辑
                        </Button>
                      ) : null}
                    </>
                  }
                  primary={
                    onConvert ? (
                      <Button onClick={() => onConvert(data.id)}>
                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                        {kind === "seasoning" ? "转调料" : "转净料"}
                      </Button>
                    ) : (kind === "net" || kind === "minor") &&
                      onPrintLabel ? (
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
                    ) : kind === "net" || kind === "minor" ? (
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
                  <>
                    {onCopy ? (
                      <Button
                        variant="outline"
                        onClick={() => onCopy(data)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        复制
                      </Button>
                    ) : null}
                    {onEdit ? (
                      <Button
                        variant="outline"
                        onClick={() => onEdit(data.id)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑
                      </Button>
                    ) : null}
                  </>
                }
                primary={
                  (kind === "raw" || kind === "seasoning") && onConvert ? (
                    <Button onClick={() => onConvert(data.id)}>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      {kind === "seasoning" ? "转调料" : "转净料"}
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
        ) : (
          <div className="space-y-6">
            {canInlineEdit &&
            (kind === "raw" || kind === "seasoning") ? (
              <IngredientFormFields
                form={rawForm}
                onChange={handleRawChange}
                errors={rawErrors}
                categories={categories}
                units={units}
                mode={kind === "seasoning" ? "seasoning" : "ingredient"}
                l2Open={l2Open}
                onL2OpenChange={setL2Open}
                viewMode={!editing}
                layout="sheet"
                supplierName={raw?.defaultSupplier?.name}
              />
            ) : canInlineEdit && (kind === "net" || kind === "minor") ? (
              <NetIngredientFormFields
                form={netForm}
                onChange={handleNetChange}
                errors={netErrors}
                categories={categories}
                rawIngredients={rawIngredients}
                sourcePricePerJin={net?.sourceIngredient?.pricePerJin}
                mode={kind === "minor" ? "minor" : "net"}
                viewMode={!editing}
                readOnly={{
                  l1Code: true,
                  l2Code: true,
                  sourceIngredientId: true,
                }}
                layout="sheet"
              />
            ) : kind === "raw" || kind === "seasoning" ? (
              <RawDetailContent
                data={raw as RawDetail}
                categoryName={categoryName}
                kind={kind}
              />
            ) : (
              <NetDetailContent
                data={net as NetDetail}
                kind={kind}
                categoryName={categoryName}
              />
            )}

          </div>
        )}
      </RecordSheet>

      {kind === "seasoning" && data && (
        <StandardSeasoningListSheet
          open={packagedOpen}
          onOpenChange={setPackagedOpen}
          sourceIngredientId={data.id}
          sourceName={data.name}
          sourceCode={data.code}
          sourceL2Name={categoryName}
        />
      )}

      <NetIngredientDishesDialog
        key={`${data?.id ?? "none"}-${relatedDishesOpen}`}
        open={relatedDishesOpen}
        onOpenChange={setRelatedDishesOpen}
        netIngredientId={data?.id ?? null}
        netIngredientName={data?.name ?? null}
        kind={kind === "minor" ? "minor" : "net"}
      />

      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={(next) => {
          if (!next) cancelDiscard();
        }}
        entityLabel={
          kind === "raw"
            ? "原料"
            : kind === "seasoning"
              ? "调料"
              : kind === "minor"
                ? "小料"
                : "净料"
        }
        onDiscard={discardAndClose}
      />
    </>
  );
}

function RawDetailContent({
  data,
  categoryName,
  kind,
}: {
  data: RawDetail;
  categoryName?: string;
  kind: IngredientDetailKind;
}) {
  return (
    <div className="space-y-4">
      <DetailSection title="基础信息">
        <InfoCell label="编号" value={data.code} />
        <InfoCell label="名称" value={data.name} emphasis />
        <InfoCell
          label={kind === "seasoning" ? "商品名称" : "品牌名称"}
          value={data.alias || "—"}
        />
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
          label={kind === "seasoning" ? "默认供应商" : "供应商名称"}
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
        <InfoCell label="份量" value={data.portion || "—"} />
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
