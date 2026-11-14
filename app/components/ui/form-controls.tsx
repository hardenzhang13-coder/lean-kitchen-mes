"use client";

import {
  useState,
  type ComponentProps,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Input as BaseInput } from "@/components/ui/input";
import { Textarea as BaseTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/shared/utils";

/**
 * 业务表单输入框统一入口。
 *
 * 内部业务字段默认关闭浏览器历史、自动填充、拼写检查和自动纠错；
 * 登录页等确有需要的场景可在调用处显式覆盖 autoComplete。
 */
export function Input({
  autoComplete = "off",
  autoCorrect = "off",
  autoCapitalize = "none",
  spellCheck = false,
  ...props
}: ComponentProps<typeof BaseInput>) {
  return (
    <BaseInput
      autoComplete={autoComplete}
      autoCorrect={autoCorrect}
      autoCapitalize={autoCapitalize}
      spellCheck={spellCheck}
      {...props}
    />
  );
}

export function Textarea({
  autoComplete = "off",
  autoCorrect = "off",
  autoCapitalize = "none",
  spellCheck = false,
  ...props
}: ComponentProps<typeof BaseTextarea>) {
  return (
    <BaseTextarea
      autoComplete={autoComplete}
      autoCorrect={autoCorrect}
      autoCapitalize={autoCapitalize}
      spellCheck={spellCheck}
      {...props}
    />
  );
}

const STEP_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
]);

export type BusinessNumberInputProps = Omit<
  ComponentProps<typeof BaseInput>,
  "type"
>;

/**
 * 业务数字输入：只允许手动录入，不响应浏览器或键盘步进。
 * 原生 Spinner 与鼠标滚轮由基础 Input 统一禁用。
 */
export function BusinessNumberInput({
  inputMode = "decimal",
  onKeyDown,
  ...props
}: BusinessNumberInputProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (STEP_KEYS.has(event.key)) {
      event.preventDefault();
      return;
    }
    onKeyDown?.(event);
  };

  return (
    <Input
      {...props}
      type="number"
      inputMode={inputMode}
      onKeyDown={handleKeyDown}
    />
  );
}

export type BusinessFieldInputProps = Omit<
  ComponentProps<typeof BaseInput>,
  "type"
> & {
  numeric?: boolean;
  /** 聚焦时隐藏示例占位，失焦且为空时恢复。 */
  hidePlaceholderOnFocus?: boolean;
};

export function BusinessFieldInput({
  numeric = false,
  hidePlaceholderOnFocus = false,
  placeholder,
  onFocus,
  onBlur,
  ...props
}: BusinessFieldInputProps) {
  const [focused, setFocused] = useState(false);

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    onBlur?.(event);
  };

  const inputProps = {
    ...props,
    placeholder: hidePlaceholderOnFocus && focused ? "" : placeholder,
    onFocus: handleFocus,
    onBlur: handleBlur,
  };

  if (numeric) {
    return <BusinessNumberInput {...inputProps} />;
  }

  return <Input {...inputProps} />;
}

export type ReadOnlyValueProps = {
  value: ReactNode;
  numeric?: boolean;
  emphasis?: boolean;
  emptyText?: ReactNode;
  className?: string;
};

/**
 * 业务只读值：不复用禁用输入框，避免浏览器自动降低文字透明度。
 */
export function ReadOnlyValue({
  value,
  numeric = false,
  emphasis = false,
  emptyText = "",
  className,
}: ReadOnlyValueProps) {
  const isEmpty = value == null || value === "";

  return (
    <div
      className={cn(
        "flex min-h-11 items-center rounded-md bg-muted px-4 text-foreground",
        !isEmpty && numeric && "font-semibold tabular-nums",
        !isEmpty && emphasis && "font-semibold text-primary",
        isEmpty && "font-normal text-muted-foreground",
        className
      )}
    >
      {isEmpty ? emptyText : value}
    </div>
  );
}
