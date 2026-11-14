import { notFound } from "next/navigation";
import { prisma } from "@/lib/server/prisma";
import { PrepLabelPrintView } from "@/app/components/production-plan/prep-label-print-view";

export default async function NetIngredientLabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ copies?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ingredientId = Number(id);
  const copiesText = Array.isArray(query.copies)
    ? query.copies[0]
    : query.copies;
  const copies = Number(copiesText);

  if (
    !Number.isInteger(ingredientId) ||
    ingredientId <= 0 ||
    !Number.isInteger(copies) ||
    copies <= 0
  ) {
    notFound();
  }

  const ingredient = await prisma.netIngredient.findFirst({
    where: { id: ingredientId, deletedAt: null },
    select: {
      id: true,
      name: true,
      packageSpec: true,
      packageMaterial: true,
      packageSize: true,
    },
  });
  if (!ingredient) notFound();

  if (ingredient.packageSpec == null || ingredient.packageSpec <= 0) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <h1 className="text-xl font-bold">无法生成净菜标签</h1>
        <p className="text-sm text-muted-foreground">
          “{ingredient.name}”缺少有效包装规格，请先在净料档案中补全。
        </p>
      </div>
    );
  }

  return (
    <PrepLabelPrintView
      labels={[
        {
          sourceType: "net",
          sourceId: ingredient.id,
          itemName: ingredient.name,
          packageSpec: Number(ingredient.packageSpec),
          packageMaterial: ingredient.packageMaterial,
          packageSize: ingredient.packageSize,
          copies,
        },
      ]}
    />
  );
}
