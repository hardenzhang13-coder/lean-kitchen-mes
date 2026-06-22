"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Pencil, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { DataTable } from "@/app/components/data-table";
import { EmptyState } from "@/app/components/empty-state";
import {
  NetIngredientFormDialog,
  NetIngredientItem,
} from "@/app/components/net-ingredient-form-dialog";
import {
  NetIngredientEditDialog,
  NetIngredientEditItem,
} from "@/app/components/net-ingredient-edit-dialog";
import { toast } from "sonner";

type IngredientDetail = {
  id: number;
  code: string;
  name: string;
  alias: string | null;
  l2Code: string;
  purchaseSpec: string | null;
  purchaseUnit: string | null;
  stockUnit: string | null;
  latestRefPrice: number | null;
  season: string;
  storage: string;
  netIngredients?: NetIngredientItem[];
};

type CategoryL1 = {
  code: string;
  name: string;
  children: { code: string; name: string }[];
};

type RawIngredientOption = {
  id: number;
  code: string;
  name: string;
  alias?: string | null;
  l2Code?: string;
  purchaseSpec?: string | null;
  purchaseUnit?: string | null;
  latestRefPrice?: number | null;
};

export default function RawIngredientDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const [ingredient, setIngredient] = useState<IngredientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryL1[]>([]);
  const [rawIngredients, setRawIngredients] = useState<RawIngredientOption[]>(
    []
  );

  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NetIngredientEditItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ingRes, catRes, rawRes] = await Promise.all([
        fetch(`/api/ingredients/${id}?includeNetIngredients=true`),
        fetch("/api/ingredient-categories"),
        fetch("/api/ingredients"),
      ]);

      if (!ingRes.ok) {
        throw new Error("原料不存在或已删除");
      }
      const ingJson = await ingRes.json();
      setIngredient(ingJson.data || null);
      setCategories(await catRes.json());
      const rawJson = await rawRes.json();
      setRawIngredients(rawJson.data || []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "获取数据失败";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id, fetchData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const l2Map = useMemo(() => {
    const map: Record<string, { name: string; parentCode: string }> = {};
    categories.forEach((l1) => {
      l1.children.forEach((l2) => {
        map[l2.code] = { name: l2.name, parentCode: l1.code };
      });
    });
    return map;
  }, [categories]);

  const l1Map = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((l1) => {
      map[l1.code] = l1.name;
    });
    return map;
  }, [categories]);

  const openEdit = (row: NetIngredientItem) => {
    setEditing({
      id: row.id,
      name: row.name,
      spec: row.spec,
      yieldRate: row.yieldRate,
      unitPrice: row.unitPrice,
      sourceIngredientId: row.sourceIngredientId,
      l2Code: row.l2Code,
    });
    setEditDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <PageHeader showBack title="原料详情" />
        <Card>
          <CardContent className="p-8">
            <div className="h-40 animate-pulse bg-muted rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ingredient) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <PageHeader showBack title="原料详情" />
        <EmptyState title="原料不存在或已删除" />
      </div>
    );
  }

  const netIngredients = ingredient.netIngredients || [];

  return (
    <div className="flex flex-col gap-6 p-8">
      <PageHeader showBack title="原料详情" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">基础信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="编号" value={ingredient.code} />
            <InfoRow label="名称" value={ingredient.name} />
            <InfoRow
              label="商品名称"
              value={ingredient.alias || "—"}
            />
            <InfoRow
              label="一级分类"
              value={
                ingredient.l2Code
                  ? l1Map[l2Map[ingredient.l2Code]?.parentCode] || "—"
                  : "—"
              }
            />
            <InfoRow
              label="二级分类"
              value={l2Map[ingredient.l2Code]?.name || ingredient.l2Code || "—"}
            />
            <InfoRow
              label="采购规格"
              value={ingredient.purchaseSpec || "—"}
            />
            <InfoRow
              label="采购单位"
              value={ingredient.purchaseUnit || "—"}
            />
            <InfoRow
              label="入库单位"
              value={ingredient.stockUnit || "—"}
            />
            <InfoRow
              label="最新参照单价"
              value={
                ingredient.latestRefPrice != null
                  ? `¥${Number(ingredient.latestRefPrice).toFixed(2)}`
                  : "—"
              }
            />
            <InfoRow label="季节" value={ingredient.season || "—"} />
            <InfoRow label="储存方式" value={ingredient.storage || "—"} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">衍生净料</CardTitle>
            <Button onClick={() => setConvertDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新增净料
            </Button>
          </CardHeader>
          <CardContent>
            <DataTable<NetIngredientItem>
              data={netIngredients}
              loading={loading}
              columns={[
                { header: "编号", cell: (row) => <span className="font-medium">{row.code}</span> },
                { header: "名称", accessorKey: "name" },
                { header: "规格", cell: (row) => row.spec || "—" },
                { header: "出成率", cell: (row) => `${row.yieldRate}%` },
                {
                  header: "净料单价",
                  cell: (row) => `¥${Number(row.unitPrice).toFixed(2)}`,
                },
                { header: "单位", accessorKey: "unit" },
              ]}
              emptyState={{
                icon: PackageOpen,
                title: "暂无衍生净料",
                description: "点击右上角按钮创建净料规格",
              }}
              rowActions={(row) => (
                <Button
                  variant="ghost"
                  size="icon"
                  title="编辑净料"
                  onClick={() => openEdit(row)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            />
          </CardContent>
        </Card>
      </div>

      <NetIngredientFormDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        mode="convert"
        sourceIngredientId={ingredient.id}
        categories={categories}
        rawIngredients={rawIngredients}
        onSuccess={() => {
          setConvertDialogOpen(false);
          fetchData();
        }}
      />

      <NetIngredientEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        initialData={editing}
        categories={categories}
        rawIngredients={rawIngredients}
        onSuccess={fetchData}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
