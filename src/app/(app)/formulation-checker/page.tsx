import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import FormulationCheckerClient from "./formulation-checker-client";

export default async function FormulationCheckerPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; q?: string }>;
}) {
  const { folder: folderId, q } = await searchParams;
  const session = await getSession();

  const folders = await prisma.formulationFolder.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { formulations: true } } },
  });

  const activeFolder = folderId ? folders.find((f) => f.id === folderId) ?? null : null;

  const formulations = activeFolder
    ? await prisma.formulation.findMany({
        where: {
          folderId: activeFolder.id,
          ...(q ? { productName: { contains: q, mode: "insensitive" } } : {}),
        },
        include: { _count: { select: { ingredients: true } } },
        orderBy: { productName: "asc" },
      })
    : [];

  return (
    <FormulationCheckerClient
      canManage={!!session && canEdit(session.role)}
      folders={folders.map((f) => ({ id: f.id, name: f.name, count: f._count.formulations }))}
      activeFolderId={activeFolder?.id ?? null}
      searchQuery={q ?? ""}
      formulations={formulations.map((f) => ({
        id: f.id,
        productName: f.productName,
        baseBatchSize: f.baseBatchSize,
        baseUnit: f.baseUnit,
        ingredientCount: f._count.ingredients,
        updatedAt: f.updatedAt.toISOString(),
      }))}
    />
  );
}
