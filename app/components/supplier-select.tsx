"use client";

import { useEffect, useState } from "react";
import { parseList } from "@/app/lib/api";
import { SelectTableMode } from "@/app/components/select-table-mode";

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
  const [data, setData] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/suppliers")
      .then((res) => parseList<Supplier>(res))
      .then((list) => setData(list))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SelectTableMode<Supplier>
      data={data}
      value={value ? String(value) : ""}
      onChange={(val, row) => {
        if (!val || !row) {
          onChange("", "");
          return;
        }
        onChange(Number(val), row.name);
      }}
      columns={[
        { key: "name", header: "名称" },
        { key: "contact", header: "联系人" },
        { key: "phone", header: "电话" },
        { key: "remark", header: "备注" },
      ]}
      placeholder={placeholder}
      title="选择供应商"
      searchPlaceholder="搜索供应商名称、联系人、电话、备注..."
      emptyText={loading ? "加载中..." : "暂无匹配供应商"}
      disabled={disabled}
      confirmSelection={true}
      displayValue={(row) => row.name}
    />
  );
}
