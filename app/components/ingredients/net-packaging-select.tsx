"use client";

import { useEffect, useMemo, useState } from "react";
import { FormField } from "@/app/components/ui/form-field";
import { SelectField } from "@/app/components/ui/select-field";
import { SelectTileMode } from "@/app/components/ui/select-tile-mode";
import { ReadOnlyValue } from "@/app/components/ui/form-controls";

type NetPackagingOption = {
  id: number;
  name: string;
  size: string;
  isActive: boolean;
};

interface NetPackagingSelectProps {
  packageMaterial: string;
  packageSize: string;
  onChange: (name: string, size: string) => void;
  viewMode?: boolean;
  error?: string;
  variant?: "combined" | "split";
  nameError?: string;
  sizeError?: string;
}

export function NetPackagingSelect({
  packageMaterial,
  packageSize,
  onChange,
  viewMode = false,
  error,
  variant = "combined",
  nameError,
  sizeError,
}: NetPackagingSelectProps) {
  const [options, setOptions] = useState<NetPackagingOption[]>([]);
  const [loading, setLoading] = useState(!viewMode);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (viewMode) return;
    let alive = true;
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await fetch(
          "/api/net-packagings?page=1&pageSize=100&includeInactive=1"
        );
        const json = await res.json();
        if (!alive) return;
        if (!res.ok || !json.success) {
          setLoadError(true);
          return;
        }
        setOptions(json.data || []);
      } catch {
        if (alive) setLoadError(true);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [viewMode]);

  const selected = useMemo(
    () =>
      options.find(
        (option) =>
          option.name === packageMaterial && option.size === packageSize
      ),
    [options, packageMaterial, packageSize]
  );

  // 新建净料/小料或转净料时，默认选中第一个启用包装
  useEffect(() => {
    if (viewMode || loading || loadError) return;
    if (packageMaterial.trim() || packageSize.trim()) return;
    const firstActive = options.find((option) => option.isActive);
    if (firstActive) onChange(firstActive.name, firstActive.size);
  }, [viewMode, loading, loadError, options, packageMaterial, packageSize, onChange]);

  const selectOptions = useMemo(() => {
    const list = options.map((option) => ({
      value: String(option.id),
      label: `${option.name} · ${option.size}${option.isActive ? "" : "（已停用）"}`,
      // 当前已选中的停用项保持可选，避免编辑存量档案时无法显示原包装
      disabled: !option.isActive && option.id !== selected?.id,
    }));

    // 兼容字典建立前的历史值，避免打开编辑弹窗时丢失原包装
    if (!selected && packageMaterial.trim() && packageSize.trim()) {
      list.unshift({
        value: "__legacy__",
        label: `${packageMaterial} · ${packageSize}（不在字典中）`,
        disabled: true,
      });
    }
    return list;
  }, [options, selected, packageMaterial, packageSize]);

  const nameOptions = useMemo(() => {
    const names = Array.from(
      new Set(
        options
          .filter(
            (option) =>
              option.isActive || option.name === packageMaterial
          )
          .map((option) => option.name)
      )
    );
    const result = names.map((name) => ({ value: name, label: name }));
    if (
      packageMaterial.trim() &&
      !names.includes(packageMaterial)
    ) {
      result.unshift({
        value: packageMaterial,
        label: `${packageMaterial}（不在字典中）`,
      });
    }
    return result;
  }, [options, packageMaterial]);

  const sizeOptions = useMemo(() => {
    const sizes = options
      .filter(
        (option) =>
          option.name === packageMaterial &&
          (option.isActive || option.size === packageSize)
      )
      .map((option) => option.size);
    const result = Array.from(new Set(sizes)).map((size) => ({
      value: size,
      label: size,
    }));
    if (
      packageSize.trim() &&
      !sizes.includes(packageSize)
    ) {
      result.unshift({
        value: packageSize,
        label: `${packageSize}（不在字典中）`,
      });
    }
    return result;
  }, [options, packageMaterial, packageSize]);

  const value = selected
    ? String(selected.id)
    : packageMaterial.trim() && packageSize.trim()
      ? "__legacy__"
      : "";

  if (viewMode && variant === "split") {
    return (
      <>
        <FormField label="包装名称">
          <ReadOnlyValue value={packageMaterial || null} />
        </FormField>
        <FormField label="包装尺寸">
          <ReadOnlyValue value={packageSize || null} />
        </FormField>
      </>
    );
  }

  if (viewMode) {
    return (
      <FormField label="包装">
        <div className="h-11 flex items-center px-4 rounded-md bg-muted text-foreground">
          {packageMaterial && packageSize
            ? `${packageMaterial} · ${packageSize}`
            : "—"}
        </div>
      </FormField>
    );
  }

  const hasActiveOption = options.some((option) => option.isActive);

  if (variant === "split") {
    return (
      <>
        <FormField
          label="包装名称"
          required
          error={nameError}
        >
          <SelectTileMode
            value={packageMaterial}
            onChange={(name) => {
              const firstActiveSize = options.find(
                (option) =>
                  option.name === name && option.isActive
              );
              onChange(name, firstActiveSize?.size || "");
            }}
            options={nameOptions}
            placeholder={loading ? "加载中..." : "请选择包装名称"}
            disabled={loading}
            title="选择包装名称"
            searchable={false}
            cols={2}
            required
          />
          {!loading && loadError && (
            <p className="text-xs text-destructive">
              包装加载失败，请关闭后重试。
            </p>
          )}
          {!loading && !loadError && !hasActiveOption && (
            <p className="text-xs text-destructive">
              暂无可用包装，请先在「设置 → 净菜包装」中新增或启用。
            </p>
          )}
        </FormField>

        <FormField
          label="包装尺寸"
          required
          error={sizeError}
        >
          <SelectTileMode
            value={packageSize}
            onChange={(size) => onChange(packageMaterial, size)}
            options={sizeOptions}
            placeholder={
              !packageMaterial
                ? "请先选择包装名称"
                : loading
                  ? "加载中..."
                  : "请选择包装尺寸"
            }
            disabled={loading || !packageMaterial}
            title="选择包装尺寸"
            searchable={false}
            cols={2}
            required
          />
        </FormField>
      </>
    );
  }

  return (
    <FormField
      label="包装"
      required
      error={error}
      hint="从设置-净菜包装中选择；停用项不可选"
    >
      <SelectField
        value={value}
        onChange={(next) => {
          if (next === "__legacy__") return;
          const option = options.find((item) => String(item.id) === next);
          if (option) onChange(option.name, option.size);
        }}
        options={selectOptions}
        placeholder={loading ? "加载中..." : "请选择包装"}
        disabled={loading}
        className="w-full text-base"
      />
      {!loading && loadError && (
        <p className="text-xs text-destructive">包装加载失败，请关闭后重试。</p>
      )}
      {!loading && !loadError && !hasActiveOption && (
        <p className="text-xs text-destructive">
          暂无可用包装，请先在「设置 → 净菜包装」中新增或启用。
        </p>
      )}
    </FormField>
  );
}
