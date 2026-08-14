import type { Priority } from "@/generated/prisma";
import type { MaterialLineStatus } from "@/lib/customer-order-defaults";

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

/** batchSizeKg * plannedBatches, computed fresh everywhere it's needed -- never
 * stored, same "never persist a derived number" precedent as order risk and Mfg
 * Reconciliation yield%. */
export function computePlannedQtyKg(batchSizeKg: number, plannedBatches: number): number {
  return Math.round(batchSizeKg * plannedBatches * 1000) / 1000;
}

export type MpsReadiness = {
  ready: boolean;
  reasons: string[];
};

/** Rolls up an entry's four readiness gates into one pass/fail, mirroring the doc's
 * own rule ("Only approved changes enter the frozen production schedule" / release
 * checklist requires Material + QC + Maintenance all ready). materialStatus comes
 * from a live check against the Customer Order material-availability helpers --
 * "NO_BOM" (no formulation linked to the product) counts as not-ready, same as an
 * unmapped ingredient would. */
export function computeMpsReadiness(entry: {
  frozen: boolean;
  materialStatus: MaterialLineStatus | "NO_BOM" | null;
  qcReady: boolean;
  maintenanceReady: boolean;
}): MpsReadiness {
  const reasons: string[] = [];
  if (!entry.frozen) reasons.push("Not yet frozen");
  if (entry.materialStatus === null) reasons.push("Material not checked yet");
  else if (entry.materialStatus === "SHORT") reasons.push("Material shortage");
  else if (entry.materialStatus === "UNMAPPED") reasons.push("Ingredients not mapped to stock items");
  else if (entry.materialStatus === "NO_BOM") reasons.push("Product has no linked formulation");
  if (!entry.qcReady) reasons.push("QC not ready");
  if (!entry.maintenanceReady) reasons.push("Maintenance not ready");

  return { ready: reasons.length === 0, reasons };
}

export const MATERIAL_STATUS_LABELS: Record<MaterialLineStatus | "NO_BOM", string> = {
  READY: "Ready",
  SHORT: "Short",
  UNMAPPED: "Unmapped",
  NO_BOM: "No BOM",
};
