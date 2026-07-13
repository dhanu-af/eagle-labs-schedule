"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFormulation, updateFormulation, type IngredientInput } from "@/lib/actions/formulation-actions";

type Folder = { id: string; name: string };

type Row = IngredientInput & { key: string };

let keySeq = 0;
function newRow(): Row {
  keySeq += 1;
  return {
    key: `row-${keySeq}`,
    rmNumber: "",
    ingredientName: "",
    uin: "",
    baseQty: 0,
    controlStatus: "Approved",
    changeControlRef: "",
    approvedBy: "",
    comments: "",
    tolerancePct: 2,
  };
}

export default function FormulationForm({
  folders,
  defaultFolderId,
  existing,
}: {
  folders: Folder[];
  defaultFolderId?: string;
  existing?: {
    id: string;
    productName: string;
    folderId: string;
    baseUnit: string;
    ingredients: IngredientInput[];
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [folderId, setFolderId] = useState(existing?.folderId ?? defaultFolderId ?? folders[0]?.id ?? "");
  const [productName, setProductName] = useState(existing?.productName ?? "");
  const [baseUnit, setBaseUnit] = useState(existing?.baseUnit ?? "kg");
  const [rows, setRows] = useState<Row[]>(() =>
    existing && existing.ingredients.length > 0
      ? existing.ingredients.map((ing) => ({ ...ing, key: `row-${keySeq++}` }))
      : [newRow()]
  );

  const totalQty = useMemo(() => rows.reduce((s, r) => s + (Number(r.baseQty) || 0), 0), [rows]);

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function submit() {
    setError(null);
    if (!productName.trim()) return setError("Product name is required");
    if (!folderId) return setError("Choose a folder");
    if (rows.length === 0) return setError("Add at least one ingredient");
    if (rows.some((r) => !r.ingredientName.trim())) return setError("Every ingredient needs a name");

    const payload = {
      folderId,
      productName: productName.trim(),
      baseBatchSize: totalQty,
      baseUnit,
      ingredients: rows.map(({ key, ...rest }) => ({
        ...rest,
        baseQty: Number(rest.baseQty) || 0,
        tolerancePct: Number(rest.tolerancePct) || 0,
      })),
    };

    startTransition(async () => {
      try {
        if (existing) {
          await updateFormulation(existing.id, payload);
          router.push(`/formulation-checker/${existing.id}`);
        } else {
          const created = await createFormulation(payload);
          router.push(`/formulation-checker/${created.id}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="card-shadow rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Master Formulation — Controlled Percentage Basis</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Product Name</span>
            <input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. Bladder AU"
              className="input"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Folder</span>
            <select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="input">
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Unit</span>
            <input value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} className="input" />
          </label>
        </div>
      </div>

      <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-2 py-2">No.</th>
              <th className="px-2 py-2">RM Number</th>
              <th className="px-2 py-2">Ingredient / AAN</th>
              <th className="px-2 py-2">UIN</th>
              <th className="px-2 py-2">Base Qty ({baseUnit})</th>
              <th className="px-2 py-2">% w/w</th>
              <th className="px-2 py-2">Tolerance %</th>
              <th className="px-2 py-2">Control Status</th>
              <th className="px-2 py-2">Change Control Ref</th>
              <th className="px-2 py-2">Approved By</th>
              <th className="px-2 py-2">Comments</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const qty = Number(r.baseQty) || 0;
              const pctWw = totalQty > 0 ? (qty / totalQty) * 100 : 0;
              return (
                <tr key={r.key} className="border-b border-border last:border-0">
                  <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <input value={r.rmNumber ?? ""} onChange={(e) => updateRow(r.key, { rmNumber: e.target.value })} className="input w-24" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={r.ingredientName} onChange={(e) => updateRow(r.key, { ingredientName: e.target.value })} className="input w-40" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={r.uin ?? ""} onChange={(e) => updateRow(r.key, { uin: e.target.value })} className="input w-20" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.001"
                      value={r.baseQty}
                      onChange={(e) => updateRow(r.key, { baseQty: Number(e.target.value) })}
                      className="input w-24"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{pctWw.toFixed(4)}%</td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      step="0.1"
                      value={r.tolerancePct}
                      onChange={(e) => updateRow(r.key, { tolerancePct: Number(e.target.value) })}
                      className="input w-16"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={r.controlStatus ?? ""} onChange={(e) => updateRow(r.key, { controlStatus: e.target.value })} className="input w-24" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={r.changeControlRef ?? ""} onChange={(e) => updateRow(r.key, { changeControlRef: e.target.value })} className="input w-24" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={r.approvedBy ?? ""} onChange={(e) => updateRow(r.key, { approvedBy: e.target.value })} className="input w-24" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={r.comments ?? ""} onChange={(e) => updateRow(r.key, { comments: e.target.value })} className="input w-32" />
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => removeRow(r.key)} className="text-xs text-danger hover:opacity-80">
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-primary/10 font-semibold text-foreground">
              <td colSpan={4} className="px-2 py-2 text-right">
                TOTAL
              </td>
              <td className="px-2 py-2">{totalQty.toFixed(3)}</td>
              <td className="px-2 py-2">{totalQty > 0 ? "100.0000%" : "—"}</td>
              <td colSpan={6}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button onClick={addRow} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
        + Add Ingredient
      </button>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-surface-muted"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save Formulation"}
        </button>
      </div>
    </div>
  );
}
