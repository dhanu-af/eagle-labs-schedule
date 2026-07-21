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
