"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, canEdit } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const BASE_PATH = "/formulation-checker";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session || !canEdit(session.role)) throw new Error("Not authorized");
  return session;
}

export type IngredientInput = {
  rmNumber?: string;
  ingredientName: string;
  uin?: string;
  baseQty: number;
  controlStatus?: string;
  changeControlRef?: string;
  approvedBy?: string;
  comments?: string;
  tolerancePct: number;
};

export async function createFolder(name: string) {
  const session = await requireSuperAdmin();
  if (!name.trim()) throw new Error("Folder name can't be empty");

  const count = await prisma.formulationFolder.count();
  const folder = await prisma.formulationFolder.create({
    data: { name: name.trim(), order: count },
  });

  await logAudit(session, {
    action: "CREATE_FORMULATION_FOLDER",
    entityType: "FormulationFolder",
    entityId: folder.id,
    summary: `Created formulation folder "${folder.name}"`,
  });

  revalidatePath(BASE_PATH);
  return folder;
}

export async function deleteFolder(id: string) {
  const session = await requireSuperAdmin();

  const count = await prisma.formulation.count({ where: { folderId: id } });
  if (count > 0) throw new Error("This folder still has formulations in it — move or delete them first");

  const folder = await prisma.formulationFolder.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_FORMULATION_FOLDER",
    entityType: "FormulationFolder",
    entityId: id,
    summary: `Deleted formulation folder "${folder.name}"`,
  });

  revalidatePath(BASE_PATH);
}

export async function createFormulation(data: {
  folderId: string;
  productName: string;
  baseBatchSize: number;
  baseUnit: string;
  ingredients: IngredientInput[];
}) {
  const session = await requireSuperAdmin();
  if (!data.productName.trim()) throw new Error("Product name is required");
  if (data.ingredients.length === 0) throw new Error("Add at least one ingredient");

  const formulation = await prisma.formulation.create({
    data: {
      folderId: data.folderId,
      productName: data.productName.trim(),
      baseBatchSize: data.baseBatchSize,
      baseUnit: data.baseUnit || "kg",
      createdById: session.userId,
      createdByName: session.fullName,
      ingredients: {
        create: data.ingredients.map((ing, i) => ({
          order: i,
          rmNumber: ing.rmNumber || null,
          ingredientName: ing.ingredientName,
          uin: ing.uin || null,
          baseQty: ing.baseQty,
          controlStatus: ing.controlStatus || null,
          changeControlRef: ing.changeControlRef || null,
          approvedBy: ing.approvedBy || null,
          comments: ing.comments || null,
          tolerancePct: ing.tolerancePct,
        })),
      },
    },
  });

  await logAudit(session, {
    action: "CREATE_FORMULATION",
    entityType: "Formulation",
    entityId: formulation.id,
    summary: `Created formulation "${formulation.productName}"`,
  });

  revalidatePath(BASE_PATH);
  return formulation;
}

export async function updateFormulation(
  id: string,
  data: {
    folderId: string;
    productName: string;
    baseBatchSize: number;
    baseUnit: string;
    ingredients: IngredientInput[];
  }
) {
  const session = await requireSuperAdmin();
  if (!data.productName.trim()) throw new Error("Product name is required");
  if (data.ingredients.length === 0) throw new Error("Add at least one ingredient");

  await prisma.$transaction([
    prisma.formulationIngredient.deleteMany({ where: { formulationId: id } }),
    prisma.formulation.update({
      where: { id },
      data: {
        folderId: data.folderId,
        productName: data.productName.trim(),
        baseBatchSize: data.baseBatchSize,
        baseUnit: data.baseUnit || "kg",
        ingredients: {
          create: data.ingredients.map((ing, i) => ({
            order: i,
            rmNumber: ing.rmNumber || null,
            ingredientName: ing.ingredientName,
            uin: ing.uin || null,
            baseQty: ing.baseQty,
            controlStatus: ing.controlStatus || null,
            changeControlRef: ing.changeControlRef || null,
            approvedBy: ing.approvedBy || null,
            comments: ing.comments || null,
            tolerancePct: ing.tolerancePct,
          })),
        },
      },
    }),
  ]);

  await logAudit(session, {
    action: "UPDATE_FORMULATION",
    entityType: "Formulation",
    entityId: id,
    summary: `Updated formulation "${data.productName}"`,
  });

  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${id}`);
}

export async function deleteFormulation(id: string) {
  const session = await requireSuperAdmin();

  const formulation = await prisma.formulation.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_FORMULATION",
    entityType: "Formulation",
    entityId: id,
    summary: `Deleted formulation "${formulation.productName}"`,
  });

  revalidatePath(BASE_PATH);
}
