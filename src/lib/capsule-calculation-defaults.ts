import type { CalculationDirection } from "@/generated/prisma";
import { capsulesFromKg } from "@/lib/mfg-reconciliation-defaults";

export const DIRECTION_LABEL: Record<CalculationDirection, string> = {
  BOTTLES_TO_KG: "Bottles needed → KG to blend",
  KG_TO_OUTPUT: "KG blended (powder) → Capsules & bottles",
  BAGGED_KG_TO_OUTPUT: "Bagged capsules (KG) → Capsules & bottles",
};

/** The weight figure each direction asks for -- BOTTLES_TO_KG/KG_TO_OUTPUT both work
 * from the powder fill weight (what goes inside the shell); BAGGED_KG_TO_OUTPUT works
 * from the capsule's average FULL weight (shell + fill), since by that stage you're
 * weighing real pressed capsules, not powder. */
export const WEIGHT_FIELD_LABEL: Record<CalculationDirection, string> = {
  BOTTLES_TO_KG: "Avg. Fill Weight (mg)",
  KG_TO_OUTPUT: "Avg. Fill Weight (mg)",
  BAGGED_KG_TO_OUTPUT: "Avg. Capsule Full Weight (mg)",
};

export const QUANTITY_FIELD_LABEL: Record<CalculationDirection, string> = {
  BOTTLES_TO_KG: "Target Bottles",
  KG_TO_OUTPUT: "Blended Powder (kg)",
  BAGGED_KG_TO_OUTPUT: "Bagged Capsules (kg)",
};

export type CalculationResult = { resultKg: number; resultCapsules: number; resultBottles: number };

/**
 * Runs one of the three capsule/bottle <-> kg conversions, reusing the same
 * "kg x 1,000,000 / avg weight" formula src/lib/mfg-reconciliation-defaults.ts's
 * capsulesFromKg() already uses for real batch reconciliation -- this is the same
 * math, just for planning ahead of / checking a batch rather than reconciling one
 * after the fact. KG_TO_OUTPUT and BAGGED_KG_TO_OUTPUT are the identical kg -> capsules
 * -> bottles calculation; they're only kept as separate directions because they use a
 * different real-world weight figure (fill weight vs full weight -- see
 * WEIGHT_FIELD_LABEL). These are theoretical figures (no allowance for spillage,
 * rejects, QC samples, or process yield loss) -- a real batch will use somewhat more
 * powder / produce somewhat fewer good capsules than this shows.
 */
export function computeCalculation(
  direction: CalculationDirection,
  inputValue: number,
  capsulesPerBottle: number,
  avgWeightMg: number
): CalculationResult {
  if (direction === "BOTTLES_TO_KG") {
    const bottles = inputValue;
    const capsules = bottles * capsulesPerBottle;
    const kg = (capsules * avgWeightMg) / 1_000_000;
    return { resultKg: kg, resultCapsules: capsules, resultBottles: bottles };
  }

  const kg = inputValue;
  const capsules = capsulesFromKg(kg, avgWeightMg) ?? 0;
  const bottles = capsules / capsulesPerBottle;
  return { resultKg: kg, resultCapsules: capsules, resultBottles: bottles };
}

export function formatKg(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatWholeCount(n: number): string {
  return Math.floor(n).toLocaleString();
}
