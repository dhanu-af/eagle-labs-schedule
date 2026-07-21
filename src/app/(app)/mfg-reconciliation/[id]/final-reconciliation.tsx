"use client";

import { Card } from "@/components/ui/Card";
import { computeFinalReconciliationChecks, type ReconciliationCheck } from "@/lib/mfg-reconciliation-defaults";
import type { BlendingData } from "./blending-section";
import type { EncapsulationData } from "./encapsulation-section";
import type { BottlingData } from "./bottling-section";

function CheckRow({ check }: { check: ReconciliationCheck }) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border py-2 first:border-0 first:pt-0">
      <span className="text-sm text-foreground">{check.label}</span>
      <div className="flex items-center gap-2">
        {check.limitLabel && <span className="text-xs text-muted-foreground">{check.limitLabel}</span>}
        <span className="w-16 text-right text-sm font-medium tabular-nums text-foreground">{check.pct !== null ? `${check.pct.toFixed(1)}%` : "—"}</span>
        {check.pass !== null && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${check.pass ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {check.pass ? "Pass" : "Fail"}
          </span>
        )}
      </div>
    </div>
  );
}

/** Every reconciliation %% check from every stage that has one, in one place -- so a reviewer can see
 * the whole batch's health at a glance without clicking through all 8 stage tabs. The web page and the
 * PDF export both call computeFinalReconciliationChecks so the two views can never drift apart. */
export default function FinalReconciliation({
  blending,
  encapsulation,
  bottling,
}: {
  blending: BlendingData | null;
  encapsulation: EncapsulationData | null;
  bottling: BottlingData | null;
}) {
  const checks = computeFinalReconciliationChecks(blending, encapsulation, bottling);
  const scored = checks.filter((c) => c.pass !== null);
  const failing = scored.filter((c) => !c.pass);

  if (checks.length === 0) {
    return null;
  }

  return (
    <Card padding="md">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Final Reconciliation</p>
        {scored.length > 0 && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${failing.length === 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {failing.length === 0 ? `All ${scored.length} checks passing` : `${failing.length} of ${scored.length} checks failing`}
          </span>
        )}
      </div>
      <div>
        {checks.map((c) => (
          <CheckRow key={c.label} check={c} />
        ))}
      </div>
    </Card>
  );
}
