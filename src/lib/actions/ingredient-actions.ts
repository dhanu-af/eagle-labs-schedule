"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function getIngredients() {
  return prisma.ingredient.findMany({ orderBy: { name: "asc" } });
}

export async function createIngredient(data: {
  name: string;
  alternateName?: string;
  type: string;
  category?: string;
  aanLabel?: string;
  aanValue?: string;
  notes: string;
  source?: string;
}) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  const ingredient = await prisma.ingredient.create({ data });

  await logAudit(session, {
    action: "CREATE_INGREDIENT",
    entityType: "Ingredient",
    entityId: ingredient.id,
    summary: `Added ingredient "${ingredient.name}"`,
  });

  revalidatePath("/ingredients");
  return ingredient;
}

export async function updateIngredient(
  id: string,
  data: {
    name: string;
    alternateName?: string;
    type: string;
    category?: string;
    aanLabel?: string;
    aanValue?: string;
    notes: string;
    source?: string;
  }
) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  await prisma.ingredient.update({ where: { id }, data });

  await logAudit(session, {
    action: "UPDATE_INGREDIENT",
    entityType: "Ingredient",
    entityId: id,
    summary: `Updated ingredient "${data.name}"`,
  });

  revalidatePath("/ingredients");
}

export async function deleteIngredient(id: string) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  const ingredient = await prisma.ingredient.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_INGREDIENT",
    entityType: "Ingredient",
    entityId: id,
    summary: `Deleted ingredient "${ingredient.name}"`,
  });

  revalidatePath("/ingredients");
}
