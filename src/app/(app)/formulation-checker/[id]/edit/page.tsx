import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import FormulationForm from "../../formulation-form";

export default async function EditFormulationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session || !canEdit(session.role)) redirect("/formulation-checker");

  const [folders, formulation] = await Promise.all([
    prisma.formulationFolder.findMany({ orderBy: { order: "asc" } }),
    prisma.formulation.findUnique({
      where: { id },
      include: { ingredients: { orderBy: { order: "asc" } } },
    }),
  ]);

  if (!formulation) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Edit Formulation</h1>
        <p className="text-sm text-muted-foreground">{formulation.productName}</p>
      </div>
      <FormulationForm
        folders={folders.map((f) => ({ id: f.id, name: f.name }))}
        existing={{
          id: formulation.id,
          productName: formulation.productName,
          folderId: formulation.folderId,
          baseUnit: formulation.baseUnit,
          ingredients: formulation.ingredients.map((ing) => ({
            rmNumber: ing.rmNumber ?? "",
            ingredientName: ing.ingredientName,
            uin: ing.uin ?? "",
            baseQty: ing.baseQty,
            controlStatus: ing.controlStatus ?? "",
            changeControlRef: ing.changeControlRef ?? "",
            approvedBy: ing.approvedBy ?? "",
            comments: ing.comments ?? "",
            tolerancePct: ing.tolerancePct,
          })),
        }}
      />
    </div>
  );
}
