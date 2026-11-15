"use client";

import { useCallback, useState } from "react";

/** 复制档案时名称追加的后缀，绕开重名校验拦截。 */
export const DEFAULT_COPY_NAME_SUFFIX = "-副本";

type UseRecordCopyOptions<TRecord extends { name: string }, TForm> = {
  /** 以现有档案为模板生成新建表单初值（不含 name，name 由本 hook 统一追加后缀） */
  buildInitialData: (record: TRecord) => Omit<TForm, "name">;
  /** 名称后缀，默认「-副本」 */
  nameSuffix?: string;
  /** 复制弹窗标题 */
  title?: string;
  /** 复制提交成功后的额外动作（如刷新列表、关闭详情抽屉） */
  onCopySuccess?: () => void;
};

/**
 * 档案复制编排：复制是**新建动作**。
 *
 * 统一负责「回填初值 → 名称追加后缀 → 弹窗叠放 → 提交成功后关闭全部弹窗」，
 * 避免各列表页各写一遍 `buildCopyData`。
 */
export function useRecordCopy<
  TRecord extends { name: string },
  TForm extends { name?: string | null },
>({
  buildInitialData,
  nameSuffix = DEFAULT_COPY_NAME_SUFFIX,
  title = "复制",
  onCopySuccess,
}: UseRecordCopyOptions<TRecord, TForm>) {
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyData, setCopyData] = useState<TForm | null>(null);

  const openCopy = useCallback(
    (record: TRecord) => {
      setCopyData({
        ...(buildInitialData(record) as Omit<TForm, "name">),
        name: `${record.name}${nameSuffix}`,
      } as TForm);
      setCopyOpen(true);
    },
    [buildInitialData, nameSuffix]
  );

  const closeCopy = useCallback(() => {
    setCopyOpen(false);
    setCopyData(null);
  }, []);

  /** 可直接展开给复制表单弹窗的 props */
  const copyDialogProps = {
    open: copyOpen,
    title,
    initialData: copyData ?? undefined,
    onOpenChange: (nextOpen: boolean) => {
      if (!nextOpen) closeCopy();
    },
    onSuccess: () => {
      closeCopy();
      onCopySuccess?.();
    },
  };

  return {
    copyOpen,
    copyData,
    openCopy,
    closeCopy,
    copyDialogProps,
  };
}
