"use client";

import { SearchableTableSelect } from "./searchable-table-select";

type Supplier = {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  remark: string | null;
};

interface SupplierSelectProps {
  value: number | "";
  onChange: (value: number | "", name: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SupplierSelect({
  value,
  onChange,
  placeholder = "选择供应商",
  disabled = false,
}: SupplierSelectProps) {
  return (
    <SearchableTableSelect<Supplier>
      fetchUrl="/api/suppliers"
      value={value ? String(value) : ""}
      onChange={(val, row) => {
        if (!val || !row) {
          onChange("", "");
          return;
        }
        onChange(Number(val), row.name);
      }}
      columns={[
        { key: "name", title: "名称" },
        { key: "contact", title: "联系人" },
        { key: "phone", title: "电话" },
        { key: "remark", title: "备注" },
      ]}
      searchFields={["name", "contact", "phone", "remark"]}
      placeholder={placeholder}
      title="选择供应商"
      searchPlaceholder="搜索供应商名称、联系人、电话、备注..."
      emptyText="暂无匹配供应商"
      disabled={disabled}
      confirmSelection={true}
      displayValue={(row) => row.name}
    />
  );
}
