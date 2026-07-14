"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function getIngredients() {
  return prisma.ingredient.findMany({ orderBy: { name: "asc" } });
}

/** Super Admin has access automatically; everyone else needs an explicit grant. */
export async function hasIngredientLibraryAccess(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  if (canEdit(session.role)) return true;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { ingredientLibraryAccess: true },
  });
  return user?.ingredientLibraryAccess ?? false;
}

/** Super Admin only: list users to grant/revoke Ingredient Library access for. */
export async function getIngredientLibraryAccessList() {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  return prisma.user.findMany({
    where: { disabled: false },
    orderBy: { fullName: "asc" },
    select: { id: true, username: true, fullName: true, role: true, ingredientLibraryAccess: true },
  });
}

export async function setIngredientLibraryAccess(userId: string, granted: boolean) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  const target = await prisma.user.update({
    where: { id: userId },
    data: { ingredientLibraryAccess: granted },
  });

  await logAudit(session, {
    action: granted ? "GRANT_INGREDIENT_LIBRARY_ACCESS" : "REVOKE_INGREDIENT_LIBRARY_ACCESS",
    entityType: "User",
    entityId: userId,
    summary: `${granted ? "Granted" : "Revoked"} Ingredient Library access for ${target.fullName} (${target.username})`,
  });

  revalidatePath("/ingredients");
}

type IngredientInput = {
  name: string;
  alternateName?: string;
  type: string;
  category?: string;
  aanLabel?: string;
  aanValue?: string;
  notes?: string;
  classification?: string;
  mainBenefit?: string;
  usedFor?: string;
  synonyms?: string;
  chemicalName?: string;
  casNumber?: string;
  molecularFormula?: string;
  molecularWeight?: string;
  tgaStatus?: string;
  apvmaStatus?: string;
  fdaStatus?: string;
  emaStatus?: string;
  aicisStatus?: string;
  regulatoryStatus?: string;
  primaryUse?: string;
  industry?: string;
  productTypes?: string;
  typicalDosage?: string;
  storageConditions?: string;
  shelfLife?: string;
  safetyNotes?: string;
  ghsClassification?: string;
  signalWord?: string;
  ppe?: string;
  handlingPrecautions?: string;
  manufacturingNotes?: string;
  qcNotes?: string;
  qcIdentity?: string;
  qcAssay?: string;
  qcMoisture?: string;
  qcHeavyMetals?: string;
  qcMicrobialLimits?: string;
  appearance?: string;
  colour?: string;
  odour?: string;
  solubility?: string;
  density?: string;
  meltingPoint?: string;
  phValue?: string;
  relatedIngredientsText?: string;
  referencesText?: string;
  faq?: string;
  source?: string;
  verified?: boolean;
  verificationSource?: string;
  verifiedBy?: string;
};

function withVerificationTimestamp(data: IngredientInput) {
  const { verified, verificationSource, verifiedBy, ...rest } = data;
  return {
    ...rest,
    verified: verified ?? false,
    verificationSource: verified ? verificationSource ?? null : null,
    verifiedBy: verified ? verifiedBy ?? null : null,
    verifiedAt: verified ? new Date() : null,
  };
}

export async function createIngredient(data: IngredientInput) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  const ingredient = await prisma.ingredient.create({ data: withVerificationTimestamp(data) });

  await logAudit(session, {
    action: "CREATE_INGREDIENT",
    entityType: "Ingredient",
    entityId: ingredient.id,
    summary: `Added ingredient "${ingredient.name}"`,
  });

  revalidatePath("/ingredients");
  return ingredient;
}

export async function updateIngredient(id: string, data: IngredientInput) {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");

  await prisma.ingredient.update({ where: { id }, data: withVerificationTimestamp(data) });

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
