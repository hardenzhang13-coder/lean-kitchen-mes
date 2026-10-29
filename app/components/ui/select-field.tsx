"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = "请选择",
  disabled = false,
  className = "",
}: SelectFieldProps) {
  // Radix SelectValue 在下拉未打开过时不认识选项 label，会回退渲染原始 value。
  // 显式传入匹配到的 label，保证有值时始终显示中文文案。
  const selectedLabel = options.find((o) => o.value === value)?.label;
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
