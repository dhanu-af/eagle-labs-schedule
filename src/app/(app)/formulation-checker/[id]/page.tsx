import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { toDateInputValueUTC, todayInBrisbane } from "@/lib/ui";
import FormulationDetailClient from "./formulation-detail-client";

export default async function FormulationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();

  const formulation = await prisma.formulation.findUnique({
    where: { id },
    include: {
      folder: true,
      ingredients: { orderBy: { order: "asc" } },
    },
  });

  if (!formulation) notFound();

  return (
    <FormulationDetailClient
      canManage={!!session && canEdit(session.role)}
      enteredByDefault={session?.fullName ?? ""}
      todayStr={toDateInputValueUTC(todayInBrisbane())}
      formulation={{
        id: formulation.id,
        productName: formulation.productName,
        folderName: formulation.folder.name,
        baseBatchSize: formulation.baseBatchSize,
        baseUnit: formulation.baseUnit,
        ingredients: formulation.ingredients.map((ing) => ({
          id: ing.id,
          rmNumber: ing.rmNumber,
          ingredientName: ing.ingredientName,
          uin: ing.uin,
          baseQty: ing.baseQty,
          controlStatus: ing.controlStatus,
          changeControlRef: ing.changeControlRef,
          approvedBy: ing.approvedBy,
          comments: ing.comments,
          tolerancePct: ing.tolerancePct,
        })),
      }}
    />
  );
}
