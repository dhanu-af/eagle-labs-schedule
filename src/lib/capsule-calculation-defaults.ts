import type { CalculationDirection } from "@/generated/prisma";
import { capsulesFromKg } from "@/lib/mfg-reconciliation-defaults";

export const DIRECTION_LABEL: Record<CalculationDirection, string> = {
  BOTTLES_TO_KG: "Bottles needed → KG to blend",
  KG_TO_OUTPUT: "KG blended (powder) → Capsules & bottles",
  BAGGED_KG_TO_OUTPUT: "Bagged capsules (KG) → Capsules & bottles",
  CAPSULES_TO_SHELLS: "Capsules → Empty shells needed",
};

/** The weight figure each direction asks for -- BOTTLES_TO_KG/KG_TO_OUTPUT both work
 * from the powder fill weight (what goes inside the shell); BAGGED_KG_TO_OUTPUT works
 * from the capsule's average FULL weight (shell + fill), since by that stage you're
 * weighing real pressed capsules, not powder; CAPSULES_TO_SHELLS works from the empty
 * shell's own weight (no powder involved at all). */
export const WEIGHT_FIELD_LABEL: Record<CalculationDirection, string> = {
  BOTTLES_TO_KG: "Avg. Fill Weight (mg)",
  KG_TO_OUTPUT: "Avg. Fill Weight (mg)",
  BAGGED_KG_TO_OUTPUT: "Avg. Capsule Full Weight (mg)",
  CAPSULES_TO_SHELLS: "Empty Shell Weight (mg)",
};

export const QUANTITY_FIELD_LABEL: Record<CalculationDirection, string> = {
  BOTTLES_TO_KG: "Target Bottles",
  KG_TO_OUTPUT: "Blended Powder (kg)",
  BAGGED_KG_TO_OUTPUT: "Bagged Capsules (kg)",
  CAPSULES_TO_SHELLS: "Capsule Count",
};

/** What the "per container" field means -- capsules per bottle for every direction
 * except CAPSULES_TO_SHELLS, which is about buying empty shells in bulk boxes instead. */
export const CONTAINER_FIELD_LABEL: Record<CalculationDirection, string> = {
  BOTTLES_TO_KG: "Capsules per Bottle",
  KG_TO_OUTPUT: "Capsules per Bottle",
  BAGGED_KG_TO_OUTPUT: "Capsules per Bottle",
  CAPSULES_TO_SHELLS: "Capsules per Box",
};

/** What the computed "how many containers" result means -- bottles produced, or boxes
 * of empty shells to buy. */
export const CONTAINER_RESULT_LABEL: Record<CalculationDirection, string> = {
  BOTTLES_TO_KG: "Bottles",
  KG_TO_OUTPUT: "Bottles",
  BAGGED_KG_TO_OUTPUT: "Bottles",
  CAPSULES_TO_SHELLS: "Boxes",
};

/** Whether the input value the user types in is a bottle count, a kg weight, or a
 * capsule count -- used to format the saved log's "Input" column correctly. */
export function formatInputValue(direction: CalculationDirection, inputValue: number): string {
  if (direction === "BOTTLES_TO_KG") return `${formatWholeCount(inputValue)} bottles`;
  if (direction === "CAPSULES_TO_SHELLS") return `${formatWholeCount(inputValue)} capsules`;
  return `${formatKg(inputValue)} kg`;
}

export type CalculationResult = { resultKg: number; resultCapsules: number; resultBottles: number };

/**
 * Runs one of the four capsule/bottle/shell <-> kg conversions, reusing the same
 * "kg x 1,000,000 / avg weight" formula src/lib/mfg-reconciliation-defaults.ts's
 * capsulesFromKg() already uses for real batch reconciliation -- this is the same
 * math, just for planning ahead of / checking a batch rather than reconciling one
 * after the fact. KG_TO_OUTPUT and BAGGED_KG_TO_OUTPUT are the identical kg -> capsules
 * -> bottles calculation; they're only kept as separate directions because they use a
 * different real-world weight figure (fill weight vs full weight -- see
 * WEIGHT_FIELD_LABEL). CAPSULES_TO_SHELLS runs the other direction again (capsules ->
 * weight) plus a "how many boxes" division, rounded UP since you can't buy a partial
 * box of empty shells. `resultCapsules` on a CAPSULES_TO_SHELLS row is just the given
 * capsule count echoed back, not a computed output.
 * These are theoretical figures (no allowance for spillage, rejects, QC samples, or
 * process yield loss) -- a real batch will use somewhat more powder / produce somewhat
 * fewer good capsules than this shows.
 */
export function computeCalculation(
  direction: CalculationDirection,
  inputValue: number,
  perContainer: number,
  weightMg: number
): CalculationResult {
  if (direction === "BOTTLES_TO_KG") {
    const bottles = inputValue;
    const capsules = bottles * perContainer;
    const kg = (capsules * weightMg) / 1_000_000;
    return { resultKg: kg, resultCapsules: capsules, resultBottles: bottles };
  }

  if (direction === "CAPSULES_TO_SHELLS") {
    const capsules = inputValue;
    const shellWeightKg = (capsules * weightMg) / 1_000_000;
    const boxes = Math.ceil(capsules / perContainer);
    return { resultKg: shellWeightKg, resultCapsules: capsules, resultBottles: boxes };
  }

  // KG_TO_OUTPUT / BAGGED_KG_TO_OUTPUT
  const kg = inputValue;
  const capsules = capsulesFromKg(kg, weightMg) ?? 0;
  const bottles = capsules / perContainer;
  return { resultKg: kg, resultCapsules: capsules, resultBottles: bottles };
}

export function formatKg(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatWholeCount(n: number): string {
  return Math.floor(n).toLocaleString();
}
