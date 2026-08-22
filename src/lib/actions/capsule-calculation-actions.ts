"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { computeCalculation, DIRECTION_LABEL } from "@/lib/capsule-calculation-defaults";
import type { CalculationDirection } from "@/generated/prisma";

const BASE_PATH = "/calculation";

async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

export async function listCalculations() {
  return prisma.capsuleCalculation.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export async function createCalculation(data: {
  direction: CalculationDirection;
  label?: string | null;
  capsulesPerBottle: number;
  avgFillWeightMg: number;
  inputValue: number;
}) {
  const session = await requireSession();
  if (!data.capsulesPerBottle || data.capsulesPerBottle <= 0) throw new Error("Capsules per bottle must be greater than 0");
  if (!data.avgFillWeightMg || data.avgFillWeightMg <= 0) throw new Error("Average fill weight must be greater than 0");
  if (!data.inputValue || data.inputValue <= 0) throw new Error("Enter a value greater than 0");

  const result = computeCalculation(data.direction, data.inputValue, data.capsulesPerBottle, data.avgFillWeightMg);

  const calc = await prisma.capsuleCalculation.create({
    data: {
      direction: data.direction,
      label: data.label?.trim() || null,
      capsulesPerBottle: data.capsulesPerBottle,
      avgFillWeightMg: data.avgFillWeightMg,
      inputValue: data.inputValue,
      resultKg: result.resultKg,
      resultCapsules: result.resultCapsules,
      resultBottles: result.resultBottles,
      createdById: session.userId,
      createdByName: session.fullName,
    },
  });

  await logAudit(session, {
    action: "CREATE_CAPSULE_CALCULATION",
    entityType: "CapsuleCalculation",
    entityId: calc.id,
    summary: `${session.fullName} ran a "${DIRECTION_LABEL[data.direction]}" calculation${data.label ? ` ("${data.label}")` : ""}`,
  });

  revalidatePath(BASE_PATH);
  return calc;
}

export async function deleteCalculation(id: string) {
  const session = await requireSession();
  const calc = await prisma.capsuleCalculation.delete({ where: { id } });

  await logAudit(session, {
    action: "DELETE_CAPSULE_CALCULATION",
    entityType: "CapsuleCalculation",
    entityId: id,
    summary: `${session.fullName} deleted a calculation${calc.label ? ` ("${calc.label}")` : ""}`,
  });

  revalidatePath(BASE_PATH);
}
