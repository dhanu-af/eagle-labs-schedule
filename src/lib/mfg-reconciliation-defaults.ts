import type { MfgBatchStatus, MfgMaterialGroup, MfgPackagingMaterialType } from "@/generated/prisma";

export const MFG_BATCH_STATUS_LABEL: Record<MfgBatchStatus, string> = {
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

export const MFG_MATERIAL_GROUP_LABEL: Record<MfgMaterialGroup, string> = {
  RAW_INGREDIENT: "Ingredient",
  RAW_ACTIVE_INGREDIENT: "Active Ingredient",
  RAW_EXCIPIENT: "Excipient",
  PACKAGING_EMPTY_CAPSULE: "Empty Capsules",
  PACKAGING_EMPTY_BOTTLE: "Empty Bottles",
  PACKAGING_CAP: "Caps",
  PACKAGING_DESICCANT: "Desiccants",
  PACKAGING_LABEL: "Labels",
  PACKAGING_CARTON: "Cartons",
  PACKAGING_INSERT: "Inserts",
  PACKAGING_SHRINK_WRAP: "Shrink Wrap",
  PACKAGING_SHIPPER: "Shippers",
  PACKAGING_PALLET: "Pallets",
};

/** Raw material lines are added per-batch by whoever issues them (formulations vary), so they aren't pre-populated. */
export const RAW_MATERIAL_GROUPS: MfgMaterialGroup[] = ["RAW_INGREDIENT", "RAW_ACTIVE_INGREDIENT", "RAW_EXCIPIENT"];

/** Packaging materials are the same standard set for every batch, so a new Warehouse Issue pre-populates one line per type. */
export const PACKAGING_MATERIAL_GROUPS: MfgMaterialGroup[] = [
  "PACKAGING_EMPTY_CAPSULE",
  "PACKAGING_EMPTY_BOTTLE",
  "PACKAGING_CAP",
  "PACKAGING_DESICCANT",
  "PACKAGING_LABEL",
  "PACKAGING_CARTON",
  "PACKAGING_INSERT",
  "PACKAGING_SHRINK_WRAP",
  "PACKAGING_SHIPPER",
  "PACKAGING_PALLET",
];

/** Default line template for a brand-new Warehouse Issue -- one row per standard packaging material,
 * the same way QC Samples pre-populates its test checklist from CAPSULE_TEST_SECTIONS/GUMMY_TEST_SECTIONS. */
export const DEFAULT_PACKAGING_ISSUE_LINES: { materialGroup: MfgMaterialGroup; description: string }[] =
  PACKAGING_MATERIAL_GROUPS.map((materialGroup) => ({ materialGroup, description: MFG_MATERIAL_GROUP_LABEL[materialGroup] }));

export const PACKAGING_MATERIAL_TYPE_LABEL: Record<MfgPackagingMaterialType, string> = {
  LABEL: "Labels",
  CARTON: "Cartons",
  INSERT: "Inserts",
  SHRINK_WRAP: "Shrink Wrap",
  SHIPPER: "Shippers",
};

/** Default line template for the Packaging stage's material reconciliation -- one row per material type. */
export const DEFAULT_PACKAGING_MATERIAL_LINES: MfgPackagingMaterialType[] = ["LABEL", "CARTON", "INSERT", "SHRINK_WRAP", "SHIPPER"];

/** Simple issued-minus-returned balance, used across every stage's material reconciliation table.
 * Never stored -- always computed at render time, matching the existing yield%% precedent in
 * batch-record-client.tsx (Total Dispensed vs Total Drum Net Weight). */
export function computeBalance(issued: number | null | undefined, returned: number | null | undefined): number | null {
  if (issued == null) return null;
  return issued - (returned ?? 0);
}

/** Generic yield %% helper (output / expected * 100), null when either side is missing or expected is zero. */
export function computeYieldPct(actual: number | null | undefined, expected: number | null | undefined): number | null {
  if (actual == null || expected == null || expected === 0) return null;
  return (actual / expected) * 100;
}

/** Capsule count = weight (kg) converted to mg, divided by the average weight per capsule (mg).
 * The core "x 1,000,000 / avg weight" formula used throughout both real Capsule/Bottle Reconciliation
 * spreadsheets these two stages mirror field-for-field. */
export function capsulesFromKg(weightKg: number | null | undefined, avgWeightMg: number | null | undefined): number | null {
  if (weightKg == null || avgWeightMg == null || avgWeightMg === 0) return null;
  return (weightKg * 1_000_000) / avgWeightMg;
}

/** A reconciliation %% check against its spec limit, as printed on the real forms (e.g. "Limits 98 - 102%",
 * "Below 1.5%"). `pass` is null when the %% itself couldn't be computed (a required input is missing). */
export type ReconciliationCheck = { label: string; pct: number | null; limitLabel: string; pass: boolean | null };

export function checkRange(label: string, pct: number | null, min: number, max: number): ReconciliationCheck {
  return { label, pct, limitLabel: `Limits ${min} - ${max}%`, pass: pct === null ? null : pct >= min && pct <= max };
}

export function checkBelow(label: string, pct: number | null, max: number): ReconciliationCheck {
  return { label, pct, limitLabel: `Below ${max}%`, pass: pct === null ? null : pct <= max };
}

/** "000,000.00" display format for the computed Batch Calculations figures -- thousands separators, always 2 decimals. */
export function formatCount(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type BlendingCheckInput = { totalBlendProducedKg: number | null; totalTheoreticalWeightKg: number | null };
type EncapsulationCheckInput = {
  issuedBulkBlendKg: number | null;
  targetCapsuleFillWeightMg: number | null;
  capsulesProducedKg: number | null;
  avgCapsuleFullWeightMg: number | null;
  avgCapsuleFillWeightMg: number | null;
  capsuleSamplesKg: number | null;
  rejectCapsulesKg: number | null;
  rejectPowderKg: number | null;
};
type BottlingCheckInput = {
  capsuleReceivedKg: number | null;
  avgCapsuleFullWeightMg: number | null;
  targetCapsulesPerBottle: number | null;
  bottlesProduced: number | null;
  capsUsed: number | null;
  bottleUsed: number | null;
};

/** Every reconciliation %% check across every stage that has one -- the single "Final Reconciliation"
 * view for a batch, used identically by the web detail page and the PDF export so the two never drift
 * apart. Reuses the exact same formulas as each stage's own section. */
export function computeFinalReconciliationChecks(
  blending: BlendingCheckInput | null,
  encapsulation: EncapsulationCheckInput | null,
  bottling: BottlingCheckInput | null
): ReconciliationCheck[] {
  const checks: ReconciliationCheck[] = [];

  if (blending) {
    const blendYieldPct = computeYieldPct(blending.totalBlendProducedKg, blending.totalTheoreticalWeightKg);
    checks.push({ label: "Blending — Blend Yield", pct: blendYieldPct, limitLabel: "", pass: null });
  }

  if (encapsulation) {
    const theoreticalCapsules = capsulesFromKg(encapsulation.issuedBulkBlendKg, encapsulation.targetCapsuleFillWeightMg);
    const capsulesProduced = capsulesFromKg(encapsulation.capsulesProducedKg, encapsulation.avgCapsuleFullWeightMg);
    const capsuleSamples = capsulesFromKg(encapsulation.capsuleSamplesKg, encapsulation.avgCapsuleFullWeightMg);
    const rejectCapsules = capsulesFromKg(encapsulation.rejectCapsulesKg, encapsulation.avgCapsuleFullWeightMg);
    const blendInProducedCapsulesKg =
      capsulesProduced !== null && encapsulation.avgCapsuleFillWeightMg !== null ? (capsulesProduced * encapsulation.avgCapsuleFillWeightMg) / 1_000_000 : null;
    const bulkBlendAccountedForKg =
      blendInProducedCapsulesKg !== null && encapsulation.capsuleSamplesKg !== null && encapsulation.rejectCapsulesKg !== null && encapsulation.rejectPowderKg !== null
        ? blendInProducedCapsulesKg + encapsulation.capsuleSamplesKg + encapsulation.rejectCapsulesKg + encapsulation.rejectPowderKg
        : null;

    const capsuleReconciliationPct =
      capsulesProduced !== null && capsuleSamples !== null && rejectCapsules !== null && theoreticalCapsules
        ? ((capsulesProduced + capsuleSamples + rejectCapsules) / theoreticalCapsules) * 100
        : null;
    const blendReconciliationPct = bulkBlendAccountedForKg !== null && encapsulation.issuedBulkBlendKg ? (bulkBlendAccountedForKg / encapsulation.issuedBulkBlendKg) * 100 : null;
    const processYieldPct = capsulesProduced !== null && theoreticalCapsules ? (capsulesProduced / theoreticalCapsules) * 100 : null;
    const capsuleRejectionPct =
      rejectCapsules !== null && capsulesProduced !== null && capsulesProduced + rejectCapsules !== 0 ? (rejectCapsules / (capsulesProduced + rejectCapsules)) * 100 : null;

    checks.push(
      checkRange("Encapsulation — Capsule Reconciliation", capsuleReconciliationPct, 98, 102),
      checkRange("Encapsulation — Blend Reconciliation", blendReconciliationPct, 98, 102),
      checkRange("Encapsulation — Process Yield", processYieldPct, 95, 102),
      checkBelow("Encapsulation — Capsule Rejection", capsuleRejectionPct, 1.5)
    );
  }

  if (bottling) {
    const theoreticalCapsules = capsulesFromKg(bottling.capsuleReceivedKg, bottling.avgCapsuleFullWeightMg);
    const theoreticalBottles = theoreticalCapsules !== null && bottling.targetCapsulesPerBottle ? theoreticalCapsules / bottling.targetCapsulesPerBottle : null;
    const capsulesUsed = bottling.bottlesProduced !== null && bottling.targetCapsulesPerBottle !== null ? bottling.bottlesProduced * bottling.targetCapsulesPerBottle : null;
    const rejectCapsules = theoreticalCapsules !== null && capsulesUsed !== null ? theoreticalCapsules - capsulesUsed : null;

    const capsuleReconciliationPct = capsulesUsed !== null && theoreticalCapsules ? (capsulesUsed / theoreticalCapsules) * 100 : null;
    const capsReconciliationPct = bottling.bottlesProduced !== null && bottling.capsUsed ? (bottling.bottlesProduced / bottling.capsUsed) * 100 : null;
    const bottleReconciliationPct = bottling.bottlesProduced !== null && bottling.bottleUsed ? (bottling.bottlesProduced / bottling.bottleUsed) * 100 : null;
    const processYieldPct = bottling.bottlesProduced !== null && theoreticalBottles ? (bottling.bottlesProduced / theoreticalBottles) * 100 : null;
    const rejectionLossPct = rejectCapsules !== null && theoreticalCapsules ? (rejectCapsules / theoreticalCapsules) * 100 : null;

    checks.push(
      checkRange("Bottling — Capsule Reconciliation", capsuleReconciliationPct, 98, 102),
      checkRange("Bottling — Caps Reconciliation", capsReconciliationPct, 98, 102),
      checkRange("Bottling — Bottle Reconciliation", bottleReconciliationPct, 98, 102),
      checkRange("Bottling — Process Yield", processYieldPct, 95, 102),
      checkBelow("Bottling — Rejection & Loss", rejectionLossPct, 2)
    );
  }

  return checks;
}
