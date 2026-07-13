import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import FormulationForm from "../formulation-form";

export default async function NewFormulationPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { folder } = await searchParams;
  const session = await getSession();
  if (!session || !canEdit(session.role)) redirect("/formulation-checker");

  const folders = await prisma.formulationFolder.findMany({ orderBy: { order: "asc" } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">New Formulation</h1>
        <p className="text-sm text-muted-foreground">Enter each ingredient's base quantity — % w/w and the total are calculated automatically.</p>
      </div>
      <FormulationForm folders={folders.map((f) => ({ id: f.id, name: f.name }))} defaultFolderId={folder} />
    </div>
  );
}
