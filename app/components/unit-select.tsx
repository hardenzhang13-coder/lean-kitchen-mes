"use client";

import { useEffect, useState } from "react";
import { SelectField } from "./select-field";

type Unit = {
  id: number;
  name: string;
  category: string;
};

interface UnitSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  category?: "weight" | "volume" | "count";
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function UnitSelect({
  value,
  onChange,
  placeholder = "请选择单位",
  category,
  required = false,
  disabled = false,
  className,
}: UnitSelectProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/units")
      .then((res) => res.json())
      .then((res) => {
        setUnits(res.data?.items || res.data || []);
      })
      .catch(() => {
        setUnits([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const options = units
    .filter((u) => (category ? u.category === category : true))
    .map((u) => ({ value: u.name, label: u.name }));

  return (
    <SelectField
      value={value}
      onChange={onChange}
      options={[{ value: "", label: placeholder }, ...options]}
      placeholder={placeholder}
      disabled={disabled || loading}
      className={className}
    />
  );
}
