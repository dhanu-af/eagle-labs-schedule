import type { CalculationDirection } from "@/generated/prisma";
import { capsulesFromKg } from "@/lib/mfg-reconciliation-defaults";

export const DIRECTION_LABEL: Record<CalculationDirection, string> = {
  BOTTLES_TO_KG: "Bottles needed → KG to blend",
  KG_TO_OUTPUT: "KG blended → Capsules & bottles output",
};

export type CalculationResult = { resultKg: number; resultCapsules: number; resultBottles: number };

/**
 * Runs one of the two capsule/bottle <-> kg conversions, reusing the same
 * "kg x 1,000,000 / avg fill weight" formula src/lib/mfg-reconciliation-defaults.ts's
 * capsulesFromKg() already uses for real batch reconciliation -- this is the same
 * math, just for planning ahead of a batch rather than reconciling one afterwards.
 * These are theoretical figures (no allowance for spillage, rejects, QC samples, or
 * process yield loss) -- a real batch will use somewhat more powder / produce somewhat
 * fewer good capsules than this shows.
 */
export function computeCalculation(
  direction: CalculationDirection,
  inputValue: number,
  capsulesPerBottle: number,
  avgFillWeightMg: number
): CalculationResult {
  if (direction === "BOTTLES_TO_KG") {
    const bottles = inputValue;
    const capsules = bottles * capsulesPerBottle;
    const kg = (capsules * avgFillWeightMg) / 1_000_000;
    return { resultKg: kg, resultCapsules: capsules, resultBottles: bottles };
  }

  const kg = inputValue;
  const capsules = capsulesFromKg(kg, avgFillWeightMg) ?? 0;
  const bottles = capsules / capsulesPerBottle;
  return { resultKg: kg, resultCapsules: capsules, resultBottles: bottles };
}

export function formatKg(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatWholeCount(n: number): string {
  return Math.floor(n).toLocaleString();
}
