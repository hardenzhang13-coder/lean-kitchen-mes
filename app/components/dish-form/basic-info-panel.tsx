"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormSection } from "@/app/components/ui/form-field";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { DishFormData, calcPriceByMargin } from "./types";

interface BasicInfoPanelProps {
  data: DishFormData;
  onChange: (data: DishFormData) => void;
  categories: Array<{ id: number; code: string; name: string }>;
  /** 当前菜品成本（BOM 估算值），用于毛利率 ↔ 售价联动计算 */
  cost?: number | null;
  readOnly?: boolean;
}

const cuisineOptions = [
  { value: "川菜", label: "川菜" },
  { value: "粤菜", label: "粤菜" },
  { value: "湘菜", label: "湘菜" },
  { value: "鲁菜", label: "鲁菜" },
  { value: "苏菜", label: "苏菜" },
  { value: "浙菜", label: "浙菜" },
  { value: "闽菜", label: "闽菜" },
  { value: "徽菜", label: "徽菜" },
  { value: "家常菜", label: "家常菜" },
];

const techniqueOptions = [
  { value: "爆炒", label: "爆炒" },
  { value: "红烧", label: "红烧" },
  { value: "清蒸", label: "清蒸" },
  { value: "炖煮", label: "炖煮" },
  { value: "煎炸", label: "煎炸" },
  { value: "凉拌", label: "凉拌" },
  { value: "干锅", label: "干锅" },
  { value: "烧烤", label: "烧烤" },
  { value: "卤制", label: "卤制" },
  { value: "煲汤", label: "煲汤" },
  { value: "烩", label: "烩" },
  { value: "熘", label: "熘" },
  { value: "扒", label: "扒" },
  { value: "焗", label: "焗" },
];

const tasteOptions = [
  { value: "麻辣", label: "麻辣" },
  { value: "咸鲜", label: "咸鲜" },
  { value: "酸甜", label: "酸甜" },
  { value: "酸辣", label: "酸辣" },
  { value: "香辣", label: "香辣" },
  { value: "清淡", label: "清淡" },
  { value: "酱香", label: "酱香" },
  { value: "蒜香", label: "蒜香" },
  { value: "椒盐", label: "椒盐" },
  { value: "糖醋", label: "糖醋" },
  { value: "鱼香", label: "鱼香" },
  { value: "蚝油", label: "蚝油" },
];

const meatTypeOptions = [
  { value: "荤菜", label: "荤菜" },
  { value: "素菜", label: "素菜" },
  { value: "小荤菜", label: "小荤菜" },
];

const seasonOptions = ["四季", "春", "夏", "秋", "冬"].map((s) => ({ value: s, label: s }));
const portionOptions = [
  { value: "单人份", label: "单人份" },
  { value: "一锅10份", label: "一锅10份" },
];

export function BasicInfoPanel({ data, onChange, categories, cost, readOnly }: BasicInfoPanelProps) {
  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: c.name }));

  // 毛利率本地编辑态：null 表示跟随售价派生显示；编辑中保留原始输入，避免派生值归一化打断输入/清空
  const [marginInput, setMarginInput] = useState<string | null>(null);
  // 标记本次售价变化来自毛利率输入，避免 effect 重置编辑态
  const marginFromInputRef = useRef(false);

  useEffect(() => {
    if (marginFromInputRef.current) {
      marginFromInputRef.current = false;
      return;
    }
    setMarginInput(null);
  }, [data.price]);

  const priceNum = data.price ? parseFloat(data.price) : null;
  const marginDerived =
    cost != null && priceNum != null && priceNum > 0
      ? Number((((priceNum - cost) / priceNum) * 100).toFixed(1))
      : null;
  const marginValue =
    marginInput !== null ? marginInput : marginDerived != null ? String(marginDerived) : "";

  const update = (patch: Partial<DishFormData>) => {
    onChange({ ...data, ...patch });
  };

  return (
    <FormSection title="基础信息" cols={2}>
      <FormField id="name" label="菜品名称" required readOnly={readOnly}>
        <Input
          id="name"
          value={data.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="请输入菜品名称"
          disabled={readOnly}
          className="h-11 text-base px-4"
        />
      </FormField>

      <FormField id="categoryId" label="菜品类别" required readOnly={readOnly}>
        <SelectTileMode
          options={categoryOptions}
          value={data.categoryId}
          onChange={(v) => update({ categoryId: v })}
          placeholder="请选择菜品类别"
          title="选择菜品类别"
          disabled={readOnly}
        />
      </FormField>

      <FormField id="intro" label="菜品描述" readOnly={readOnly} className="col-span-2">
        <Textarea
          id="intro"
          value={data.intro}
          onChange={(e) => update({ intro: e.target.value })}
          placeholder="请输入菜品描述"
          disabled={readOnly}
          rows={3}
          className="text-base px-4 py-3 resize-none"
        />
      </FormField>

      <FormField id="cuisine" label="菜系" required readOnly={readOnly}>
        <SelectTileMode
          options={cuisineOptions}
          value={data.cuisine}
          onChange={(v) => update({ cuisine: v })}
          placeholder="请选择菜系"
          title="选择菜系"
          disabled={readOnly}
        />
      </FormField>

      <FormField id="technique" label="做法" required readOnly={readOnly}>
        <SelectTileMode
          options={techniqueOptions}
          value={data.technique}
          onChange={(v) => update({ technique: v })}
          placeholder="请选择做法"
          title="选择做法"
          disabled={readOnly}
        />
      </FormField>

      <FormField id="taste" label="口味" required readOnly={readOnly}>
        <SelectTileMode
          options={tasteOptions}
          value={data.taste}
          onChange={(v) => update({ taste: v })}
          placeholder="请选择口味"
          title="选择口味"
          disabled={readOnly}
        />
      </FormField>

      <FormField id="meatType" label="荤素类型" required readOnly={readOnly}>
        <SelectTileMode
          options={meatTypeOptions}
          value={data.meatType}
          onChange={(v) => update({ meatType: v })}
          placeholder="请选择荤素类型"
          title="选择荤素类型"
          searchable={false}
          disabled={readOnly}
        />
      </FormField>

      <FormField id="portion" label="份量" required readOnly={readOnly}>
        <SelectTileMode
          options={portionOptions}
          value={data.portion || "单人份"}
          onChange={(v) => update({ portion: v })}
          placeholder="请选择份量"
          title="选择份量"
          searchable={false}
          disabled={readOnly}
        />
      </FormField>

      <FormField id="season" label="季节" required readOnly={readOnly}>
        <SelectTileMode
          options={seasonOptions}
          value={data.season || "四季"}
          onChange={(v) => update({ season: v })}
          placeholder="请选择季节"
          title="选择季节"
          searchable={false}
          disabled={readOnly}
        />
      </FormField>
      <FormField id="price" label="售价（元/份）" optionalHint={false} readOnly={readOnly}>
        <Input
          id="price"
          type="number"
          min="0"
          step="0.01"
          value={data.price}
          onChange={(e) => update({ price: e.target.value })}
          placeholder="如 15.00"
          disabled={readOnly}
          className="h-11 text-base px-4"
        />
      </FormField>
      <FormField id="grossMargin" label="毛利率（%）" optionalHint={false} readOnly={readOnly}>
        <Input
          id="grossMargin"
          type="number"
          min="0"
          max="99.9"
          step="0.1"
          value={marginValue}
          onChange={(e) => {
            const raw = e.target.value;
            setMarginInput(raw);
            if (raw === "") {
              marginFromInputRef.current = true;
              update({ price: "" });
              return;
            }
            const m = parseFloat(raw);
            if (Number.isNaN(m) || cost == null) return;
            const nextPrice = calcPriceByMargin(cost, m);
            if (nextPrice != null) {
              marginFromInputRef.current = true;
              update({ price: String(nextPrice) });
            }
          }}
          placeholder={cost != null ? "如 60" : "请先填写菜品用料"}
          disabled={readOnly || cost == null}
          className="h-11 text-base px-4"
        />
      </FormField>
    </FormSection>
  );
}
