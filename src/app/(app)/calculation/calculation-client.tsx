"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CalculationDirection } from "@/generated/prisma";
import { createCalculation, deleteCalculation } from "@/lib/actions/capsule-calculation-actions";
import {
  computeCalculation,
  DIRECTION_LABEL,
  WEIGHT_FIELD_LABEL,
  QUANTITY_FIELD_LABEL,
  formatKg,
  formatWholeCount,
} from "@/lib/capsule-calculation-defaults";
import { formatBrisbaneDateTime } from "@/lib/ui";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

export type CalculationRow = {
  id: string;
  direction: CalculationDirection;
  label: string | null;
  capsulesPerBottle: number;
  avgFillWeightMg: number;
  inputValue: number;
  resultKg: number | null;
  resultCapsules: number | null;
  resultBottles: number | null;
  createdByName: string | null;
  createdAt: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const DIRECTIONS: CalculationDirection[] = ["BOTTLES_TO_KG", "KG_TO_OUTPUT", "BAGGED_KG_TO_OUTPUT"];

const DIRECTION_TONE: Record<CalculationDirection, "info" | "muted" | "success"> = {
  BOTTLES_TO_KG: "info",
  KG_TO_OUTPUT: "muted",
  BAGGED_KG_TO_OUTPUT: "success",
};

export default function CalculationClient({ calculations }: { calculations: CalculationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [direction, setDirection] = useState<CalculationDirection>("BOTTLES_TO_KG");
  const [label, setLabel] = useState("");
  const [capsulesPerBottle, setCapsulesPerBottle] = useState("31");
  const [avgFillWeightMg, setAvgFillWeightMg] = useState("372");
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  function save() {
    setError("");
    const capsulesPerBottleNum = Number(capsulesPerBottle);
    const avgFillWeightMgNum = Number(avgFillWeightMg);
    const inputValueNum = Number(inputValue);
    if (!capsulesPerBottleNum || capsulesPerBottleNum <= 0) return setError("Capsules per bottle must be greater than 0.");
    if (!avgFillWeightMgNum || avgFillWeightMgNum <= 0) return setError(`${WEIGHT_FIELD_LABEL[direction]} must be greater than 0.`);
    if (!inputValueNum || inputValueNum <= 0) {
      return setError(`Enter a value for "${QUANTITY_FIELD_LABEL[direction]}".`);
    }

    startTransition(async () => {
      try {
        await createCalculation({
          direction,
          label: label || null,
          capsulesPerBottle: capsulesPerBottleNum,
          avgFillWeightMg: avgFillWeightMgNum,
          inputValue: inputValueNum,
        });
        setLabel("");
        setInputValue("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save calculation.");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this calculation?")) return;
    startTransition(async () => {
      try {
        await deleteCalculation(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete.");
      }
    });
  }

  const capsulesPerBottleNum = Number(capsulesPerBottle);
  const avgFillWeightMgNum = Number(avgFillWeightMg);
  const inputValueNum = Number(inputValue);
  const preview =
    capsulesPerBottleNum > 0 && avgFillWeightMgNum > 0 && inputValueNum > 0
      ? computeCalculation(direction, inputValueNum, capsulesPerBottleNum, avgFillWeightMgNum)
      : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calculation"
        subtitle="Quick capsule/bottle ↔ kg planning math — theoretical figures, before spillage, rejects, or process yield loss."
      />

      <Card padding="sm" className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {DIRECTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-out ${
                direction === d
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {DIRECTION_LABEL[d]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Field label="Label (optional)">
            <input className="input" placeholder="e.g. Gut AU August run" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label="Capsules per Bottle">
            <input type="number" className="input" value={capsulesPerBottle} onChange={(e) => setCapsulesPerBottle(e.target.value)} />
          </Field>
          <Field label={WEIGHT_FIELD_LABEL[direction]}>
            <input type="number" step="0.1" className="input" value={avgFillWeightMg} onChange={(e) => setAvgFillWeightMg(e.target.value)} />
          </Field>
          <Field label={QUANTITY_FIELD_LABEL[direction]}>
            <input type="number" step="0.001" className="input" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
          </Field>
        </div>

        {preview && (
          <div className={`grid gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 text-center ${direction === "BOTTLES_TO_KG" ? "grid-cols-3" : "grid-cols-2"}`}>
            {direction === "BOTTLES_TO_KG" && (
              <div>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatKg(preview.resultKg)} kg</p>
                <p className="text-xs text-muted-foreground">Powder to Blend</p>
              </div>
            )}
            <div>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatWholeCount(preview.resultCapsules)}</p>
              <p className="text-xs text-muted-foreground">Capsules</p>
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums text-foreground">{formatWholeCount(preview.resultBottles)}</p>
              <p className="text-xs text-muted-foreground">Bottles</p>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Calculate & Save"}
          </Button>
        </div>
      </Card>

      {calculations.length === 0 ? (
        <EmptyState title="No calculations yet" description="Run your first calculation above." />
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className={THEAD_ROW_CLASS}>
                <Th>Label</Th>
                <Th>Type</Th>
                <Th>Input</Th>
                <Th>Weight (kg)</Th>
                <Th>Capsules</Th>
                <Th>Bottles</Th>
                <Th>By</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {calculations.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 even:bg-surface-muted/30">
                  <td className="px-3 py-2 text-foreground">{c.label ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge tone={DIRECTION_TONE[c.direction]}>{DIRECTION_LABEL[c.direction]}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {c.direction === "BOTTLES_TO_KG" ? `${formatWholeCount(c.inputValue)} bottles` : `${formatKg(c.inputValue)} kg`}
                    <br />
                    <span className="text-xs">
                      {c.capsulesPerBottle}/bottle, {c.avgFillWeightMg}mg {c.direction === "BAGGED_KG_TO_OUTPUT" ? "full" : "fill"}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{c.resultKg !== null ? formatKg(c.resultKg) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.resultCapsules !== null ? formatWholeCount(c.resultCapsules) : "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.resultBottles !== null ? formatWholeCount(c.resultBottles) : "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {c.createdByName ?? "—"}
                    <br />
                    {formatBrisbaneDateTime(c.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => remove(c.id)} className="text-xs font-medium text-danger hover:opacity-80">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
