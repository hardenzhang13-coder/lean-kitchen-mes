"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export type RecordFormErrors = Record<string, string>;

type UseRecordFormOptions<T extends object> = {
  active: boolean;
  resetKey: string;
  initialValues: T;
  validate: (values: T) => RecordFormErrors;
  onSubmit: (values: T) => Promise<boolean>;
  onReset?: () => void;
};

/**
 * 通用记录表单状态：初始化、dirty、字段错误、提交中和重置。
 * 业务校验、接口请求和计算逻辑仍由业务 Hook 注入。
 */
export function useRecordForm<T extends object>({
  active,
  resetKey,
  initialValues,
  validate,
  onSubmit,
  onReset,
}: UseRecordFormOptions<T>) {
  const [form, setForm] = useState<T>(initialValues);
  const [errors, setErrors] = useState<RecordFormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const initialValuesRef = useRef(initialValues);
  const onResetRef = useRef(onReset);

  useEffect(() => {
    initialValuesRef.current = initialValues;
    onResetRef.current = onReset;
  }, [initialValues, onReset]);

  const resetForm = useCallback(() => {
    setForm(initialValuesRef.current);
    setErrors({});
    setIsDirty(false);
    onResetRef.current?.();
  }, []);

  useEffect(() => {
    if (!active) return;
    resetForm();
  }, [active, resetKey, resetForm]);

  const setField = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setForm((previous) => ({ ...previous, [field]: value }));
      setIsDirty(true);
      setErrors((previous) => {
        if (!previous[String(field)]) return previous;
        return { ...previous, [String(field)]: "" };
      });
    },
    []
  );

  const submit = useCallback(async () => {
    if (!active) return false;
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return false;

    setSubmitting(true);
    try {
      const success = await onSubmit(form);
      if (success) setIsDirty(false);
      return success;
    } finally {
      setSubmitting(false);
    }
  }, [active, form, onSubmit, validate]);

  return {
    form,
    setForm,
    errors,
    setErrors,
    isDirty,
    submitting,
    setField,
    resetForm,
    submit,
  };
}
