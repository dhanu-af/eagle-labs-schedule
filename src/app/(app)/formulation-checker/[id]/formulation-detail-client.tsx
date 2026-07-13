"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteFormulation } from "@/lib/actions/formulation-actions";

type Ingredient = {
  id: string;
  rmNumber: string | null;
  ingredientName: string;
  uin: string | null;
  baseQty: number;
  controlStatus: string | null;
  changeControlRef: string | null;
  approvedBy: string | null;
  comments: string | null;
  tolerancePct: number;
};

type Formulation = {
  id: string;
  productName: string;
  folderName: string;
  baseBatchSize: number;
  baseUnit: string;
  ingredients: Ingredient[];
};

/** Mass units the Batch Calculator can auto-convert between, expressed relative to 1 mg. */
const UNIT_TO_MG: Record<string, number> = { mg: 1, g: 1000, kg: 1_000_000 };

export default function FormulationDetailClient({
  canManage,
  enteredByDefault,
  todayStr,
  formulation,
}: {
  canManage: boolean;
  enteredByDefault: string;
  todayStr: string;
  formulation: Formulation;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const baseUnitKey = formulation.baseUnit.trim().toLowerCase();
  const canConvertUnits = baseUnitKey in UNIT_TO_MG;
  const unitOptions = canConvertUnits ? ["mg", "g", "kg"] : [formulation.baseUnit];

  const [requiredBatchSize, setRequiredBatchSize] = useState(formulation.baseBatchSize);
  const [calcUnit, setCalcUnit] = useState(canConvertUnits ? baseUnitKey : formulation.baseUnit);
  const [batchNumber, setBatchNumber] = useState("");
  const [enteredBy, setEnteredBy] = useState(enteredByDefault);
  const [checkedBy, setCheckedBy] = useState("");
  const [calcDate, setCalcDate] = useState(todayStr);

  const totalQty = formulation.ingredients.reduce((s, i) => s + i.baseQty, 0);

  // Ratio of "1 unit of calcUnit" to "1 unit of the formulation's base unit" — 1 when they match.
  const unitFactor = canConvertUnits ? UNIT_TO_MG[calcUnit] / UNIT_TO_MG[baseUnitKey] : 1;

  const batchRows = useMemo(() => {
    const requiredBatchSizeInBaseUnit = requiredBatchSize * unitFactor;
    return formulation.ingredients.map((ing) => {
      const pctWw = totalQty > 0 ? ing.baseQty / totalQty : 0;
      const calculatedQtyRawInBaseUnit = pctWw * requiredBatchSizeInBaseUnit;
      const calculatedQtyRaw = unitFactor > 0 ? calculatedQtyRawInBaseUnit / unitFactor : calculatedQtyRawInBaseUnit;
      const calculatedQty = Math.round(calculatedQtyRaw * 1000) / 1000;
      const roundedQty = Math.round(calculatedQty * 100) / 100;
      const minQty = calculatedQty * (1 - ing.tolerancePct / 100);
      const maxQty = calculatedQty * (1 + ing.tolerancePct / 100);
      return { ...ing, pctWw, calculatedQty, roundedQty, minQty, maxQty };
    });
  }, [formulation.ingredients, totalQty, requiredBatchSize, unitFactor]);

  const batchTotal = batchRows.reduce((s, r) => s + r.roundedQty, 0);

  function remove() {
    if (!confirm(`Delete formulation "${formulation.productName}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteFormulation(formulation.id);
      router.push("/formulation-checker");
    });
  }

  function downloadPdf() {
    const params = new URLSearchParams({
      batchSize: String(requiredBatchSize),
      unit: calcUnit,
      batchNumber,
      enteredBy,
      checkedBy,
      calcDate,
    });
    window.open(`/api/formulation/${formulation.id}/pdf?${params.toString()}`, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/formulation-checker" className="hover:underline">
              Formulation Checker
            </Link>{" "}
            / {formulation.folderName}
          </p>
          <h1 className="text-xl font-semibold text-foreground">{formulation.productName}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadPdf}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Download PDF
          </button>
          {canManage && (
            <>
              <Link
                href={`/formulation-checker/${formulation.id}/edit`}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
              >
                Edit
              </Link>
              <button
                onClick={remove}
                disabled={pending}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-danger hover:bg-surface-muted"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card-shadow rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Master Formulation — Controlled Percentage Basis</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Base Batch Size: <span className="font-medium text-foreground">{formulation.baseBatchSize} {formulation.baseUnit}</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-2 py-2">No.</th>
                <th className="px-2 py-2">RM Number</th>
                <th className="px-2 py-2">Ingredient / AAN</th>
                <th className="px-2 py-2">UIN</th>
                <th className="px-2 py-2">Base Qty ({formulation.baseUnit})</th>
                <th className="px-2 py-2">% w/w</th>
                <th className="px-2 py-2">Control Status</th>
                <th className="px-2 py-2">Change Control Ref</th>
                <th className="px-2 py-2">Approved By</th>
                <th className="px-2 py-2">Comments</th>
              </tr>
            </thead>
            <tbody>
              {formulation.ingredients.map((ing, i) => (
                <tr key={ing.id} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{ing.rmNumber ?? "—"}</td>
                  <td className="px-2 py-1.5 text-foreground">{ing.ingredientName}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{ing.uin ?? "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{ing.baseQty.toFixed(3)}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {totalQty > 0 ? ((ing.baseQty / totalQty) * 100).toFixed(4) : "0.0000"}%
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{ing.controlStatus ?? "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{ing.changeControlRef ?? "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{ing.approvedBy ?? "—"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{ing.comments ?? "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary/10 font-semibold text-foreground">
                <td colSpan={4} className="px-2 py-2 text-right">
                  TOTAL
                </td>
                <td className="px-2 py-2">{totalQty.toFixed(3)}</td>
                <td className="px-2 py-2">100.0000%</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card-shadow rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Batch Calculator</h2>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Required Batch Size</span>
            <div className="flex gap-1.5">
              <input
                type="number"
                step="0.001"
                value={requiredBatchSize}
                onChange={(e) => setRequiredBatchSize(Number(e.target.value))}
                className="input min-w-0 flex-1"
              />
              <select
                value={calcUnit}
                onChange={(e) => setCalcUnit(e.target.value)}
                disabled={!canConvertUnits}
                className="input w-20 shrink-0"
              >
                {unitOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {canConvertUnits && calcUnit !== baseUnitKey && (
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Formulation is authored in {formulation.baseUnit} — auto-converted to {calcUnit}.
              </span>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Batch Number</span>
            <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Entered By</span>
            <input value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Checked By</span>
            <input value={checkedBy} onChange={(e) => setCheckedBy(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Calculation Date</span>
            <input type="date" value={calcDate} onChange={(e) => setCalcDate(e.target.value)} className="input" />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-2 py-2">No.</th>
                <th className="px-2 py-2">Ingredient</th>
                <th className="px-2 py-2">Controlled % w/w</th>
                <th className="px-2 py-2">Calculated Qty ({calcUnit})</th>
                <th className="px-2 py-2">Rounded Qty ({calcUnit})</th>
                <th className="px-2 py-2">Tolerance %</th>
                <th className="px-2 py-2">Min Qty</th>
                <th className="px-2 py-2">Max Qty</th>
              </tr>
            </thead>
            <tbody>
              {batchRows.map((r, i) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5 text-foreground">{r.ingredientName}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{(r.pctWw * 100).toFixed(4)}%</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.calculatedQty.toFixed(3)}</td>
                  <td className="px-2 py-1.5 text-foreground">{r.roundedQty.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.tolerancePct.toFixed(2)}%</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.minQty.toFixed(3)}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.maxQty.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-primary/10 font-semibold text-foreground">
                <td colSpan={4} className="px-2 py-2 text-right">
                  TOTAL
                </td>
                <td className="px-2 py-2">{batchTotal.toFixed(2)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
