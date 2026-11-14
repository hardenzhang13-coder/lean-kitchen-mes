"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppDialogContent } from "@/app/components/ui/app-dialog";
import { FormDialog } from "@/app/components/ui/form-dialog";
import {
  CategoryL1,
  IngredientFormFields,
  Unit,
} from "@/app/components/ingredients/ingredient-form-fields";
import {
  IngredientFormInitialData,
  SavedIngredientRecord,
  useIngredientForm,
} from "@/app/components/ingredients/use-ingredient-form";

export type CreatedIngredient = SavedIngredientRecord;

interface IngredientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: IngredientFormInitialData;
  categories: CategoryL1[];
  units: Unit[];
  mode?: "ingredient" | "seasoning" | "auto";
  /** 查看模式：字段全部只读，仅提供关闭按钮 */
  view?: boolean;
  onSuccess: (data: CreatedIngredient) => void;
}

export function IngredientFormDialog({
  open,
  onOpenChange,
  initialData,
  categories,
  units,
  mode = "auto",
  view = false,
  onSuccess,
}: IngredientFormDialogProps) {
  const {
    form,
    errors,
    l2Open,
    setL2Open,
    submitting,
    handleChange,
    submit,
  } = useIngredientForm({
    active: open,
    autoCalculate: !view,
    initialData,
    categories,
    units,
    mode,
    onSaved: (data) => {
      onSuccess(data);
      onOpenChange(false);
    },
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent
        size="workbench"
        className="[&>button]:cursor-pointer p-0 flex flex-col max-h-[90vh]"
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg">
            {view
              ? `查看${mode === "seasoning" ? "调料" : mode === "ingredient" ? "原料" : "食材"}`
              : initialData?.id
                ? `编辑${mode === "seasoning" ? "调料" : mode === "ingredient" ? "原料" : "食材"}`
                : `新增${mode === "seasoning" ? "调料" : mode === "ingredient" ? "原料" : "食材"}`}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <IngredientFormFields
            form={form}
            onChange={handleChange}
            errors={errors}
            categories={categories}
            units={units}
            mode={mode}
            l2Open={l2Open}
            onL2OpenChange={setL2Open}
            viewMode={view}
            layout="workbench"
          />
        </div>

        <DialogFooter className="px-6 pt-0 pb-6">
          {view ? (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-11 px-6"
            >
              关闭
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-11 px-6"
              >
                取消
              </Button>
              <Button
                onClick={() => {
                  void submit();
                }}
                disabled={submitting}
                className="h-11 px-6"
              >
                <span aria-live="polite" className="inline-flex items-center">
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  保存
                </span>
              </Button>
            </>
          )}
        </DialogFooter>
      </AppDialogContent>
    </FormDialog>
  );
}
