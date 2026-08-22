import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listCalculations } from "@/lib/actions/capsule-calculation-actions";
import CalculationClient from "./calculation-client";

export default async function CalculationPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const calculations = await listCalculations();

  return (
    <CalculationClient
      calculations={calculations.map((c) => ({
        id: c.id,
        direction: c.direction,
        label: c.label,
        capsulesPerBottle: c.capsulesPerBottle,
        avgFillWeightMg: c.avgFillWeightMg,
        inputValue: c.inputValue,
        resultKg: c.resultKg,
        resultCapsules: c.resultCapsules,
        resultBottles: c.resultBottles,
        createdByName: c.createdByName,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
