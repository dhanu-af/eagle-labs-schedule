"use client";

import { useEffect, useState } from "react";
import { findIngredientLibraryMatch } from "@/lib/actions/ingredient-actions";
import type { Ingredient as IngredientDetail } from "@/generated/prisma";

const AUTHORITY_ROWS: { key: keyof IngredientDetail; label: string }[] = [
  { key: "tgaStatus", label: "🇦🇺 TGA" },
  { key: "apvmaStatus", label: "🇦🇺 APVMA" },
  { key: "fdaStatus", label: "🇺🇸 FDA" },
  { key: "emaStatus", label: "🇪🇺 EMA" },
  { key: "aicisStatus", label: "AICIS" },
];

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <p className="text-sm text-foreground">
      <span className="font-medium">{label}: </span>
      <span className="text-muted-foreground">{value}</span>
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 border-t border-border pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function hasAny(...values: (string | null | undefined)[]) {
  return values.some((v) => !!v);
}

export default function FormulationIngredientModal({
  ingredientName,
  onClose,
}: {
  ingredientName: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "unauthorized" }
    | { status: "not-found" }
    | { status: "found"; ingredient: NonNullable<IngredientDetail> }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    findIngredientLibraryMatch(ingredientName).then((result) => {
      if (cancelled) return;
      if (!result.authorized) setState({ status: "unauthorized" });
      else if (!result.ingredient) setState({ status: "not-found" });
      else setState({ status: "found", ingredient: result.ingredient });
    });
    return () => {
      cancelled = true;
    };
  }, [ingredientName]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{ingredientName}</h2>
          <button onClick={onClose} className="text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground">
            ✕
          </button>
        </div>

        {state.status === "loading" && <p className="text-sm text-muted-foreground">Looking up Ingredient Library entry…</p>}

        {state.status === "unauthorized" && (
          <p className="text-sm text-muted-foreground">
            You don&apos;t have access to the Ingredient Library. Ask a Super Admin to grant access if you need to see ingredient details.
          </p>
        )}

        {state.status === "not-found" && (
          <p className="text-sm text-muted-foreground">
            No matching entry found in the Ingredient Library for &quot;{ingredientName}&quot;.
          </p>
        )}

        {state.status === "found" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
                {state.ingredient.type}
              </span>
              {state.ingredient.category && (
                <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {state.ingredient.category}
                </span>
              )}
              {state.ingredient.verified ? (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  ✓ Verified
                </span>
              ) : (
                <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                  🟡 Not Yet Verified
                </span>
              )}
            </div>

            {state.ingredient.mainBenefit && (
              <p className="text-sm text-foreground">
                <span className="font-medium">Main benefit: </span>
                {state.ingredient.mainBenefit}
              </p>
            )}
            {state.ingredient.usedFor && (
              <p className="text-sm text-foreground">
                <span className="font-medium">Used for: </span>
                <span className="text-muted-foreground">{state.ingredient.usedFor}</span>
              </p>
            )}

            <Section title="General Information">
              <DetailRow label="Chemical name" value={state.ingredient.chemicalName} />
              <DetailRow label={state.ingredient.aanLabel ?? "AAN / AHN"} value={state.ingredient.aanValue} />
              <DetailRow label="CAS number" value={state.ingredient.casNumber} />
              <DetailRow label="Formula" value={state.ingredient.molecularFormula} />
              <DetailRow label="Molecular weight" value={state.ingredient.molecularWeight} />
              <DetailRow label="Synonyms" value={state.ingredient.synonyms} />
            </Section>

            <Section title="Regulatory Status">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-3 font-medium">Authority</th>
                      <th className="py-1 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AUTHORITY_ROWS.map((row) => (
                      <tr key={row.key} className="border-t border-border/60">
                        <td className="py-1 pr-3 text-foreground">{row.label}</td>
                        <td className="py-1 text-muted-foreground">
                          {(state.ingredient[row.key] as string | null) ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DetailRow label="Summary" value={state.ingredient.regulatoryStatus} />
            </Section>

            {state.ingredient.notes && (
              <Section title="Benefits / Function">
                <p className="text-sm text-muted-foreground">{state.ingredient.notes}</p>
              </Section>
            )}

            <DetailRow label="Typical dosage / use level" value={state.ingredient.typicalDosage} />
            <DetailRow label="Storage conditions" value={state.ingredient.storageConditions} />
            <DetailRow label="Shelf life" value={state.ingredient.shelfLife} />

            {hasAny(
              state.ingredient.safetyNotes,
              state.ingredient.ghsClassification,
              state.ingredient.signalWord,
              state.ingredient.ppe,
              state.ingredient.handlingPrecautions
            ) && (
              <Section title="Safety">
                <DetailRow label="Safety & handling" value={state.ingredient.safetyNotes} />
                <DetailRow label="GHS classification" value={state.ingredient.ghsClassification} />
                <DetailRow label="Signal word" value={state.ingredient.signalWord} />
                <DetailRow label="PPE" value={state.ingredient.ppe} />
                <DetailRow label="Handling precautions" value={state.ingredient.handlingPrecautions} />
              </Section>
            )}

            {hasAny(
              state.ingredient.qcNotes,
              state.ingredient.qcIdentity,
              state.ingredient.qcAssay,
              state.ingredient.qcMoisture,
              state.ingredient.qcHeavyMetals,
              state.ingredient.qcMicrobialLimits
            ) && (
              <Section title="Quality Specifications">
                <DetailRow label="Identity" value={state.ingredient.qcIdentity} />
                <DetailRow label="Assay" value={state.ingredient.qcAssay} />
                <DetailRow label="Moisture" value={state.ingredient.qcMoisture} />
                <DetailRow label="Heavy metals" value={state.ingredient.qcHeavyMetals} />
                <DetailRow label="Microbial limits" value={state.ingredient.qcMicrobialLimits} />
                <DetailRow label="Other QC / CoA parameters" value={state.ingredient.qcNotes} />
              </Section>
            )}

            {hasAny(
              state.ingredient.appearance,
              state.ingredient.colour,
              state.ingredient.odour,
              state.ingredient.solubility,
              state.ingredient.density,
              state.ingredient.meltingPoint,
              state.ingredient.phValue
            ) && (
              <Section title="Physical Properties">
                <DetailRow label="Appearance" value={state.ingredient.appearance} />
                <DetailRow label="Colour" value={state.ingredient.colour} />
                <DetailRow label="Odour" value={state.ingredient.odour} />
                <DetailRow label="Solubility" value={state.ingredient.solubility} />
                <DetailRow label="Density" value={state.ingredient.density} />
                <DetailRow label="Melting point" value={state.ingredient.meltingPoint} />
                <DetailRow label="pH" value={state.ingredient.phValue} />
              </Section>
            )}

            <DetailRow label="FAQ" value={state.ingredient.faq} />
            {state.ingredient.source && <p className="text-xs text-muted-foreground">Source: {state.ingredient.source}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
