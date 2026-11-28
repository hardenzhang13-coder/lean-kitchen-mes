"use client";

import { Loader2 } from "lucide-react";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormDialog } from "@/app/components/ui/form-dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import {
  NetIngredientFormFields,
  CategoryL1,
  RawIngredientOption,
} from "@/app/components/ingredients/net-ingredient-form-fields";
import { useNetIngredientForm } from "@/app/components/ingredients/use-net-ingredient-form";

export type NetIngredientEditItem = {
  id: number;
  name: string;
  packageSpec: number | null;
  packageMaterial: string | null;
  packageSize: string | null;
  processingFeePerJin: number | null;
  yieldRate: number | null;
  unitPrice: number | null;
  grossMarginRate: number | null;
  /** 份量（小碗菜 / 社区口径） */
  portion?: string | null;
  sourceIngredientId: number | null;
  l2Code: string;
};

interface NetIngredientEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 查看模式：字段全部只读，仅提供关闭按钮 */
  view?: boolean;
  initialData: NetIngredientEditItem | null;
  categories: CategoryL1[];
  rawIngredients: RawIngredientOption[];
  onSuccess?: () => void;
}

export function NetIngredientEditDialog({
  open,
  onOpenChange,
  view = false,
  initialData,
  categories,
  rawIngredients,
  onSuccess,
}: NetIngredientEditDialogProps) {
  const {
    form,
    errors,
    submitting,
    handleChange,
    submit,
  } = useNetIngredientForm({
    active: open && initialData !== null,
    initialData,
    categories,
    rawIngredients,
    onSaved: () => {
      onOpenChange(false);
      onSuccess?.();
    },
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="wide"
        className="[&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]"
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">
            {view ? "查看净料" : "编辑净料"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 px-6 overflow-y-auto flex-1">
          <NetIngredientFormFields
            form={form}
            onChange={handleChange}
            categories={categories}
            rawIngredients={rawIngredients}
            readOnly={{ l1Code: true, l2Code: true, sourceIngredientId: true }}
            viewMode={view}
            errors={errors}
          />
        </div>

        <DialogFooter className="px-6 pt-0 pb-6">
          {view ? (
            <SkeuButton
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              关闭
            </SkeuButton>
          ) : (
            <>
              <SkeuButton
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </SkeuButton>
              <SkeuButton
                onClick={() => {
                  void submit();
                }}
                disabled={submitting}
              >
                <span aria-live="polite" className="inline-flex items-center">
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  保存
                </span>
              </SkeuButton>
            </>
          )}
        </DialogFooter>
      </AppDialogContent>
    </FormDialog>
  );
}
