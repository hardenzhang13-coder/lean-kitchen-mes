"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type RecordFormErrors = Record<string, string>;

type UseRecordFormOptions<T extends object> = {
  active: boolean;
  resetKey: string;
  initialValues: T;
  validate: (values: T) => RecordFormErrors;
  /** 执行保存；返回 true 表示保存成功 */
  onSubmit: (values: T) => Promise<boolean>;
  /** 保存成功后的回调；continued 为 true 表示走的是「保存并继续添加」 */
  onSaved?: (values: T, continued: boolean) => void;
  /** 连续录入：保存成功后清空的字段 */
  clearOnContinue?: (keyof T)[];
  /** 连续录入：保存成功后保留的字段白名单；不传则除 clearOnContinue 外都保留 */
  keepOnContinue?: (keyof T)[];
  onReset?: () => void;
};

/**
 * 通用记录表单状态：初始化、dirty、字段错误、提交中和重置。
 * 业务校验、接口请求和计算逻辑仍由业务 Hook 注入。
 *
 * 连续录入（保存并继续添加）的字段保留/清空策略在此统一实现，
 * 业务 Hook 不需要再维护标志位。
 */
export function useRecordForm<T extends object>({
  active,
  resetKey,
  initialValues,
  validate,
  onSubmit,
  onSaved,
  clearOnContinue,
  keepOnContinue,
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

  /**
   * 连续录入后的字段策略：清空指定字段；提供白名单时只保留白名单字段。
   * 清空语义是「置为空字符串」，适用于全部字段为字符串型的表单。
   */
  const applyContinuePolicy = useMemo(
    () =>
      (values: T): T => {
        const clearSet = new Set(clearOnContinue ?? []);
        const keepSet = keepOnContinue ? new Set(keepOnContinue) : null;
        const next = { ...values } as Record<keyof T, T[keyof T]>;
        for (const key of Object.keys(next) as (keyof T)[]) {
          const shouldClear =
            clearSet.has(key) || (keepSet != null && !keepSet.has(key));
          if (shouldClear) next[key] = "" as T[keyof T];
        }
        return next as T;
      },
    [clearOnContinue, keepOnContinue]
  );

  const doSubmit = useCallback(
    async (continueAdd: boolean) => {
      if (!active) return false;
      const nextErrors = validate(form);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return false;

      setSubmitting(true);
      try {
        const success = await onSubmit(form);
        if (!success) return false;
        setIsDirty(false);
        if (continueAdd) {
          setForm((previous) => applyContinuePolicy(previous));
        }
        onSaved?.(form, continueAdd);
        return true;
      } finally {
        setSubmitting(false);
      }
    },
    [
      active,
      applyContinuePolicy,
      form,
      onSaved,
      onSubmit,
      validate,
    ]
  );

  const submit = useCallback(() => doSubmit(false), [doSubmit]);

  /** 保存并继续添加：保存成功后按策略处理字段，弹窗保持打开 */
  const submitContinue = useCallback(() => doSubmit(true), [doSubmit]);

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
    submitContinue,
  };
}
